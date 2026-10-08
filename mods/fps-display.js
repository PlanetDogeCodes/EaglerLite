EL.registerMod({
  id: 'fps-display',
  name: 'FPS Display',
  version: '1.1.0',
  author: 'EaglerLite',
  description: 'Corner overlay with FPS, frame time, draw calls and current screen',
  config: [
    { key: 'interval', label: 'Update interval (ms)', type: 'number', def: 500, min: 250, max: 5000, step: 250 },
    { key: 'showFrameMs', label: 'Show frame time', type: 'bool', def: true },
    { key: 'showDrawCalls', label: 'Show draw calls', type: 'bool', def: true },
    { key: 'showScreen', label: 'Show screen name', type: 'bool', def: true }
  ]
}, function (api) {
  var panel = api.ui.panel({ anchor: 'tr' });
  panel.show();
  var iv = null;
  function start() {
    if (iv) clearInterval(iv);
    iv = setInterval(function () {
      var s = api.game.screen();
      var lines = ['FPS ' + api.performance.fps()];
      if (api.config.get('showFrameMs')) lines.push('FT  ' + api.performance.frameMs().toFixed(1) + 'ms');
      if (api.config.get('showDrawCalls')) lines.push('DC  ' + api.performance.drawCalls());
      if (api.config.get('showScreen')) lines.push('SCR ' + (s === null ? '(in game)' : (s || '(none)').split('.').pop()));
      panel.set(lines.join('\n'));
    }, Math.max(250, Number(api.config.get('interval')) || 500));
  }
  start();
  api.events.on('mod:config', function (ev) {
    if (ev && ev.id === 'fps-display' && (ev.key === 'interval' || ev.key === null)) start();
  });
  return {
    onDisable: function () { clearInterval(iv); panel.destroy(); }
  };
});
