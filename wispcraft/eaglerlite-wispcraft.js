/*
 * EaglerLite Wispcraft Connector v1.1
 *
 * Self-contained epoxy-tls WebSocket wrapper for EaglerLite.
 * Loads epoxy-tls (WASM) from CDN, replaces window.WebSocket with AutoWS
 * that tries direct connection first, falls back to epoxy-tls proxy.
 *
 * Usage: Load this script BEFORE the game starts.
 *        Set window.EAGLERLITE_WISP_URL to override the default proxy URL.
 *
 * License: Apache 2.0 (epoxy-tls is AGPL-3.0 — check compatibility)
 */

(function() {
  'use strict';

  var DEFAULT_WISP_URL = 'wss://anura.pro/';
  var EPOXY_CDN = 'https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-tls@2.1.19-1/full/epoxy-bundled.js';

  var wispUrl = window.EAGLERLITE_WISP_URL || DEFAULT_WISP_URL;
  // Normalize: ensure trailing slash
  try {
    var _u = new URL(wispUrl);
    if (!_u.pathname.endsWith('/')) { _u.pathname += '/'; }
    wispUrl = _u.href;
  } catch(_) {}

  var origWS = window.WebSocket;
  var epoxyReady = false;
  var epoxyInitPromise = null;
  var epoxyClient = null;
  var EpoxyHandlersClass = null;
  var EpoxyClientClass = null;
  var EpoxyClientOptionsClass = null;

  // --- Epoxy initialization ---

  function initEpoxy() {
    if (epoxyInitPromise) return epoxyInitPromise;
    epoxyInitPromise = import(EPOXY_CDN).then(function(mod) {
      return mod.default().then(function() {
        EpoxyClientClass = mod.EpoxyClient;
        EpoxyClientOptionsClass = mod.EpoxyClientOptions;
        EpoxyHandlersClass = mod.EpoxyHandlers;
        var opts = new EpoxyClientOptionsClass();
        opts.wisp_v2 = false;
        opts.udp_extension_required = false;
        epoxyClient = new EpoxyClientClass(wispUrl, opts);
        epoxyReady = true;
        console.log('[EaglerLite] Epoxy-TLS initialized (wisp:', wispUrl + ')');
      });
    }).catch(function(e) {
      console.error('[EaglerLite] Epoxy-TLS init failed:', e);
      throw e;
    });
    return epoxyInitPromise;
  }

  // Start loading epoxy immediately (non-blocking)
  initEpoxy();

  // --- EpoxyWS: wraps epoxy's connect_websocket ---

  function EpoxyWS(url, protocols) {
    var self = this;
    this.url = url;
    this.readyState = 0;
    this.protocol = '';
    this._binaryType = 'arraybuffer';
    this.extensions = '';
    this.bufferedAmount = 0;
    this._listeners = { open: [], message: [], close: [], error: [] };
    this._onopen = null;
    this._onmessage = null;
    this._onclose = null;
    this._onerror = null;
    this._inner = null;
    this._queue = [];
    this._closed = false;
    this._dispatchedClose = false;

    var protos = Array.isArray(protocols) ? protocols : (protocols ? [protocols] : []);

    initEpoxy().then(function() {
      if (self._closed) return;
      if (!EpoxyHandlersClass || !epoxyClient) {
        self._fail('Epoxy not properly initialized');
        return;
      }

      var handlers = new EpoxyHandlersClass(
        // onopen
        function() {
          if (self._closed) return;
          self.readyState = 1;
          self._dispatch('open', { type: 'open', target: self });
          // Flush queued messages
          for (var i = 0; i < self._queue.length; i++) {
            try { self._inner.send(self._queue[i]); } catch(_) {}
          }
          self._queue = [];
        },
        // onclose
        function() {
          if (self._dispatchedClose) return;
          self._dispatchedClose = true;
          self.readyState = 3;
          self._closed = true;
          self._dispatch('close', { type: 'close', code: 1000, reason: '', wasClean: true, target: self });
          if (self._inner) { try { self._inner.free(); } catch(_) {} self._inner = null; }
        },
        // onerror
        function(err) {
          console.error('[EaglerLite] Epoxy WS error:', err);
          if (!self._dispatchedClose) {
            self._dispatch('error', { type: 'error', target: self });
          }
        },
        // onmessage
        function(data) {
          if (self._closed) return;
          // data is Uint8Array — convert to ArrayBuffer for game compatibility
          var buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
          self._dispatch('message', { type: 'message', data: buf, target: self });
        }
      );

      epoxyClient.connect_websocket(handlers, url, protos, {}).then(function(ws) {
        if (self._closed) { try { ws.close(1000, ''); } catch(_) {} try { ws.free(); } catch(_) {} return; }
        self._inner = ws;
      }).catch(function(e) {
        console.error('[EaglerLite] Epoxy connect_websocket failed:', e);
        if (!self._dispatchedClose) {
          self._dispatch('error', { type: 'error', target: self });
          self._dispatch('close', { type: 'close', code: 1006, reason: 'Epoxy connection failed', wasClean: false, target: self });
          self._dispatchedClose = true;
          self._closed = true;
          self.readyState = 3;
        }
      });
    }).catch(function(e) {
      if (!self._dispatchedClose) {
        self._dispatch('error', { type: 'error', target: self });
        self._dispatch('close', { type: 'close', code: 1006, reason: 'Epoxy init failed', wasClean: false, target: self });
        self._dispatchedClose = true;
        self._closed = true;
        self.readyState = 3;
      }
    });
  }

  EpoxyWS.prototype.CONNECTING = 0;
  EpoxyWS.prototype.OPEN = 1;
  EpoxyWS.prototype.CLOSING = 2;
  EpoxyWS.prototype.CLOSED = 3;

  EpoxyWS.prototype.addEventListener = function(type, listener) {
    if (this._listeners[type]) this._listeners[type].push(listener);
  };

  EpoxyWS.prototype.removeEventListener = function(type, listener) {
    if (!this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter(function(l) { return l !== listener; });
  };

  EpoxyWS.prototype._dispatch = function(type, event) {
    event = event || {};
    event.target = this;
    event.currentTarget = this;
    event.type = type;
    var handler = this['_on' + type];
    if (handler) { try { handler.call(this, event); } catch(_) {} }
    var ls = this._listeners[type];
    if (ls) { for (var i = 0; i < ls.length; i++) { try { ls[i].call(this, event); } catch(_) {} } }
  };

  EpoxyWS.prototype._fail = function(reason) {
    if (this._dispatchedClose) return;
    this._dispatch('error', { type: 'error', target: this });
    this._dispatch('close', { type: 'close', code: 1006, reason: reason, wasClean: false, target: this });
    this._dispatchedClose = true;
    this._closed = true;
    this.readyState = 3;
  };

  Object.defineProperty(EpoxyWS.prototype, 'binaryType', {
    get: function() { return this._binaryType || 'arraybuffer'; },
    set: function(v) { this._binaryType = v; },
    configurable: true
  });

  Object.defineProperties(EpoxyWS.prototype, {
    onopen: { get: function() { return this._onopen; }, set: function(v) { this._onopen = v; }, configurable: true },
    onmessage: { get: function() { return this._onmessage; }, set: function(v) { this._onmessage = v; }, configurable: true },
    onclose: { get: function() { return this._onclose; }, set: function(v) { this._onclose = v; }, configurable: true },
    onerror: { get: function() { return this._onerror; }, set: function(v) { this._onerror = v; }, configurable: true }
  });

  EpoxyWS.prototype.send = function(data) {
    if (this.readyState !== 1) {
      if (this.readyState === 0) { this._queue.push(data); }
      return;
    }
    if (!this._inner) return;
    try {
      if (data instanceof ArrayBuffer) {
        this._inner.send(data);
      } else if (typeof data === 'string') {
        this._inner.send(data);
      } else if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(data)) {
        this._inner.send(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      } else {
        this._inner.send(data);
      }
    } catch(e) {
      console.error('[EaglerLite] Epoxy send error:', e);
    }
  };

  EpoxyWS.prototype.close = function(code, reason) {
    if (this.readyState >= 2) return;
    this.readyState = 2;
    if (this._inner) { try { this._inner.close(code || 1000, reason || ''); } catch(_) {} }
    this.readyState = 3;
    this._closed = true;
    if (!this._dispatchedClose) {
      this._dispatch('close', { type: 'close', code: code || 1000, reason: reason || '', wasClean: true, target: this });
      this._dispatchedClose = true;
    }
  };

  // --- AutoWS: tries direct first, falls back to EpoxyWS ---

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
    this._triedEpoxy = false;
    this._closed = false;
    this._dispatchedClose = false;

    // Validate URL synchronously (like native WebSocket)
    var parsed;
    try { parsed = new URL(url); } catch(e) { throw new SyntaxError('Invalid WebSocket URL: ' + url); }
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      throw new SyntaxError('Invalid WebSocket scheme: ' + parsed.protocol);
    }

    this._origUrl = url;
    this._origProtocols = (protocols != null) ? protocols : undefined;

    // Try direct first (synchronous — no setTimeout delay)
    try {
      this._inner = (this._origProtocols != null)
        ? new origWS(this._origUrl, this._origProtocols)
        : new origWS(this._origUrl);
    } catch(e) {
      // Direct threw synchronously — try epoxy
      this._tryEpoxy();
      return;
    }

    // Wire up direct connection events
    this._inner.binaryType = this._binaryType;

    this._inner.onopen = function(e) {
      self._directOpened = true;
      self.readyState = 1;
      self._dispatch('open', { type: 'open', target: self });
    };

    this._inner.onmessage = function(e) {
      self._dispatch('message', { type: 'message', data: e.data, target: self });
    };

    this._inner.onclose = function(e) {
      if (self._directOpened || self.readyState >= 2) {
        // Connection was open then closed, or was explicitly closed
        if (self._dispatchedClose) return;
        self._dispatchedClose = true;
        self.readyState = 3;
        self._closed = true;
        self._dispatch('close', { type: 'close', code: e.code, reason: e.reason, wasClean: e.wasClean, target: self });
      } else {
        // Direct failed before opening — try epoxy fallback
        self._inner = null;
        self._tryEpoxy();
      }
    };

    this._inner.onerror = function(e) {
      if (self._directOpened) {
        self._dispatch('error', { type: 'error', target: self });
      }
      // If not opened yet, let onclose handle the fallback
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
      if (this._inner && this._inner instanceof origWS) { this._inner.binaryType = v; }
    },
    configurable: true
  });

  Object.defineProperties(AutoWS.prototype, {
    onopen: { get: function() { return this._onopen; }, set: function(v) { this._onopen = v; }, configurable: true },
    onmessage: { get: function() { return this._onmessage; }, set: function(v) { this._onmessage = v; }, configurable: true },
    onclose: { get: function() { return this._onclose; }, set: function(v) { this._onclose = v; }, configurable: true },
    onerror: { get: function() { return this._onerror; }, set: function(v) { this._onerror = v; }, configurable: true }
  });

  AutoWS.prototype._tryEpoxy = function() {
    var self = this;
    if (self._closed || self._triedEpoxy) return;
    self._triedEpoxy = true;

    if (self._inner) { try { self._inner.close(); } catch(_) {} self._inner = null; }

    console.log('[EaglerLite] Direct failed, falling back to Epoxy-TLS for:', self._origUrl);

    var ep = new EpoxyWS(self._origUrl, self._origProtocols);
    self._inner = ep;

    // Share listeners and event handlers — EpoxyWS dispatches directly to AutoWS's listeners
    // We don't reassign _listeners because the game may have already called addEventListener on the AutoWS
    // Instead, EpoxyWS dispatches, and we forward from ep to self
    // But since ep._listeners is separate, we need to make ep dispatch to self's listeners

    // Override ep's _dispatch to forward to self
    var origEpDispatch = ep._dispatch.bind(ep);
    ep._dispatch = function(type, event) {
      event = event || {};
      event.target = self; // Target is the AutoWS, not the inner EpoxyWS
      event.currentTarget = self;
      event.type = type;

      // Update self's readyState based on epoxy events
      if (type === 'open') { self.readyState = 1; }
      if (type === 'close') {
        if (self._dispatchedClose) return;
        self._dispatchedClose = true;
        self.readyState = 3;
        self._closed = true;
      }

      // Dispatch to self's handlers
      var handler = self['_on' + type];
      if (handler) { try { handler.call(self, event); } catch(_) {} }
      var ls = self._listeners[type];
      if (ls) { for (var i = 0; i < ls.length; i++) { try { ls[i].call(self, event); } catch(_) {} } }
    };
  };

  AutoWS.prototype.send = function(data) {
    if (!this._inner) return;
    if (this._inner instanceof EpoxyWS) {
      this._inner.send(data);
      return;
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
      this._dispatch('close', { type: 'close', code: code || 1000, reason: reason || '', wasClean: true, target: this });
      this._dispatchedClose = true;
    }
  };

  // --- Replace window.WebSocket ---

  window.WebSocket = function(url, protocols) {
    // Don't wrap the wisp proxy connection itself — it needs native WebSocket
    if (url === wispUrl) {
      return new origWS(url, protocols);
    }
    return new AutoWS(url, protocols);
  };

  window.WebSocket.prototype = AutoWS.prototype;
  AutoWS.prototype.constructor = window.WebSocket;
  window.WebSocket.CONNECTING = 0;
  window.WebSocket.OPEN = 1;
  window.WebSocket.CLOSING = 2;
  window.WebSocket.CLOSED = 3;

  // Allow EaglerLite to configure the wisp URL
  window.__eaglerliteSetWispUrl = function(url) {
    var u = new URL(url);
    if (!u.pathname.endsWith('/')) { u.pathname += '/'; }
    wispUrl = u.href;
  };

  // Allow checking if epoxy is ready
  window.__eaglerliteEpoxyReady = function() { return epoxyReady; };

  console.log('[EaglerLite] Wispcraft connector loaded (wisp:', wispUrl + ')');
})();
