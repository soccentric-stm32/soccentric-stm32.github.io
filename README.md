# soccentric-stm32.github.io

Project site for SoCcentric STM32: <https://soccentric-stm32.github.io>

## About

I am an embedded software and firmware consultant with 25+ years of
experience in embedded systems and firmware, 15+ of them on STM32
microcontrollers. I have completed many STM32 projects on bare metal,
FreeRTOS and Zephyr.

The work published here covers almost every part of an embedded firmware
project:

- **Bootloaders** with A/B firmware updates
- **Validation and verification:** firmware that tests the whole board, and a
  Python desktop app to run the tests
- **End-of-line and factory provisioning:** a station tool for production
  test, identity and traceability
- **Applications** on FreeRTOS, on Zephyr and in Rust

I have open-sourced these applications on GitHub and use them as the building
blocks for my client work. I would be glad to help you adapt them for your
product. If you already have a team, you are welcome to use them as building
blocks yourselves: everything is released under the MIT licence, so you can use
it as you like, without licence restrictions.

Contact: sandesh@soccentric.com

## Projects

| Repository | Role |
|---|---|
| [soccentric-stm32-validation-firmware](https://github.com/soccentric-stm32/soccentric-stm32-validation-firmware) | HWVAL hardware validation firmware |
| [soccentric-stm32-bootloader](https://github.com/soccentric-stm32/soccentric-stm32-bootloader) | A/B bootloader (UART update, CRC32, trial boot and rollback) |
| [soccentric-stm32-application](https://github.com/soccentric-stm32/soccentric-stm32-application) | FreeRTOS demo application in C |
| [soccentric-stm32-rust-application](https://github.com/soccentric-stm32/soccentric-stm32-rust-application) | The same demo in Rust (Embassy) |
| [soccentric-stm32-zephyr-application](https://github.com/soccentric-stm32/soccentric-stm32-zephyr-application) | The same demo on Zephyr RTOS |
| [soccentric-stm32-validation-gui](https://github.com/soccentric-stm32/soccentric-stm32-validation-gui) | HWVAL Studio: validation GUI for tests, updates and SWD flashing |
| [soccentric-stm32-factory-provisioning](https://github.com/soccentric-stm32/soccentric-stm32-factory-provisioning) | HWVAL Factory: end-of-line test and provisioning station |

## The site

Published with GitHub Pages from the `main` branch root. Plain HTML, CSS and
JavaScript with no build step (`.nojekyll` turns Jekyll off). To preview
locally:

```bash
python3 -m http.server 8000
```

## License

[MIT](LICENSE) © 2026 Sandesh Ghimire.
