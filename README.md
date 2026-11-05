# SoCcentric STM32

The website of SoCcentric STM32, a showcase of the open-source projects that together form a complete STM32 product baseline: an A/B bootloader, the same application in C and Rust on both FreeRTOS and Zephyr, the HWVAL validation firmware and desktop GUI, and the HWVAL Factory provisioning station. It is a single static page with one slide per project, no framework and no build step, served by GitHub Pages at https://soccentric-stm32.github.io/.

## Features

- One-page site with full-height slides and scroll snapping
- One slide per project with features and a repository link
- Light and dark theme
- Header menu with dropdowns and deep links to each project
- No framework and no build step: HTML, CSS and a small script
- Self-hosted fonts, no third-party requests and no cookies
- Works without JavaScript
- Social preview image, sitemap and structured metadata
- Branded 404 page

## Build and run

```bash
python3 -m http.server 8000   # then open http://localhost:8000/
```

Pushing to `main` deploys the site with GitHub Pages.

## Related projects

- [bootloader](https://github.com/soccentric-stm32/bootloader) — A/B bootloader with UART update, CRC32 checks, trial boot and rollback
- [app-c-freertos](https://github.com/soccentric-stm32/app-c-freertos) — Demo application in C on FreeRTOS
- [app-c-zephyr](https://github.com/soccentric-stm32/app-c-zephyr) — Demo application in C on Zephyr RTOS
- [app-rust-freertos](https://github.com/soccentric-stm32/app-rust-freertos) — Demo application in Rust on Embassy
- [app-rust-zephyr](https://github.com/soccentric-stm32/app-rust-zephyr) — Demo application in Rust on Zephyr RTOS
- [validation-firmware](https://github.com/soccentric-stm32/validation-firmware) — HWVAL hardware validation firmware
- [validation-gui](https://github.com/soccentric-stm32/validation-gui) — HWVAL Studio: desktop GUI for tests, updates and flashing
- [factory-station](https://github.com/soccentric-stm32/factory-station) — HWVAL Factory: end-of-line test and provisioning station

## License

Released under the [MIT License](LICENSE) © 2026 Sandesh Ghimire. You are free
to use, modify and ship it in your own products.

Contributions are welcome. Fork the repository, make your change on a branch and
open a pull request. Bug reports, ideas and improvements are all appreciated.
