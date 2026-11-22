// ==UserScript==
// @name         YouTube: no translate button
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      2.2
// @description  Removes the translate button from YouTube comments, leaving no gap.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts/tree/main/youtube-no-translate-button
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/youtube-no-translate-button/youtube-no-translate-button.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/youtube-no-translate-button/youtube-no-translate-button.user.js
// @license      MIT
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Remove any translate button from the DOM
    function removeTranslateButtons() {
        document.querySelectorAll('ytd-tri-state-button-view-model.translate-button')
            .forEach(el => el.remove());
    }

    // Initial cleanup
    removeTranslateButtons();

    // Watch for new comments (infinite scroll, navigation)
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Remove buttons inside the added node
                    if (node.querySelectorAll) {
                        node.querySelectorAll('ytd-tri-state-button-view-model.translate-button')
                            .forEach(el => el.remove());
                    }
                    // In case the added node itself is the button
                    if (node.matches && node.matches('ytd-tri-state-button-view-model.translate-button')) {
                        node.remove();
                    }
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();