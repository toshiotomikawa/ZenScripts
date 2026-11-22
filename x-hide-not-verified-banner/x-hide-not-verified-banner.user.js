// ==UserScript==
// @name         x-hide-not-verified-banner
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.0.0
// @description  Hide the "You aren't verified yet" banner on X/Twitter profiles.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts/tree/main/x-hide-not-verified-banner
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-not-verified-banner/x-hide-not-verified-banner.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-hide-not-verified-banner/x-hide-not-verified-banner.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Matched by the banner's "Get verified" sign-up link, not its text, so it works in every language.
  // Hides the card itself (the link is a grandchild); its empty wrappers have no margin or padding.
  GM_addStyle(`
    [data-testid="primaryColumn"] div:has(> div > a[href^="/i/premium_sign_up"]) {
      display: none !important;
    }
  `);
})();
