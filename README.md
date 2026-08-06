# EaglerLite

A lightweight but powerful optimization layer for Eaglercraft.


### What it actually is

EaglerLite is an optimized launcher that fetches the Eaglercraft client at runtime, injects an optimizer script into it, and opens the result in a new `about:blank` tab. The optimizer runs before the game's WebGL context is created and patches low-level browser APIs to reduce CPU stalls and GPU fill-rate waste. Nothing about vanilla gameplay is changed — the optimizer only touches rendering and input plumbing.

The launcher itself is a static HTML file. You host it anywhere (or open it locally), pick options, hit Launch. The game runs in a fresh tab with all patches applied. Configuration is persisted to `localStorage` under a single key, so toggles survive between browser sessions.

### How the injection works

When you click Launch, the launcher:

1. Fetches the Eaglercraft source (an XML file containing the compiled client)
2. Strips the XML prolog
3. Builds a new HTML document containing the original client plus the optimizer script
4. Opens `about:blank` in a new tab and writes the combined document via `document.open()` / `document.write()` / `document.close()`

Because the game runs from `about:blank`, its origin is `null`. This is intentional — it makes the tab harder to fingerprint — but it also means some Minecraft servers reject the connection outright (they see `Origin: null` and drop it). To work around that, EaglerLite ships with a WebSocket wrapper that falls back through a proxy chain (more on that below).

### What the optimizer patches

The optimizer is a single IIFE that wraps a handful of browser APIs. Each patch is gated behind a config flag so you can toggle it on or off. The interesting ones:

**WebGL context creation** — `HTMLCanvasElement.prototype.getContext` is wrapped so that when the game requests a WebGL context, we pass `{ antialias: false, powerPreference: 'high-performance' }`. MSAA is the single biggest fill-rate cost in Eaglercraft, and the game doesn't visually benefit from it at the default render distance.

**VBO orphaning** — `bufferSubData` is wrapped so that before each sub-update, the buffer is re-allocated with `bufferData` at its original size and usage hint. This is the standard "orphan and refill" pattern: the GPU keeps reading from the old allocation while the CPU writes to the new one, so chunk updates stop causing pipeline stalls. The wrapper tracks per-buffer metadata (size, usage) by intercepting `bindBuffer` and `bufferData`.

**Texture filtering overrides** — `texParameteri` is wrapped so that `TEXTURE_MIN_FILTER` and `TEXTURE_MAG_FILTER` are forced to `NEAREST`. Mipmaps are also suppressed by no-oping `generateMipmap`. This trades a tiny amount of distant-texture quality for a large reduction in fill-rate and VRAM.

**Fullbright** — The Minecraft 1.12.2 lightmap is a 16×16 RGBA texture that gets re-uploaded every frame via `texSubImage2D` (or `texImage2D`). The optimizer detects which texture is the lightmap by tracking upload frequency — the lightmap is the only 16×16 texture that updates 60+ times per second — and replaces its pixel data with pure white (255,255,255,255). Since the lightmap is multiplied with block texture colors in the fragment shader, white acts as an identity multiply: every block renders at full brightness with its original colors intact. No color curves are modified, no game textures are touched.

**requestAnimationFrame override** — When the game is in pointer lock, `requestAnimationFrame` is replaced with a `MessageChannel`-based queue that fires as fast as the event loop allows, bypassing the browser's V-Sync cap. This is only active during pointer lock so background tabs and menus still throttle normally. When the tab is hidden, a visibility-change handler throttles to 1 FPS to save battery.

**WebGL error suppression** — `getError` is wrapped to return 0 (no error) unless the context is actually lost. Each `getError` call forces a CPU-GPU sync, and Eaglercraft calls it a lot. The context-lost check is preserved so real failures still surface.

**Renderbuffer downgrading** — `renderbufferStorageMultisample` is redirected to `renderbufferStorage` (single-sampled). This skips the MSAA resolve pass entirely.

### Quality-of-life features

**AutoSprint** — Wraps `Object.prototype` to intercept the game's `sprint` field. When the player holds W and pointer lock is active, the sprint flag is forced true and a synthetic `keydown` for the configured sprint key is dispatched to `document` (with `isTrusted` spoofed via `Object.defineProperty`). The sprint keybind is auto-detected by scanning `localStorage` for the game's `key_key.sprint` keybind entries.

