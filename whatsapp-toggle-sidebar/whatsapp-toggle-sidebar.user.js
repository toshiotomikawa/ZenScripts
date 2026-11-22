// ==UserScript==
// @name         whatsapp-toggle-sidebar
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.0.0
// @description  Hide or show the chat list on WhatsApp Web with Ctrl+Alt+B, so the open chat fills the window.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts/tree/main/whatsapp-toggle-sidebar
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/whatsapp-toggle-sidebar/whatsapp-toggle-sidebar.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/whatsapp-toggle-sidebar/whatsapp-toggle-sidebar.user.js
// @license      MIT
// @match        https://web.whatsapp.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const KEY = 'zenscripts-whatsapp-sidebar-hidden';
  let hidden = false;
  try { hidden = localStorage.getItem(KEY) === '1'; } catch (e) { /* storage blocked: start shown */ }

  // WhatsApp's class names change with every build, so the chat list is found by position:
  // climb from #side until the parent is wider than the column, which is then the chat list column.
  function locate() {
    const side = document.getElementById('side');
    if (!side) return null;
    let col = side;
    while (col.parentElement && col.parentElement !== document.body) {
      const parent = col.parentElement;
      if (parent.getBoundingClientRect().width > col.getBoundingClientRect().width + 1) {
        return { col, box: parent };
      }
      col = parent;
    }
    return null;
  }

  let applied = null; // the inline styles this script replaced, to put back exactly

  function save(el, props) {
    return props.map((p) => [el, p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]);
  }

  function show() {
    if (!applied) return;
    applied.saved.forEach(([el, p, v, prio]) => (v ? el.style.setProperty(p, v, prio) : el.style.removeProperty(p)));
    applied = null;
  }

  function hide() {
    const found = locate();
    if (!found) return;
    if (applied && applied.col === found.col && found.col.style.display === 'none') return;
    show();
    const { col, box } = found;
    const kids = [...box.children].filter((k) => k !== col);
    // The open chat (or the welcome pane) is the widest of the other columns.
    const chat = kids.reduce((a, b) => (b.getBoundingClientRect().width > (a ? a.getBoundingClientRect().width : -1) ? b : a), null);
    const cs = getComputedStyle(box);
    const saved = save(col, ['display']);
    if (cs.display.includes('grid')) {
      saved.push(...save(box, ['grid-template-columns']));
      const tracks = cs.gridTemplateColumns.split(' ');
      const colLeft = col.getBoundingClientRect().left - box.getBoundingClientRect().left;
      let x = 0, sideIdx = -1, chatIdx = -1;
      const chatLeft = chat ? chat.getBoundingClientRect().left - box.getBoundingClientRect().left : -1;
      tracks.forEach((t, i) => {
        if (Math.abs(x - colLeft) < 2 && sideIdx < 0) sideIdx = i;
        if (Math.abs(x - chatLeft) < 2 && chatIdx < 0) chatIdx = i;
        x += parseFloat(t) || 0;
      });
      if (sideIdx >= 0) {
        if (chatIdx >= 0) tracks[chatIdx] = 'minmax(0, 1fr)';
        tracks.splice(sideIdx, 1);
        box.style.gridTemplateColumns = tracks.join(' ');
      }
    } else if (chat) {
      saved.push(...save(chat, ['flex', 'max-width', 'width']));
      chat.style.setProperty('flex', '1 1 auto', 'important');
      chat.style.setProperty('max-width', 'none', 'important');
      chat.style.setProperty('width', 'auto', 'important');
    }
    col.style.setProperty('display', 'none', 'important');
    applied = { col, saved };
  }

  function sync() { hidden ? hide() : show(); }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && e.code === 'KeyB') {
      e.preventDefault();
      hidden = !hidden;
      try { localStorage.setItem(KEY, hidden ? '1' : '0'); } catch (err) { /* keep the toggle for this tab */ }
      sync();
    }
  }, true);

  // WhatsApp rebuilds its panes (after loading, on resize); reapply once per frame at most.
  let queued = false;
  new MutationObserver(() => {
    if (queued || !hidden) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  }).observe(document.body, { childList: true, subtree: true });

  sync();
})();
