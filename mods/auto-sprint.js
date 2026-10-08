EL.registerMod({
  id: 'auto-sprint',
  name: 'Auto Sprint',
  version: '1.0.0',
  author: 'EaglerLite',
  description: 'Holds the sprint key for you while walking. Can read the sprint keybind from your saved game options like the old built-in.',
  config: [
    { key: 'sprintKey', label: 'Sprint key', type: 'key', def: 'ControlLeft' },
    { key: 'detectFromOptions', label: 'Read keybind from saved options', type: 'bool', def: true },
    { key: 'alwaysSprint', label: 'Sprint on any move key (W/A/S/D)', type: 'bool', def: false }
  ]
}, function (api) {
  var MOVE = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1 };
  var held = false;

  function locked() {
    try { return !!document.pointerLockElement; } catch (e0) { return false; }
  }

  function keyCodeToCode(kc) {
    if (typeof kc !== 'number' || isNaN(kc)) return null;
    if (kc >= 65 && kc <= 90) return 'Key' + String.fromCharCode(kc);
    if (kc >= 48 && kc <= 57) return 'Digit' + (kc - 48);
    if (kc === 17) return 'ControlLeft';
    if (kc === 16) return 'ShiftLeft';
    if (kc === 18) return 'AltLeft';
    if (kc === 32) return 'Space';
    if (kc === 13) return 'Enter';
    if (kc === 9) return 'Tab';
    if (kc === 8) return 'Backspace';
    if (kc === 27) return 'Escape';
    if (kc === 37) return 'ArrowLeft';
    if (kc === 38) return 'ArrowUp';
    if (kc === 39) return 'ArrowRight';
    if (kc === 40) return 'ArrowDown';
    if (kc === 45) return 'Insert';
    if (kc === 46) return 'Delete';
    if (kc === 36) return 'Home';
    if (kc === 35) return 'End';
    if (kc === 33) return 'PageUp';
    if (kc === 34) return 'PageDown';
    if (kc === 20) return 'CapsLock';
    if (kc >= 112 && kc <= 135) return 'F' + (kc - 111);
    if (kc >= 96 && kc <= 105) return 'Numpad' + (kc - 96);
    if (kc === 107) return 'NumpadAdd';
    if (kc === 109) return 'NumpadSubtract';
    if (kc === 106) return 'NumpadMultiply';
    if (kc === 111) return 'NumpadDivide';
    if (kc === 110) return 'NumpadDecimal';
    return null;
  }

  function resolveSprintKey(code) {
    var keyCode = 17, keyStr = 'Control';
    if (code === 'ShiftLeft' || code === 'ShiftRight') { keyCode = 16; keyStr = 'Shift'; }
    else if (code === 'AltLeft' || code === 'AltRight') { keyCode = 18; keyStr = 'Alt'; }
    else if (code === 'ControlLeft' || code === 'ControlRight') { keyCode = 17; keyStr = 'Control'; }
    else if (code === 'Space') { keyCode = 32; keyStr = ' '; }
    else if (code === 'Enter' || code === 'NumpadEnter') { keyCode = 13; keyStr = 'Enter'; }
    else if (code === 'Tab') { keyCode = 9; keyStr = 'Tab'; }
    else if (code === 'Backspace') { keyCode = 8; keyStr = 'Backspace'; }
    else if (code === 'Escape') { keyCode = 27; keyStr = 'Escape'; }
    else if (code === 'ArrowUp') { keyCode = 38; keyStr = 'ArrowUp'; }
    else if (code === 'ArrowDown') { keyCode = 40; keyStr = 'ArrowDown'; }
    else if (code === 'ArrowLeft') { keyCode = 37; keyStr = 'ArrowLeft'; }
    else if (code === 'ArrowRight') { keyCode = 39; keyStr = 'ArrowRight'; }
    else if (code === 'Insert') { keyCode = 45; keyStr = 'Insert'; }
    else if (code === 'Delete') { keyCode = 46; keyStr = 'Delete'; }
    else if (code === 'Home') { keyCode = 36; keyStr = 'Home'; }
    else if (code === 'End') { keyCode = 35; keyStr = 'End'; }
    else if (code === 'PageUp') { keyCode = 33; keyStr = 'PageUp'; }
    else if (code === 'PageDown') { keyCode = 34; keyStr = 'PageDown'; }
    else if (code === 'CapsLock') { keyCode = 20; keyStr = 'CapsLock'; }
    else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) { keyCode = 111 + parseInt(code.substring(1), 10); keyStr = code; }
    else if (/^Numpad([0-9])$/.test(code)) { var np = parseInt(code.substring(6), 10); keyCode = 96 + np; keyStr = 'Numpad' + np; }
    else if (code === 'NumpadDecimal') { keyCode = 110; keyStr = 'NumpadDecimal'; }
    else if (code === 'NumpadAdd') { keyCode = 107; keyStr = 'NumpadAdd'; }
    else if (code === 'NumpadSubtract') { keyCode = 109; keyStr = 'NumpadSubtract'; }
    else if (code === 'NumpadMultiply') { keyCode = 106; keyStr = 'NumpadMultiply'; }
    else if (code === 'NumpadDivide') { keyCode = 111; keyStr = 'NumpadDivide'; }
    else {
      var letterMatch = /^Key([A-Z])$/.exec(code);
      var digitMatch = /^Digit([0-9])$/.exec(code);
      if (letterMatch) { keyCode = letterMatch[1].charCodeAt(0); keyStr = letterMatch[1].toLowerCase(); }
      else if (digitMatch) { keyCode = digitMatch[1].charCodeAt(0); keyStr = digitMatch[1]; }
    }
    return { code: code, keyCode: keyCode, keyStr: keyStr };
  }

  function sprintKey() {
    var c = String(api.config.get('sprintKey') || 'ControlLeft');
    return c || 'ControlLeft';
  }

  function parseSprintKeyCode(val) {
    if (!val || val.length > 2000000) return null;
    var m = null;
    if ((m = /key_key\.sprint[^\d\-]*(\-?\d+)/.exec(val))) return keyCodeToCode(parseInt(m[1], 10));
    if ((m = /["']key_key\.sprint["']\s*[:=]\s*(\-?\d+)/.exec(val))) return keyCodeToCode(parseInt(m[1], 10));
    if ((m = /key\.sprint[^\d\-]*(\-?\d+)/.exec(val))) return keyCodeToCode(parseInt(m[1], 10));
    if ((m = /["']key\.sprint["']\s*[:=]\s*(\-?\d+)/.exec(val))) return keyCodeToCode(parseInt(m[1], 10));
    return null;
  }

  function applyOptionsValue(v) {
    var code = parseSprintKeyCode(v);
    if (!code) return;
    if (code === sprintKey()) return;
    api.config.set('sprintKey', code);
    api.log('sprint key from saved options: ' + code);
  }

  api.events.on('game:load', function (ev) {
    if (!api.config.get('detectFromOptions')) return;
    var k = String(ev.key || '');
    var v = (ev.value === null || ev.value === undefined) ? '' : String(ev.value);
    if (k.toLowerCase().indexOf('options') < 0 && v.indexOf('key_key.sprint') < 0 && v.indexOf('key.sprint') < 0) return;
    applyOptionsValue(v);
  });

  api.events.on('game:save', function (ev) {
    if (!api.config.get('detectFromOptions')) return;
    var k = String(ev.key || '');
    if (k.toLowerCase().indexOf('options') < 0) return;
    applyOptionsValue((ev.value === null || ev.value === undefined) ? '' : String(ev.value));
  });

  function fireSprint(down) {
    var code = sprintKey();
    if (code === 'ControlLeft') {
      api.movement.sprint(down);
      return;
    }
    var r = resolveSprintKey(code);
    try {
      var ev = new KeyboardEvent(down ? 'keydown' : 'keyup', {
        code: r.code, keyCode: r.keyCode, which: r.keyCode, key: r.keyStr, bubbles: true, cancelable: true
      });
      try { Object.defineProperty(ev, 'isTrusted', { get: function () { return true; }, configurable: true }); } catch (e1) {}
      window.dispatchEvent(ev);
    } catch (e2) {}
  }

  function setSprint(on) {
    if (held === on) return;
    held = on;
    fireSprint(on);
  }

  function moving() {
    return !!(api.input.isDown('KeyW') || api.input.isDown('KeyA') || api.input.isDown('KeyS') || api.input.isDown('KeyD'));
  }

  api.events.on('input:key', function (ev) {
    var code = ev.code || '';
    if (!MOVE[code]) return;
    if (ev.down) {
      if (!ev.repeat && locked() && (code === 'KeyW' || api.config.get('alwaysSprint'))) setSprint(true);
    } else if (api.config.get('alwaysSprint')) {
      setSprint(moving());
    } else if (code === 'KeyW') {
      setSprint(false);
    }
  });

  var refire = setInterval(function () {
    if (!locked()) return;
    var want = api.config.get('alwaysSprint') ? moving() : !!api.input.isDown('KeyW');
    if (want) setSprint(true);
  }, 2000);

  function release() { setSprint(false); }
  function onPlc() { if (!locked()) setSprint(false); }
  window.addEventListener('blur', release, false);
  document.addEventListener('pointerlockchange', onPlc, false);

  return {
    onDisable: function () {
      clearInterval(refire);
      setSprint(false);
      window.removeEventListener('blur', release, false);
      document.removeEventListener('pointerlockchange', onPlc, false);
    }
  };
});
