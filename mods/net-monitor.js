EL.registerMod({
  id: 'net-monitor',
  name: 'Net Monitor',
  version: '1.1.0',
  author: 'EaglerLite',
  description: 'Live panel of game sockets and traffic counters',
  config: [
    { key: 'maxRows', label: 'Rows shown', type: 'number', def: 4, min: 1, max: 10, step: 1 },
    { key: 'showTraffic', label: 'Show traffic counters', type: 'bool', def: true }
  ]
}, function (api) {
  var panel = api.ui.panel({ anchor: 'tl', title: 'Net' });
  panel.show();
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + 'M' : (n > 1024 ? (n / 1024).toFixed(1) + 'K' : String(n)); }
  function short(u) { return String(u).replace(/^wss?:\/\//i, '').split('/')[0].slice(0, 26); }
  var iv = setInterval(function () {
    var socks = api.net.sockets();
    var lines = [];
    var shown = 0;
    var max = Math.max(1, Number(api.config.get('maxRows')) || 4);
    var traffic = api.config.get('showTraffic') !== false;
    for (var i = socks.length - 1; i >= 0 && shown < max; i--) {
      var s = socks[i];
      lines.push((s.opened ? '>' : 'x') + ' ' + short(s.url) + (traffic ? ' ' + kb(s.rx) + ' in / ' + kb(s.tx) + ' out' : ''));
      shown++;
    }
    if (!lines.length) lines.push('no connections yet');
    panel.set(lines.join('\n'));
  }, 1000);
  return {
    onDisable: function () { clearInterval(iv); panel.destroy(); }
  };
});
