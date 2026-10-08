EL.registerMod({
  id: 'frame-control',
  name: 'Frame Control',
  version: '1.0.0',
  author: 'EaglerLite',
  description: 'Caps the framerate, drops to a low FPS when the tab is hidden, and can bypass vsync through the 60Hz rAF limit like the old built-in.',
  config: [
    { key: 'targetFPS', label: 'Target FPS (240 = uncapped)', type: 'number', def: 120, min: 20, max: 240, step: 10 },
    { key: 'idleFPS', label: 'FPS when tab hidden', type: 'number', def: 1, min: 1, max: 30, step: 1 },
    { key: 'bypassVsync', label: 'Bypass vsync when uncapped', type: 'bool', def: true }
  ]
}, function (api) {
  var cfg = { target: 120, idle: 1, bypass: true };
  var mine = {};
  var pendingIdle = null;
  var last = 0;
  var origRaf = null;
  function readCfg() {
    var t = Number(api.config.get('targetFPS'));
    cfg.target = (t >= 20 && t <= 240) ? t : 120;
    var d = Number(api.config.get('idleFPS'));
    cfg.idle = (d >= 1 && d <= 30) ? d : 1;
    cfg.bypass = api.config.get('bypassVsync') !== false;
  }
  function now() { return (window.performance && window.performance.now) ? window.performance.now() : Date.now(); }
  function poke() {
    if (!origRaf) return;
    try { origRaf(function () {}); } catch (e0) {}
  }
  function onVis() {
    if (document.hidden || !pendingIdle) return;
    var p = pendingIdle;
    pendingIdle = null;
    try { clearTimeout(p.id); } catch (e0) {}
    delete mine[p.id];
    try { window.requestAnimationFrame(p.cb); } catch (e1) {}
  }
  readCfg();
  var origSrc = '';
  try { origSrc = String(window.requestAnimationFrame); } catch (eS) {}
  var unRaf = api.util.wrap(window, 'requestAnimationFrame', function (ret, orig) {
    if (!origRaf) origRaf = orig;
    var cb = ret.args[0];
    if (typeof cb !== 'function') return;
    if (document.hidden) {
      if (pendingIdle) {
        try { clearTimeout(pendingIdle.id); } catch (e0) {}
        delete mine[pendingIdle.id];
        pendingIdle = null;
      }
      var tid = setTimeout(function () {
        if (pendingIdle && pendingIdle.id === tid) pendingIdle = null;
        delete mine[tid];
        try { cb(now()); } catch (e1) {}
      }, Math.max(33, 1000 / cfg.idle));
      mine[tid] = 1;
      pendingIdle = { id: tid, cb: cb };
      poke();
      ret.skip = true;
      ret.result = tid;
      return;
    }
    if (cfg.target < 240) {
      var interval = 1000 / cfg.target;
      var elapsed = now() - last;
      if (elapsed < interval) {
        var fid = setTimeout(function () {
          delete mine[fid];
          last = now();
          try { cb(last); } catch (e2) {}
        }, interval - elapsed);
        mine[fid] = 1;
        poke();
        ret.skip = true;
        ret.result = fid;
        return;
      }
      last = now();
      return;
    }
    if (cfg.bypass) {
      var uid = setTimeout(function () {
        delete mine[uid];
        try { cb(now()); } catch (e3) {}
      }, 0);
      mine[uid] = 1;
      poke();
      ret.skip = true;
      ret.result = uid;
    }
  });
  if (origSrc) {
    try {
      window.requestAnimationFrame.toString = function () { return origSrc; };
      if (String(window.requestAnimationFrame.toString.toString) !== String(Function.prototype.toString)) window.requestAnimationFrame.toString.toString = Function.prototype.toString.toString;
    } catch (eT) {}
  }
  var unCaf = api.util.wrap(window, 'cancelAnimationFrame', function (ret) {
    var id = ret.args[0];
    if (id == null) return;
    if (mine[id]) { try { clearTimeout(id); } catch (e0) {} delete mine[id]; }
    if (pendingIdle && pendingIdle.id === id) { try { clearTimeout(id); } catch (e1) {} pendingIdle = null; }
  });
  document.addEventListener('visibilitychange', onVis, false);
  api.events.on('mod:config', function (ev) {
    if (ev && ev.id === 'frame-control') readCfg();
  });
  return {
    onDisable: function () {
      document.removeEventListener('visibilitychange', onVis, false);
      try { unRaf(); } catch (e2) {}
      try { unCaf(); } catch (e3) {}
    }
  };
});
