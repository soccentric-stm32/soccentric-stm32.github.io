#!/usr/bin/env python3
#
# record_session.py - record BOOT Flasher and the board's UART log as webm
#
# Author:  Sandesh Ghimire <sandesh@soccentric.com>
#
# Drives the real BOOT Flasher in a virtual display against the real board:
# it flashes BOOT first, then each of the six firmware projects, and records
# every step twice while it runs, so the files read as one set:
#
#   assets/video/bootloader/<name>.webm        the BOOT Flasher window
#   assets/video/bootloader/term-<name>.webm   the UART log, live
#   assets/video/bootloader/<name>.log         the UART log as text
#
# <name> is bootloader, app-c-freertos, app-c-zephyr, app-rust-embassy,
# app-rust-freertos, app-rust-zephyr and validation-firmware.  The UART is
# USART6 on PG14 (115200 8N1), read through a USB serial adapter.
#
# Flashing writes to the board.  The images are the ones already built (the
# GUI signs them with the development key, then uploads them through BOOT);
# a step fails and records the reason if an image is missing or the GUI asks
# for a confirmation, it never confirms for you.
#
# Requirements: Xvfb, ffmpeg with libvpx-vp9, PySide6, pyserial, openocd.
#
#   python3 ci/record_session.py trial            # no flashing: show a reset
#   python3 ci/record_session.py all              # BOOT, then the six apps
#   python3 ci/record_session.py one app-c-zephyr # a single step
#

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "assets" / "video" / "bootloader"
WORKSPACE = next((p for p in ROOT.parents if (p / "repos.yaml").is_file()),
                 ROOT.parent)
GUI_DIR = WORKSPACE / "bootloader" / "bootloader-gui"
BOOT_DIR = WORKSPACE / "bootloader" / "bootloader"

# Screen layout: the flasher on the left, the UART terminal on the right.
GUI_W, TERM_W, HEIGHT = 1100, 620, 900
DISPLAY = ":97"

# (name, page key in the GUI, steps to run)
STEPS = (
    ("bootloader", "boot", ["flash"]),
    ("app-c-freertos", "app-c-freertos", ["sign", "flash"]),
    ("app-c-zephyr", "app-c-zephyr", ["sign", "flash"]),
    ("app-rust-embassy", "app-rust-embassy", ["sign", "flash"]),
    ("app-rust-freertos", "app-rust-freertos", ["sign", "flash"]),
    ("app-rust-zephyr", "app-rust-zephyr", ["sign", "flash"]),
    ("validation-firmware", "validation-firmware", ["sign", "flash"]),
)
TITLES = {
    "bootloader": "BOOT", "app-c-freertos": "C FreeRTOS",
    "app-c-zephyr": "C Zephyr", "app-rust-embassy": "Rust Embassy",
    "app-rust-freertos": "Rust FreeRTOS", "app-rust-zephyr": "Rust Zephyr",
    "validation-firmware": "HWVAL",
}


