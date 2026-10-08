EL.registerMod({
  id: 'saves-guard',
  name: 'Saves Guard',
  version: '1.1.0',
  author: 'EaglerLite',
  description: 'Tracks game profile and settings writes and keeps a rolling backup in mod storage',
  config: [
    { key: 'maxBackup', label: 'Backup size limit (KB)', type: 'number', def: 200, min: 10, max: 1000, step: 10 }
  ]
}, function (api) {
  var seen = {};
  var seenOrder = [];
  var writes = 0;
  var MINE = 'elmod:';
  api.events.on('game:save', function (ev) {
    if (!ev.key || ev.key.indexOf(MINE) === 0) return;
    if (seen[ev.key] === ev.value) return;
    if (!Object.prototype.hasOwnProperty.call(seen, ev.key)) {
      seenOrder.push(ev.key);
      if (seenOrder.length > 200) { delete seen[seenOrder.shift()]; }
    }
    seen[ev.key] = ev.value;
    writes++;
    try {
      var cap = Math.max(10, Number(api.config.get('maxBackup')) || 200) * 1024;
      api.storage.set('backup:' + ev.key, { at: Date.now(), len: ev.value ? String(ev.value).length : 0, value: String(ev.value || '').slice(0, cap) });
      api.storage.set('stats', { writes: writes, keys: Object.keys(seen).length, last: Date.now() });
    } catch (e) {}
  });
  api.events.on('game:load', function (ev) {
    if (!ev.key || ev.key.indexOf(MINE) === 0) return;
    if (!seen[ev.key]) api.log('game loaded key ' + ev.key);
  });
  return {
    onDisable: function () {
      api.toast('Saves Guard off', 2000);
    }
  };
});
