// ==UserScript==
// @name         zen-scripts-full
// @namespace    https://github.com/toshiotomikawa/zenscripts
// @version      1.1.5
// @description  All ZenScripts userscripts in a single bundle (Instagram, WhatsApp, Wikipedia/Wikimedia, X/Twitter, and YouTube).
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/zenscripts/tree/main/zen-scripts-full
// @supportURL   https://github.com/toshiotomikawa/zenscripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/zen-scripts-full/zen-scripts-full.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/zen-scripts-full/zen-scripts-full.user.js
// @license      MIT
// @match        https://www.instagram.com/*
// @match        https://web.whatsapp.com/*
// @match        *://*.wikipedia.org/*
// @match        *://*.wikimedia.org/*
// @match        *://*.wiktionary.org/*
// @match        *://*.wikibooks.org/*
// @match        *://*.wikidata.org/*
// @match        *://*.wikiquote.org/*
// @match        *://*.wikisource.org/*
// @match        *://*.wikiversity.org/*
// @match        *://*.wikivoyage.org/*
// @match        *://*.mediawiki.org/*
// @match        https://x.com/*
// @match        https://twitter.com/*
// @match        https://www.youtube.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      cdninstagram.com
// @connect      fbcdn.net
// @connect      pbs.twimg.com
// @connect      cdn.syndication.twimg.com
// @connect      api.fxtwitter.com
// @connect      video.twimg.com
// ==/UserScript==

