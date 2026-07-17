# EaglerLite

A highly optimized, plug-and-play launcher for Eaglercraft — built to maximize framerate and minimize system load without touching the vanilla gameplay experience.

This repository holds the latest stable HTML launcher with the optimizer script pre-injected. Just open the file and click Launch.

---

## What it does

EaglerLite sits between you and the game as a thin optimization layer. Unlike traditional clients, EaglerLite doesn't change any vanilla features, only focusing on Higher FPS, lower CPU, and longer battery life.

The launcher itself is a single HTML file. No install, no dependencies, no server. You open it in a browser, pick your options, hit Launch, and the game opens in a new tab with all optimizations already applied.

## How it works

Before the game's WebGL context is even created, EaglerLite injects a self-contained JavaScript optimizer into the page. This wrapper intercepts low-level rendering APIs — `getContext`, `bufferData`, `uniformMatrix4fv`, `requestAnimationFrame`, and a handful of others — and safely retunes them for speed.

Quality-of-life features like Fullbright work the same way: by mutating the lightmap directly inside VBO arrays during upload, we bypass the need to touch game textures at all. The game never knows we're there.

## Why it's so fast

Eaglercraft is compiled from Java to JavaScript via TeaVM, and TeaVM-compiled code has two main bottlenecks: **CPU stalls** and **GPU fill-rate**. EaglerLite helps to improve both.

- **VBO orphaning** — Before every `bufferSubData` call, we re-allocate the buffer via `bufferData`. This means the CPU never blocks waiting for the GPU to finish reading chunk geometry. The result: chunk updates stop causing micro-stutters.
- **Uncapped framerate** — We override `requestAnimationFrame` with a `MessageChannel` queue, bypassing the browser's 60Hz V-Sync cap. Your FPS is now limited only by your hardware, not your monitor.
- **Reduced GPU waste** — Flat textures, mipmap suppression, disabled dithering, and single-sampled renderbuffers all cut down on fill-rate and VRAM pressure without visibly changing how the game looks.


## Getting started

1. Download the latest `EaglerLite.html` from the [releases page](../../releases).
2. Open it in any modern browser (Chrome, Firefox, Edge).
3. Configure your options (or leave the defaults — they're tuned for maximum performance).
4. Click **Launch Game**.

The game opens in a new `about:blank` tab with all optimizations injected. If your browser blocks the popup or you're in a sandboxed environment, the launcher will automatically download a standalone copy you can open locally.

## Compatibility

- **Eaglercraft 1.12.2** — fully supported and stable
- **Eaglercraft 1.21.11** — coming soon (probably not, don't quote me on that)

## Credits

- **Eaglercraft** — not created by me, all credit goes to lax1dude and peytonplayz585
- **EaglerLite** — created and compiled by [PlanetDoge](https://github.com/PlanetDogeCodes).
- **License** — Apache 2.0. Redistribution without attribution is prohibited.

## Feedback

Found a bug? Have a feature request? [Join the Discord](https://discord.gg/2Tz8wxv9yu) or [Open an Issue](https://github.com/PlanetDogeCodes/EaglerLite).
