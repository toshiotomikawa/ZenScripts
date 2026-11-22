// ==UserScript==
// @name         x-hide-creator-subscribe-button
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.0.0
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

  // Matched by the button's test id ("<user id>-subscribe"), not its label, so it works in every language.
  // Hides the button's own wrapper, so the row's 8px gap goes with it.
  GM_addStyle(`
    div:has(> button[data-testid$="-subscribe"]) {
      display: none !important;
    }
  `);
})();
