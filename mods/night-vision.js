EL.registerMod({
  id: 'night-vision',
  name: 'Night Vision (shader)',
  version: '1.1.0',
  author: 'EaglerLite',
  description: 'Rewrites lightmap shaders to full white through the graphics hook',
  config: [
    { key: 'level', label: 'Brightness (0-100)', type: 'number', def: 100, min: 20, max: 100, step: 5 }
  ]
}, function (api) {
  var off = api.graphics.onShader(function (ev) {
    if (ev.type !== 'fragment') return;
    if (ev.source.indexOf('u_samplerLightmap') === -1) return;
    var lvl = Math.min(100, Math.max(0, Number(api.config.get('level')) || 100)) / 100;
    var c = lvl.toFixed(2);
    var patched = ev.source.replace(/color\s*\*?=\s*(?:EAGLER_TEXTURE_2D|texture)\s*\(\s*u_samplerLightmap\b[^;]*;/gi, 'color *= vec4(' + c + ', ' + c + ', ' + c + ', 1.0);');
    if (patched !== ev.source) {
      ev.rewritten = true;
      return patched;
    }
    return null;
  });
  return {
    onDisable: function () {
      off();
      api.toast('Night Vision off \u2014 reload the world to restore lighting', 4000);
    }
  };
});
