#!/usr/bin/env python3
#
# capture_screens.py - regenerate the real screen captures on the website
#
# Author:  Sandesh Ghimire <sandesh@soccentric.com>
#
# Every picture comes from the real thing:
#
#   * the desktop captures run the real applications under Xvfb, on a clean
#     profile, with serial ports hidden so a bench board is never touched;
#   * the terminal captures open a real kitty window under Xvfb and print the
#     recorded board output in assets/logs/ (UART logs recorded from the
#     NUCLEO-F767ZI), then take a screenshot of that window.
#
# Requirements: python3 with Pillow and pyserial, Xvfb (xvfb-run), xwd, kitty,
# PySide6 for the applications, and Chromium for the social preview.
#
#   python3 ci/capture_screens.py all
#   python3 ci/capture_screens.py gui | terminals | og
#

from __future__ import annotations

import argparse
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "assets" / "shots"
LOGS = ROOT / "assets" / "logs"
SCRATCH = ROOT / ".capture-tmp"
# The website repository sits in <workspace>/website/<name>.
WORKSPACE = ROOT.parent.parent

TERM_W, TERM_H = 1800, 1126
GUI_W, GUI_H = 1360, 860
TERMINALS = [
    "bootloader", "app-c", "app-zephyr", "rust-embassy", "rust-freertos",
    "rust-zephyr", "validation", "factory-firmware",
]

# Runs inside the application: pick the page that tells the story.
HOOK_BOOT = r'''
from PySide6.QtWidgets import QWidget
w.switch_page(1)
for t in w.findChildren(QWidget):
    if type(t).__name__ == "TerminalPanel":
        t.show(); t.stop("Recorded from the board")
        t.feed(open(LOG).read())
'''
HOOK_STUDIO = r'''
from PySide6.QtWidgets import QWidget
for t in w.findChildren(QWidget):
    if type(t).__name__ == "TerminalPanel":
        t.hide()
w.statusBar().hide()
w._connect_port("simulator:hwval")
def go():
    w._select_key("group:ADC")
    QTimer.singleShot(1000, lambda: w.tests_page.run_group())
QTimer.singleShot(2500, go)
'''
HOOK_STATION = r'''
from PySide6.QtWidgets import QWidget
for t in w.findChildren(QWidget):
    if type(t).__name__ == "TerminalPanel":
        t.hide()
w._show_section("validation")
w.bench_pages["detect"].on_shown()
QTimer.singleShot(800, lambda: w.bench_pages["validation"].run())
'''
HOOK_DATA = r'''
from PySide6.QtWidgets import QLabel
for label in w.findChildren(QLabel):
    if label.text().startswith("/"):
        label.setText("artifacts")
w.switch_page(0)
page = w.pages[0]
page.csv_edit.setText("examples/sys.csv")
page.out_edit.setText("out")
page.reload()
page.run_all()
'''

# Wraps an application's own entry point: after it shows its window, size
# it, run the hook, wait, grab the window and quit.
DRIVER = r'''
import os, runpy, sys
from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QApplication
out, delay, hook, mode = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
width, height = int(sys.argv[5]), int(sys.argv[6])
sys.argv = sys.argv[7:]
LOG = os.environ.get("CAPTURE_LOG", "")
import serial.tools.list_ports as lp
lp.comports = lambda *a, **k: []
real_exec = QApplication.exec
def fake_exec(*a):
    def top():
        shown = [x for x in QApplication.topLevelWidgets()
                 if x.isVisible() and x.width() > 300]
        return max(shown, key=lambda x: x.width() * x.height())
    def stage():
        w = top(); w.resize(width, height)
        def grab():
            top().grab().save(out)
            os._exit(0)
        QTimer.singleShot(delay, grab)
        try:
            exec(open(hook).read(), {"w": w, "QTimer": QTimer, "LOG": LOG})
        except Exception as error:
            print("capture hook failed:", error, file=sys.stderr)
    QTimer.singleShot(2500, stage)
    return real_exec(*a)
QApplication.exec = staticmethod(fake_exec)
sys.path.insert(0, os.getcwd())
if mode == "script":
    runpy.run_path(sys.argv[0], run_name="__main__")
else:
    runpy.run_module(sys.argv[0], run_name="__main__")
'''

# The factory data app has no start-up dialog to wait for in this form, so it
# is launched through its own window class.
DATA_MAIN = """
from PySide6.QtWidgets import QApplication
from gui import theme
from gui.window import MainWindow
app = QApplication([])
app.setStyle("Fusion")
app.setFont(theme.ui_font())
window = MainWindow()
window.show()
app.exec()
"""

APPS = [
    # name, repo dir, python, mode, target, extra args, hook, delay ms
    ("bootloader-gui", "bootloader/bootloader-gui", "python3", "script",
     "flash_gui.py", [], HOOK_BOOT, 1500),
    ("validation-gui", "validation/validation-gui", ".venv/bin/python",
     "module", "hwval_studio", ["--simulate", "hwval"], HOOK_STUDIO, 9000),
    ("factory-station", "factory/factory-station", ".venv/bin/python",
     "module", "hwval_factory", ["--simulate"], HOOK_STATION, 5000),
    ("factory-data-gui", "factory/factory-data-gui", "python3", "script",
     "@data_main.py", [], HOOK_DATA, 3000),
]


