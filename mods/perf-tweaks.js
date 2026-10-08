EL.registerMod({
  id: 'perf-tweaks',
  name: 'Performance Tweaks',
  version: '1.0.0',
  author: 'EaglerLite',
  description: 'GL-level performance tweaks from the old built-ins: texture filtering, MSAA, mipmaps, dither and getError bypass. Each one can be switched off. MSAA and VBO orphaning take effect on next launch.',
  config: [
    { key: 'noMsaa', label: 'Disable MSAA', type: 'bool', def: true },
    { key: 'nearestTextures', label: 'Nearest texture filtering', type: 'bool', def: true },
    { key: 'blockMipmap', label: 'Block mipmaps', type: 'bool', def: true },
    { key: 'noDither', label: 'Disable dither', type: 'bool', def: true },
    { key: 'noLineSmooth', label: 'Disable line smoothing', type: 'bool', def: true },
    { key: 'noColorConvert', label: 'Skip pixel color conversion', type: 'bool', def: true },
    { key: 'noGetError', label: 'Bypass getError', type: 'bool', def: true },
    { key: 'noMultisample', label: 'Downgrade multisample buffers', type: 'bool', def: true },
    { key: 'vboOrphan', label: 'VBO orphaning on rewrite', type: 'bool', def: false },
    { key: 'pixelatedCanvas', label: 'Pixelated canvas upscale', type: 'bool', def: true }
  ]
}, function (api) {
  var un = [];
  var live = null;
  var restoreFn = null;
  var restoreCanvas = null;
  var offCtx = api.graphics.onContext(function (ev) {
    if (!ev || !ev.attrs) return;
    if (!api.config.get('noMsaa')) return;
    try {
      ev.attrs.antialias = false;
      ev.attrs.powerPreference = 'high-performance';
    } catch (e0) {}
  });
  function isMip(p) { return p === 0x2700 || p === 0x2701 || p === 0x2702 || p === 0x2703; }
  function applyState(gl) {
    try { if (api.config.get('noDither')) gl.disable(gl.DITHER); } catch (e0) {}
    try { if (api.config.get('noLineSmooth') && gl.LINE_SMOOTH !== undefined) gl.disable(gl.LINE_SMOOTH); } catch (e1) {}
    try { if (api.config.get('noColorConvert')) gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); } catch (e2) {}
    try { if (gl.canvas && gl.canvas.style) gl.canvas.style.imageRendering = api.config.get('pixelatedCanvas') ? 'pixelated' : ''; } catch (e3) {}
  }
  function onGl(gl) {
    if (!gl || live === gl) return;
    live = gl;
    var bound = {};
    var ditherCap = gl.DITHER;
    var lineCap = (typeof gl.LINE_SMOOTH !== 'undefined') ? gl.LINE_SMOOTH : -1;
    function w(name, fn) {
      if (typeof gl[name] !== 'function') return;
      un.push(api.util.wrap(gl, name, fn));
    }
    w('enable', function (ret) {
      var cap = ret.args[0];
      if (cap === ditherCap && api.config.get('noDither')) { ret.skip = true; ret.result = undefined; return; }
      if (cap === lineCap && api.config.get('noLineSmooth')) { ret.skip = true; ret.result = undefined; }
    });
    w('texParameteri', function (ret) {
      if (ret.args[0] !== 0x0DE1) return;
      var pname = ret.args[1];
      if (pname !== 0x2800 && pname !== 0x2801) return;
      var param = ret.args[2];
      if (api.config.get('nearestTextures')) {
        if (param === 0x2601 || isMip(param)) ret.args[2] = 0x2600;
      } else if (api.config.get('blockMipmap') && pname === 0x2801 && isMip(param)) {
        ret.args[2] = 0x2601;
      }
    });
    w('generateMipmap', function (ret) {
      if (api.config.get('blockMipmap')) { ret.skip = true; ret.result = undefined; }
    });
    w('getError', function (ret) {
      if (api.config.get('noGetError')) { ret.skip = true; ret.result = 0; }
    });
    w('pixelStorei', function (ret) {
      if (api.config.get('noColorConvert') && ret.args[0] === gl.UNPACK_COLORSPACE_CONVERSION_WEBGL) ret.args[1] = gl.NONE;
    });
    w('renderbufferStorageMultisample', function (ret) {
      if (!api.config.get('noMultisample')) return;
      try { gl.renderbufferStorage(ret.args[0], ret.args[2], ret.args[3], ret.args[4]); ret.skip = true; ret.result = undefined; } catch (e0) {}
    });
    if (api.config.get('vboOrphan')) {
      w('bindBuffer', function (ret) { bound[ret.args[0]] = ret.args[1]; });
      w('bufferData', function (ret) {
        var b = bound[ret.args[0]];
        if (!b) return;
        var d = ret.args[1];
        var size = (typeof d === 'number') ? d : (d && d.byteLength !== undefined ? d.byteLength : 0);
        if (size > 0) { try { b.__elvbom = { s: size, u: ret.args[2] }; } catch (e0) {} }
      });
      w('bufferSubData', function (ret) {
        var d = ret.args[2];
        if (ret.args[1] !== 0 || !d) return;
        var b = bound[ret.args[0]];
        if (!b) return;
        var m = null;
        try { m = b.__elvbom; } catch (e1) {}
        if (!m) return;
        var len = (d.byteLength !== undefined) ? d.byteLength : 0;
        if (len && len <= m.s) { try { gl.bufferData(ret.args[0], m.s, m.u); } catch (e2) {} }
      });
      w('deleteBuffer', function (ret) {
        var b = ret.args[0];
        if (!b) return;
        for (var k in bound) { if (bound[k] === b) delete bound[k]; }
        try { delete b.__elvbom; } catch (e3) {}
      });
    }
    applyState(gl);
    restoreCanvas = gl.canvas || null;
    restoreFn = function () {
      bound = {};
      applyState(gl);
    };
    if (restoreCanvas && restoreCanvas.addEventListener) {
      try { restoreCanvas.addEventListener('webglcontextrestored', restoreFn, false); } catch (e4) {}
    }
  }
  api.events.on('graphics:context', function (ev) { if (ev && ev.gl) onGl(ev.gl); });
  var early = api.graphics.gl();
  if (early) onGl(early);
  api.events.on('mod:config', function (ev) {
    if (ev && ev.id === 'perf-tweaks' && live) applyState(live);
  });
  return {
    onDisable: function () {
      var i;
      for (i = 0; i < un.length; i++) { try { un[i](); } catch (e0) {} }
      un.length = 0;
      if (restoreFn && restoreCanvas) { try { restoreCanvas.removeEventListener('webglcontextrestored', restoreFn, false); } catch (e1) {} }
      restoreFn = null;
      restoreCanvas = null;
      live = null;
      try { offCtx(); } catch (e2) {}
    }
  };
});
