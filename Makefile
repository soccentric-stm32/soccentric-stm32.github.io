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

PYTHON ?= python3
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

help:
	@sed -n '/^#   make/p' Makefile | sed 's/^#//'
