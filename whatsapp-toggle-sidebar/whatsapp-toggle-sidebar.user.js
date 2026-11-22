// ==UserScript==
// @name         whatsapp-toggle-sidebar
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.1.0
// @description  Adds a button to WhatsApp Web that hides or shows the chat list, so the open chat fills the window.
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

  // Laid out in the page flow, not a drawer or overlay floating over it.
  function inFlow(el) {
    const p = getComputedStyle(el).position;
    return p !== 'absolute' && p !== 'fixed' && el.getBoundingClientRect().width > 0;
  }

  // WhatsApp's class names change with every build, so the columns are found from stable ids:
  // `col` is the chat list column (holds #side), `chat` the pane beside it, `box` their parent.
  function locate() {
    const side = document.getElementById('side');
    if (!side) return null;
    const main = document.getElementById('main');
    let col = side;
    if (main) {
      while (col.parentElement && !col.parentElement.contains(main)) col = col.parentElement;
      const box = col.parentElement;
      if (!box || box === document.body) return null;
      let chat = main;
      while (chat.parentElement !== box) chat = chat.parentElement;
      return { col, box, chat };
    }
    // No chat open (welcome pane): climb until a parent is wider and has another column in it.
    while (col.parentElement && col.parentElement !== document.body) {
      const box = col.parentElement;
      if (box.getBoundingClientRect().width > col.getBoundingClientRect().width + 1) {
        const chat = [...box.children].filter((k) => k !== col && inFlow(k))
          .reduce((a, b) => (!a || b.getBoundingClientRect().width > a.getBoundingClientRect().width ? b : a), null);
        if (chat) return { col, box, chat };
      }
      col = box;
    }
    return null;
  }

  let applied = null; // what this script changed, with the inline styles it replaced

  function save(el, props) {
    return props.map((p) => [el, p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]);
  }

  function show() {
    if (!applied) return;
    applied.saved.forEach(([el, p, v, prio]) => (v ? el.style.setProperty(p, v, prio) : el.style.removeProperty(p)));
    applied = null;
  }

  function hide(found, force) {
    if (!force && applied && applied.col === found.col && applied.box === found.box
      && applied.chat === found.chat && found.col.style.display === 'none') return;
    show();
    const { col, box, chat } = found;
    const cs = getComputedStyle(box);
    const saved = save(col, ['display']);
    if (cs.display.includes('grid')) {
      saved.push(...save(box, ['grid-template-columns']));
      const tracks = cs.gridTemplateColumns.split(' ');
      const gap = parseFloat(cs.columnGap) || 0;
      const left = box.getBoundingClientRect().left;
      const colLeft = col.getBoundingClientRect().left - left;
      const chatLeft = chat.getBoundingClientRect().left - left;
      let x = 0, sideIdx = -1, chatIdx = -1;
      tracks.forEach((t, i) => {
        if (sideIdx < 0 && Math.abs(x - colLeft) < 2) sideIdx = i;
        if (chatIdx < 0 && Math.abs(x - chatLeft) < 2) chatIdx = i;
        x += (parseFloat(t) || 0) + gap;
      });
      if (sideIdx >= 0) {
        if (chatIdx >= 0) tracks[chatIdx] = 'minmax(0, 1fr)';
        // The hidden column leaves the grid, so its track goes too and the others move up.
        tracks.splice(sideIdx, 1);
        box.style.gridTemplateColumns = tracks.join(' ');
      }
    } else {
      saved.push(...save(chat, ['flex', 'max-width', 'width']));
      chat.style.setProperty('flex', '1 1 auto', 'important');
      chat.style.setProperty('max-width', 'none', 'important');
      chat.style.setProperty('width', 'auto', 'important');
    }
    col.style.setProperty('display', 'none', 'important');
    applied = { col, box, chat, saved };
  }

  // The button is built with the DOM API and styled through CSSOM, because WhatsApp's
  // Trusted Types and style rules can block innerHTML and injected <style> tags.
  const SVG = 'http://www.w3.org/2000/svg';
  const btn = document.createElement('button');
  btn.type = 'button';
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  const chevron = document.createElementNS(SVG, 'path');
  chevron.setAttribute('fill', 'none');
  chevron.setAttribute('stroke', 'currentColor');
  chevron.setAttribute('stroke-width', '2');
  chevron.setAttribute('stroke-linecap', 'round');
  chevron.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(chevron);
  btn.appendChild(svg);
  // A tab flush with the chat pane's left edge, clear of the chat list's scrollbar and the left rail.
  const base = {
    position: 'fixed', 'z-index': '1000', width: '24px', height: '48px', margin: '0', padding: '0',
    border: '0', 'border-radius': '0 12px 12px 0', 'align-items': 'center', 'justify-content': 'center',
    cursor: 'pointer', transform: 'translateY(-50%)', 'box-shadow': '1px 1px 3px rgba(0, 0, 0, 0.3)',
  };
  Object.entries(base).forEach(([p, v]) => btn.style.setProperty(p, v, 'important'));

  let shown = '';
  function place(found) {
    let state = 'none';
    let x = 0, y = 0;
    if (found) {
      const r = found.chat.getBoundingClientRect();
      x = Math.round(Math.max(r.left, 0));
      y = Math.round(r.top + r.height / 2);
      // Stay out of the way when something covers the chat there (media viewer, dialogs).
      const top = document.elementsFromPoint(x + 12, y).find((el) => el !== btn && !btn.contains(el));
      if (top && found.chat.contains(top)) state = [x, y, hidden, document.body.classList.contains('dark')].join();
    }
    if (state === shown && (state === 'none' || btn.isConnected)) return;
    shown = state;
    if (state === 'none') {
      btn.style.setProperty('display', 'none', 'important');
      return;
    }
    if (!btn.isConnected) document.body.prepend(btn); // first in the Tab order
    const dark = document.body.classList.contains('dark');
    btn.style.setProperty('left', x + 'px', 'important');
    btn.style.setProperty('top', y + 'px', 'important');
    btn.style.setProperty('display', 'flex', 'important');
    btn.style.setProperty('background', dark ? '#202c33' : '#ffffff', 'important');
    btn.style.setProperty('color', dark ? '#aebac1' : '#54656f', 'important');
    const label = hidden ? 'Show chat list' : 'Hide chat list';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-expanded', String(!hidden));
    chevron.setAttribute('d', hidden ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6');
  }

  let resized = false;
  function update() {
    const found = locate();
    // Without the columns there is no button, so nothing may stay hidden either.
    if (hidden && found) hide(found, resized); else show();
    resized = false;
    place(found);
  }

  btn.addEventListener('click', () => {
    hidden = !hidden;
    try { localStorage.setItem(KEY, hidden ? '1' : '0'); } catch (e) { /* keep the choice for this tab */ }
    update();
  });

  // WhatsApp rebuilds its panes (after loading, when a chat opens) and switches theme by
  // a class on <body>; recheck once per frame at most.
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  // Grid tracks are measured in pixels, so a resize measures them again.
  window.addEventListener('resize', () => { resized = true; schedule(); });

  update();
})();