(function () {
  'use strict';

  const host = location.hostname;
  const WIKIMEDIA_RE =
    /(^|\.)(wikipedia|wikimedia|wiktionary|wikibooks|wikidata|wikiquote|wikisource|wikiversity|wikivoyage|mediawiki)\.org$/i;

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  // ---------------------------------------------------------------------------
  // instagram-download-images-button
  // ---------------------------------------------------------------------------
  if (host === 'www.instagram.com') {
    onReady(function instagramDownloadImagesButton() {
      const BTN_ATTR = 'data-ig-img-dl-btn';
      const SVG_NS = 'http://www.w3.org/2000/svg';
      const CDN_RE = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;
      const AVATAR_PATH_RE = /\/t51\.\d+-19\//;
      const RESERVED_PATHS = new Set([
        'p',
        'reel',
        'reels',
        'stories',
        'explore',
        'direct',
        'accounts',
        'about',
        'developer',
        'legal',
      ]);

      GM_addStyle(`
        [${BTN_ATTR}="1"] {
          cursor: pointer;
          transition: opacity 0.12s ease;
        }
        [${BTN_ATTR}="1"]:hover {
          opacity: 0.5;
        }
        [${BTN_ATTR}="1"][data-busy="1"] {
          opacity: 0.35;
          pointer-events: none;
        }
      `);

      function isSaveSvg(svg) {
        if (!svg) return false;
        if (svg.querySelector('polygon[points="20 21 12 13.44 4 21 4 3 20 3 20 21"]')) {
          return true;
        }
        if (svg.querySelector('path[d^="M20 22a.999"]')) return true;
        const label = (svg.getAttribute('aria-label') || '').toLowerCase();
        return label === 'save' || label === 'remove' || label === 'salvar' || label === 'remover';
      }

      function findActionSections(root) {
        const out = [];
        if (!root || !root.querySelectorAll) return out;
        const sections = root.matches && root.matches('section') ? [root] : [];
        for (const sec of root.querySelectorAll('section')) sections.push(sec);
        for (const sec of sections) {
          if (sec.querySelector('section, form, textarea, input')) continue;
          if (sec.children.length < 2) continue;
          const svgs = sec.querySelectorAll('svg');
          let hasSave = false;
          for (const svg of svgs) {
            if (isSaveSvg(svg)) {
              hasSave = true;
              break;
            }
          }
          if (hasSave) out.push(sec);
        }
        return out;
      }

      function isPostImage(img) {
        if (!img || img.tagName !== 'IMG') return false;
        const src = img.currentSrc || img.src;
        if (!src || !src.startsWith('http')) return false;
        let u;
        try {
          u = new URL(src);
        } catch {
          return false;
        }
        if (!CDN_RE.test(u.hostname)) return false;
        if (AVATAR_PATH_RE.test(u.pathname)) return false;
        if (img.closest('header')) return false;
        const rect = img.getBoundingClientRect();
        if (rect.width < 200 || rect.height < 200) return false;
        return true;
      }

      function isVideoOverlayImage(img, container) {
        const videos = container.querySelectorAll('video');
        if (!videos.length) return false;
        const ir = img.getBoundingClientRect();
        for (const v of videos) {
          const vr = v.getBoundingClientRect();
          if (vr.width < 100 || vr.height < 100) continue;
          const overlapX = Math.max(0, Math.min(ir.right, vr.right) - Math.max(ir.left, vr.left));
          const overlapY = Math.max(0, Math.min(ir.bottom, vr.bottom) - Math.max(ir.top, vr.top));
          const overlapArea = overlapX * overlapY;
          const imgArea = ir.width * ir.height;
          if (imgArea > 0 && overlapArea / imgArea > 0.6) return true;
        }
        return false;
      }

      function getPostContainer(section) {
        const article = section.closest('article');
        if (article) return article;
        const dialog = section.closest('[role="dialog"]');
        if (dialog) return dialog;
        let cur = section.parentElement;
        let depth = 0;
        while (cur && cur !== document.body && cur.tagName !== 'MAIN' && depth < 12) {
          const imgs = cur.querySelectorAll('img');
          for (const img of imgs) {
            if (isPostImage(img)) return cur;
          }
          if (cur.querySelector('video')) return cur;
          cur = cur.parentElement;
          depth++;
        }
        return null;
      }

      function getVisiblePostImage(container) {
        if (!container) return null;
        const candidates = [];
        for (const img of container.querySelectorAll('img')) {
          if (!isPostImage(img)) continue;
          if (isVideoOverlayImage(img, container)) continue;
          candidates.push(img);
        }
        if (!candidates.length) return null;
        if (candidates.length === 1) return candidates[0];

        const cr = container.getBoundingClientRect();
        const viewLeft = Math.max(0, cr.left);
        const viewRight = Math.min(window.innerWidth, cr.right);
        const viewTop = Math.max(0, cr.top);
        const viewBottom = Math.min(window.innerHeight, cr.bottom);
        const centerX = (viewLeft + viewRight) / 2;

        let best = candidates[0];
        let bestScore = -Infinity;
        for (const img of candidates) {
          const r = img.getBoundingClientRect();
          const visW = Math.max(0, Math.min(r.right, viewRight) - Math.max(r.left, viewLeft));
          const visH = Math.max(0, Math.min(r.bottom, viewBottom) - Math.max(r.top, viewTop));
          const visArea = visW * visH;
          const dist = Math.abs((r.left + r.right) / 2 - centerX);
          const score = visArea - dist * 10;
          if (score > bestScore) {
            bestScore = score;
            best = img;
          }
        }
        return best;
      }

      function bestImageUrl(img) {
        let bestUrl = img.currentSrc || img.src;
        let bestWidth = img.naturalWidth || 0;
        const srcset = img.getAttribute('srcset');
        if (srcset) {
          for (const part of srcset.split(',')) {
            const tokens = part.trim().split(/\s+/);
            if (tokens.length < 2) continue;
            const url = tokens[0];
            const m = tokens[1].match(/^(\d+)w$/);
            if (!m) continue;
            const w = Number(m[1]);
            if (w > bestWidth) {
              bestWidth = w;
              bestUrl = url;
            }
          }
        }
        return bestUrl;
      }

      function getPostMeta(container) {
        let username = '';
        let shortcode = '';

        const postLink = container.querySelector('a[href*="/p/"]');
        if (postLink) {
          const m = postLink.getAttribute('href').match(/^(?:\/([^/]+))?\/p\/([^/?#]+)/);
          if (m) {
            if (m[1] && !RESERVED_PATHS.has(m[1])) username = m[1];
            shortcode = m[2];
          }
        }

        if (!shortcode) {
          const loc = location.pathname.match(/^(?:\/([^/]+))?\/p\/([^/?#]+)/);
          if (loc) {
            if (!username && loc[1] && !RESERVED_PATHS.has(loc[1])) username = loc[1];
            shortcode = loc[2];
          }
        }

        if (!username) {
          const headerLinks = container.querySelectorAll('header a[href^="/"], a[role="link"][href^="/"]');
          for (const a of headerLinks) {
            const m = a.getAttribute('href').match(/^\/([A-Za-z0-9._]+)\/?$/);
            if (m && !RESERVED_PATHS.has(m[1])) {
              username = m[1];
              break;
            }
          }
        }

        return {
          username: username || 'instagram',
          shortcode: shortcode || String(Date.now()),
        };
      }

      function extFrom(url, mime) {
        if (mime) {
          if (mime.includes('png')) return 'png';
          if (mime.includes('webp')) return 'webp';
          if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
          if (mime.includes('heic')) return 'heic';
        }
        try {
          const m = new URL(url).pathname.match(/\.([a-zA-Z0-9]+)$/);
          if (m) return m[1].toLowerCase();
        } catch {
          // ignore
        }
        return 'jpg';
      }

      function fetchBlob(url) {
        return new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: 'GET',
            url,
            responseType: 'blob',
            onload: (res) => {
              if (res.status >= 200 && res.status < 300 && res.response) {
                resolve(res.response);
              } else {
                reject(new Error(`HTTP ${res.status} for ${url}`));
              }
            },
            onerror: () => reject(new Error(`Network error for ${url}`)),
          });
        });
      }

      function triggerBlobDownload(blob, filename) {
        const forced = new Blob([blob], { type: 'application/octet-stream' });
        const objUrl = URL.createObjectURL(forced);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = filename;
        a.style.display = 'none';
        a.addEventListener('click', (e) => e.stopPropagation(), { once: true });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 30000);
      }

      function gmDownload(url, filename) {
        return new Promise((resolve, reject) => {
          if (typeof GM_download !== 'function') {
            reject(new Error('GM_download unavailable'));
            return;
          }
          GM_download({
            url,
            name: filename,
            saveAs: false,
            onload: () => resolve(),
            onerror: (err) => reject(err || new Error('GM_download failed')),
            ontimeout: () => reject(new Error('GM_download timeout')),
          });
        });
      }

      async function downloadPostImage(section, btn) {
        if (btn.dataset.busy === '1') return;
        const container = getPostContainer(section);
        const img = getVisiblePostImage(container);
        if (!img) return;

        const url = bestImageUrl(img);
        const { username, shortcode } = getPostMeta(container);

        btn.dataset.busy = '1';
        try {
          const ext = extFrom(url, '');
          const filename = `${username}_${shortcode}.${ext}`;
          try {
            await gmDownload(url, filename);
            return;
          } catch {
            // Fall back to fetching as a blob if GM_download is unavailable or blocked.
          }
          const blob = await fetchBlob(url);
          triggerBlobDownload(blob, `${username}_${shortcode}.${extFrom(url, blob.type)}`);
        } catch (err) {
          console.error('[Instagram image download]', err);
        } finally {
          delete btn.dataset.busy;
        }
      }

      function makeDownloadSvg(templateSvg) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        if (templateSvg) {
          const cls = templateSvg.getAttribute('class');
          if (cls) svg.setAttribute('class', cls);
        }
        svg.setAttribute('aria-label', 'Download image');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('height', '24');
        svg.setAttribute('width', '24');
        svg.setAttribute('role', 'img');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');

        const title = document.createElementNS(SVG_NS, 'title');
        title.textContent = 'Download image';
        svg.appendChild(title);

        const shaft = document.createElementNS(SVG_NS, 'line');
        shaft.setAttribute('x1', '12');
        shaft.setAttribute('y1', '3');
        shaft.setAttribute('x2', '12');
        shaft.setAttribute('y2', '15');
        svg.appendChild(shaft);

        const head = document.createElementNS(SVG_NS, 'polyline');
        head.setAttribute('points', '7 10 12 15 17 10');
        svg.appendChild(head);

        const tray = document.createElementNS(SVG_NS, 'path');
        tray.setAttribute('d', 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2');
        svg.appendChild(tray);

        return svg;
      }

      function directChildOf(parent, el) {
        let cur = el;
        while (cur && cur.parentElement !== parent) {
          cur = cur.parentElement;
        }
        return cur && cur.parentElement === parent ? cur : null;
      }

      function lowestCommonAncestor(a, b, limit) {
        let cur = a;
        while (cur && cur !== limit.parentElement) {
          if (cur.contains(b)) return cur;
          cur = cur.parentElement;
        }
        return limit;
      }

      function findActionRowAndShare(section) {
        const iconBtns = [];
        for (const el of section.querySelectorAll('div[role="button"], button')) {
          if (el.getAttribute(BTN_ATTR) === '1') continue;
          const svg = el.querySelector('svg');
          if (!svg || isSaveSvg(svg)) continue;
          iconBtns.push(el);
        }
        if (iconBtns.length < 2) return null;
        const firstBtn = iconBtns[0];
        const shareBtn = iconBtns[iconBtns.length - 1];
        const row = lowestCommonAncestor(firstBtn, shareBtn, section);
        if (!section.contains(row)) return null;
        let anchor = directChildOf(row, shareBtn);
        if (!anchor || anchor === section || !section.contains(anchor)) return null;
        const next = anchor.nextElementSibling;
        if (next && next.getAttribute(BTN_ATTR) !== '1' && !next.querySelector('svg')) {
          anchor = next;
        }
        return { shareBtn, anchor };
      }

      function restingTemplateSvg(section, shareBtn) {
        const shareSvgs = shareBtn.querySelectorAll('svg');
        if (shareSvgs.length > 1) {
          for (const svg of section.querySelectorAll('svg')) {
            if (isSaveSvg(svg)) return svg;
          }
          return shareSvgs[shareSvgs.length - 1];
        }
        return shareSvgs[0] || null;
      }

      function buildButton(section, shareBtn) {
        const clone = shareBtn.cloneNode(true);
        clone.setAttribute(BTN_ATTR, '1');
        clone.setAttribute('role', 'button');
        clone.setAttribute('tabindex', '0');
        clone.setAttribute('aria-label', 'Download image');
        clone.setAttribute('title', 'Download image');
        clone.removeAttribute('id');

        const templateSvg = restingTemplateSvg(section, shareBtn);
        const newSvg = makeDownloadSvg(templateSvg);
        clone.textContent = '';
        const iconWrap = document.createElement('div');
        iconWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;';
        iconWrap.appendChild(newSvg);
        clone.appendChild(iconWrap);

        const activate = (e) => {
          e.preventDefault();
          e.stopPropagation();
          downloadPostImage(section, clone);
        };
        clone.addEventListener('click', activate);
        clone.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') activate(e);
        });

        return clone;
      }

      function processSection(section) {
        if (!section || !section.isConnected) return;

        const container = getPostContainer(section);
        const hasImage = Boolean(getVisiblePostImage(container));
        const existing = section.querySelector(`[${BTN_ATTR}="1"]`);

        if (!hasImage) {
          if (existing) existing.remove();
          return;
        }

        const found = findActionRowAndShare(section);
        if (!found) return;

        const btn = existing || buildButton(section, found.shareBtn);
        if (found.anchor.nextElementSibling !== btn) {
          found.anchor.insertAdjacentElement('afterend', btn);
        }
      }

      let scheduled = false;
      function flush() {
        scheduled = false;
        for (const sec of findActionSections(document.body)) {
          processSection(sec);
        }
      }

      function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(flush);
      }

      schedule();

      const observer = new MutationObserver(() => schedule());
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset'],
      });
    });
  }

  // ---------------------------------------------------------------------------
  // whatsapp-toggle-sidebar
  // ---------------------------------------------------------------------------
  if (host === 'web.whatsapp.com') {
    onReady(function whatsappToggleSidebar() {
      const KEY = 'zenscripts-whatsapp-sidebar-hidden';
      let hidden = false;
      try { hidden = localStorage.getItem(KEY) === '1'; } catch (e) { /* storage blocked: start shown */ }

      function inFlow(el) {
        const p = getComputedStyle(el).position;
        return p !== 'absolute' && p !== 'fixed' && el.getBoundingClientRect().width > 0;
      }

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
          if (chat.getBoundingClientRect().width === 0) return null;
          return { col, box, chat };
        }
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

      let applied = null;

      function save(el, props) {
        return props.map((p) => [el, p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]);
      }

      function show() {
        if (!applied) return;
        applied.saved.forEach(([el, p, v, prio]) => (v ? el.style.setProperty(p, v, prio) : el.style.removeProperty(p)));
        applied = null;
      }

      function dividers(edge) {
        return [...document.querySelectorAll('[data-testid^="drawer-"]')].filter((d) => {
          if (d.style.getPropertyValue('border-left-color') === 'transparent') return false;
          return Math.abs(d.getBoundingClientRect().left - edge) <= 2
            && parseFloat(getComputedStyle(d).borderLeftWidth) > 0;
        });
      }

      function clear(lines, saved) {
        lines.forEach((l) => {
          saved.push(...save(l, ['border-left-color']));
          l.style.setProperty('border-left-color', 'transparent', 'important');
        });
      }

      function hide(found, force) {
        if (!force && applied && applied.col === found.col && applied.box === found.box
          && applied.chat === found.chat && found.col.style.display === 'none') {
          clear(dividers(applied.edge), applied.saved);
          return;
        }
        show();
        const { col, box, chat } = found;
        const edge = col.getBoundingClientRect().right;
        const lines = dividers(edge);
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
        clear(lines, saved);
        applied = { col, box, chat, edge, saved };
      }

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
          const top = document.elementsFromPoint(x + 12, y).find((el) => el !== btn && !btn.contains(el));
          if (top && found.chat.contains(top)) state = [x, y, hidden, document.body.classList.contains('dark')].join();
        }
        if (state === shown && (state === 'none' || btn.isConnected)) return;
        shown = state;
        if (state === 'none') {
          btn.style.setProperty('display', 'none', 'important');
          return;
        }
        if (!btn.isConnected) document.body.prepend(btn);
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
        if (hidden && found) hide(found, resized); else show();
        resized = false;
        place(found);
      }

      btn.addEventListener('click', () => {
        hidden = !hidden;
        try { localStorage.setItem(KEY, hidden ? '1' : '0'); } catch (e) { /* keep the choice for this tab */ }
        update();
      });

      let queued = false;
      function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; update(); });
      }
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
      new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
      window.addEventListener('resize', () => { resized = true; schedule(); });

      update();
    });
    return;
  }

  // ---------------------------------------------------------------------------
  // wikipedia-seamless-background
  // ---------------------------------------------------------------------------
  if (WIKIMEDIA_RE.test(host)) {
    const STYLE_ID = 'wikipedia-seamless-background';

    const canvas = (bg, th) => `
      &,
      & body {
        --background-color-neutral-subtle: ${bg} !important;
        --background-color-interactive-subtle: ${bg} !important;
        --background-color-base: ${bg} !important;
        --background-color-base-fixed: ${bg} !important;
      }

      &,
      & body,
      .mw-page-container,
      .mw-page-container-inner,
      .vector-body,
      .vector-header-container,
      .vector-header-container .mw-header,
      .vector-header-container .vector-sticky-header,
      .vector-sticky-header-container,
      .vector-main-menu-container,
      .mw-content-container,
      #content,
      #mw-page-base,
      #mw-head-base {
        background-color: ${bg} !important;
        background-image: none !important;
      }

      .infobox,
      .infobox-header,
      .infobox-subheader,
      .infobox-above,
      .infobox-below,
      .infobox-full-data,
      .infobox-data,
      .infobox-label,
      .infobox-image,
      .infobox td,
      .infobox th,
      .infobox caption,
      figure[typeof~='mw:File/Thumb'],
      figure[typeof~='mw:File/Frame'],
      figure[typeof~='mw:File/Thumb'] > figcaption,
      figure[typeof~='mw:File/Frame'] > figcaption,
      .thumbinner,
      .thumbcaption,
      div.thumb,
      .wikitable,
      .catlinks,
      .mw-footer,
      #footer,
      #footer-icons a,
      .vector-pinnable-header-toggle-button:hover,
      .vector-pinnable-header,
      .cdx-button:enabled,
      .cdx-button.cdx-button--fake-button--enabled,
      .cdx-text-input__input:enabled:read-only {
        background-color: ${bg} !important;
      }

      .wikitable > tr > th,
      .wikitable > * > tr > th {
        background-color: ${th} !important;
      }
    `;

    const light = canvas('#ffffff', '#f7f7f7');
    const night = canvas('#101418', '#27292d');

    const css = `
      html.skin-theme-clientpref-night { ${night} }
      @media (prefers-color-scheme: dark) {
        html.skin-theme-clientpref-os { ${night} }
        html:not(.skin-theme-clientpref-night):not(.skin-theme-clientpref-os) { ${light} }
      }
      @media not (prefers-color-scheme: dark) {
        html:not(.skin-theme-clientpref-night) { ${light} }
      }
    `;

    function apply() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }

    apply();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply, { once: true });
    }
    return;
  }

  // ---------------------------------------------------------------------------
  // youtube-no-translate-button
  // ---------------------------------------------------------------------------
  if (host === 'www.youtube.com') {
    onReady(function youtubeNoTranslateButton() {
      function removeTranslateButtons() {
        document.querySelectorAll('ytd-tri-state-button-view-model.translate-button')
          .forEach((el) => el.remove());
      }

      removeTranslateButtons();

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.querySelectorAll) {
                node.querySelectorAll('ytd-tri-state-button-view-model.translate-button')
                  .forEach((el) => el.remove());
              }
              if (node.matches && node.matches('ytd-tri-state-button-view-model.translate-button')) {
                node.remove();
              }
            }
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
    return;
  }

  // ---------------------------------------------------------------------------
  // X / Twitter bundle
  // ---------------------------------------------------------------------------
  if (host === 'x.com' || host === 'twitter.com') {
    // CSS-only hide rules (injected at document-start)
    GM_addStyle(`
      /* x-clean-left-sidebar */
      nav > a[href="/i/calls"],
      nav > a[href^="/i/jf/creators/studio"],
      nav > a[href="/i/premium_sign_up"],

      /* x-hide-analytics-banner */
      div:has(> div > [role="button"]):has(> div > div img[src*="/premium_nux/analytics"]),
      div:has(> div > [role="button"]):has(> div > div > a[href^="/i/account_analytics"]),

      /* x-hide-creator-subscribe-button */
      div:has(> button[data-testid$="-subscribe"]),
      span:has(> a[href$="/creator-subscriptions/subscribe"]),
      a[href$="/creator-subscriptions/subscribe"],

      /* x-hide-get-verified-button */
      [data-testid="UserName"] a[href^="/i/verified-choose"],
      [data-testid="UserName"] a[href^="/i/premium_sign_up"],
      main span:has(> h1) + span a[href^="/i/verified-choose"],
      main span:has(> h1) + span a[href^="/i/premium_sign_up"],
      main span:has(> h1) + span button,

      /* x-hide-grok-button */
      nav > a[href="/i/grok"],

      /* x-hide-not-verified-banner */
      [data-testid="primaryColumn"] div:has(> div > a[href^="/i/premium_sign_up"]),
      main div:has(> [class*="callout"] a[href^="/i/premium_sign_up"]),

      /* x-hide-subscribe-button */
      [data-testid="sidebarColumn"] div:has(> aside a[href^="/i/premium_sign_up"]),
      aside section:has(a[href^="/i/premium_sign_up"]),

      /* x-hide-whats-happening */
      [data-testid="sidebarColumn"] div:has(> section[role="region"] > [aria-label="Timeline: Trending now"]),
      [data-testid="sidebarColumn"] div:has(> section[role="region"] [data-testid="trend"]),
      [data-testid="sidebarColumn"] div:has(> section[role="region"] a[href="/explore"]),
      [data-testid="sidebarColumn"] div:has(> section[role="region"] a[href^="/explore/"]),
      [data-testid="sidebarColumn"] div:has(> section[role="region"] a[href^="/i/trends"]),
      aside section:has(a[href*="vertical=trends"]),
      aside section:has(a[href="/explore"]),
      aside section:has(a[href^="/explore/"]),
      aside section:has(a[href^="/i/trends"]) {
        display: none !important;
      }
    `);

    const DOWNLOAD_PATH =
      'M12 16.41l-5.7-5.7 1.41-1.42L11 12.59V3h2v9.59l3.3-3.3 1.41 1.42L12 16.41z' +
      'M21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z';

    function isInsideQuote(node, article) {
      let cur = node && node.parentElement;
      while (cur && cur !== article) {
        if (
          cur.tagName === 'DIV' &&
          cur.getAttribute('role') === 'link' &&
          cur.getAttribute('tabindex') === '0'
        ) {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    }

    function getTweetMeta(article) {
      const links = article.querySelectorAll('a[href*="/status/"]');
      for (const a of links) {
        if (!a.querySelector('time') || isInsideQuote(a, article)) continue;
        const m = a.getAttribute('href').match(/^\/([^/]+)\/status\/(\d+)/);
        if (m) return { username: m[1], tweetId: m[2] };
      }
      for (const a of links) {
        if (isInsideQuote(a, article)) continue;
        const m = a.getAttribute('href').match(/^\/([^/]+)\/status\/(\d+)(?:\/|$)/);
        if (m) return { username: m[1], tweetId: m[2] };
      }
      const loc = location.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
      if (loc) return { username: loc[1], tweetId: loc[2] };
      return { username: 'x', tweetId: null };
    }

    function gmGet(url, responseType) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          responseType,
          onload: (res) => {
            if (res.status >= 200 && res.status < 300) {
              resolve(responseType === 'blob' ? res.response : res.responseText);
            } else {
              reject(new Error(`HTTP ${res.status} for ${url}`));
            }
          },
          onerror: () => reject(new Error(`Network error for ${url}`)),
        });
      });
    }

    function triggerBlobDownload(blob, filename) {
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 30000);
    }

    function getActionBar(article) {
      const groups = article.querySelectorAll('div[role="group"]');
      for (const g of groups) {
        if (!isInsideQuote(g, article)) return g;
      }
      const bm = article.querySelector('[data-engagement-action="bookmark"]');
      if (bm && !isInsideQuote(bm, article)) {
        const slot = bm.parentElement;
        if (slot && slot.parentElement) return slot.parentElement;
      }
      return null;
    }

    function directSlotOf(group, el) {
      let cur = el;
      while (cur && cur.parentElement !== group) {
        cur = cur.parentElement;
      }
      return cur && cur.parentElement === group ? cur : null;
    }

    function bookmarkSlotOf(group) {
      const newAction = group.querySelector('[data-engagement-action="bookmark"]');
      if (newAction) {
        const bookmarkBtn = newAction.querySelector('button');
        if (bookmarkBtn) {
          const wrap = newAction.parentElement;
          const slot = wrap && wrap.children.length === 1 ? wrap : newAction;
          return { bookmarkBtn, slot };
        }
      }
      const bookmarkBtn = group.querySelector(
        'button[data-testid="bookmark"], button[data-testid="removeBookmark"]'
      );
      return bookmarkBtn ? { bookmarkBtn, slot: directSlotOf(group, bookmarkBtn) } : null;
    }

    function buildButtonSlot(group, article, bookmark, opts) {
      const { bookmarkBtn, slot: templateSlot } = bookmark;
      const shareBtn =
        group.querySelector('button[aria-haspopup="menu"]:not([data-testid])') ||
        group.querySelector('button[aria-label*="Share"]');

      const cloneSlot = templateSlot.cloneNode(true);
      cloneSlot.setAttribute(opts.slotAttr, '1');
      const actionWrap = cloneSlot.querySelector('[data-engagement-action]');
      if (actionWrap) actionWrap.removeAttribute('data-engagement-action');
      if (cloneSlot.hasAttribute('data-engagement-action')) {
        cloneSlot.removeAttribute('data-engagement-action');
      }

      const btn = cloneSlot.querySelector('button');
      if (!btn) return null;

      btn.removeAttribute('id');
      btn.removeAttribute('data-base-ui-tooltip-trigger');
      btn.removeAttribute('aria-pressed');
      btn.setAttribute('data-testid', opts.testId);
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', opts.label);
      btn.setAttribute('title', opts.label);
      btn.removeAttribute('aria-expanded');
      btn.removeAttribute('aria-haspopup');

      if (btn.classList.contains('text-brand')) {
        btn.classList.remove('text-brand');
        btn.classList.add('text-secondary');
      }

      const inner = btn.querySelector('div[dir="ltr"]');
      if (inner) {
        if (bookmarkBtn.getAttribute('data-testid') === 'removeBookmark') {
          const neutralSource =
            (shareBtn && shareBtn.querySelector('div[dir="ltr"]')) ||
            group.querySelector('button[data-testid="reply"] div[dir="ltr"]');
          if (neutralSource && neutralSource.style.color) {
            inner.style.color = neutralSource.style.color;
          }
        }
        for (const child of Array.from(inner.children)) {
          if (!child.querySelector('svg')) child.remove();
        }
      }

      const svg = btn.querySelector('svg');
      if (svg) {
        const svgParent = svg.parentElement;
        if (svgParent && svgParent !== btn) {
          for (const child of Array.from(svgParent.children)) {
            if (child === svg) continue;
            if (child === svg.previousElementSibling && child.tagName === 'DIV' && !child.textContent.trim()) {
              child.setAttribute(opts.circleAttr, '1');
              continue;
            }
            child.remove();
          }
        }
        const g = svg.querySelector('g') || svg;
        while (g.firstChild) g.removeChild(g.firstChild);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', DOWNLOAD_PATH);
        g.appendChild(path);
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        opts.onClick(article, btn);
      });

      return cloneSlot;
    }

    // Styles for both download buttons
    const IMG_TESTID = 'x-img-dl-btn';
    const IMG_SLOT_ATTR = 'data-x-img-dl-slot';
    const IMG_CIRCLE_ATTR = 'data-x-img-dl-circle';
    const VID_TESTID = 'x-vid-dl-btn';
    const VID_SLOT_ATTR = 'data-x-vid-dl-slot';
    const VID_CIRCLE_ATTR = 'data-x-vid-dl-circle';

    GM_addStyle(`
      button[data-testid="${IMG_TESTID}"]:hover > div,
      button[data-testid="${IMG_TESTID}"]:focus-visible > div,
      button[data-testid="${VID_TESTID}"]:hover > div,
      button[data-testid="${VID_TESTID}"]:focus-visible > div {
        color: rgb(29, 155, 240) !important;
      }
      button[data-testid="${IMG_TESTID}"]:hover [${IMG_CIRCLE_ATTR}],
      button[data-testid="${IMG_TESTID}"]:focus-visible [${IMG_CIRCLE_ATTR}],
      button[data-testid="${VID_TESTID}"]:hover [${VID_CIRCLE_ATTR}],
      button[data-testid="${VID_TESTID}"]:focus-visible [${VID_CIRCLE_ATTR}] {
        background-color: rgba(29, 155, 240, 0.1) !important;
      }
      button[data-testid="${IMG_TESTID}"][data-busy="1"],
      button[data-testid="${VID_TESTID}"][data-busy="1"] {
        opacity: 0.5;
        pointer-events: none;
      }
    `);

    // x-download-images-button helpers
    function toOrigImage(src) {
      const u = new URL(src);
      let ext = u.searchParams.get('format');
      if (ext) {
        u.searchParams.set('name', 'orig');
      } else {
        const m = u.pathname.match(/\.([a-zA-Z0-9]+)(?::[a-z]+)?$/);
        ext = m ? m[1].toLowerCase() : 'jpg';
        u.pathname = u.pathname.replace(/:[a-z]+$/, '');
        u.searchParams.set('name', 'orig');
      }
      return { url: u.toString(), ext: ext.toLowerCase() };
    }

    function getOwnImages(article, tweetId) {
      const imgs = article.querySelectorAll(
        '[data-testid="tweetPhoto"] img[src*="pbs.twimg.com/media/"], a[href*="/photo/"] img[src*="pbs.twimg.com/media/"]'
      );
      const seen = new Set();
      const out = [];
      for (const img of imgs) {
        if (isInsideQuote(img, article)) continue;
        const photoLink = img.closest('a[href*="/status/"]');
        if (photoLink && tweetId) {
          const m = photoLink.getAttribute('href').match(/\/status\/(\d+)/);
          if (m && m[1] !== tweetId) continue;
        }
        let key;
        try {
          key = new URL(img.src).pathname;
        } catch {
          continue;
        }
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(toOrigImage(img.src));
      }
      return out;
    }

    async function downloadTweetImages(article, btn) {
      if (btn.dataset.busy === '1') return;
      const { username, tweetId } = getTweetMeta(article);
      const images = getOwnImages(article, tweetId);
      if (!images.length) return;

      btn.dataset.busy = '1';
      try {
        const idPart = tweetId || String(Date.now());
        for (let i = 0; i < images.length; i++) {
          const { url, ext } = images[i];
          const filename = `${username}_${idPart}_${i + 1}.${ext}`;
          const blob = await gmGet(url, 'blob');
          triggerBlobDownload(blob, filename);
          if (i + 1 < images.length) {
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      } catch (err) {
        console.error('[X image download]', err);
      } finally {
        delete btn.dataset.busy;
      }
    }

    // x-download-videos-button helpers
    function countOwnVideos(article) {
      const raw = Array.from(
        article.querySelectorAll(
          'video, [data-testid="videoComponent"], [data-testid="videoPlayer"], img[src*="video_thumb"]'
        )
      ).filter((el) => !isInsideQuote(el, article));

      const kept = [];
      for (const el of raw) {
        if (kept.some((other) => other === el || other.contains(el) || el.contains(other))) {
          continue;
        }
        kept.push(el);
      }
      return kept.length;
    }

    function getDirectVideoUrls(article) {
      const videos = article.querySelectorAll('video');
      const seen = new Set();
      const out = [];
      for (const v of videos) {
        if (isInsideQuote(v, article)) continue;
        const src = v.currentSrc || v.src || '';
        if (!/^https:\/\/.*\.mp4(\?|$)/i.test(src)) continue;
        let key;
        try {
          key = new URL(src).pathname;
        } catch {
          continue;
        }
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ url: src, ext: 'mp4' });
      }
      return out;
    }

    function resolutionArea(url) {
      const m = String(url).match(/\/(\d{2,5})x(\d{2,5})\//);
      return m ? Number(m[1]) * Number(m[2]) : 0;
    }

    function pickBestMp4(variants) {
      if (!Array.isArray(variants)) return null;
      const mp4s = variants
        .filter((v) => v && v.url && (v.content_type === 'video/mp4' || /\.mp4(\?|$)/i.test(v.url)))
        .map((v) => ({
          url: v.url,
          bitrate: typeof v.bitrate === 'number' ? v.bitrate : -1,
          area: resolutionArea(v.url),
        }));
      mp4s.sort((a, b) => b.bitrate - a.bitrate || b.area - a.area);
      return mp4s[0] ? mp4s[0].url : null;
    }

    async function fetchVideosFromSyndication(tweetId) {
      const token = ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
      const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}`;
      const text = await gmGet(url, 'text');
      const data = JSON.parse(text);

      const mediaList = Array.isArray(data.mediaDetails)
        ? data.mediaDetails
        : data.extended_entities && Array.isArray(data.extended_entities.media)
          ? data.extended_entities.media
          : [];

      const out = [];
      const seen = new Set();
      for (const m of mediaList) {
        if (!m || !m.video_info || !Array.isArray(m.video_info.variants)) continue;
        const best = pickBestMp4(m.video_info.variants);
        if (!best || seen.has(best)) continue;
        seen.add(best);
        out.push({ url: best, ext: 'mp4' });
      }
      if (!out.length && data.video && Array.isArray(data.video.variants)) {
        const best = pickBestMp4(data.video.variants);
        if (best) out.push({ url: best, ext: 'mp4' });
      }
      return out;
    }

    async function fetchVideosFromFxTwitter(tweetId) {
      const text = await gmGet(`https://api.fxtwitter.com/status/${tweetId}`, 'text');
      const data = JSON.parse(text);
      const videos = data && data.tweet && data.tweet.media && data.tweet.media.videos;
      if (!Array.isArray(videos)) return [];
      const out = [];
      const seen = new Set();
      for (const v of videos) {
        if (!v || typeof v.url !== 'string' || seen.has(v.url)) continue;
        seen.add(v.url);
        out.push({ url: v.url, ext: 'mp4' });
      }
      return out;
    }

    async function resolveTweetVideos(article, tweetId) {
      const direct = getDirectVideoUrls(article);
      if (direct.length) return direct;
      if (!tweetId) return [];

      try {
        const synd = await fetchVideosFromSyndication(tweetId);
        if (synd.length) return synd;
      } catch (err) {
        console.warn('[X video download] Syndication lookup failed, trying fallback:', err);
      }

      return fetchVideosFromFxTwitter(tweetId);
    }

    async function downloadTweetVideos(article, btn) {
      if (btn.dataset.busy === '1') return;
      const { username, tweetId } = getTweetMeta(article);

      btn.dataset.busy = '1';
      try {
        const videos = await resolveTweetVideos(article, tweetId);
        if (!videos.length) {
          console.error('[X video download] No downloadable video URL found for tweet', tweetId);
          return;
        }
        const idPart = tweetId || String(Date.now());
        for (let i = 0; i < videos.length; i++) {
          const { url, ext } = videos[i];
          const filename = `${username}_${idPart}_${i + 1}.${ext}`;
          const blob = await gmGet(url, 'blob');
          triggerBlobDownload(blob, filename);
          if (i + 1 < videos.length) {
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      } catch (err) {
        console.error('[X video download]', err);
      } finally {
        delete btn.dataset.busy;
      }
    }

    function processArticle(article) {
      if (!article || !article.isConnected) return;
      const group = getActionBar(article);
      if (!group) return;

      const { tweetId } = getTweetMeta(article);
      const images = getOwnImages(article, tweetId);
      const videoCount = countOwnVideos(article);

      const existingImgSlot = group.querySelector(`[${IMG_SLOT_ATTR}]`);
      const existingVidSlot = group.querySelector(`[${VID_SLOT_ATTR}]`);

      if (!images.length && existingImgSlot) existingImgSlot.remove();
      if (!videoCount && existingVidSlot) existingVidSlot.remove();
      if (!images.length && !videoCount) return;

      const bookmark = bookmarkSlotOf(group);
      if (!bookmark || !bookmark.slot) return;

      let imgSlot = existingImgSlot;
      if (images.length) {
        const label = images.length > 1 ? 'Download images' : 'Download image';
        imgSlot =
          existingImgSlot ||
          buildButtonSlot(group, article, bookmark, {
            slotAttr: IMG_SLOT_ATTR,
            testId: IMG_TESTID,
            circleAttr: IMG_CIRCLE_ATTR,
            label,
            onClick: downloadTweetImages,
          });
        if (imgSlot) {
          if (existingImgSlot) {
            const btn = existingImgSlot.querySelector(`button[data-testid="${IMG_TESTID}"]`);
            if (btn && btn.getAttribute('aria-label') !== label) {
              btn.setAttribute('aria-label', label);
              btn.setAttribute('title', label);
            }
          }
          if (bookmark.slot.nextElementSibling !== imgSlot) {
            bookmark.slot.insertAdjacentElement('afterend', imgSlot);
          }
        }
      }

      if (videoCount) {
        const label = videoCount > 1 ? 'Download videos' : 'Download video';
        const vidSlot =
          existingVidSlot ||
          buildButtonSlot(group, article, bookmark, {
            slotAttr: VID_SLOT_ATTR,
            testId: VID_TESTID,
            circleAttr: VID_CIRCLE_ATTR,
            label,
            onClick: downloadTweetVideos,
          });
        if (vidSlot) {
          if (existingVidSlot) {
            const btn = existingVidSlot.querySelector(`button[data-testid="${VID_TESTID}"]`);
            if (btn && btn.getAttribute('aria-label') !== label) {
              btn.setAttribute('aria-label', label);
              btn.setAttribute('title', label);
            }
          }
          const anchor = imgSlot && imgSlot.parentElement === group ? imgSlot : bookmark.slot;
          if (anchor.nextElementSibling !== vidSlot) {
            anchor.insertAdjacentElement('afterend', vidSlot);
          }
        }
      }
    }

    onReady(function initXDownloadButtons() {
      const pending = new Set();
      let scheduled = false;

      function flush() {
        scheduled = false;
        for (const article of pending) {
          processArticle(article);
        }
        pending.clear();
      }

      function queueArticle(article) {
        if (!article) return;
        pending.add(article);
        if (!scheduled) {
          scheduled = true;
          requestAnimationFrame(flush);
        }
      }

      function scanRoot(root) {
        if (!root || root.nodeType !== 1) return;
        if (root.matches('article')) {
          queueArticle(root);
        }
        const closest = root.closest && root.closest('article');
        if (closest) {
          queueArticle(closest);
        }
        if (root.querySelectorAll) {
          for (const a of root.querySelectorAll('article')) {
            queueArticle(a);
          }
        }
      }

      scanRoot(document.body);

      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes') {
            queueArticle(m.target.closest('article'));
            continue;
          }
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) scanRoot(node);
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'poster'],
      });
    });
  }
})();
