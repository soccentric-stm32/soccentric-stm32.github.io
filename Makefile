#
# Makefile - check, serve and capture the SoCcentric STM32 website
#
# Author:  Sandesh Ghimire <sandesh@soccentric.com>
#
#   make check     validate links, captures and page metadata (the build)
#   make serve     serve the site at http://localhost:8000/
#   make shots     regenerate the screen captures in assets/shots/
#   make clean     remove the capture scratch directory
#   make help      list these targets
#
# There is no compile step: the site is plain HTML, CSS and one script. The
# check target is what CI runs, and it is the repository's build target in
# repos.yaml.
#

# Git Bash only offers `python3` as the Microsoft Store stub, which exits
# 9009; there the interpreter is `python`.
# Windows: run every recipe under Git's POSIX sh, also from cmd.exe or
# PowerShell with only Git\cmd on PATH. Otherwise native make falls back to
# cmd.exe, which cannot run the recipes (quotes, pipes, find, rm -rf), and
# `sh scripts/...` is not found. Git's usr\bin goes first on PATH so find,
# sort and friends are the POSIX tools, not the Windows ones of the same name.
ifeq ($(OS),Windows_NT)
ifneq ($(origin SHELL),command line)
GIT_USR_BIN := $(firstword \
  $(if $(wildcard C:/Program?Files/Git/usr/bin/sh.exe),C:/Program?Files/Git/usr/bin) \
  $(if $(wildcard $(subst \,/,$(LOCALAPPDATA))/Programs/Git/usr/bin/sh.exe),$(subst \,/,$(LOCALAPPDATA))/Programs/Git/usr/bin) \
  $(if $(wildcard C:/msys64/usr/bin/sh.exe),C:/msys64/usr/bin))
ifneq ($(GIT_USR_BIN),)
SHELL := $(subst ?, ,$(GIT_USR_BIN))/sh.exe
export PATH := $(subst /,\,$(subst ?, ,$(GIT_USR_BIN)));$(PATH)
endif
endif
endif

ifeq ($(OS),Windows_NT)
PYTHON ?= python
else
PYTHON ?= python3
endif

PORT   ?= 8000

.PHONY: all build check serve shots clean help

all: check
build: check

check:
	$(PYTHON) ci/check_site.py

serve: check
	$(PYTHON) -m http.server $(PORT)

# Screenshots come from the real applications and from the terminal blocks in
# index.html; see ci/capture_screens.py for the requirements.
shots:
	$(PYTHON) ci/capture_screens.py all

clean:
	rm -rf .capture-tmp

.DEFAULT_GOAL := help

help:
	@sed -n "/^#   make/p" Makefile | sed "s/^#//"
