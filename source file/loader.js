"use strict";
(function(){
        const opts = {};
        var progressPanel = null;
        var progressStr1 = null;
        var progressStr2 = null;
        var progressStr3 = null;
        var progressBarOuter = null;
        var progressBarInner = null;
        var cancelButton = null;
        var currentXHR = null;

        const LOADING_ICON_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkBAMAAACCzIhnAAAAGFBMVEUAAAA/QT5dX1x5e3iYmpe0trPS1NH///9divB0AAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH6AEXAik7MKTXeAAAA6NJREFUWMPVmDGz2yAMx5mqj5D1XRev764D6xt6x9qp+gQtK5ek0dcvQgKETeLkJR2K7+LEDvr5jyQscPRwc/9Jl/jvKXF7SHslhc31AwWCiP3ahPJnZe+yQ8lmEClbVQgWSKAQQv5OHfOMlmIyWAxrC7QsS/4ko2aPcvp6hSI+QIBsMD95RB0wJA+HwyK/KsZQksuNzufBIrfTVAsb+MG3QQaoHFlVubT4OoQF47oPhDKaLJR0RUuMpYsD3zEUyiVH4hmca3GwpbgJJXYtuQt7J5TDe1evFdBKy2MUyQv8kC5sTiDBL+UK6G/F3EP5PqFI6qEvJgNWTCgYAMQGafIlL86n4n1j70zHjMZZjEVJSPYCm2wHBv+eu4jr6dl8US0hNDd3ECd/LOqI8GmKBqsYapDisHJPZ4DntWwx2O5AdpjOAdzl8vsyn7H+NJ8lE2iVgibtiCTOvGjh71AjDaXL5QrEhB+Z3NQYEyOC8vngGWBZfPhZpjeOAQCvD+L63DKZxMh9+cVn/sNxpGA2AgTZCH8eMobPcGAJ3GrWoMkXt99OhqKZUvLLgZwB1j1ES6xazp2SVufeVrnvYYDM2ie0AA1aQp0Wb0FGv1TXpK6Ab0yVVC0hOLAD1bzRyNC0xBWlYVIaKYlGLZwZMA4YNGSl0LLSQun2gE20IIqaDaSN2GGtZc81Wy3ZwNYnMDrf65R5NwXWWvIxpcAYyDRqSemRGCvvj7CnJWy0VM+QzZWG3vqFj3d9V4IJAxt19R1juh/1mQenH9OUou9GX6IXBlE5spoW1LelpbzJnz4s5fRtNmI6ZJ6WLaUNJHSMpSSxllKyA5XSzC+KWbQg60HMpkOvY7hmHignGSs6p+4Zfsccr2gpGK1hPGl06fODAmlTw9CpW0vi9zSr/bQeK5ggFH67fCgFS2hUCtfOqzeypdjnn1DqoEltyaGQhILluq+6ZC3zWUpdsfhU68jQBixqwoquuKkuUqMkm+/lV6sBTM2fzb0Vv4SVYaOFdijOUOY1f9WCRotcB/keb2o571KaFmh1stHCoQ3T9YulFF90TwyLi1ELtdI7WC3BQm5Sbq74qpYDiF843kCd36vkfS3nexbvWYvTugxl6GLbBehLvusUuG+LwKlfZJB6rRmvrCt1MfEYJXumLvdC9cp6u+FGNb5PiW3SDFi1DBsO8TXr/QoquxVYU7D6JV7Zu/jUPkxtZkNkswX0mm2oHcgrN7s6Jr5g5+ovpIaM1+QieF8AAAAASUVORK5CYII=";

        function makePatternA(domain) {
                const domainStr = domain;
                return (cid, path) => { return "https://" + domainStr + "/ipfs/" + cid + "/" + path; };
        }

        function makePatternB(domain) {
                const domainStr = domain;
                return (cid, path) => { return "https://" + cid + ".ipfs." + domain + "/" + path; };
        }

        Object.defineProperty(window, 'eaglercraftXOpts', {
          configurable: true,
          enumerable: true,
          set(value) {
            value.servers = [
  { addr: "wss://mc.voidsent.net", name: "Voidsent MC - PVP, Survival, etc" },
  { addr: "wss://1b2t.eagler.cc", name: "1 Builder 2 Tools Anarchy" },
  { addr: "https://github.com/PlanetDogeCodes/EaglerLite", name: "EaglerLite created by Planet_Doge" },
  { addr: "Contact us on this Discord: https://discord.gg/UEE39zHuCx", name: "Want to see your server here?" }
];
            this._eaglercraftXOpts = value;
          },
          get() {
            return this._eaglercraftXOpts;
          }
        });


        const IPFS_GATEWAYS = [
                makePatternA("gateway.ipfs.io"),
                makePatternB("4everland.io"),
                makePatternB("dweb.link"),
                makePatternA("cloudflare-ipfs.com"),
                makePatternB("cf-ipfs.com"),
                makePatternA("w3s.link"),
                makePatternA("storry.tv"),
                makePatternB("nftstorage.link")
        ];

        function tryDecompressDownload(arrayBufferIn) {
                return new Promise((resolve) => {
                        var ds = new DecompressionStream("gzip");
                        var result = [];
                        function fetchStream(reader) {
                                return reader.read().then(function processData({ done, value }) {
                                        if (done) {
                                                var ret = new Blob(result);
                                                result = [];
                                                return ret.arrayBuffer();
                                        }
                                        result.push(value);
                                        return reader.read().then(processData);
                                })
                        }
                        fetchStream((new Blob([arrayBufferIn])).stream().pipeThrough(ds).getReader()).then((arrayBufferOut) => {
                                resolve(arrayBufferOut);
                        }).catch((err) => {
                                console.error("Could not decompress file!");
                                console.error(err);
                                resolve(null);
                        });
                });
        }

        function tryDownloadURL(ipfsURL) {
                const theIpfsURL = ipfsURL;
                return new Promise((resolve) => {
                        var percentDone = -1.0;
                        const xhr = currentXHR = new XMLHttpRequest();
                        cancelButton.disabled = false;
                        cancelButton.style.display = "inline";
                        xhr.open("GET", ipfsURL);
                        xhr.responseType = "arraybuffer";
                        xhr.addEventListener("progress", (evt) => {
                                updateProgressBar("Update: " + Math.round(evt.loaded * 0.001) + " / " + Math.round(opts.dlSize * 0.001) + " kB", theIpfsURL, Math.min(evt.loaded / opts.dlSize, 1.0));
                        });
                        xhr.addEventListener("readystatechange", (evt) => {
                                if(xhr.readyState === XMLHttpRequest.DONE) {
                                        updateProgressBar("Update: " + Math.round(opts.dlSize * 0.001) + " / " + Math.round(opts.dlSize * 0.001) + " kB", theIpfsURL, Math.min(evt.loaded / opts.dlSize, 1.0));
                                        if(cancelButton !== null) {
                                                cancelButton.disabled = true;
                                                currentXHR = null;
                                        }
                                        currentXHR = null;
                                        if(xhr.status === 200) {
                                                resolve(xhr.response);
                                        }else {
                                                console.error("Got response code " + xhr.status + " for: " + theIpfsURL);
                                                resolve(null);
                                        }
                                }
                        });
                        xhr.addEventListener("error", (evt) => {
                                if(cancelButton !== null) {
                                        cancelButton.disabled = true;
                                }
                                currentXHR = null;
                                console.error("Could not complete request to: " + theIpfsURL);
                                resolve(null);
                        });
                        xhr.addEventListener("load", (evt) => {
                                if(cancelButton !== null) {
                                        cancelButton.disabled = true;
                                }
                                currentXHR = null;
                        });
                        xhr.addEventListener("abort", (evt) => {
                                console.error("Request aborted: " + theIpfsURL);
                                if(cancelButton !== null) {
                                        cancelButton.disabled = true;
                                }
                                currentXHR = null;
                                resolve(null);
                        });
                        xhr.send();
                });
        }

        function delayProgress(delayMS) {
                return new Promise((resolve) => {
                        setTimeout(() => {
                                resolve();
                        }, delayMS);
                });
        }

        async function tryDownloadClient(download) {
                var rand = Math.floor(Math.random() * IPFS_GATEWAYS.length);
                for(var i = 0; i < IPFS_GATEWAYS.length; ++i) {
                        var url = download;
                        updateProgressBar("Update: 0 / " + Math.round(opts.dlSize * 0.001) + " kB", url, 0.0);
                        try {
                                var j = await tryDownloadURL(url);
                                if(j) {
                                        if(opts.gzip) {
                                                try {
                                                        updateProgressBar("Extracting...", url, -1);
                                                        j = await tryDecompressDownload(j);
                                                        if(j) {
                                                                return j;
                                                        }else {
                                                                throw "Return value from tryDecompressDownload is undefined";
                                                        }
                                                }catch(ex) {
                                                        updateProgressBar("Client decompress failed!", url, -1);
                                                        console.error("Caught exception during decompress: " + url);
                                                        console.error(ex);
                                                }
                                        }else {
                                                return j;
                                        }
                                }else {
                                        throw "Return value from tryDownloadURL is undefined";
                                }
                        }catch(ex) {
                                updateProgressBar("Client download failed!", url, 1.0);
                                console.error("Caught exception during download: " + url);
                                console.error(ex);
                        }
                        await delayProgress(1000);
                }
                return null;
        }

        function loadClientFile(arrayBuffer) {
                if(progressPanel != null) {
                        progressPanel.remove();
                        progressPanel = null;
                }
                var objURL = URL.createObjectURL(new Blob([ arrayBuffer ], { type: "text/javascript;charset=utf-8" }));
                var scriptElement = document.createElement("script");
                scriptElement.type = "text/javascript";
                scriptElement.src = objURL;
                document.head.appendChild(scriptElement);
        }

        function initProgressScreen() {
                if(progressPanel == null) {
                        progressPanel = document.createElement("div");
                        progressPanel.setAttribute("style", "margin:0px;width:100%;height:100%;font-family:sans-serif;display:flex;align-items:center;user-select:none;");
                        var progressPanelInner = document.createElement("div");
                        progressPanelInner.setAttribute("style", "margin:auto;text-align:center;");
                        var progressPanelIconContainer = document.createElement("h2");
                        var progressPanelIcon = document.createElement("img");
                        progressPanelIcon.style.imageRendering = "pixelated";
                        progressPanelIcon.width = 200;
                        progressPanelIcon.height = 200;
                        progressPanelIcon.src = LOADING_ICON_SRC;
                        progressPanelIconContainer.appendChild(progressPanelIcon);
                        progressPanelInner.appendChild(progressPanelIconContainer);
                        progressStr1 = document.createElement("h2");
                        progressStr1.innerText = "Please Wait...";
                        progressPanelInner.appendChild(progressStr1);
                        progressStr2 = document.createElement("h3");
                        progressPanelInner.appendChild(progressStr2);
                        progressBarOuter = document.createElement("div");
                        progressBarOuter.setAttribute("style", "border:2px solid transparent;width:400px;height:15px;padding:1px;margin:auto;margin-bottom:5px;");
                        progressBarInner = document.createElement("div");
                        progressBarInner.setAttribute("style", "background-color:#AA0000;width:0%;height:100%;");
                        progressBarOuter.appendChild(progressBarInner);
                        progressPanelInner.appendChild(progressBarOuter);
                        progressStr3 = document.createElement("h5");
                        progressPanelInner.appendChild(progressStr3);
                        var buttonContainer = document.createElement("p");
                        buttonContainer.setAttribute("style", "margin-bottom:20vh;");
                        cancelButton = document.createElement("button");
                        cancelButton.setAttribute("style", "display:none;");
                        cancelButton.innerText = "Skip Download";
                        cancelButton.disabled = true;
                        cancelButton.addEventListener("click", (evt) => {
                                if(currentXHR !== null) {
                                        currentXHR.abort();
                                }
                        });
                        buttonContainer.appendChild(cancelButton);
                        progressPanelInner.appendChild(buttonContainer);
                        progressPanel.appendChild(progressPanelInner);
                        document.getElementById(opts.container).appendChild(progressPanel);
                }
        }

        function updateProgressScreen(str1) {
                progressStr1.innerText = str1;
        }

        function updateProgressBar(str2, str3, prog) {
                progressStr2.innerText = str2;
                progressStr3.innerText = str3;
                if(prog < 0) {
                        progressBarInner.style.width = "0%";
                        progressBarOuter.style.border = "2px solid transparent";
                }else {
                        progressBarInner.style.width = "" + Math.floor(Math.min(prog, 1.0) * 100.0) + "%";
                        progressBarOuter.style.border = "2px solid black";
                }
        }
        
        function hasDownloadFailed(cidPath) {
                if(window.localStorage) {
                        var keyPath = "_eagler_dl_" + cidPath + ".failedAt";
                        var keyValue = window.localStorage.getItem(keyPath);
                        if(keyValue) {
                                try {
                                        if((Date.now() - parseInt(keyValue)) < 6 * 3600 * 1000) { // <6 hours = don't retry
                                                return true;
                                        }else {
                                                window.localStorage.removeItem(keyPath);
                                                return false;
                                        }
                                }catch(ex) {
                                        window.localStorage.removeItem(keyPath);
                                        return false;
                                }
                        }else {
                                return false;
                        }
                }else {
                        return false;
                }
        }
        
        function setDownloadFailed(cidPath) {
                if(window.localStorage) {
                        window.localStorage.setItem("_eagler_dl_" + cidPath + ".failedAt", "" + Date.now());
                }
        }

        function loadClientFromIndexedDB(fileName) {
                const reqFileName = fileName;
                return new Promise((resolve) => {
                        const openRequest = window.indexedDB.open("_eagler_loader_cache_v1", 1);
                        openRequest.addEventListener("upgradeneeded", (evt) => {
                                openRequest.result.createObjectStore("file_cache", { keyPath: "fileName" });
                        });
                        openRequest.addEventListener("success", (evt2) => {
                                const db = openRequest.result;
                                db.addEventListener("error", (err) => {
                                        console.error("Error loading from cache database!");
                                        console.error(err);
                                });
                                const transaction = db.transaction(["file_cache"], "readonly");
                                const readRequest = transaction.objectStore("file_cache").get(reqFileName);
                                var readResult = null;
                                readRequest.addEventListener("success", (evt) => {
                                        resolve(readRequest.result);
                                });
                                transaction.addEventListener("success", (evt) => {
                                        db.close();
                                });
                                transaction.addEventListener("error", (evt) => {
                                        db.close();
                                        console.error("Failed to load from cache database!");
                                        resolve(null);
                                });
                        });
                        openRequest.addEventListener("error", (evt) => {
                                console.error("Failed to open cache database!");
                                console.error(openRequest.error);
                                resolve(null);
                        });
                });
        }

        function saveClientToIndexedDB(fileData) {
                return new Promise((resolve) => {
                        const openRequest = window.indexedDB.open("_eagler_loader_cache_v1", 1);
                        openRequest.addEventListener("upgradeneeded", (evt) => {
                                openRequest.result.createObjectStore("file_cache", { keyPath: "fileName" });
                        });
                        openRequest.addEventListener("success", (evt2) => {
                                const db = openRequest.result;
                                db.addEventListener("error", (err) => {
                                        console.error("Error saving to cache database!");
                                        console.error(err);
                                });
                                const transaction = db.transaction(["file_cache"], "readwrite");
                                const writeRequest = transaction.objectStore("file_cache").put(fileData);
                                writeRequest.addEventListener("success", (evt) => {
                                        resolve(true);
                                });
                                transaction.addEventListener("success", (evt) => {
                                        db.close();
                                });
                                transaction.addEventListener("error", (evt) => {
                                        db.close();
                                        console.error("Failed to save to cache database!");
                                        console.error(evt);
                                        resolve(false);
                                });
                        });
                        openRequest.addEventListener("error", (evt) => {
                                console.error("Failed to open cache database!");
                                console.error(openRequest.error);
                                resolve(false);
                        });
                });
        }

        window.addEventListener("load", async function() {
                if(!window.__eaglercraftLoaderClient) {
                        console.error("window.__eaglercraftLoaderClient is not defined!");
                        return;
                }
                
                opts.container = window.__eaglercraftLoaderClient.container;
                opts.name = window.__eaglercraftLoaderClient.name;
                opts.file = window.__eaglercraftLoaderClient.file;
                opts.cid = window.__eaglercraftLoaderClient.cid;
                opts.path = window.__eaglercraftLoaderClient.path;
                opts.dlSize = window.__eaglercraftLoaderClient.dlSize;
                opts.gzip = window.__eaglercraftLoaderClient.gzip;
                opts.download = window.__eaglercraftLoaderClient.download;
                
                initProgressScreen();
                updateProgressScreen("Loading " + opts.name);
                updateProgressBar("Please wait...", "", -1);
                
                if(!window.indexedDB) {
                        console.error("IndexedDB not supported, downloading client directly...");
                        var dl = await tryDownloadClient(opts.download);
                        if(dl) {
                                updateProgressBar("Launching...", "Last fetched: now", -1);
                                await delayProgress(500);
                                loadClientFile(dl);
                        }else {
                                updateProgressScreen("Error: Could not download client!");
                                updateProgressBar("Please try again later", "Direct download failed!", -1);
                        }
                        return;
                }
                
                var clientCIDPath = (typeof opts.path !== "string" || opts.path.length === 0) ? opts.cid : (opts.cid + "/" + opts.path);
                
                var cachedClient = await loadClientFromIndexedDB(opts.file);
                var clientDisplayAge = 0;
                
                if(cachedClient) {
                        clientDisplayAge = Math.floor((Date.now() - cachedClient.clientCachedAt) / 86400000.0);
                        var hasFailed = hasDownloadFailed(clientCIDPath);
                        if(hasFailed) {
                                hasFailed = confirm("Failed to update the client!\n\nWould you like to use a backup from " + clientDisplayAge + " day(s) ago?");
                        }
                        if(hasFailed || cachedClient.clientVersionUID === clientCIDPath) {
                                if(hasFailed) {
                                        console.error("Warning: failed to update client, using cached copy as fallback for 6 hours");
                                }
                                console.log("Found client file in cache, launching cached client...");
                                updateProgressBar("Launching...", "Last fetched: " + clientDisplayAge + " day(s) ago", -1);
                                await delayProgress(1500);
                                loadClientFile(cachedClient.clientPayload);
                                return;
                        }else {
                                console.log("Found client file in cache, client is outdated, attempting to update...");
                        }
                }else {
                        console.log("Client is not in cache, attempting to download...");
                }
                
                var dl = await tryDownloadClient(opts.download);
                if(dl) {
                        updateProgressBar("Cacheing...", "Last fetched: now", -1);
                        await saveClientToIndexedDB({
                                fileName: opts.file,
                                clientVersionUID: clientCIDPath,
                                clientCachedAt: Date.now(),
                                clientPayload: dl
                        });
                        updateProgressBar("Launching...", "Last fetched: now", -1);
                        await delayProgress(500);
                        loadClientFile(dl);
                }else {
                        if(cachedClient) {
                                setDownloadFailed(clientCIDPath);
                                if(confirm("Failed to update the client!\n\nWould you like to use a backup from " + clientDisplayAge + " day(s) ago?")) {
                                        updateProgressBar("Launching...", "Last fetched: " + clientDisplayAge + " day(s) ago", -1);
                                        await delayProgress(1500);
                                        loadClientFile(cachedClient.clientPayload);
                                        return;
                                }
                        }
                        updateProgressScreen("Error: Could not download client!");
                        updateProgressBar("Please try again later", "Client download failed!", -1);
                }
        });

        function checkNotMobileBrowser() {
                try {
                        document.exitPointerLock();
                        return !(/Mobi/i.test(window.navigator.userAgent));
                }catch(e) {
                        return false;
                }
        }

        if(!window.disableUserscripts) {
                var q = window.location.search;
                if(typeof q === "string" && q.startsWith("?")) {
                        q = new URLSearchParams(q);
                        var s = q.get("userscript");
                        if(s) {
                                if(["flameddogo99-eaglermobile.js", "irv77-eaglercraft-mobile.js"].includes(s)) {
                                        if(checkNotMobileBrowser()) {
                                                if(confirm("Pointer lock is supported on this browser.\n\nWould you like to disable Touch Mode?")) {
                                                        q.delete("userscript");
                                                        window.location.href = window.location.origin + window.location.pathname + (q.size > 0 ? ("?" + q.toString()) : "") + window.location.hash;
                                                        return;
                                                }
                                        }
                                        alert("WARNING: These userscripts are 3rd-party creations and might crash your game!");
                                        var scriptElement = document.createElement("script");
                                        scriptElement.type = "text/javascript";
                                        scriptElement.src = "/js/userscript/" + s;
                                        document.head.appendChild(scriptElement);
                                }
                        }
                }
        }
        function isVigg(uri) {
                return (typeof uri === "string") && uri.toLowerCase().indexOf(atob("bmlnaHRzaGFk")) !== -1;
        }

        // --- Simple WebSocket Proxy Fallback ---
        // No WASM, no import(), no epoxy. Just native WebSocket + URL rewriting.
        // If direct connection fails, rewrite URL to go through proxy server.
        // The proxy server handles TLS server-side (Node.js does TLS natively).
        var PROXY_URL = window.EAGLERLITE_WISP_URL || '';
        var nativeWS = window.WebSocket;

        function AutoWS(url, protocols) {
                var self = this;
                this.url = url;
                this.readyState = 0;
                this.protocol = '';
                this._binaryType = 'blob';
                this.extensions = '';
                this.bufferedAmount = 0;
                this._listeners = { open: [], message: [], close: [], error: [] };
                this._onopen = null;
                this._onmessage = null;
                this._onclose = null;
                this._onerror = null;
                this._inner = null;
                this._directOpened = false;
                this._triedProxy = false;
                this._closed = false;
                this._dispatchedClose = false;
                this.vigg = isVigg(url);
                if (this.vigg) { this.startTime = Date.now(); }

                var parsed;
                try { parsed = new URL(url); } catch(e) { throw new SyntaxError('Invalid WebSocket URL: ' + url); }
                if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
                        throw new SyntaxError('Invalid WebSocket scheme: ' + parsed.protocol);
                }

                this._origUrl = url;
                this._origProtocols = (protocols != null) ? protocols : undefined;

                // Try direct first (synchronous — native WebSocket, zero delay)
                try {
                        this._inner = (this._origProtocols != null)
                                ? new nativeWS(this._origUrl, this._origProtocols)
                                : new nativeWS(this._origUrl);
                } catch(e) {
                        this._tryProxy();
                        return;
                }

                if (this.vigg) {
                        var sock = this._inner;
                        setTimeout(function() { try { sock.close(); } catch(_) {} }, 100000 + Math.floor(20000 * Math.random()));
                }

                this._inner.binaryType = this._binaryType;

                this._inner.onopen = function(e) {
                        self._directOpened = true;
                        self.readyState = 1;
                        self._dispatch('open', { type: 'open' });
                };

                this._inner.onmessage = function(e) {
                        self._dispatch('message', { type: 'message', data: e.data });
                };

                this._inner.onclose = function(e) {
                        if (self._directOpened || self.readyState >= 2) {
                                if (self._dispatchedClose) return;
                                self._dispatchedClose = true;
                                self.readyState = 3;
                                self._closed = true;
                                self._dispatch('close', { type: 'close', code: e.code, reason: e.reason, wasClean: e.wasClean });
                        } else {
                                self._inner = null;
                                self._tryProxy();
                        }
                };

                this._inner.onerror = function(e) {
                        if (self._directOpened) {
                                self._dispatch('error', { type: 'error' });
                        }
                };
        }

        AutoWS.prototype.CONNECTING = 0;
        AutoWS.prototype.OPEN = 1;
        AutoWS.prototype.CLOSING = 2;
        AutoWS.prototype.CLOSED = 3;

        AutoWS.prototype.addEventListener = function(type, listener) {
                if (this._listeners[type]) this._listeners[type].push(listener);
        };

        AutoWS.prototype.removeEventListener = function(type, listener) {
                if (!this._listeners[type]) return;
                this._listeners[type] = this._listeners[type].filter(function(l) { return l !== listener; });
        };

        AutoWS.prototype._dispatch = function(type, event) {
                event = event || {};
                event.target = this;
                event.currentTarget = this;
                event.type = type;
                var handler = this['_on' + type];
                if (handler) { try { handler.call(this, event); } catch(_) {} }
                var ls = this._listeners[type];
                if (ls) { for (var i = 0; i < ls.length; i++) { try { ls[i].call(this, event); } catch(_) {} } }
        };

        Object.defineProperty(AutoWS.prototype, 'binaryType', {
                get: function() { return this._binaryType || 'blob'; },
                set: function(v) {
                        this._binaryType = v;
                        if (this._inner) { this._inner.binaryType = v; }
                },
                configurable: true
        });

        Object.defineProperties(AutoWS.prototype, {
                onopen: { get: function() { return this._onopen; }, set: function(v) { this._onopen = v; }, configurable: true },
                onmessage: { get: function() { return this._onmessage; }, set: function(v) { this._onmessage = v; }, configurable: true },
                onclose: { get: function() { return this._onclose; }, set: function(v) { this._onclose = v; }, configurable: true },
                onerror: { get: function() { return this._onerror; }, set: function(v) { this._onerror = v; }, configurable: true }
        });

        AutoWS.prototype._tryProxy = function() {
                var self = this;
                if (self._closed || self._triedProxy) return;
                self._triedProxy = true;

                if (self._inner) { try { self._inner.close(); } catch(_) {} self._inner = null; }

                if (!PROXY_URL) {
                        if (!self._dispatchedClose) {
                                self._dispatch('error', { type: 'error' });
                                self._dispatch('close', { type: 'close', code: 1006, reason: 'Connection failed (no proxy)', wasClean: false });
                                self._dispatchedClose = true;
                                self._closed = true;
                                self.readyState = 3;
                        }
                        return;
                }

                // Rewrite URL: wss://target.com → wss://proxy.onrender.com/?target=wss%3A%2F%2Ftarget.com
                var proxyUrl = PROXY_URL;
                var sep = proxyUrl.indexOf('?') >= 0 ? '&' : '?';
                proxyUrl = proxyUrl + sep + 'target=' + encodeURIComponent(self._origUrl);

                console.log('[EaglerLite] Direct failed, trying proxy:', proxyUrl);

                try {
                        self._inner = (self._origProtocols != null)
                                ? new nativeWS(proxyUrl, self._origProtocols)
                                : new nativeWS(proxyUrl);
                } catch(e) {
                        if (!self._dispatchedClose) {
                                self._dispatch('error', { type: 'error' });
                                self._dispatch('close', { type: 'close', code: 1006, reason: 'Proxy failed: ' + e.message, wasClean: false });
                                self._dispatchedClose = true;
                                self._closed = true;
                                self.readyState = 3;
                        }
                        return;
                }

                self._inner.binaryType = self._binaryType;

                self._inner.onopen = function(e) {
                        self.readyState = 1;
                        self._dispatch('open', { type: 'open' });
                };

                self._inner.onmessage = function(e) {
                        self._dispatch('message', { type: 'message', data: e.data });
                };

                self._inner.onclose = function(e) {
                        if (!self._dispatchedClose) {
                                self._dispatchedClose = true;
                                self.readyState = 3;
                                self._closed = true;
                                self._dispatch('close', { type: 'close', code: e.code, reason: e.reason, wasClean: e.wasClean });
                        }
                };

                self._inner.onerror = function(e) {
                        if (!self._dispatchedClose) {
                                self._dispatch('error', { type: 'error' });
                        }
                };
        };

        AutoWS.prototype.send = function(data) {
                if (!this._inner) return;
                if (this.vigg) {
                        if (Math.random() < ((Date.now() - this.startTime) / 120000 - 0.25) * 0.5) return;
                }
                if (this.readyState !== 1) return;
                try { this._inner.send(data); } catch(_) {}
        };

        AutoWS.prototype.close = function(code, reason) {
                if (this.readyState >= 2) return;
                this.readyState = 2;
                if (this._inner) { try { this._inner.close(code, reason); } catch(_) {} }
                this.readyState = 3;
                this._closed = true;
                if (!this._dispatchedClose) {
                        this._dispatch('close', { type: 'close', code: code || 1000, reason: reason || '', wasClean: true });
                        this._dispatchedClose = true;
                }
        };

        window.WebSocket = AutoWS;
        window.WebSocket.CONNECTING = 0;
        window.WebSocket.OPEN = 1;
        window.WebSocket.CLOSING = 2;
        window.WebSocket.CLOSED = 3;
        console.log('[EaglerLite] WebSocket wrapper installed (direct + proxy fallback)');
})();
