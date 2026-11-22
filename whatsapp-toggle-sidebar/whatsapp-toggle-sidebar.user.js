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

  // WhatsApp's class names change with every build, so the chat list is found by position:
  // climb from #side until the parent is wider than the column, which is then the chat list column.
  function locate() {
    const side = document.getElementById('side');
    if (!side) return null;
    let col = side;
    while (col.parentElement && col.parentElement !== document.body) {
      const box = col.parentElement;
      if (box.getBoundingClientRect().width > col.getBoundingClientRect().width + 1) {
        // The open chat (or the welcome pane) is the widest of the other columns.
        const chat = [...box.children].filter((k) => k !== col)
          .reduce((a, b) => (!a || b.getBoundingClientRect().width > a.getBoundingClientRect().width ? b : a), null);
        return { col, box, chat };
      }
      col = box;
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

  function hide(found) {
    if (!found) return;
    if (applied && applied.col === found.col && found.col.style.display === 'none') return;
    show();
    const { col, box, chat } = found;
    const cs = getComputedStyle(box);
    const saved = save(col, ['display']);
    if (cs.display.includes('grid')) {
      saved.push(...save(box, ['grid-template-columns']));
      const tracks = cs.gridTemplateColumns.split(' ');
      const left = box.getBoundingClientRect().left;
      const colLeft = col.getBoundingClientRect().left - left;
      const chatLeft = chat ? chat.getBoundingClientRect().left - left : -1;
      let x = 0, sideIdx = -1, chatIdx = -1;
      tracks.forEach((t, i) => {
        if (sideIdx < 0 && Math.abs(x - colLeft) < 2) sideIdx = i;
        if (chatIdx < 0 && Math.abs(x - chatLeft) < 2) chatIdx = i;
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
  const base = {
    position: 'fixed', 'z-index': '1000', width: '24px', height: '48px', margin: '0', padding: '0',
    border: '0', 'border-radius': '12px', 'align-items': 'center', 'justify-content': 'center',
    cursor: 'pointer', transform: 'translate(-50%, -50%)', 'box-shadow': '0 1px 3px rgba(0, 0, 0, 0.3)',
  };
  Object.entries(base).forEach(([p, v]) => btn.style.setProperty(p, v, 'important'));

  function place(found) {
    if (!found || !found.chat) {
      btn.style.setProperty('display', 'none', 'important');
      return;
    }
    if (!btn.isConnected) document.body.appendChild(btn);
    const r = found.chat.getBoundingClientRect();
    btn.style.setProperty('left', Math.max(r.left, 12) + 'px', 'important');
    btn.style.setProperty('top', r.top + r.height / 2 + 'px', 'important');
    btn.style.setProperty('display', 'flex', 'important');
    const dark = document.body.classList.contains('dark');
    btn.style.setProperty('background', dark ? '#202c33' : '#ffffff', 'important');
    btn.style.setProperty('color', dark ? '#aebac1' : '#54656f', 'important');
    const label = hidden ? 'Show chat list' : 'Hide chat list';
    if (btn.title !== label) {
      btn.title = label;
      btn.setAttribute('aria-label', label);
      chevron.setAttribute('d', hidden ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6');
    }
  }

  function update() {
    const found = locate();
    if (hidden) hide(found); else show();
    place(locate());
  }

  btn.addEventListener('click', () => {
    hidden = !hidden;
    try { localStorage.setItem(KEY, hidden ? '1' : '0'); } catch (e) { /* keep the choice for this tab */ }
    update();
  });

  // WhatsApp rebuilds its panes (after loading, on resize, when a chat opens); recheck once per frame at most.
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);

  update();
})();
