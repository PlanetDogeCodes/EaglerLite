EL.registerMod({
  id: 'crystal-optimizer',
  name: 'Crystal Optimizer',
  version: '1.0.0',
  author: 'EaglerLite',
  description: 'Zeros the End Crystal attack cooldown timers while you are in-game (pointer locked) and blocks the right-click menu while playing, like the old built-in. If enabled after the game loaded, restart to apply.',
  config: [
    { key: 'aggressive', label: 'Also trap attack cooldown (left click)', type: 'bool', def: false }
  ]
}, function (api) {
  var ALL_PROPS = ['rightClickDelayTimer', 'leftClickCounter'];
  var captured = [];

  function activeProps() {
    return api.config.get('aggressive') ? ALL_PROPS : ['rightClickDelayTimer'];
  }

  function trapGetter(name) {
    return function () {
      if (document.pointerLockElement) {
        var v = this['__eco_' + name] || 0;
        if (v <= 2) return 0;
        return v;
      }
      return this['__eco_' + name] || 0;
    };
  }

  function noteCapture(obj, name) {
    for (var i = 0; i < captured.length; i++) { if (captured[i] === obj) return; }
    captured.push(obj);
    if (captured.length === 1) api.log('captured game instance via ' + name);
  }

  function setupTrap(name) {
    try {
      var desc = Object.getOwnPropertyDescriptor(Object.prototype, name);
      if (desc && desc.get && desc.set) return;
      Object.defineProperty(Object.prototype, name, {
        configurable: true,
        enumerable: false,
        get: trapGetter(name),
        set: function (v) {
          noteCapture(this, name);
          try {
            Object.defineProperty(this, '__eco_' + name, {
              value: v, writable: true, enumerable: false, configurable: true
            });
          } catch (e1) {
            this['__eco_' + name] = v;
          }
          try {
            Object.defineProperty(this, name, {
              configurable: true,
              enumerable: true,
              get: trapGetter(name),
              set: function (v2) { this['__eco_' + name] = v2; }
            });
          } catch (e2) {}
          try { delete Object.prototype[name]; } catch (e3) {}
        }
      });
    } catch (e0) {}
  }

  function removeTrap(name) {
    try { delete Object.prototype[name]; } catch (e0) {}
    for (var i = 0; i < captured.length; i++) {
      try { delete captured[i][name]; } catch (e1) {}
      try { delete captured[i]['__eco_' + name]; } catch (e2) {}
    }
  }

  function installAll() {
    var list = activeProps();
    for (var i = 0; i < list.length; i++) setupTrap(list[i]);
  }

  function noMenu(e) {
    if (document.pointerLockElement) e.preventDefault();
  }

  installAll();
  document.addEventListener('contextmenu', noMenu, false);

  var guard = setInterval(function () {
    var list = activeProps();
    for (var i = 0; i < list.length; i++) {
      var desc = Object.getOwnPropertyDescriptor(Object.prototype, list[i]);
      if (!desc || !desc.get || !desc.set) setupTrap(list[i]);
    }
  }, 5000);

  api.events.on('mod:config', function (ev) {
    if (ev.id !== 'crystal-optimizer' || ev.key !== 'aggressive') return;
    if (ev.value) setupTrap('leftClickCounter');
    else removeTrap('leftClickCounter');
    if (captured.length) api.toast('cooldown trap change applies fully after a restart', 3600);
  });

  return {
    onDisable: function () {
      clearInterval(guard);
      for (var i = 0; i < ALL_PROPS.length; i++) removeTrap(ALL_PROPS[i]);
      captured.length = 0;
      document.removeEventListener('contextmenu', noMenu, false);
    }
  };
});
