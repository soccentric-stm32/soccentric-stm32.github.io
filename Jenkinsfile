// Jenkinsfile - multi-stage CI for the SoCcentric STM32 website.
//
//   Checkout -> Validate site -> Package -> Publish
//
// The site is static (index.html, assets/style.css, assets/main.js) and has
// no build step. CI verifies that every local asset and anchor exists, that
// the page makes no third-party requests, and that sitemap.xml stays in sync.
// GitHub Pages deploys the repository root on push to main; no deploy stage
// is needed here.

pipeline {
    agent any

    options {
        skipDefaultCheckout()
        timestamps()
        ansiColor('xterm')
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh '''
                    git log -1 --pretty=fuller
                    echo "commit: $(git rev-parse HEAD)"
                    echo "branch: $(git rev-parse --abbrev-ref HEAD)"
                '''
            }
        }

        stage('Validate site') {
            steps {
                sh '''
                    python3 - <<'PY'
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

root = Path(".")
required = ["index.html", "404.html", "assets/style.css", "assets/main.js",
            ".nojekyll", "robots.txt", "sitemap.xml"]
missing = [name for name in required if not (root / name).is_file()]
if missing:
    raise SystemExit(f"site: missing required files: {', '.join(missing)}")

class Site(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.refs = []          # (tag, attribute, value)
        self.resources = []     # external resource URLs

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        for key in ("href", "src"):
            value = attrs.get(key)
            if value:
                self.refs.append((tag, key, value))
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.resources.append(attrs.get("href", ""))
        if tag == "script" and "src" in attrs:
            self.resources.append(attrs["src"])
        if tag == "img" and "src" in attrs:
            self.resources.append(attrs["src"])

page = Site()
page.feed((root / "index.html").read_text(encoding="utf-8"))

problems = []
for tag, key, value in page.refs:
    if value.startswith(("http://", "https://", "//", "mailto:", "data:", "javascript:")):
        continue
    if value.startswith("#"):
        if value != "#" and value[1:] not in page.ids:
            problems.append(f"index.html: missing anchor target {value}")
        continue
    path = urlparse(value).path
    if path and not (root / path.lstrip("/")).exists():
        problems.append(f"index.html: <{tag} {key}> points at missing {value}")

for value in page.resources:
    if value.startswith(("http://", "https://", "//")):
        problems.append(f"index.html: third-party resource {value}")

for extra in ("404.html",):
    other = Site()
    other.feed((root / extra).read_text(encoding="utf-8"))
    for tag, key, value in other.refs:
        if value.startswith(("http://", "https://", "//", "mailto:", "data:", "javascript:", "#")):
            continue
        path = urlparse(value).path
        if path and not (root / path.lstrip("/")).exists():
            problems.append(f"{extra}: <{tag} {key}> points at missing {value}")

if problems:
    raise SystemExit("site: " + "; ".join(problems))

sitemap = ET.parse(root / "sitemap.xml").getroot()
locs = [node.text.strip() for node in sitemap.iter() if node.tag.endswith("loc") and node.text]
if not locs:
    raise SystemExit("site: sitemap.xml has no <loc> entries")
for loc in locs:
    if not loc.startswith("https://soccentric-stm32.github.io/"):
        raise SystemExit(f"site: sitemap entry outside the site: {loc}")

print(f"site: {len(page.refs)} references, {len(page.ids)} anchors, "
      f"{len(locs)} sitemap entries - OK")
PY
                '''
            }
        }

        stage('Package') {
            steps {
                sh '''
                    mkdir -p build
                    tar -czf build/soccentric-stm32-site.tar.gz \
                        index.html 404.html assets .nojekyll robots.txt sitemap.xml \
                        LICENSE README.md
                    tar -tzf build/soccentric-stm32-site.tar.gz
                    sha256sum build/soccentric-stm32-site.tar.gz > build/SHA256SUMS
                    cat build/SHA256SUMS
                '''
            }
        }

        stage('Publish') {
            steps {
                archiveArtifacts artifacts: 'build/soccentric-stm32-site.tar.gz,build/SHA256SUMS',
                                 fingerprint: true
            }
        }
    }

    post {
        always {
            deleteDir()
        }
        success {
            echo 'Website: assets, anchors, third-party policy and sitemap checks passed.'
        }
        failure {
            echo 'Website: pipeline failed - see the stage logs above.'
        }
    }
}
