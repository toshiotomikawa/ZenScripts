// ==UserScript==
// @name         x-download-images-button
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.1.0
// @description  Add a native-styled download button to image tweets on X/Twitter to save all images at original quality.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts/tree/main/x-download-images-button
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-download-images-button/x-download-images-button.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-download-images-button/x-download-images-button.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      pbs.twimg.com
// ==/UserScript==

(function () {
  'use strict';

  const BTN_TESTID = 'x-img-dl-btn';
  const SLOT_ATTR = 'data-x-img-dl-slot';
  const CIRCLE_ATTR = 'data-x-img-dl-circle';
  // Exact downward-arrow mirror of X's own Share icon (24x24 viewBox, 2px stroke geometry).
  const DOWNLOAD_PATH =
    'M12 16.41l-5.7-5.7 1.41-1.42L11 12.59V3h2v9.59l3.3-3.3 1.41 1.42L12 16.41z' +
    'M21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z';

  GM_addStyle(`
    button[data-testid="${BTN_TESTID}"]:hover > div,
    button[data-testid="${BTN_TESTID}"]:focus-visible > div {
      color: rgb(29, 155, 240) !important;
    }
    button[data-testid="${BTN_TESTID}"]:hover [${CIRCLE_ATTR}],
    button[data-testid="${BTN_TESTID}"]:focus-visible [${CIRCLE_ATTR}] {
      background-color: rgba(29, 155, 240, 0.1) !important;
    }
    button[data-testid="${BTN_TESTID}"][data-busy="1"] {
      opacity: 0.5;
      pointer-events: none;
    }
  `);

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
    return { username: 'x', tweetId: String(Date.now()) };
  }

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

  async function downloadTweetImages(article, btn) {
    if (btn.dataset.busy === '1') return;
    const { username, tweetId } = getTweetMeta(article);
    const images = getOwnImages(article, tweetId);
    if (!images.length) return;

    btn.dataset.busy = '1';
    try {
      for (let i = 0; i < images.length; i++) {
        const { url, ext } = images[i];
        const filename = `${username}_${tweetId}_${i + 1}.${ext}`;
        const blob = await fetchBlob(url);
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

  // The button always copies the Bookmark slot and sits right after it, so it
  // matches Bookmark's size and spacing and never trades places with it.
  function bookmarkSlotOf(group) {
    const bookmarkBtn = group.querySelector(
      'button[data-testid="bookmark"], button[data-testid="removeBookmark"], [data-engagement-action="bookmark"] button'
    );
    return bookmarkBtn ? { bookmarkBtn, slot: directSlotOf(group, bookmarkBtn) } : null;
  }

  function buildButtonSlot(group, article, imageCount, bookmark) {
    const { bookmarkBtn, slot: templateSlot } = bookmark;
    const shareBtn =
      group.querySelector('button[aria-haspopup="menu"]:not([data-testid])') ||
      group.querySelector('button[aria-label*="Share"]');

    const cloneSlot = templateSlot.cloneNode(true);
    cloneSlot.setAttribute(SLOT_ATTR, '1');
    const actionWrap = cloneSlot.querySelector('[data-engagement-action]');
    if (actionWrap) actionWrap.removeAttribute('data-engagement-action');

    const btn = cloneSlot.querySelector('button');
    if (!btn) return null;

    const label = imageCount > 1 ? 'Download images' : 'Download image';
    btn.removeAttribute('id');
    btn.removeAttribute('data-base-ui-tooltip-trigger');
    btn.removeAttribute('aria-pressed');
    btn.setAttribute('data-testid', BTN_TESTID);
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.removeAttribute('aria-expanded');
    btn.removeAttribute('aria-haspopup');

    const inner = btn.querySelector('div[dir="ltr"]');
    if (inner) {
      // If cloned from an already-bookmarked (blue) button, copy resting color from Share/Reply.
      if (bookmarkBtn.getAttribute('data-testid') === 'removeBookmark') {
        const neutralSource =
          (shareBtn && shareBtn.querySelector('div[dir="ltr"]')) ||
          group.querySelector('button[data-testid="reply"] div[dir="ltr"]');
        if (neutralSource && neutralSource.style.color) {
          inner.style.color = neutralSource.style.color;
        }
      }
      // Strip any text/count siblings (e.g. bookmark count on focal tweets), keeping only the icon wrapper.
      for (const child of Array.from(inner.children)) {
        if (!child.querySelector('svg')) child.remove();
      }
    }

    const svg = btn.querySelector('svg');
    if (svg) {
      const hoverCircle = svg.previousElementSibling;
      if (hoverCircle) hoverCircle.setAttribute(CIRCLE_ATTR, '1');
      const g = svg.querySelector('g') || svg;
      while (g.firstChild) g.removeChild(g.firstChild);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', DOWNLOAD_PATH);
      g.appendChild(path);
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      downloadTweetImages(article, btn);
    });

    return cloneSlot;
  }

  function processArticle(article) {
    if (!article || !article.isConnected) return;
    const group = getActionBar(article);
    if (!group) return;

    const { tweetId } = getTweetMeta(article);
    const images = getOwnImages(article, tweetId);
    const existingSlot = group.querySelector(`[${SLOT_ATTR}]`);

    if (!images.length) {
      if (existingSlot) existingSlot.remove();
      return;
    }

    // Wait for Bookmark to render; the observer runs again when it does.
    const bookmark = bookmarkSlotOf(group);
    if (!bookmark || !bookmark.slot) return;

    const slot = existingSlot || buildButtonSlot(group, article, images.length, bookmark);
    if (!slot) return;

    // X re-renders the bar at times; put the button back right after Bookmark.
    if (bookmark.slot.nextElementSibling !== slot) {
      bookmark.slot.insertAdjacentElement('afterend', slot);
    }
  }

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
      // X can swap an image's src in place after the tweet first renders.
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
    attributeFilter: ['src'],
  });
})();
