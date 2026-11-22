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

  // Matched by the banner's illustration or its button's link, not its text, so it works in every language.
  // Under 500px X drops the illustration, so the "Learn more" link rule covers narrow windows.
  // Hides the card's wrapper, which carries the 16px bottom margin, so no gap is left.
  GM_addStyle(`
    div:has(> div > [role="button"]):has(> div > div img[src*="/premium_nux/analytics"]),
    div:has(> div > [role="button"]):has(> div > div > a[href^="/i/account_analytics"]) {
      display: none !important;
    }
  `);
})();
