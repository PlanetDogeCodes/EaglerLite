# EaglerLite

A lightweight but powerful optimization layer for Eaglercraft.

### What it actually is

EaglerLite is an optimized launcher that fetches the Eaglercraft client, injects an optimizer script into it (and more recently, the EaglerLite API), and opens the result in a new `about:blank` tab. Nothing about vanilla gameplay is changed because the optimizer only touches rendering and input stuff (unless the crystal optimizer counts ig).

### How it works

When you click Launch, the launcher:

1. Fetches the Eaglercraft source
2. Strips the XML prolog
3. Builds a new HTML document containing the original client plus the API
4. Opens `about:blank` in a new tab and writes the combined document via `document.open()` / `document.write()` / `document.close()`

Because the game runs from `about:blank`, its origin is `null`, which makes the tab harder to fingerprint.

### Proxy and Connections

Eaglercraft servers are WebSocket-based. When the game calls `new WebSocket(url)`, EaglerLite tries 3 things:

1. **Direct** — open the WebSocket directly from the `about:blank` tab. Works for servers that accept `Origin: null`.
2. **Simple proxy** — if direct fails before opening, retry through a WebSocket proxy server that rewrites the `Origin` header to a real value. The proxy is an inbuilt node.js container thing.
3. **Epoxy-TLS** — if the proxy also fails, fall back to epoxy-TLS (many thanks to Mercury Workshop), which does TLS in-browser via WASM and tunnels through wisp. 

### Credits

- Eaglercraft — not created by me
- EaglerLite — created and mantained by [PlanetDoge](https://github.com/PlanetDogeCodes)

### Disclaimer
EaglerLite is a tool and is not affiliated with, endorsed by, or sponsored by Mojang Studios, Microsoft, or the creators of Eaglercraft. "Minecraft" is a trademark of Mojang Studios. All trademarks and registered trademarks are the property of their respective owners.

EaglerLite does not distribute or modify any game files. It is a launcher that fetches and runs Eaglercraft, which is separately developed and maintained by third parties. EaglerLite's code interacts with the game at the browser API level only — no game assets, source code, or proprietary content are included, modified, or redistributed.

This software is provided "as is," without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

By using EaglerLite, you acknowledge that you are solely responsible for complying with any applicable terms of service, end-user license agreements, or other policies that may govern your use of the game or its associated services. The author(s) of EaglerLite do not condone, encourage, or facilitate any violation of such terms.

### Feedback

Bugs, feature requests, or questions: [Discord](https://discord.gg/2Tz8wxv9yu) or [open an issue](https://github.com/PlanetDogeCodes/EaglerLite).
