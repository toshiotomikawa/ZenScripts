// ==UserScript==
// @name         x-hide-whats-happening
// @namespace    https://github.com/toshiotomikawa/zenscripts
// @version      1.1.1
// @description  Hide only the "What's happening" trending card in the right sidebar on X/Twitter.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/zenscripts/tree/main/x-hide-whats-happening
// @supportURL   https://github.com/toshiotomikawa/zenscripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/x-hide-whats-happening/x-hide-whats-happening.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/x-hide-whats-happening/x-hide-whats-happening.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Matched by trend links and the card's "Show more" Explore/Trends link, not its label,
  // so it works in every language and even when X renders an empty card with no trend rows.
  GM_addStyle(`
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
})();
