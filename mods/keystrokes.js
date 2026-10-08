EL.registerMod({
  id: 'keystrokes',
  name: 'Keystrokes',
  version: '1.1.0',
  author: 'EaglerLite',
  description: 'On-screen WASD keystroke display for clips and streams',
  config: [
    { key: 'showExtra', label: 'Show Space and Shift row', type: 'bool', def: true },
    { key: 'opacity', label: 'Background opacity (%)', type: 'number', def: 72, min: 20, max: 100, step: 2 }
  ]
}, function (api) {
  var keys = [
    { code: 'KeyW', label: 'W', row: 0 },
    { code: 'KeyA', label: 'A', row: 1 },
    { code: 'KeyS', label: 'S', row: 1 },
    { code: 'KeyD', label: 'D', row: 1 },
    { code: 'Space', label: '___', row: 2, extra: true },
    { code: 'ShiftLeft', label: 'Shift', row: 2, extra: true }
  ];
  var box = document.createElement('div');
  box.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px;';
  var cells = {};
  for (var i = 0; i < keys.length; i++) {
    (function (k) {
      var c = document.createElement('div');
      c.textContent = k.label;
      c.style.cssText = 'min-width:34px;padding:5px 0;text-align:center;font:11px monospace;color:#ddd;background:rgba(15,15,18,0.72);border:1px solid rgba(255,255,255,0.22);border-radius:4px;transition:all 0.08s;';
      if (k.extra) c.className = 'el-ks-extra';
      cells[k.code] = c;
      box.appendChild(c);
    })(keys[i]);
  }
  var panel = api.ui.panel({ anchor: 'tl', title: 'Keys' });
  panel.el.appendChild(box);
  panel.show();
  function applyCfg() {
    var extras = box.querySelectorAll('.el-ks-extra');
    var show = !!api.config.get('showExtra');
    for (var i = 0; i < extras.length; i++) extras[i].style.display = show ? '' : 'none';
    var op = (Number(api.config.get('opacity')) || 72) / 100;
    for (var k in cells) cells[k].style.background = 'rgba(15,15,18,' + op.toFixed(2) + ')';
  }
  applyCfg();
  api.events.on('mod:config', function (ev) {
    if (ev.id === 'keystrokes') applyCfg();
  });
  api.events.on('input:key', function (ev) {
    var c = cells[ev.code];
    if (!c) return;
    if (ev.down) {
      c.style.background = 'rgba(240,240,245,0.92)';
      c.style.color = '#111';
    } else {
      var op = (Number(api.config.get('opacity')) || 72) / 100;
      c.style.background = 'rgba(15,15,18,' + op.toFixed(2) + ')';
      c.style.color = '#ddd';
    }
  });
  return {
    onDisable: function () { panel.destroy(); }
  };
});
