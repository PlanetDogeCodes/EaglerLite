EL.registerMod({
  id: 'shared-worlds',
  name: 'Shared Worlds',
  version: '2.0.0',
  author: 'EaglerLite',
  description: 'Join shared worlds by code, and replaces the dead Open to LAN button with the sharing screen. This client build cannot host LAN worlds - only join them.',
  config: [
    { key: 'lanBtnOffsetX', label: 'LAN button offset X', type: 'number', def: 0, min: -60, max: 60, step: 1 },
    { key: 'lanBtnOffsetY', label: 'LAN button offset Y', type: 'number', def: 0, min: -60, max: 60, step: 1 }
  ]
}, function (api) {
  var joinCode = (api.boot && api.boot.opts && api.boot.opts.joinCode) || '';
  var hintedPause = false;
  var hintedWorld = false;
  var cancelled = false;
  var inWorld = false;
  var lanBtn = null;
  var shareWin = null;
  var PAUSE_RE = /(^|\.)GuiIngameMenu$/;

  function numCfg(key) {
    var v = Number(api.config.get(key));
    if (!isFinite(v)) v = 0;
    if (v < -60) v = -60;
    if (v > 60) v = 60;
    return v;
  }

  function isPause() { return PAUSE_RE.test(api.game.screen() || ''); }

  function pxPerUnit() {
    var st = api.game.screenState();
    var cv = api.graphics.canvas();
    if (!st || !st.width || !cv) return 0;
    var r = cv.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return r.width / st.width;
  }

  function paintButton(cv, label, hover) {
    var w = cv.width;
    var h = cv.height;
    var ctx = cv.getContext('2d');
    if (!ctx || !ctx.fillRect || !ctx.fillText) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = hover ? '#7f8b7f' : '#6f6f6f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hover ? '#889488' : '#757575';
    ctx.fillRect(1, 3, w - 2, 2);
    ctx.fillStyle = hover ? '#727e72' : '#6a6a6a';
    ctx.fillRect(1, h - 6, w - 2, 3);
    ctx.fillStyle = hover ? '#b4c0b4' : '#a8a8a8';
    ctx.fillRect(1, 1, w - 2, 1);
    ctx.fillRect(1, 1, 1, h - 2);
    ctx.fillStyle = hover ? '#3f4a3f' : '#4a4a4a';
    ctx.fillRect(1, h - 2, w - 2, 1);
    ctx.fillRect(w - 2, 1, 1, h - 2);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, 1);
    ctx.fillRect(0, h - 1, w, 1);
    ctx.fillRect(0, 0, 1, h);
    ctx.fillRect(w - 1, 0, 1, h);
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    var tw = ctx.measureText(label).width;
    var tx = Math.round((w - tw) / 2);
    ctx.fillStyle = '#3f3f3f';
    ctx.fillText(label, tx + 1, 7);
    ctx.fillStyle = hover ? '#ffffa0' : '#ffffff';
    ctx.fillText(label, tx, 6);
  }

  function makeButton(label, unitsW, onClick) {
    var host = document.createElement('div');
    host.style.cssText = 'position:relative;cursor:pointer;line-height:0;pointer-events:auto;user-select:none;';
    var cv = document.createElement('canvas');
    cv.width = unitsW;
    cv.height = 20;
    cv.style.cssText = 'display:block;image-rendering:pixelated;image-rendering:crisp-edges;';
    host.appendChild(cv);
    var hover = false;
    function draw() { paintButton(cv, label, hover); }
    function fit(px) {
      cv.style.width = Math.max(1, Math.round(unitsW * px)) + 'px';
      cv.style.height = Math.max(1, Math.round(20 * px)) + 'px';
    }
    host.addEventListener('mouseenter', function () { hover = true; draw(); });
    host.addEventListener('mouseleave', function () { hover = false; draw(); });
    host.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
    host.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!cancelled) { try { onClick(); } catch (eC) {} }
    });
    draw();
    return { el: host, canvas: cv, draw: draw, fit: fit };
  }

  function placeLan() {
    if (cancelled || shareWin || !inWorld || !isPause()) return;
    var st = api.game.screenState();
    var cv = api.graphics.canvas();
    if (!st || !st.width || !st.height || !cv) return;
    var r = cv.getBoundingClientRect();
    if (!r || !r.width) return;
    var px = r.width / st.width;
    if (!lanBtn) {
      lanBtn = makeButton('Open to LAN', 150, openShare);
      lanBtn.el.style.position = 'fixed';
      lanBtn.el.style.zIndex = '2147483500';
      lanBtn.el.style.margin = '0';
      api.graphics.addOverlay(lanBtn.el);
    }
    var x = r.x + (st.width / 2 + 5 + numCfg('lanBtnOffsetX')) * px;
    var y = r.y + (st.height / 4 + 96 + numCfg('lanBtnOffsetY')) * px;
    lanBtn.el.style.left = Math.round(x) + 'px';
    lanBtn.el.style.top = Math.round(y) + 'px';
    lanBtn.fit(px);
  }

  function removeLan() {
    if (!lanBtn) return;
    api.graphics.removeOverlay(lanBtn.el);
    lanBtn = null;
  }

  function openShare() {
    if (shareWin || cancelled) return;
    var px = pxPerUnit() || 3;
    var w = Math.round(230 * px);
    var h = Math.round(150 * px);
    if (w > window.innerWidth - 8) w = window.innerWidth - 8;
    if (h > window.innerHeight - 8) h = window.innerHeight - 8;
    if (w < 100) w = 100;
    if (h < 70) h = 70;
    var fs = Math.max(9, Math.round(px * 8));
    var root = document.createElement('div');
    root.id = 'el-sharewin';
    root.style.cssText = 'position:fixed;z-index:2147483500;pointer-events:auto;user-select:none;background:#c6c6c6;border:2px solid;border-color:#fefefe #565656 #565656 #fefefe;box-shadow:0 0 0 1px #000;border-radius:0;box-sizing:border-box;overflow:hidden;font-family:monospace;color:#3f3f3f;font-size:' + fs + 'px;line-height:1.25;padding:' + Math.round(10 * px) + 'px;';
    root.style.width = w + 'px';
    root.style.height = h + 'px';
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;
    var gcv = api.graphics.canvas();
    if (gcv && gcv.getBoundingClientRect) {
      var gr = gcv.getBoundingClientRect();
      if (gr && gr.width && gr.height) {
        cx = gr.x + gr.width / 2;
        cy = gr.y + gr.height / 2;
      }
    }
    root.style.left = Math.round(cx - w / 2) + 'px';
    root.style.top = Math.round(cy - h / 2) + 'px';
    var title = document.createElement('div');
    title.style.cssText = 'text-align:center;';
    title.appendChild(document.createTextNode('World Sharing'));
    var txt = document.createElement('div');
    txt.style.cssText = 'text-align:center;margin:' + Math.round(3 * px) + 'px 0 ' + Math.round(2 * px) + 'px;';
    txt.appendChild(document.createTextNode("This build cannot host a LAN world - the game's hosting code is not in this client. A friend with the full EaglercraftX client can share their own world and hand you its join code."));
    var lab = document.createElement('div');
    lab.style.cssText = 'text-align:center;margin:' + Math.round(2 * px) + 'px 0;';
    lab.appendChild(document.createTextNode('Join code:'));
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.maxLength = 12;
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    inp.value = '';
    inp.style.cssText = 'display:block;margin:0 auto;width:' + Math.round(150 * px) + 'px;height:' + Math.round(18 * px) + 'px;background:#000;border:2px solid;border-color:#373737 #ffffff #ffffff #373737;color:#ffffff;font-family:monospace;font-size:' + fs + 'px;text-align:center;outline:none;padding:0;box-sizing:border-box;border-radius:0;';
    var row = document.createElement('div');
    row.style.cssText = 'text-align:center;margin-top:' + Math.round(5 * px) + 'px;';
    var bJoin = makeButton('Join', 60, doJoin);
    var bDone = makeButton('Done', 60, function () { closeShare(false); });
    bJoin.fit(px);
    bDone.fit(px);
    bJoin.el.style.display = 'inline-block';
    bJoin.el.style.verticalAlign = 'top';
    bJoin.el.style.margin = '0 ' + Math.round(4 * px) + 'px';
    bDone.el.style.display = 'inline-block';
    bDone.el.style.verticalAlign = 'top';
    row.appendChild(bJoin.el);
    row.appendChild(bDone.el);
    root.appendChild(title);
    root.appendChild(txt);
    root.appendChild(lab);
    root.appendChild(inp);
    root.appendChild(row);
    root.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      if (e.target !== inp) {
        e.preventDefault();
        try { inp.focus(); } catch (eF) {}
      }
    });
    root.addEventListener('mouseup', function (e) { e.stopPropagation(); });
    root.addEventListener('click', function (e) { e.stopPropagation(); });
    root.addEventListener('wheel', function (e) { e.stopPropagation(); });
    root.addEventListener('contextmenu', function (e) { e.stopPropagation(); });
    root.addEventListener('input', function () {
      var v = String(inp.value || '').replace(/[^a-zA-Z0-9]/g, '');
      if (v.length > 12) v = v.slice(0, 12);
      if (String(inp.value || '') !== v) inp.value = v;
    });
    api.graphics.addOverlay(root);
    shareWin = { root: root, input: inp };
    removeLan();
    try { inp.focus(); inp.select(); } catch (eF2) {}
  }

  function closeShare(fromJoin) {
    if (!shareWin) return;
    var root = shareWin.root;
    shareWin = null;
    api.graphics.removeOverlay(root);
    if (fromJoin) { removeLan(); return; }
    if (!cancelled) placeLan();
  }

  function doJoin() {
    if (cancelled || !shareWin) return;
    var code = String(shareWin.input.value || '').replace(/[^a-zA-Z0-9]/g, '');
    if (!/^[a-zA-Z0-9]{3,12}$/.test(code)) {
      api.toast('Enter the join code first (3-12 letters or digits)', 4000, 'err');
      try { shareWin.input.focus(); } catch (eF) {}
      return;
    }
    closeShare(true);
    joinByCode(code);
  }

  function keyGuard(e) {
    if (!shareWin || !e || !e.target) return;
    var t = e.target;
    var inside = false;
    while (t && t.nodeType === 1) {
      if (t === shareWin.root) { inside = true; break; }
      t = t.parentNode;
    }
    if (!inside) return;
    if (e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); doJoin(); return; }
    if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); closeShare(false); return; }
    if (e.code === 'Tab') { e.preventDefault(); e.stopPropagation(); return; }
    e.stopPropagation();
  }

  api.events.on('game:world-enter', function () {
    inWorld = true;
    if (hintedWorld) return;
    hintedWorld = true;
    api.toast('Shared Worlds: this build cannot host LAN worlds - join a friend with their code from the pause menu', 6000);
  });

  api.events.on('game:world-exit', function () {
    inWorld = false;
    removeLan();
  });

  api.events.on('game:screen', function (ev) {
    var n = (ev && ev.name) || '';
    if (PAUSE_RE.test(n) && !hintedPause && !hintedWorld) {
      hintedPause = true;
      api.toast('Shared Worlds: the Open to LAN button below opens the sharing screen', 6000);
    }
    if (n && PAUSE_RE.test(n)) {
      placeLan();
    } else {
      removeLan();
      if (shareWin) closeShare(false);
    }
  });

  api.events.on('mod:config', function (ev) {
    if (!ev || ev.id !== 'shared-worlds') return;
    if (ev.key === 'lanBtnOffsetX' || ev.key === 'lanBtnOffsetY' || ev.key === null) placeLan();
  });

  window.addEventListener('keydown', keyGuard, true);

  function onResize() {
    if (shareWin) closeShare(false);
    placeLan();
  }
  window.addEventListener('resize', onResize);
  function onFs() {
    if (shareWin) closeShare(false);
    placeLan();
  }
  document.addEventListener('fullscreenchange', onFs, false);

  function tryClicks(list, cb) {
    var i = 0;
    var screenBefore = api.game.screen();
    var stop = api.events.on('game:screen', function () { stop(); });
    function step() {
      if (cancelled) { stop(); cb(false); return; }
      if (i >= list.length) { stop(); cb(false); return; }
      var c = list[i++];
      api.game.click(c[0], c[1]);
      setTimeout(function () {
        if (api.game.screen() !== screenBefore) { stop(); cb(true); return; }
        step();
      }, 700);
    }
    step();
  }

  function waitFor(regex, timeoutMs, cb) {
    var t0 = Date.now();
    var stop = api.events.on('game:screen', function (ev) {
      if (ev.name && regex.test(ev.name)) { stop(); cb(true); }
    });
    (function poll() {
      if (cancelled) { stop(); return; }
      if (regex.test(api.game.screen() || '')) { stop(); cb(true); return; }
      if (Date.now() - t0 > timeoutMs) { stop(); cb(false); return; }
      setTimeout(poll, 600);
    })();
  }

  function joinByCode(code) {
    api.toast('Joining shared world ' + code + ' ...', 4000);
    if (isPause()) { leaveWorld(); return; }
    atTitle();
    function leaveWorld() {
      var st = api.game.screenState();
      var hh = (st && st.height) ? st.height : 267;
      var yc = (hh / 4 + 130) / hh * 100;
      tryClicks([[50, yc], [50, yc + 1.5], [50, yc - 1.5], [50, 74]], function () {
        waitFor(/GuiMainMenu/, 60000, function (ok) {
          if (!ok) { api.toast('Could not save and quit the world to join', 5000, 'err'); return; }
          goMenu();
        });
      });
    }
    function atTitle() {
      waitFor(/GuiMainMenu/, 90000, function (ok) {
        if (!ok) { api.toast('Never reached the title screen', 5000, 'err'); return; }
        goMenu();
      });
    }
    function goMenu() {
      tryClicks([[50.8, 52.5], [50, 55], [50.8, 49], [50, 58]], function () {
        waitFor(/Multiplayer|ServerList/i, 12000, function (ok) {
          if (!ok) { goMenuRetry(0); return; }
          goDirect();
        });
      });
    }
    function goMenuRetry(n) {
      if (n > 2) { api.toast('Could not open Multiplayer', 5000, 'err'); return; }
      tryClicks([[50.8, 52.5], [50, 55], [50.8, 49], [50, 58]], function () {
        waitFor(/Multiplayer|ServerList/i, 12000, function (ok) {
          if (ok) goDirect(); else goMenuRetry(n + 1);
        });
      });
    }
    function goDirect() {
      tryClicks([[50, 61], [50, 65], [33, 61], [67, 61], [50, 57]], function () {
        waitFor(/ServerList|DirectConnect|direct/i, 12000, function (ok) {
          if (!ok) { api.toast('Could not open Direct Connect', 5000, 'err'); return; }
          goLanTab();
        });
      });
    }
    function goLanTab() {
      tryClicks([[50, 46], [50, 40], [50, 52], [30, 46], [70, 46]], function () {
        setTimeout(function () { typeCode(); }, 1200);
      });
    }
    function typeCode() {
      api.game.click(50, 52);
      setTimeout(function () {
        if (cancelled) return;
        api.game.type(code);
        setTimeout(function () { if (!cancelled) confirmJoin(); }, 700);
      }, 500);
    }
    function confirmJoin() {
      tryClicks([[50, 84], [33, 84], [50, 88], [50, 80], [50, 90]], function () {
        api.toast('Join requested. If the code was correct you will connect.', 6000);
      });
    }
  }

  if (joinCode && /^[a-zA-Z0-9]{3,12}$/.test(joinCode)) {
    joinByCode(joinCode);
  }

  return {
    onDisable: function () {
      cancelled = true;
      if (shareWin) closeShare(true);
      removeLan();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('keydown', keyGuard, true);
      api.toast('Shared Worlds off - overlay removed, pending join cancelled', 4000);
    }
  };
});
