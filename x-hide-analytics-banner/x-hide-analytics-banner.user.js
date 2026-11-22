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

  // Matched by the banner's "Learn more" Premium link and its preview image, not its text, so it works in every language.
  GM_addStyle(`
    main[role="main"] div:has(> div > a[href^="/i/premium"]):has(img) {
      display: none !important;
    }
  `);
})();
