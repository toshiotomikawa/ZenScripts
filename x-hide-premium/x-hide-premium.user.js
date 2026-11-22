// ==UserScript==
// @name         X: hide Subscribe to Premium
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.0.0
// @description  Hide the "Subscribe to Premium" card in the right sidebar on X/Twitter.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-premium/x-hide-premium.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-premium/x-hide-premium.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Matched by the card's sign-up link, not its label, so it works in every language.
  // Hides the card's outer wrapper too, so its bottom margin leaves no gap.
  GM_addStyle(`
    [data-testid="sidebarColumn"] div:has(> div > aside a[href^="/i/premium_sign_up"]) {
      display: none !important;
    }
  `);
})();
