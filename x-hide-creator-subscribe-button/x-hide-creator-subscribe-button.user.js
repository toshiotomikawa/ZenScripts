// ==UserScript==
// @name         x-hide-creator-subscribe-button
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.1.0
// @description  Hide creator "Subscribe" buttons on X/Twitter (posts, articles, user lists).
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts/tree/main/x-hide-creator-subscribe-button
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-creator-subscribe-button/x-hide-creator-subscribe-button.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-creator-subscribe-button/x-hide-creator-subscribe-button.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Matched by test id (legacy layout) and subscription URL path (Tailwind/Base-UI layout),
  // not by label, so it works in every language. Hides the wrapper so no gap is left.
  GM_addStyle(`
    div:has(> button[data-testid$="-subscribe"]),
    span:has(> a[href$="/creator-subscriptions/subscribe"]),
    a[href$="/creator-subscriptions/subscribe"] {
      display: none !important;
    }
  `);
})();
