// ==UserScript==
// @name         x-hide-grok-button
// @namespace    https://github.com/toshiotomikawa/zenscripts
// @version      1.0.0
// @description  Hide Grok from the left sidebar on X/Twitter.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/zenscripts/tree/main/x-hide-grok-button
// @supportURL   https://github.com/toshiotomikawa/zenscripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/x-hide-grok-button/x-hide-grok-button.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/x-hide-grok-button/x-hide-grok-button.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Matched by the link's address, not its label, so it works in every language.
  // Covers both X's legacy header nav and the newer primary <nav> sidebar.
  GM_addStyle(`
    nav > a[href="/i/grok"] {
      display: none !important;
    }
  `);
})();
