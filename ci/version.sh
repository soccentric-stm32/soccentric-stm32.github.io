#!/usr/bin/env bash
#
# version.sh - print the version this build reports, without a leading v
#
# Author:  Sandesh Ghimire <sandesh@soccentric.com>
#
# Used by the Jenkins Package and Release stages.  The source of truth is
# the tag itself (the site has no version file); untagged builds use the date and commit; the release tag must be v<this version>.
#

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ "${TAG_NAME:-}" == v* ]]; then echo "${TAG_NAME#v}"; else echo "$(date -u +%Y.%m.%d)+$(git rev-parse --short HEAD)"; fi
