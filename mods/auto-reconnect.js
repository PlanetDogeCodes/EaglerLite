EL.registerMod({
  id: 'auto-reconnect',
  name: 'Auto Reconnect',
  version: '1.0.0',
  author: 'EaglerLite',
  description: 'Reconnects automatically after a disconnect (delay + retries configurable), like the old built-in.',
  config: [
    { key: 'delayMs', label: 'Delay before reconnect (ms)', type: 'number', def: 2500, min: 500, max: 30000, step: 500 },
    { key: 'retries', label: 'Retry attempts', type: 'number', def: 1, min: 0, max: 10, step: 1 }
  ]
}, function (api) {
  var st = {
    uri: null,
    retryCount: 0,
    pendingTimer: null,
    cancelled: false,
    lastScreen: '',
    manualPending: false,
    connected: false,
    flowActive: false,
    dropAt: 0,
    dropBeforePause: false
  };
  var timers = [];

  function cfgDelay() {
    var n = Number(api.config.get('delayMs'));
    return (n >= 500 && n <= 30000) ? n : 2500;
  }

  function cfgRetries() {
    var n = Number(api.config.get('retries'));
    return (n >= 0 && n <= 10) ? n : 1;
  }

  function short(n) {
    var s = String(n || '');
    var p = s.split('.');
    return p[p.length - 1];
  }

  function later(ms, fn) {
    var t = setTimeout(function () {
      for (var i = 0; i < timers.length; i++) { if (timers[i] === t) { timers.splice(i, 1); break; } }
      if (!st.cancelled) fn();
    }, ms);
    timers.push(t);
    return t;
  }

  function clearTimers() {
    for (var i = 0; i < timers.length; i++) { clearTimeout(timers[i]); }
    timers.length = 0;
    st.pendingTimer = null;
  }

  function lastUri() {
    try { if (window.__eaglerLastServerURI) return String(window.__eaglerLastServerURI); } catch (e0) {}
    return st.uri;
  }

  function stopFlow() {
    clearTimers();
    st.flowActive = false;
  }

  function hardCancel(msg) {
    st.cancelled = true;
    stopFlow();
    if (msg) api.log('auto-reconnect: ' + msg);
  }

  api.events.on('net:connected', function (ev) {
    var u = String((ev && ev.url) || '');
    if (!u) return;
    var host = u;
    if (host.indexOf('ws://') === 0) host = host.substring(5);
    else if (host.indexOf('wss://') === 0) host = host.substring(6);
    else return;
    host = host.split('/')[0].toLowerCase();
    if (host.indexOf('relay') >= 0) return;
    st.uri = u;
    st.connected = true;
  });

  api.events.on('net:close', function (ev) {
    var u = String((ev && ev.url) || '');
    if (st.uri && u === st.uri) {
      st.connected = false;
      st.dropAt = Date.now();
    }
  });

  api.events.on('input:key', function (ev) {
    if (ev.down && (ev.code || '') === 'Escape') stopFlow();
  });

  api.events.on('game:screen', function (ev) {
    var n = ev.name ? String(ev.name) : '';
    var s = short(n);
    var prev = st.lastScreen;
    if (s === 'GuiDisconnected') {
      st.lastScreen = s;
      if (st.manualPending || prev === 'GuiIngameMenu') {
        if (st.dropAt && (Date.now() - st.dropAt) < 8000 && st.dropBeforePause) {
          st.manualPending = false;
          st.connected = false;
          api.log('auto-reconnect: connection dropped while paused, reconnecting');
          scheduleReconnect();
          return;
        }
        st.manualPending = false;
        st.connected = false;
        api.log('auto-reconnect: manual disconnect, not reconnecting');
        return;
      }
      st.connected = false;
      scheduleReconnect();
      return;
    }
    if (s === 'GuiIngameMenu') {
      st.dropBeforePause = !!(st.dropAt && (Date.now() - st.dropAt) < 5000 && st.connected === false);
      st.manualPending = true;
    } else if (s === 'GuiConnecting' || s === 'GuiDownloadTerrain' || s === 'GuiScreenSingleplayerConnecting') {
      stopFlow();
      st.connected = false;
    } else if (s === 'GuiMainMenu' || s === 'GuiMultiplayer' || s === 'GuiWorldSelection') {
      if (!st.flowActive) hardCancel('user navigated to ' + s + ', cancelled');
      else if (s !== 'GuiMultiplayer') hardCancel('unexpected navigation to ' + s + ', cancelled');
    } else if (!n) {
      st.connected = true;
      st.cancelled = false;
      st.retryCount = 0;
      st.manualPending = false;
      stopFlow();
    }
    st.lastScreen = s;
  });

  function scheduleReconnect() {
    if (st.cancelled) return;
    if (st.retryCount >= cfgRetries()) {
      if (cfgRetries() > 0) api.toast('Auto Reconnect gave up after ' + st.retryCount + ' attempt(s)', 4000, 'err');
      api.log('auto-reconnect: max retries (' + cfgRetries() + ') reached, giving up');
      return;
    }
    var uri = lastUri();
    if (!uri) { api.log('auto-reconnect: no last server address, cannot reconnect'); return; }
    clearTimers();
    st.retryCount++;
    var d = cfgDelay();
    if (st.retryCount > 1) d = Math.round(cfgDelay() * Math.pow(1.5, st.retryCount - 1));
    api.log('auto-reconnect: attempt ' + st.retryCount + '/' + cfgRetries() + ' in ' + d + 'ms');
    api.toast('Auto Reconnect: retrying in ' + (d / 1000) + 's', 3000);
    st.pendingTimer = later(d, function () {
      st.pendingTimer = null;
      if (st.cancelled) return;
      if (st.connected) { api.log('auto-reconnect: already connected, skipping'); return; }
      doReconnect();
    });
  }

  function doReconnect() {
    var uri = lastUri();
    if (!uri) { api.log('auto-reconnect: no address, cannot reconnect'); return; }
    try {
      if (window.__eaglerReconnect) {
        window.__eaglerReconnect(uri);
        return;
      }
    } catch (e0) {}
    startFlow(uri);
  }

  function row1Y() {
    var ss = api.game.screenState();
    var h = (ss && ss.height) ? ss.height : 240;
    return Math.round(((h - 42) / h) * 1000) / 10;
  }

  function tryCands(list, cb) {
    var i = 0;
    var base = short(api.game.screen());
    function step() {
      if (i >= list.length) { cb(false); return; }
      var c = list[i++];
      api.game.click(c[0], c[1]);
      later(800, function () {
        if (short(api.game.screen()) !== base) { cb(true); return; }
        step();
      });
    }
    step();
  }

  function startFlow(uri) {
    if (short(api.game.screen()) !== 'GuiDisconnected') {
      api.log('auto-reconnect: not on the disconnect screen, cannot click through');
      return;
    }
    st.flowActive = true;
    var y1 = row1Y();
    tryCands([[50, 62], [50, 65], [50, 68], [50, 71], [50, 74]], function () {
      var s = short(api.game.screen());
      if (s === 'GuiMultiplayer') {
        tryCands([[50, y1], [50, 85.2], [50, 84], [50, y1 - 1], [50, y1 + 1]], function () {
          var s2 = short(api.game.screen());
          if (s2 === 'GuiScreenServerList') typeAndJoin(uri);
          else fail('could not open direct connect (' + s2 + ')');
        });
      } else if (s === 'GuiScreenServerList') {
        typeAndJoin(uri);
      } else {
        fail('unexpected screen after leaving the disconnect screen: ' + s);
      }
    });
    function fail(msg) {
      st.flowActive = false;
      api.log('auto-reconnect: ' + msg);
    }
    function typeAndJoin(u) {
      later(700, function () {
        if (short(api.game.screen()) !== 'GuiScreenServerList') { fail('lost the connect screen'); return; }
        api.game.click(50, 50);
        later(600, function () {
          if (short(api.game.screen()) !== 'GuiScreenServerList') { fail('lost the connect screen'); return; }
          api.game.type(u);
          later(800, function () {
            if (short(api.game.screen()) !== 'GuiScreenServerList') { fail('lost the connect screen'); return; }
            tryCands([[50, 68], [50, 70], [50, 66], [50, 64]], function (moved) {
              var s3 = short(api.game.screen());
              st.flowActive = false;
              if (moved && s3 !== 'GuiScreenServerList') api.log('auto-reconnect: join sent (' + s3 + ')');
              else fail('could not click Join Server');
            });
          });
        });
      });
    }
  }

  return {
    onDisable: function () {
      st.cancelled = true;
      stopFlow();
    }
  };
});