def xwd_to_image(path: Path):
    """Read an xwd dump (32-bit ZPixmap) into a Pillow image."""
    from PIL import Image

    raw = path.read_bytes()
    head = struct.unpack(">25I", raw[:100])
    header_size, width, height = head[0], head[4], head[5]
    bits, per_line, colours = head[11], head[12], head[19]
    if bits != 32:
        sys.exit(f"capture_screens: unsupported xwd depth {bits}")
    start = header_size + colours * 12
    data = raw[start:start + per_line * height]
    image = Image.frombuffer("RGBA", (per_line // 4, height), data,
                             "raw", "BGRA", 0, 1).convert("RGB")
    return image.crop((0, 0, width, height))


def save_webp(image, name: str) -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(SHOTS / name, "WEBP", quality=84, method=6)
    print(f"  {name:28s} {image.width}x{image.height}")


def capture_gui(only: str = "") -> None:
    from PIL import Image

    SCRATCH.mkdir(exist_ok=True)
    driver = SCRATCH / "driver.py"
    driver.write_text(DRIVER, encoding="utf-8")
    for name, rel, python, mode, target, extra, hook, delay in APPS:
        if only and only != name:
            continue
        repo = WORKSPACE / rel
        if not repo.is_dir():
            print(f"  {name}: not checked out, skipped")
            continue
        hook_file = SCRATCH / f"hook-{name}.py"
        hook_file.write_text(hook, encoding="utf-8")
        png = SCRATCH / f"{name}.png"
        profile = Path(tempfile.mkdtemp(prefix="shot-profile-"))
        env = {
            **os.environ,
            "QT_QPA_PLATFORM": "xcb",
            "XDG_CONFIG_HOME": str(profile / "config"),
            "XDG_DATA_HOME": str(profile / "data"),
            "XDG_CACHE_HOME": str(profile / "cache"),
            "CAPTURE_LOG": str(LOGS / "app-c.log"),
            "PYTHONPATH": str(repo / "src") if (repo / "src").is_dir() else "",
        }
        if target.startswith("@"):
            target = str(SCRATCH / target[1:])
            Path(target).write_text(DATA_MAIN, encoding="utf-8")
        py = repo / python if python.startswith(".") else python
        subprocess.run(
            ["xvfb-run", "-a", "-s", "-screen 0 1600x1000x24", str(py),
             str(driver), str(png), str(delay), str(hook_file), mode,
             str(GUI_W), str(GUI_H), target, *extra],
            check=True, cwd=repo, env=env, timeout=120,
            stdout=subprocess.DEVNULL,
        )
        shutil.rmtree(profile, ignore_errors=True)
        if name == "factory-data-gui":
            shutil.rmtree(repo / "out", ignore_errors=True)
        save_webp(Image.open(png), f"{name}.webp")


TERM_SCRIPT = """#!/bin/bash
printf '\\033[2J\\033[H'
cat "$1"
sleep 6
"""


def capture_terminals() -> None:
    """Show each recorded log in a real kitty window and photograph it."""
    if not shutil.which("kitty"):
        sys.exit("capture_screens: kitty is required for the terminal captures")
    SCRATCH.mkdir(exist_ok=True)
    runner = SCRATCH / "show-log.sh"
    runner.write_text(TERM_SCRIPT, encoding="utf-8")
    runner.chmod(0o755)
    for sid in TERMINALS:
        dump = SCRATCH / f"term-{sid}.xwd"
        shell = (
            f"kitty -o initial_window_width={TERM_W} "
            f"-o initial_window_height={TERM_H} -o remember_window_size=no "
            "-o font_size=26 -o background=#15171b -o foreground=#d7dae0 "
            "-o window_padding_width=34 -o confirm_os_window_close=0 "
            "-o hide_window_decorations=yes -o cursor_blink_interval=0 "
            f"{runner} {LOGS / (sid + '.log')} & "
            f"sleep 3; xwd -root -silent -out {dump}; kill %1"
        )
        subprocess.run(
            ["xvfb-run", "-a", "-s", f"-screen 0 {TERM_W}x{TERM_H}x24",
             "bash", "-c", shell],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        save_webp(xwd_to_image(dump), f"term-{sid}.webp")


def capture_og() -> None:
    """The social preview: the live hero at 1600x900, scaled to 1200x630."""
    from PIL import Image

    chromium = next((p for n in ("chromium", "chromium-browser",
                                 "google-chrome") if (p := shutil.which(n))), "")
    if not chromium:
        print("  og.png: no Chromium, skipped")
        return
    SCRATCH.mkdir(exist_ok=True)
    png = SCRATCH / "og.png"
    subprocess.run(
        [chromium, "--headless=new", "--no-sandbox", "--disable-gpu",
         "--hide-scrollbars", "--allow-file-access-from-files",
         "--force-prefers-reduced-motion", "--window-size=1600,900",
         "--virtual-time-budget=5000", f"--screenshot={png}",
         (ROOT / "index.html").as_uri()],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    image = Image.open(png).convert("RGB").resize((1200, 675), Image.LANCZOS)
    image.crop((0, 0, 1200, 630)).save(ROOT / "assets" / "og.png", "PNG",
                                       optimize=True)
    print("  og.png                       1200x630")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("what", nargs="?", default="all",
                        choices=["all", "gui", "terminals", "og"])
    args = parser.parse_args()
    print("capturing screens")
    if args.what in ("all", "gui"):
        capture_gui()
    if args.what in ("all", "terminals"):
        capture_terminals()
    if args.what in ("all", "og"):
        capture_og()
    return 0


if __name__ == "__main__":
    sys.exit(main())
