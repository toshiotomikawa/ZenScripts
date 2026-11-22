// ==UserScript==
// @name         x-hide-analytics-banner
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.0.0
// @description  Hide the "Access your post analytics" Premium banner on X/Twitter.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts/tree/main/x-hide-analytics-banner
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-analytics-banner/x-hide-analytics-banner.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-analytics-banner/x-hide-analytics-banner.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Matched by the banner's own illustration (premium_nux/analytics), not its text, so it works in every language.
  // Hides the card itself: the one element holding both the dismiss button and that image's wrapper.
  GM_addStyle(`
    div:has(> [role="button"]):has(> div img[src*="/premium_nux/analytics"]) {
      display: none !important;
    }
  `);
})();
