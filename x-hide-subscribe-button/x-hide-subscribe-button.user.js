// ==UserScript==
// @name         x-hide-subscribe-button
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.0.0
// @description  Hide the "Subscribe to Premium" card in the right sidebar on X/Twitter.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts/tree/main/x-hide-subscribe-button
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-subscribe-button/x-hide-subscribe-button.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-subscribe-button/x-hide-subscribe-button.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Matched by the card's sign-up link, not its label, so it works in every language.
  // Hides the card's own wrapper, which carries its bottom margin, so no gap is left.
  GM_addStyle(`
    [data-testid="sidebarColumn"] div:has(> aside a[href^="/i/premium_sign_up"]) {
      display: none !important;
    }
  `);
})();