def inner(args: argparse.Namespace) -> int:
    """Runs inside the virtual display: the GUI, the terminal, the driver."""
    import serial
    from PySide6.QtCore import QProcess, QThread, QTimer, Signal
    from PySide6.QtWidgets import (QApplication, QLabel, QPlainTextEdit,
                                   QVBoxLayout, QWidget)

    sys.path.insert(0, str(GUI_DIR))
    from gui import theme
    from gui.window import MainWindow

    class Reader(QThread):
        line = Signal(str)

        def run(self) -> None:
            port = serial.Serial(args.uart, args.baud, timeout=0.2)
            raw_log = Path(args.log).with_suffix(".raw").open("wb")
            buf = b""
            while not self.isInterruptionRequested():
                chunk = port.read(max(1, port.in_waiting))
                raw_log.write(chunk)
                raw_log.flush()
                buf += chunk
                while b"\n" in buf:
                    raw, buf = buf.split(b"\n", 1)
                    self.line.emit(raw.decode("latin1").rstrip("\r"))

    app = QApplication(sys.argv[:1])
    app.setStyle("Fusion")
    app.setFont(theme.ui_font())
    window = MainWindow()
    window.setGeometry(0, 0, GUI_W, HEIGHT)
    window.show()

    t = theme.current()
    term = QWidget()
    term.setStyleSheet(f"background: {t.console};")
    box = QVBoxLayout(term)
    box.setContentsMargins(0, 0, 0, 0)
    box.setSpacing(0)
    bar = QLabel(f"{args.title} · {Path(args.uart).name} · "
                 f"USART6 {args.baud} 8N1")
    bar.setFont(theme.mono_font())
    bar.setStyleSheet(f"background: {t.sidebar}; color: {t.text_secondary};"
                      " padding: 10px 14px;")
    panel = QPlainTextEdit()
    panel.setReadOnly(True)
    panel.setFont(theme.mono_font())
    panel.setStyleSheet(f"QPlainTextEdit {{ background: {t.console};"
                        f" color: {t.console_text}; border: none;"
                        " padding: 12px; }")
    box.addWidget(bar)
    box.addWidget(panel, 1)
    term.setGeometry(GUI_W, 0, TERM_W, HEIGHT)
    term.show()

    log = Path(args.log).open("w", encoding="utf-8")

    # The PL2303 adapter sometimes re-sends its stale receive buffer, the tail
    # of the previous step, over and over until the board sends something new.
    # Ignore everything before this step's first BOOT start line (every step
    # resets the board), and a line that exactly repeats one of the last few.
    state = {"live": False}
    recent: list[str] = []

    def on_line(text: str) -> None:
        if not state["live"]:
            if "BOOT I start" not in text:
                return
            state["live"] = True
        if text in recent:
            return
        recent.append(text)
        del recent[:-8]
        panel.appendPlainText(text)
        log.write(text + "\n")
        log.flush()

    reader = Reader()
    reader.line.connect(on_line)
    reader.start()

    failure: list[str] = []

    def fail(reason: str) -> None:
        failure.append(reason)
        print("FAILED:", reason, file=sys.stderr)
        QTimer.singleShot(2000, app.quit)

    def finish_after_tail() -> None:
        QTimer.singleShot(int(args.tail * 1000), app.quit)

    def reset_board() -> None:
        subprocess.Popen(["make", "-C", str(BOOT_DIR), "reset"],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if args.mode == "trial":
        for i in range(len(window.pages)):
            QTimer.singleShot(1000 + 1500 * i,
                              lambda i=i: window.switch_page(i))
        QTimer.singleShot(1000 + 1500 * len(window.pages), reset_board)
        QTimer.singleShot(int(args.tail * 1000) + 12000, app.quit)
    else:
        def start() -> None:
            page = next((p for p in window.pages if p.key == args.page), None)
            if page is None:
                return fail(f"no page {args.page}")
            window.switch_page(window.pages.index(page))
            if hasattr(page, "project"):
                # Ignore an image name left in the saved GUI settings.
                page.image_edit.setText(page.project.image)
            window.pages[0].container_switch.setChecked(False)
            # A confirmation never gets an automatic yes: record it and stop.
            window.confirm = lambda title, text, *a, **k: (
                fail(f"asked '{title}': {text[:120]}") or False)
            window.error = lambda title, text, *a, **k: fail(
                f"{title}: {text[:120]}")
            # An application that does not answer HWLINK is first caught in
            # BOOT's listen window (Board > Recover Board into BOOT).
            stage = ["start" if args.page == "boot" else "recover"]
            tries = [0]
            deadline = [time.time() + args.timeout]

            def poll() -> None:
                if failure:
                    return
                if window.busy() or \
                        window.info_process.state() != QProcess.NotRunning:
                    if time.time() > deadline[0]:
                        window.runner.cancel()
                        fail("timed out")
                    else:
                        QTimer.singleShot(500, poll)
                    return
                failed = window.console_status.text().startswith("Failed")
                if stage[0] == "recovering" and failed and tries[0] < 3:
                    tries[0] += 1          # BOOT missed its listen window
                    window.console_status.setText("Retrying\u2026")
                    stage[0] = "recover"
                elif failed:
                    return fail("a step failed (see the output panel)")
                if stage[0] == "recover":
                    stage[0] = "recovering"
                    window.recover_board()
                elif stage[0] in ("recovering", "start"):
                    stage[0] = "running"
                    page.run_steps(args.steps.split(","))
                elif stage[0] == "running":
                    stage[0] = "done"
                    return finish_after_tail()
                QTimer.singleShot(1500, poll)

            poll()

        # The board panel reads BOOT in the background; give it a moment.
        QTimer.singleShot(7000, start)

    code = app.exec()
    reader.requestInterruption()
    reader.wait(2000)
    log.close()
    return 1 if failure else code


def record(region: str, size: str, out: Path, env: dict) -> subprocess.Popen:
    return subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "x11grab",
         "-framerate", "15", "-video_size", size, "-i", region,
         "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34",
         "-deadline", "realtime", "-cpu-used", "8", str(out)],
        env=env, stdin=subprocess.PIPE)