**Crystal Optimizer** — Same `Object.prototype` trap technique, but targeting the cooldown fields (`rightClickDelayTimer`, `leftClickCounter`). When pointer lock is active, these read as 0, letting crystals be placed and broken every tick. If the named fields aren't found within 60 seconds, a heuristic scan walks the captured Minecraft instance's fields looking for small integers that decrement by 1 and reset to 4 or 10 — the signature of a cooldown counter.

**Soft pointer lock** — In sandboxed environments where `requestPointerLock` is blocked, the optimizer falls back to a software-emulated pointer lock. `pointerLockElement` is spoofed on `document`, and `movementX`/`movementY` on `MouseEvent.prototype` are overridden to read from a manual delta computed on `mousemove`. The mouse cursor is hidden and the position wraps around the window edges for unbound 360° movement. Esc pauses, and the game's own `requestPointerLock` / `exitPointerLock` calls drive activation — so soft PL only engages when the game is actually in a world, never in menus.

**Tab cloaking** — `document.title` is set to a configurable string and a `MutationObserver` watches the `<title>` element, reverting any changes the game makes. Favicon is overridden via a `<link rel="icon">` element. `window.opener` is nulled and `document.referrer` is spoofed to empty.

**Panic key** — A configurable key (default `=`) opens a configurable URL (default Google Classroom) in a new tab, then closes the game tab.

**HUD** — A fixed-position overlay showing FPS, draw calls per frame, and throttle status, updated every 500ms. Toggle with `F3 + O`.

### Connection layer

Eaglercraft servers are WebSocket-based. When the game calls `new WebSocket(url)`, EaglerLite's wrapper tries three strategies in sequence:

1. **Direct** — open the WebSocket directly from the `about:blank` tab. Works for servers that accept `Origin: null`.
2. **Simple proxy** — if direct fails before opening, retry through a WebSocket proxy server that rewrites the `Origin` header to a real value and forwards traffic bidirectionally. The proxy is a Node.js process (`ws` + `wisp-server-node`) that also serves the epoxy-TLS runtime and a health endpoint.
3. **Epoxy-TLS** — if the proxy also fails, fall back to epoxy-TLS, which does TLS in-browser via WASM and tunnels through the wisp protocol. This layer is only needed for servers with strict origin/CORS policies.

Each layer has a heartbeat monitor that tracks `lastActivity` and fires `onclose` after 60 seconds of total silence, so dead connections surface quickly instead of hanging. The wrapper also queues `addEventListener` and `send` calls made before the connection opens, flushing them to whichever underlying socket wins — this is necessary because the game sets up handlers and sends login packets immediately after construction.

A separate Cloudflare Worker pings the proxy's `/health` endpoint every minute to keep the proxy from sleeping.

### Compatibility

- Eaglercraft 1.12.2 — primary target, all features
- Eaglercraft 1.21.11 — not currently supported, but is coming soon

### Credits

- Eaglercraft — not created by me; all credit to its respective authors
- EaglerLite — created and compiled by [PlanetDoge](https://github.com/PlanetDogeCodes)
- License — Apache 2.0; redistribution without attribution is prohibited

### Disclaimer
EaglerLite is an independent optimization tool and is not affiliated with, endorsed by, or sponsored by Mojang Studios, Microsoft, or the creators of Eaglercraft. "Minecraft" is a trademark of Mojang Studios. All trademarks and registered trademarks are the property of their respective owners.

EaglerLite does not distribute or modify any game files. It is a launcher that fetches and runs the Eaglercraft client, which is separately developed and maintained by third parties. EaglerLite's code interacts with the game at the browser API level only — no game assets, source code, or proprietary content are included, modified, or redistributed.

This software is provided "as is," without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

By using EaglerLite, you acknowledge that you are solely responsible for complying with any applicable terms of service, end-user license agreements, or other policies that may govern your use of the game or its associated services. The authors of EaglerLite do not condone, encourage, or facilitate any violation of such terms.

### Feedback

Bugs, feature requests, or questions: [Discord](https://discord.gg/2Tz8wxv9yu) or [open an issue](https://github.com/PlanetDogeCodes/EaglerLite).
