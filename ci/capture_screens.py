#!/usr/bin/env python3
#
# capture_screens.py - regenerate the screen captures on the website
#
# Author:  Sandesh Ghimire <sandesh@soccentric.com>
#
# The desktop captures in assets/shots/ are made by running the real
# applications; the terminal captures are made from the terminal blocks in
# index.html with a real browser, so the picture and the live page never drift
# apart. Three files come from screen sessions that need a board or a
# simulator and are kept by hand:
#
#   bootloader-gui.webp   BOOT Flasher, Applications page
#   validation-gui.webp   HWVAL Studio, test catalogue
#   factory-station.webp  HWVAL Factory, four fixtures running
#
# Requirements: python3 with Pillow, a Chromium binary, and Xvfb plus PySide6
# for the desktop capture. Screenshots are written next to the page.
#
#   python3 ci/capture_screens.py all
#   python3 ci/capture_screens.py terminals
#   python3 ci/capture_screens.py factory-data
#

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "assets" / "shots"
SCRATCH = ROOT / ".capture-tmp"
WORKSPACE = ROOT.parent

# Terminal pictures use the same 8:5 stage as the desktop captures so the
# hero showcase never changes height when a visitor picks another screen.
TERM_W, TERM_H = 900, 563
SCALE = 2

TERMINAL_IDS = [
    "bootloader",
    "app-c",
    "app-zephyr",
    "rust-embassy",
    "rust-freertos",
    "rust-zephyr",
    "validation",
    "factory-firmware",
]


def chromium() -> str:
    for name in ("chromium", "chromium-browser", "google-chrome", "chrome"):
        path = shutil.which(name)
        if path:
            return path
    sys.exit("capture_screens: no Chromium binary found")


def shoot(page: Path, out: Path, width: int, height: int) -> Path:
    """Screenshot one page at 2x; Chromium is sandboxed, so write inside the tree."""
    png = SCRATCH / (out.stem + ".png")
    subprocess.run(
        [
            chromium(),
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--hide-scrollbars",
            "--allow-file-access-from-files",
            f"--force-device-scale-factor={SCALE}",
            f"--window-size={width},{height}",
            "--virtual-time-budget=5000",
            f"--screenshot={png}",
            page.as_uri(),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    from PIL import Image

    image = Image.open(png)
    if image.size != (width * SCALE, height * SCALE):
        image = image.crop((0, 0, width * SCALE, height * SCALE))
    return image


def terminal_block(page: str, sid: str) -> str:
    """Return the balanced <div class="term"> block of a section."""
    for chunk in re.split(r"(?=<section )", page):
        match = re.match(r'<section[^>]*id="([^"]+)"', chunk)
        if not match or match.group(1) != sid:
            continue
        start = chunk.find('<div class="term">')
        if start < 0:
            raise SystemExit(f"capture_screens: #{sid} has no terminal")
        depth = 0
        for token in re.finditer(r"<div\b|</div>", chunk[start:]):
            depth += 1 if token.group() == "<div" else -1
            if depth == 0:
                return chunk[start:start + token.end()]
    raise SystemExit(f"capture_screens: #{sid} not found")


def strip_title_bar(block: str) -> str:
    """Drop the window bar: the showcase draws its own, themed one."""
    start = block.find('<div class="win-bar">')
    if start < 0:
        return block
    depth = 0
    for token in re.finditer(r"<div\b|</div>", block[start:]):
        depth += 1 if token.group() == "<div" else -1
        if depth == 0:
            return block[:start] + block[start + token.end():]
    return block


def capture_terminals() -> None:
    page = (ROOT / "index.html").read_text(encoding="utf-8")
    SCRATCH.mkdir(exist_ok=True)
    (ROOT / "assets" / "shots").mkdir(parents=True, exist_ok=True)
    for sid in TERMINAL_IDS:
        block = strip_title_bar(terminal_block(page, sid)).replace(
            '<div class="term">', '<div class="term body-only">', 1)
        html = f"""<!doctype html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8">
<link rel="stylesheet" href="{(ROOT / 'assets/style.css').as_uri()}">
<style>
  html, body {{ margin: 0; background: #15171b; }}
  .term {{ width: {TERM_W}px; height: {TERM_H}px; border: 0; border-radius: 0;
          box-shadow: none; background: var(--term-bg); overflow: hidden; }}
  .term .win-bar {{ display: none; }}
  .term .term-body {{ height: 100%; box-sizing: border-box; overflow: hidden;
                     padding: 18px 22px; font-size: 16px; }}
  .term .term-body .ln {{ white-space: pre; }}
  .term .term-body code {{ min-width: 0; }}
  .term .cur {{ animation: none; background: transparent; }}
</style></head>
<body>{block}</body></html>"""
        source = SCRATCH / f"term-{sid}.html"
        source.write_text(html, encoding="utf-8")
        image = shoot(source, SHOTS / f"term-{sid}.webp", TERM_W, TERM_H)
        image.convert("RGB").save(SHOTS / f"term-{sid}.webp", "WEBP",
                                  quality=82, method=6)
        print(f"  {sid:20s} {TERM_W * SCALE}x{TERM_H * SCALE}")


FACTORY_DATA_DRIVER = r'''
import shutil, sys
from pathlib import Path
repo, out = Path(sys.argv[1]), Path(sys.argv[2])
sys.path.insert(0, str(repo))
from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QApplication
from gui import theme
from gui.window import MainWindow

app = QApplication([])
app.setStyle("Fusion")
app.setFont(theme.ui_font())
window = MainWindow()
window.resize(1360, 860)
window.show()

def stage():
    page = window.pages[0]                      # System info
    window.switch_page(0)
    page.csv_edit.setText("examples/sys.csv")
    page.out_edit.setText("out")
    page.reload()
    page.run_all()

def grab():
    window.grab().save(str(out))
    shutil.rmtree(repo / "out", ignore_errors=True)
    app.quit()

QTimer.singleShot(1200, stage)
QTimer.singleShot(3000, grab)
sys.exit(app.exec())
'''


def capture_factory_data() -> None:
    repo = WORKSPACE / "factory-data-gui"
    if not (repo / "factory_data_gui.py").is_file():
        print("  factory-data-gui: not checked out, skipped")
        return
    SCRATCH.mkdir(exist_ok=True)
    driver = SCRATCH / "factory_data_shot.py"
    driver.write_text(FACTORY_DATA_DRIVER, encoding="utf-8")
    png = SCRATCH / "factory-data-gui.png"
    subprocess.run(
        ["xvfb-run", "-a", "-s", "-screen 0 1920x1200x24",
         sys.executable, str(driver), str(repo), str(png)],
        check=True, cwd=repo,
        env={**os.environ, "QT_QPA_PLATFORM": "xcb"},
    )
    from PIL import Image

    image = Image.open(png).convert("RGB")
    image.save(SHOTS / "factory-data-gui.webp", "WEBP", quality=82, method=6)
    print(f"  factory-data-gui     {image.width}x{image.height}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("what", nargs="?", default="all",
                        choices=["all", "terminals", "factory-data"])
    args = parser.parse_args()

    print("capturing screens")
    if args.what in ("all", "factory-data"):
        capture_factory_data()
    if args.what in ("all", "terminals"):
        capture_terminals()
    for path in sorted(SHOTS.glob("*.webp")):
        print(f"  {path.stat().st_size / 1024:6.0f} KB  {path.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
