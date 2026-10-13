/* Remote navigation for browser-based Smart TV. No account or payment logic here. */
(function () {
  'use strict';
  if (/[?&]tv=0(?:&|$)/.test(location.search)) { document.documentElement.classList.remove('tv-mode'); return; }
  var selector = 'button,a[href],input:not([type="hidden"]),select,textarea,[tabindex="0"],[role="button"]';
  var current = null, activeScope = document, scopeStack = [], keyboard = null, editing = null;
  var toast, timer, lastKey = 0, pageName = 'intro', pageFocus = {};
  function visible(el) {
    if (!el || !el.isConnected || el.disabled || el.closest('[hidden],[aria-hidden="true"]')) return false;
    var r = el.getBoundingClientRect(), style = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }
  function scope() {
    if (keyboard) return keyboard;
    var dialogs = Array.prototype.filter.call(document.querySelectorAll('[data-tv-dialog]'), visible);
    dialogs.sort(function (a, b) { return (parseInt(getComputedStyle(b).zIndex, 10) || 0) - (parseInt(getComputedStyle(a).zIndex, 10) || 0); });
    return dialogs[0] || document.fullscreenElement || document.webkitFullscreenElement || document.querySelector('.tv-movie-stage') || document;
  }
  function candidates() { return Array.prototype.filter.call(scope().querySelectorAll(selector), visible); }
  function focus(el) {
    if (!visible(el)) return;
    if (current) current.removeAttribute('data-tv-focus');
    current = el; el.setAttribute('data-tv-focus', 'true');
    if (!el.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.tabIndex = 0;
    try { el.focus({ preventScroll: true }); } catch (error) { el.focus(); }
    if (!el.closest('header')) {
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); } catch (error) { el.scrollIntoView(false); }
    } else {
      var nav = el.closest('nav');
      if (nav) { var r = el.getBoundingClientRect(), nr = nav.getBoundingClientRect(); if (r.right > nr.right) nav.scrollLeft += r.right - nr.right + 12; if (r.left < nr.left) nav.scrollLeft -= nr.left - r.left + 12; }
    }
  }
  function refresh() {
    var next = scope();
    if (next !== activeScope) {
      if (next !== document && (!scopeStack.length || scopeStack[scopeStack.length - 1].scope !== next)) scopeStack.push({ scope: activeScope, focus: current });
      var restore = null;
      if (scopeStack.length && scopeStack[scopeStack.length - 1].scope === next) restore = scopeStack.pop().focus;
      activeScope = next;
      if (visible(restore) && (next === document || next.contains(restore))) { focus(restore); return; }
      var focused = document.activeElement;
      if (next !== document && visible(focused) && next.contains(focused) && focused.matches(selector)) { focus(focused); return; }
      current = null;
    }
    if (visible(current) && (next === document || next.contains(current))) return;
    var list = candidates();
    var initial = list.find(function (el) { return /Comenzar Experiencia|Reproducir Ahora|Ver ahora|Validar/i.test(el.textContent); });
    focus(initial || list[0]);
  }
  function move(direction) {
    refresh(); if (!current) return;
    var a = current.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    var horizontal = direction === 'left' || direction === 'right', best = null, score = Infinity;
    candidates().forEach(function (el) {
      if (el === current) return;
      var b = el.getBoundingClientRect(), dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
      var main = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
      if (main < 3) return;
      var cross = Math.abs(horizontal ? dy : dx);
      var aligned = horizontal ? b.bottom > a.top && b.top < a.bottom : b.right > a.left && b.left < a.right;
      var value = main + cross * 3 + (aligned ? 0 : 1000);
      if (value < score) { best = el; score = value; }
    });
    if (best) focus(best);
    else if (direction === 'down' || direction === 'up') window.scrollBy(0, direction === 'down' ? window.innerHeight * 0.65 : -window.innerHeight * 0.65);
  }
  function announce(message) {
    if (!toast) { toast = document.createElement('div'); toast.className = 'tv-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); document.body.appendChild(toast); }
    toast.textContent = message; toast.hidden = false; clearTimeout(timer); timer = setTimeout(function () { toast.hidden = true; }, 2400);
  }
  function event(name, detail) { var e = new CustomEvent(name, { cancelable: true, detail: detail }); window.dispatchEvent(e); return e.defaultPrevented; }
  function setValue(input, value) {
    var prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function openKeyboard(input) {
    if (keyboard || input.readOnly || input.disabled) return;
    editing = { input: input, original: input.value, value: input.value, upper: false };
    keyboard = document.createElement('section'); keyboard.className = 'tv-keyboard'; keyboard.setAttribute('role', 'dialog'); keyboard.setAttribute('aria-modal', 'true'); keyboard.setAttribute('aria-label', input.placeholder || 'Teclado en pantalla');
    var panel = document.createElement('div'); panel.className = 'tv-keyboard-panel'; keyboard.appendChild(panel);
    var title = document.createElement('h2'); title.textContent = input.placeholder || 'Escribir con el mando'; panel.appendChild(title);
    var output = document.createElement('div'); output.className = 'tv-keyboard-value'; output.setAttribute('aria-live', input.type === 'password' ? 'off' : 'polite'); panel.appendChild(output);
    function renderValue() { output.textContent = input.type === 'password' ? new Array(editing.value.length + 1).join('•') : editing.value || ' '; }
    function insert(char) { if (input.maxLength > 0 && editing.value.length >= input.maxLength) return; editing.value += editing.upper ? char.toUpperCase() : char; renderValue(); }
    var rows = input.type === 'password' || input.inputMode === 'numeric' ? ['123','456','789','0'] : ['1234567890','qwertyuiop','asdfghjklñ','zxcvbnm@._','-+'];
    rows.forEach(function (row) { var div = document.createElement('div'); div.className = 'tv-keyboard-row'; row.split('').forEach(function (char) { var button = document.createElement('button'); button.textContent = char; button.type = 'button'; button.onclick = function () { insert(char); }; div.appendChild(button); }); panel.appendChild(div); });
    var actions = document.createElement('div'); actions.className = 'tv-keyboard-row tv-keyboard-actions'; panel.appendChild(actions);
    function action(label, callback) { var button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.onclick = callback; actions.appendChild(button); }
    if (input.type !== 'password') { action('Espacio', function () { insert(' '); }); action('Mayús', function () { editing.upper = !editing.upper; Array.prototype.forEach.call(panel.querySelectorAll('.tv-keyboard-row:not(.tv-keyboard-actions) button'), function (b) { b.textContent = editing.upper ? b.textContent.toUpperCase() : b.textContent.toLowerCase(); }); }); }
    action('Borrar', function () { editing.value = editing.value.slice(0, -1); renderValue(); });
    action('Cancelar', function () { closeKeyboard(false); }); action('Listo', function () { closeKeyboard(true); });
    var hint = document.createElement('p'); hint.textContent = 'Flechas: moverse · OK: escribir · Atrás: cancelar'; panel.appendChild(hint);
    document.body.appendChild(keyboard); renderValue(); refresh();
  }
  function closeKeyboard(commit) {
    if (!keyboard) return;
    var target = editing.input, value = editing.value;
    keyboard.remove(); keyboard = null; editing = null;
    if (commit && target.isConnected) setValue(target, value);
    refresh(); focus(target);
  }
  function nativeVideo() { return Array.prototype.find.call(document.querySelectorAll('video'), visible); }
  function media(action) {
    if (event('boxplay:media', { action: action })) return;
    var v = nativeVideo(); if (!v) { announce('Este reproductor externo usa sus propios controles'); return; }
    if (action === 'toggle') action = v.paused ? 'play' : 'pause';
    if (action === 'play') { var promise = v.play(); if (promise) promise.catch(function () { announce('No se pudo reproducir el video'); }); }
    if (action === 'pause' || action === 'stop') v.pause();
    if (action === 'stop') { try { v.currentTime = 0; } catch (error) {} }
    if (action === 'mute') { v.muted = !v.muted; announce(v.muted ? 'Silenciado' : 'Sonido activado'); }
    if (action === 'volumeDown' || action === 'volumeUp') { v.volume = Math.max(0, Math.min(1, v.volume + (action === 'volumeUp' ? 0.1 : -0.1))); announce('Volumen ' + Math.round(v.volume * 100) + '%'); }
    if (action === 'subtitles') {
      if (!v.textTracks.length) { announce('Este video no incluye subtítulos'); return; }
      var enabled = v.textTracks[0].mode !== 'showing';
      for (var i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = i === 0 && enabled ? 'showing' : 'disabled';
      announce(enabled ? 'Subtítulos activados' : 'Subtítulos desactivados');
    }
    if (action === 'forward' || action === 'rewind') {
      if (!v.seekable.length) { announce('Este directo no permite adelantar o retroceder'); return; }
      var start = v.seekable.start(0), end = v.seekable.end(v.seekable.length - 1);
      v.currentTime = Math.max(start, Math.min(end, v.currentTime + (action === 'forward' ? 10 : -10)));
      announce(action === 'forward' ? '+10 segundos' : '−10 segundos');
    }
  }
  function back() {
    if (keyboard) { closeKeyboard(false); return; }
    if (current && current.tagName === 'SELECT' && current.dataset.tvEditing === 'true') { current.dataset.tvEditing = 'false'; return; }
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      var result = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen(); if (result && result.catch) result.catch(function () {}); return;
    }
    var guide = document.getElementById('install-guide-modal');
    if (guide && visible(guide)) { guide.classList.add('hidden'); refresh(); return; }
    event('boxplay:back'); setTimeout(refresh, 50);
  }
  function activate() {
    refresh(); if (!current) return;
    if (/^(INPUT|TEXTAREA)$/.test(current.tagName) && current.type !== 'range' && !/^(checkbox|radio|submit|button)$/.test(current.type)) { openKeyboard(current); return; }
    if (current.tagName === 'SELECT') { announce('Usa ↑ ↓ para elegir y OK para confirmar'); current.dataset.tvEditing = current.dataset.tvEditing === 'true' ? 'false' : 'true'; return; }
    current.click();
  }
  var directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
  var namedMediaKeys = { MediaPlay: 'play', MediaPause: 'pause', MediaPlayPause: 'toggle', MediaStop: 'stop', MediaFastForward: 'forward', MediaRewind: 'rewind', MediaTrackNext: 'next', MediaTrackPrevious: 'previous' };
  var mediaKeys = { 415: 'play', 19: 'pause', 10252: 'toggle', 179: 'toggle', 413: 'stop', 178: 'stop', 417: 'forward', 412: 'rewind', 427: 'next', 428: 'previous', 176: 'next', 177: 'previous' };
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var code = e.keyCode || e.which, direction = directions[code];
    var isBack = [8,27,461,10009,166].indexOf(code) !== -1 || e.key === 'BrowserBack' || e.key === 'GoBack';
    if (isBack && code === 8 && !keyboard && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (isBack) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) back(); return; }
    var mediaAction = namedMediaKeys[e.key] || mediaKeys[code];
    if (mediaAction) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) media(mediaAction); return; }
    if (e.key === 'Select' || e.key === 'Accept') code = 13;
    if (!direction && code !== 13 && code !== 32 && code !== 9) return;
    // Physical keyboards can type spaces into fields. Remote OK opens the screen keyboard.
    if (code === 32 && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (direction) {
      var now = Date.now(); if (e.repeat && now - lastKey < 100) return; lastKey = now;
      if (current && current.type === 'range' && (direction === 'left' || direction === 'right')) {
        var step = Number(current.step) || 1, min = Number(current.min) || 0, max = current.max === '' ? 100 : Number(current.max);
        setValue(current, String(Math.max(min, Math.min(max, Number(current.value) + (direction === 'left' ? -step : step))))); return;
      }
      if (current && current.tagName === 'SELECT' && current.dataset.tvEditing === 'true') {
        var delta = direction === 'up' || direction === 'left' ? -1 : 1;
        current.selectedIndex = Math.max(0, Math.min(current.options.length - 1, current.selectedIndex + delta)); current.dispatchEvent(new Event('change', { bubbles: true })); return;
      }
      move(direction);
    } else if (code === 9) { var list = candidates(), index = list.indexOf(current); focus(list[(index + (e.shiftKey ? -1 : 1) + list.length) % list.length]); }
    else if (!e.repeat) activate();
  }, true);
  document.addEventListener('focusin', function (e) {
    if (e.target.matches && e.target.matches(selector) && visible(e.target)) {
      var sc = scope(); if (sc !== activeScope) refresh(); if (sc !== document && !sc.contains(e.target)) { refresh(); return; }
      if (current) current.removeAttribute('data-tv-focus'); current = e.target; current.setAttribute('data-tv-focus', 'true');
    }
  });
  document.addEventListener('click', function (e) { var el = e.target.closest(selector); if (el && visible(el)) focus(el); });
  function prepare() {
    var header = document.querySelector('header');
    if (header) document.documentElement.style.setProperty('--tv-header-height', header.getBoundingClientRect().height + 'px');
    Array.prototype.forEach.call(document.querySelectorAll('.cursor-pointer'), function (el) {
      if (!el.matches(selector) && !el.matches('label')) { el.tabIndex = 0; el.setAttribute('role', 'button'); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('button'), function (el) {
      if (!el.textContent.trim() && !el.getAttribute('aria-label')) el.setAttribute('aria-label', el.title || 'Acción');
    });
    refresh();
  }
  var scheduled = false;
  new MutationObserver(function () { if (!scheduled) { scheduled = true; setTimeout(function () { scheduled = false; prepare(); }, 60); } }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'disabled'] });
  document.addEventListener('fullscreenchange', refresh); window.addEventListener('resize', prepare);
  window.addEventListener('boxplay:view', function (e) {
    var nextPage = e.detail.page;
    if (nextPage === pageName) return;
    if (current && current.getAttribute('data-tv-id')) pageFocus[pageName] = current.getAttribute('data-tv-id');
    pageName = nextPage;
    var target = Array.prototype.find.call(document.querySelectorAll('[data-tv-id]'), function (el) { return el.getAttribute('data-tv-id') === pageFocus[pageName] && visible(el); });
    if (target) focus(target); else { current = null; refresh(); }
  });
  document.addEventListener('webkitfullscreenchange', refresh);
  window.BoxplayTV = { announce: announce, refresh: refresh, media: media, back: back };
  try { if (window.tizen && window.tizen.tvinputdevice) ['MediaPlay','MediaPause','MediaPlayPause','MediaStop','MediaFastForward','MediaRewind','ChannelUp','ChannelDown'].forEach(function (key) { try { window.tizen.tvinputdevice.registerKey(key); } catch (error) {} }); } catch (error) {}
  prepare();
})();
