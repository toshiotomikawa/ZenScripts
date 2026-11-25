// ==UserScript==
// @name         x-hide-subscribe-button
// @namespace    https://github.com/toshiotomikawa/zenscripts
// @version      1.1.0
// @description  Hide the "Subscribe to Premium" card in the right sidebar on X/Twitter.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/zenscripts/tree/main/x-hide-subscribe-button
// @supportURL   https://github.com/toshiotomikawa/zenscripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/x-hide-subscribe-button/x-hide-subscribe-button.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/x-hide-subscribe-button/x-hide-subscribe-button.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Matched by the card's sign-up link, not its label, so it works in every language.
  // Covers both X's legacy React Native Web sidebar and the newer semantic <aside>/<section> UI.
  GM_addStyle(`
    [data-testid="sidebarColumn"] div:has(> aside a[href^="/i/premium_sign_up"]),
    aside section:has(a[href^="/i/premium_sign_up"]) {
      display: none !important;
    }
  `);
})();
