#!/usr/bin/env python3
#
# check_site.py - static checks for the SoCcentric STM32 website
#
# Author:  Sandesh Ghimire <sandesh@soccentric.com>
#
# Runs without third-party packages so it can be the repository's build step:
#
#   make check        (or: python3 ci/check_site.py)
#
# It verifies that the pages parse, that every local link and asset resolves,
# that fragment links land on an id, that ids are unique, that images describe
# themselves, and that the head carries the metadata the site relies on. It
# also prints the weight of the page so a heavy screenshot is noticed early.
#

from __future__ import annotations

import sys
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "404.html"]
PAGE_HEAD = {
    "description": "a meta description",
    "viewport": "a viewport meta tag",
    "canonical": "a canonical link",
}
MAX_PAGE_BYTES = 2 * 1024 * 1024

errors: list[str] = []
warnings: list[str] = []
checked: set[str] = set()


class Page(HTMLParser):
    """Collect ids, links, images and head metadata from one page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[tuple[str, int]] = []
        self.refs: list[tuple[str, str, int]] = []   # kind, value, line
        self.images: list[dict] = []
        self.meta: dict[str, bool] = {}
        self.title: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        line = self.getpos()[0]
        if "id" in attr:
            self.ids.append((attr["id"], line))
        if tag == "a" and attr.get("href"):
            self.refs.append(("href", attr["href"], line))
        if tag == "link" and attr.get("href"):
            self.refs.append(("href", attr["href"], line))
            rel = attr.get("rel", "")
            if rel == "canonical":
                self.meta["canonical"] = True
        if tag in ("img", "script", "source") and attr.get("src"):
            self.refs.append(("src", attr["src"], line))
        if tag == "img":
            self.images.append({"alt": attr.get("alt"), "src": attr.get("src", ""),
                                "line": line})
        if tag == "meta" and attr.get("name") == "description":
            self.meta["description"] = bool(attr.get("content"))
        if tag == "meta" and attr.get("name") == "viewport":
            self.meta["viewport"] = True
        if tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title.append(data)


def local_path(ref: str) -> tuple[str, str] | None:
    """Split a local reference into (path, fragment); None for external URLs."""
    parts = urlsplit(ref)
    if parts.scheme or parts.netloc:
        return None
    # 404.html uses root-absolute paths, which GitHub Pages serves from the
    # repository root; resolve them the same way here.
    return unquote(parts.path).lstrip("/"), parts.fragment


def check_page(name: str) -> Page:
    path = ROOT / name
    if not path.is_file():
        errors.append(f"{name}: missing")
        return Page()
    raw = path.read_text(encoding="utf-8")
    if len(raw.encode()) > MAX_PAGE_BYTES:
        errors.append(f"{name}: {len(raw) / 1024:.0f} KB is over the {MAX_PAGE_BYTES // 1024} KB budget")
    page = Page()
    page.feed(raw)
    page.close()

    ids = [i for i, _ in page.ids]
    for ident in sorted({i for i in ids if ids.count(i) > 1}):
        errors.append(f"{name}: duplicate id #{ident}")
    checked.add(name)

    if not "".join(page.title).strip():
        errors.append(f"{name}: empty <title>")
    if name == "index.html":
        for key, label in PAGE_HEAD.items():
            if not page.meta.get(key):
                warnings.append(f"{name}: no {label}")

    for kind, ref, line in page.refs:
        if ref.startswith(("mailto:", "tel:", "data:", "javascript:")):
            continue
        local = local_path(ref)
        if local is None:
            continue
        target, fragment = local
        if fragment and not target and not ref.startswith("#"):
            target = "index.html"          # "/#contact" returns to the root page
        if target and not (ROOT / target).exists():
            errors.append(f"{name}:{line}: {kind} {ref!r} does not exist")
            continue
        if fragment and target in ("", name):
            if fragment not in ids and fragment != "top":
                errors.append(f"{name}:{line}: fragment #{fragment} has no id")
        elif fragment and target:
            other = ROOT / target
            if other.suffix in (".html", "") and other.is_file():
                sub = Page()
                sub.feed(other.read_text(encoding="utf-8"))
                if fragment not in [i for i, _ in sub.ids]:
                    errors.append(f"{name}:{line}: #{fragment} is not in {target}")
        if target and re.search(r"\s", target):
            errors.append(f"{name}:{line}: {ref!r} contains whitespace")

    for image in page.images:
        if not image["src"]:
            errors.append(f"{name}:{image['line']}: <img> without src")
        elif image["alt"] is None:
            warnings.append(f"{name}:{image['line']}: <img {image['src']}> has no alt")
    return page


def weight() -> None:
    root_files = [ROOT / p for p in PAGES]
    assets = [p for p in (ROOT / "assets").rglob("*") if p.is_file()]
    total = sum(p.stat().st_size for p in root_files + assets)
    print(f"\npage weight: {total / 1024:.0f} KB "
          f"({len(assets)} assets, {len(root_files)} pages)")
    biggest = sorted(assets, key=lambda p: p.stat().st_size, reverse=True)[:6]
    for path in biggest:
        print(f"  {path.stat().st_size / 1024:6.0f} KB  {path.relative_to(ROOT)}")


def main() -> int:
    pages = {name: check_page(name) for name in PAGES}

    # every screen capture the pages link to should exist, and every capture in
    # assets/shots should be used by at least one page
    shots = sorted((ROOT / "assets/shots").glob("*"))
    referenced: set[Path] = set()
    for name, page in pages.items():
        for kind, ref, _ in page.refs:
            if kind != "src":
                continue
            local = local_path(ref)
            if local and local[0]:
                referenced.add((ROOT / local[0]).resolve())
    for shot in shots:
        if shot.suffix not in (".webp", ".png", ".jpg", ".svg"):
            continue
        if shot.resolve() not in referenced:
            warnings.append(f"assets/shots: {shot.name} is not referenced")

    weight()

    for warning in warnings:
        print(f"warning: {warning}")
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        print(f"\n{len(errors)} error(s); the site was not built.", file=sys.stderr)
        return 1
    print(f"\nok: {len(pages)} pages, {len(shots)} captures, "
          f"{len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
