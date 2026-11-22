// ==UserScript==
// @name         x-clean-left-sidebar
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.0.0
// @description  Hide Calls, Creator Studio and Premium from the left sidebar on X/Twitter.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts/tree/main/x-clean-left-sidebar
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-clean-left-sidebar/x-clean-left-sidebar.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/x-clean-left-sidebar/x-clean-left-sidebar.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Matched by each link's address, not its label, so it works in every language.
  // The links are direct children of the nav with no margins, so hiding them leaves no gap.
  GM_addStyle(`
    header nav[role="navigation"] > a[href="/i/calls"],
    header nav[role="navigation"] > a[href^="/i/jf/creators/studio"],
    header nav[role="navigation"] > a[href="/i/premium_sign_up"] {
      display: none !important;
    }
  `);
})();
