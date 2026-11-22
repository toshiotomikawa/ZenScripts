// ==UserScript==
// @name         X: hide What's happening
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.0.0
// @description  Hide only the "What's happening" trending card in the right sidebar on X/Twitter.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts/tree/main/x-hide-whats-happening
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-whats-happening/x-hide-whats-happening.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-whats-happening/x-hide-whats-happening.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  GM_addStyle(`
    [data-testid="sidebarColumn"] div:has(> section[role="region"] > [aria-label="Timeline: Trending now"]),
    [data-testid="sidebarColumn"] div:has(> section[role="region"] [data-testid="trend"]) {
      display: none !important;
    }
  `);
})();
