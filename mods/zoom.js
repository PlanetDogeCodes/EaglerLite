EL.registerMod({
  id: 'zoom',
  name: 'Zoom',
  version: '1.0.0',
  author: 'EaglerLite',
  description: 'Hold a key to zoom the screen like the old built-in (CSS zoom of the game canvas).',
  config: [
    { key: 'zoomKey', label: 'Zoom key', type: 'key', def: 'KeyC' },
    { key: 'factor', label: 'Zoom factor', type: 'number', def: 4, min: 1.5, max: 10, step: 0.5 },
    { key: 'smooth', label: 'Smooth transition', type: 'bool', def: true }
  ]
}, function (api) {
  var zoomed = false;

  function locked() {
    try { return !!document.pointerLockElement; } catch (e0) { return false; }
  }

  function factor() {
    var f = Number(api.config.get('factor'));
    if (!(f >= 1.5)) f = 4;
    if (f > 10) f = 10;
    return f;
  }

  function apply(on) {
    if (zoomed === on) return;
    zoomed = on;
    var c = api.graphics.canvas();
    if (!c) { zoomed = false; return; }
    c.style.transformOrigin = 'center center';
    c.style.transition = api.config.get('smooth') === false ? 'none' : 'transform 0.15s ease';
    c.style.transform = on ? 'scale(' + factor() + ')' : 'scale(1)';
  }

  function reset() { apply(false); }
  function onPlc() { if (!locked()) apply(false); }

  api.events.on('input:key', function (ev) {
    if ((ev.code || '') !== String(api.config.get('zoomKey') || 'KeyC')) return;
    if (ev.down) {
      if (!ev.repeat && locked()) apply(true);
    } else {
      apply(false);
    }
  });

  api.events.on('mod:config', function (ev) {
    if (ev.id !== 'zoom') return;
    if (ev.key === 'zoomKey' || ev.key === 'factor' || ev.key === 'smooth') apply(false);
  });

  window.addEventListener('blur', reset, false);
  document.addEventListener('pointerlockchange', onPlc, false);

  return {
    onDisable: function () {
      zoomed = false;
      var c = api.graphics.canvas();
      if (c) {
        c.style.transform = 'scale(1)';
        c.style.transformOrigin = '';
        c.style.transition = '';
      }
      window.removeEventListener('blur', reset, false);
      document.removeEventListener('pointerlockchange', onPlc, false);
    }
  };
});
