// ==UserScript==
// @name         x-hide-get-verified-button
// @namespace    https://github.com/toshiotomikawa/zenscripts
// @version      1.0.0
// @description  Hide the "Get verified" pill next to the handle on X/Twitter profiles.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/zenscripts/tree/main/x-hide-get-verified-button
// @supportURL   https://github.com/toshiotomikawa/zenscripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/x-hide-get-verified-button/x-hide-get-verified-button.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/zenscripts/main/x-hide-get-verified-button/x-hide-get-verified-button.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Matched by position next to the profile handle and sign-up address, so it works in every language.
  // Covers both X's legacy UserName header and the newer semantic <main> profile header.
  GM_addStyle(`
    [data-testid="UserName"] a[href^="/i/verified-choose"],
    [data-testid="UserName"] a[href^="/i/premium_sign_up"],
    main span:has(> h1) + span a[href^="/i/verified-choose"],
    main span:has(> h1) + span a[href^="/i/premium_sign_up"],
    main span:has(> h1) + span button {
      display: none !important;
    }
  `);
})();
