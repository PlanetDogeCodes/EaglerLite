EL.registerMod({
  id: 'audio-latency',
  name: 'Low Latency Audio',
  version: '1.1.0',
  author: 'EaglerLite',
  description: 'Wraps the AudioContext constructor so the game audio is created with a latency hint (playback = less CPU). Applies to contexts created after the mod loads; hint changes apply on relaunch.',
  config: [
    { key: 'hint', label: 'Latency hint', type: 'choice', def: 'playback',
      options: [
        { value: 'playback', label: 'playback (saves CPU)' },
        { value: 'balanced', label: 'balanced' },
        { value: 'interactive', label: 'interactive (lowest latency)' }
      ] }
  ]
}, function (api) {
  var wrapped = false;
  var orig = null;
  var origWebkit = null;
  var savedSrc = '';

  function currentHint() {
    var h = String(api.config.get('hint') || 'playback');
    if (h !== 'balanced' && h !== 'interactive') h = 'playback';
    return h;
  }

  function makeOpts(userOpts) {
    var o = {};
    var k;
    if (userOpts && typeof userOpts === 'object') {
      for (k in userOpts) {
        if (Object.prototype.hasOwnProperty.call(userOpts, k)) o[k] = userOpts[k];
      }
    }
    o.latencyHint = currentHint();
    return o;
  }

  function install() {
    if (wrapped) return;
    orig = window.AudioContext || null;
    origWebkit = window.webkitAudioContext || null;
    if (!orig) return;
    savedSrc = String(orig);
    function Wrapped(opts) {
      if (this instanceof Wrapped) return new orig(makeOpts(opts));
      return new orig(makeOpts(opts));
    }
    try { Wrapped.prototype = orig.prototype; } catch (eP) {}
    try { Wrapped.toString = function () { return savedSrc; }; } catch (eT) {}
    window.AudioContext = Wrapped;
    if (origWebkit && origWebkit === orig) window.webkitAudioContext = Wrapped;
    else if (origWebkit) {
      function WrappedW(opts) {
        if (this instanceof WrappedW) return new origWebkit(makeOpts(opts));
        return new origWebkit(makeOpts(opts));
      }
      try { WrappedW.prototype = origWebkit.prototype; } catch (eP2) {}
      window.webkitAudioContext = WrappedW;
    }
    wrapped = true;
  }

  function uninstall() {
    if (!wrapped) return;
    try { window.AudioContext = orig; } catch (e0) {}
    if (origWebkit) { try { window.webkitAudioContext = origWebkit; } catch (e1) {} }
    wrapped = false;
  }

  install();

  api.events.on('mod:config', function (ev) {
    if (!ev || ev.id !== 'audio-latency') return;
    if (ev.key === 'hint') api.toast('latency hint applies to audio opened after the next launch', 3600);
  });

  return {
    onDisable: function () {
      uninstall();
      api.toast('Low Latency Audio off - applies on next launch', 3200);
    }
  };
});
