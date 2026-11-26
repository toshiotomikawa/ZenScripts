// ==UserScript==
// @name         instagram-download-images-button
// @namespace    https://github.com/toshiotomikawa/zenscripts
// @version      1.0.5
// @description  Add a native-styled download button to image posts on Instagram to save photos at highest available quality.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/zenscripts/tree/main/instagram-download-images-button
// @supportURL   https://github.com/toshiotomikawa/zenscripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/instagram-download-images-button/instagram-download-images-button.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/instagram-download-images-button/instagram-download-images-button.user.js
// @license      MIT
// @match        https://www.instagram.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      cdninstagram.com
// @connect      fbcdn.net
// ==/UserScript==

(function () {
  'use strict';

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
    const path = svg.querySelector('path[d^="M20 22a.999"]');
    if (path) return true;
    const label = (svg.getAttribute('aria-label') || '').toLowerCase();
    return label === 'save' || label === 'remove' || label === 'salvar' || label === 'remover';
  }

  function findActionSections(root) {
    const out = [];
    if (!root || !root.querySelectorAll) return out;
    const sections = root.matches && root.matches('section') ? [root] : [];
    for (const sec of root.querySelectorAll('section')) sections.push(sec);
    for (const sec of sections) {
      // Only leaf action-bar sections: skip outer page/post wrapper sections.
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

    // In carousels, multiple slides may be mounted; pick the slide most visible in its container.
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
    // Force octet-stream so Firefox downloads instead of opening the image inline in a new tab.
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
    // If Share has an adjacent count span (no SVG), place Download after it.
    const next = anchor.nextElementSibling;
    if (next && next.getAttribute(BTN_ATTR) !== '1' && !next.querySelector('svg')) {
      anchor = next;
    }
    return { shareBtn, anchor };
  }

  function restingTemplateSvg(section, shareBtn) {
    const shareSvgs = shareBtn.querySelectorAll('svg');
    // Profile modals put a muted hover SVG first inside Share; use Save's resting SVG class instead.
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
    // Clear all cloned children so multi-SVG hover-swap buttons never leave a stale icon behind.
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
})();
