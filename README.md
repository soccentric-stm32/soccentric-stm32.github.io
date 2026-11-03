# SoCcentric STM32

The website of **SoCcentric STM32**, the STM32 firmware consultancy of
Sandesh Ghimire. It presents the open-source building blocks behind the
work — A/B bootloader, applications in C/C++ and Rust, FreeRTOS and
Zephyr, hardware validation and end-of-line testing — and how to engage.

Live site: <https://soccentric-stm32.github.io/>

## The site

- One-page, full-height slides with scroll snapping, a page navigator on
  wide screens, and a light/dark "paper / blueprint" theme.
- Every slide has a menu item: Bootloader; Application (C/C++, Rust);
  RTOS (FreeRTOS, Zephyr); Validation (Firmware, Python app); End
  line testing; Open source;
  Engagement; Contact. The logo (or Home in the mobile menu) returns
  to the intro.
- The header menu has dropdowns for Application, RTOS and
  Validation; each item turns to its slide. Deep links work too, e.g. `#app-rust`,
  `#rtos-zephyr`, `#eol`.
- No build step, no framework: `index.html`, `assets/style.css` and
  `assets/main.js`.
- Works without JavaScript: all content is static; only scrolling
  snap, the theme toggle and the animated preview need JS.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

## Deploy

Push to `main`. GitHub Pages serves the repository root; `.nojekyll`
keeps the files served as-is.

## Structure

```
index.html                  content, metadata and JSON-LD
assets/style.css            design tokens, layout, themes
assets/main.js              theme, menu, slide navigator, preview
assets/chip.svg             favicon
assets/apple-touch-icon.png
assets/og.png               social preview (1200 × 630)
robots.txt
sitemap.xml
```

## About

I am an embedded software and firmware consultant with 25+ years in
embedded systems and 15+ years on STM32 microcontrollers. I work bare
metal and with FreeRTOS and Zephyr, and have built A/B bootloaders,
complete validation and verification suites with a Python host app,
end-of-line provisioning and factory automation tools, and applications
in C/C++ and Rust, on FreeRTOS and on Zephyr.

My open-source projects on GitHub are the foundation blocks I use, and
I am happy to customise them for your product. Everything is released
under the MIT licence, so you can use it as you please.

- GitHub: <https://github.com/soccentric-stm32>
- Email: <sandesh@soccentric.com>

## Licence

Site content © Sandesh Ghimire. Code and open building blocks: MIT.
