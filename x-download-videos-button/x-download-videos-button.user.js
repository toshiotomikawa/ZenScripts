// ==UserScript==
// @name         x-download-videos-button
// @namespace    https://github.com/toshiotomikawa/zenscripts
// @version      1.1.0
// @description  Add a native-styled download button to video tweets on X/Twitter to save all videos at source quality.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/zenscripts/tree/main/x-download-videos-button
// @supportURL   https://github.com/toshiotomikawa/zenscripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/x-download-videos-button/x-download-videos-button.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/x-download-videos-button/x-download-videos-button.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      cdn.syndication.twimg.com
// @connect      api.fxtwitter.com
// @connect      video.twimg.com
// ==/UserScript==

(function () {
  'use strict';

  const BTN_TESTID = 'x-vid-dl-btn';
  const SLOT_ATTR = 'data-x-vid-dl-slot';
  const CIRCLE_ATTR = 'data-x-vid-dl-circle';
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
    return { username: 'x', tweetId: null };
  }

  // Pure DOM detection so the button renders reliably across Firefox, Chrome, and any userscript sandbox.
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

  // The button always copies the Bookmark slot so it matches Bookmark's size and spacing.
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

  function buildButtonSlot(group, article, videoCount, bookmark) {
    const { bookmarkBtn, slot: templateSlot } = bookmark;
    const shareBtn =
      group.querySelector('button[aria-haspopup="menu"]:not([data-testid])') ||
      group.querySelector('button[aria-label*="Share"]');

    const cloneSlot = templateSlot.cloneNode(true);
    cloneSlot.setAttribute(SLOT_ATTR, '1');
    const actionWrap = cloneSlot.querySelector('[data-engagement-action]');
    if (actionWrap) actionWrap.removeAttribute('data-engagement-action');
    if (cloneSlot.hasAttribute('data-engagement-action')) {
      cloneSlot.removeAttribute('data-engagement-action');
    }

    const btn = cloneSlot.querySelector('button');
    if (!btn) return null;

    const label = videoCount > 1 ? 'Download videos' : 'Download video';
    btn.removeAttribute('id');
    btn.removeAttribute('data-base-ui-tooltip-trigger');
    btn.removeAttribute('aria-pressed');
    btn.setAttribute('data-testid', BTN_TESTID);
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.removeAttribute('aria-expanded');
    btn.removeAttribute('aria-haspopup');

    // In the Tailwind/Base-UI layout, an already-bookmarked button uses text-brand instead of text-secondary.
    if (btn.classList.contains('text-brand')) {
      btn.classList.remove('text-brand');
      btn.classList.add('text-secondary');
    }

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
      // Strip count spans next to the icon in the Tailwind/Base-UI layout (x-engagement-pill),
      // while keeping the legacy empty hover-circle div if present.
      const svgParent = svg.parentElement;
      if (svgParent && svgParent !== btn) {
        for (const child of Array.from(svgParent.children)) {
          if (child === svg) continue;
          if (child === svg.previousElementSibling && child.tagName === 'DIV' && !child.textContent.trim()) {
            child.setAttribute(CIRCLE_ATTR, '1');
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
      downloadTweetVideos(article, btn);
    });

    return cloneSlot;
  }

  function processArticle(article) {
    if (!article || !article.isConnected) return;
    const group = getActionBar(article);
    if (!group) return;

    const videoCount = countOwnVideos(article);
    const existingSlot = group.querySelector(`[${SLOT_ATTR}]`);

    if (!videoCount) {
      if (existingSlot) existingSlot.remove();
      return;
    }

    // Wait for Bookmark to render; the observer runs again when it does.
    const bookmark = bookmarkSlotOf(group);
    if (!bookmark || !bookmark.slot) return;

    const slot = existingSlot || buildButtonSlot(group, article, videoCount, bookmark);
    if (!slot) return;

    if (existingSlot) {
      const btn = existingSlot.querySelector(`button[data-testid="${BTN_TESTID}"]`);
      if (btn) {
        const label = videoCount > 1 ? 'Download videos' : 'Download video';
        if (btn.getAttribute('aria-label') !== label) {
          btn.setAttribute('aria-label', label);
          btn.setAttribute('title', label);
        }
      }
    }

    // Sit right after Bookmark, or after x-download-images-button on mixed-media posts.
    const imgSlot = group.querySelector('[data-x-img-dl-slot]');
    const anchor = imgSlot && imgSlot.parentElement === group ? imgSlot : bookmark.slot;
    if (anchor.nextElementSibling !== slot) {
      anchor.insertAdjacentElement('afterend', slot);
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
})();
