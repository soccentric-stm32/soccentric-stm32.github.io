# Contributing to SoCcentric STM32 website

Thanks for taking the time to contribute. This project is part of the
[soccentric-stm32](https://github.com/soccentric-stm32) STM32F767ZI baseline and is released under
the MIT License.

## Before you start

- Read [README.md](README.md) for what soccentric-stm32.github.io does and which tooling it needs.
- Report security issues privately, following [SECURITY.md](SECURITY.md), and not
  in a public issue.
- By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

The site is static HTML, CSS and JavaScript. `make build` assembles it and
`make serve` starts a local preview. See [README.md](README.md).

## Building and testing

| Command | What it does |
|---|---|
| `make build` | Assemble the site into the output directory |
| `make check` | Run the HTML, link and theme checks |
| `make serve` | Serve the site locally |
| `make shots` | Regenerate the screen captures |

Run `make build` and `make check` before you open a pull request.

## Code style

- Follow the style of the surrounding code; do not reformat unrelated lines.
- Keep the existing configuration (`.editorconfig`, the scripts in `ci/`) the single
  source of truth for formatting and checks.
- Keep the HTML, CSS and JavaScript static and dependency-free so the page still
  works as a plain file preview and under Jekyll.
- Look at the page in a browser before and after the change.

## Branch and commit conventions

- Branch off `master` and use a short, descriptive kebab-case name, for example
  `fix-spi-timeout` or `add-imx708-autofocus`.
- Write imperative, present-tense commit subjects (`fix:`, `feat:`, `docs:`,
  `refactor:`, `test:`, `build:`), keep them under about 72 characters and explain
  the reason for the change in the body.
- One logical change per commit.

## Pull requests

- Explain what changed and why, and how you tested it (including the board and
  toolchain you used).
- Reference the issue you are fixing (`Fixes #123`).
- Keep the pull request focused; split unrelated changes into separate ones.
- The Jenkins pipeline in the repository must be green before the change
  is merged.

## Changelog and releases

- Record user-visible changes under `## [Unreleased]` in
  [CHANGELOG.md](CHANGELOG.md), following
  [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
- Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and
  releases are tagged `vMAJOR.MINOR.PATCH`.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE), the same terms as the rest of the project.