def stop(proc: subprocess.Popen) -> None:
    if proc.stdin:
        proc.stdin.write(b"q")
        proc.stdin.flush()
    proc.wait(timeout=60)


def run_step(name: str, page: str, steps: list[str], mode: str,
             args: argparse.Namespace) -> int:
    """One recording: start the display and both recorders, run, encode."""
    VIDEO.mkdir(parents=True, exist_ok=True)
    gui_webm = VIDEO / f"{name}.webm"
    term_webm = VIDEO / f"term-{name}.webm"
    log = VIDEO / f"{name}.log"
    xvfb = subprocess.Popen(
        ["Xvfb", DISPLAY, "-screen", "0", f"{GUI_W + TERM_W}x{HEIGHT}x24"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    env = {**os.environ, "DISPLAY": DISPLAY, "QT_QPA_PLATFORM": "xcb"}
    gui_rec = record(DISPLAY, f"{GUI_W}x{HEIGHT}", gui_webm, env)
    term_rec = record(f"{DISPLAY}+{GUI_W},0", f"{TERM_W}x{HEIGHT}",
                      term_webm, env)
    try:
        code = subprocess.call(
            [sys.executable, __file__, "--inner", mode, "--page", page,
             "--steps", ",".join(steps), "--uart", args.uart,
             "--baud", str(args.baud), "--tail", str(args.tail),
             "--timeout", str(args.timeout), "--log", str(log),
             "--title", TITLES.get(name, name)], env=env)
    finally:
        stop(gui_rec)
        stop(term_rec)
        xvfb.terminate()
    state = "ok" if code == 0 else f"FAILED ({code})"
    lines = len(log.read_text().splitlines()) if log.exists() else 0
    print(f"{name:<22} {state:<10} {gui_webm.stat().st_size // 1024:>5} KB "
          f"+ {term_webm.stat().st_size // 1024:>5} KB, {lines} log lines")
    return code


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Record BOOT Flasher and the UART log as webm")
    parser.add_argument("mode", choices=["trial", "all", "one", "step"])
    parser.add_argument("name", nargs="?", help="step name for 'one'")
    parser.add_argument("--uart", default="/dev/ttyUSB0")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--tail", type=float, default=8,
                        help="seconds to keep recording after a step ends")
    parser.add_argument("--timeout", type=float, default=300,
                        help="seconds a step may take")
    parser.add_argument("--page", default="")
    parser.add_argument("--steps", default="")
    parser.add_argument("--log", default="")
    parser.add_argument("--title", default="")
    parser.add_argument("--inner", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.inner:
        return inner(args)
    for tool in ("Xvfb", "ffmpeg", "openocd"):
        if shutil.which(tool) is None:
            sys.exit(f"{tool} is required")
    if args.mode == "trial":
        return run_step("trial", "", [], "trial", args)
    chosen = [s for s in STEPS if args.mode == "all" or s[0] == args.name]
    if not chosen:
        sys.exit("unknown step; choose one of " + ", ".join(s[0] for s in STEPS))
    for name, page, steps in chosen:
        if run_step(name, page, steps, "step", args) != 0:
            print(f"stopping after {name}: fix it, then run 'one {name}'")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
