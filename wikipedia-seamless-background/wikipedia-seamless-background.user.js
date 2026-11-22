// ==UserScript==
// @name         wikipedia-seamless-background
// @namespace    https://github.com/toshiotomikawa/ZenScripts
// @version      1.0.0
// @description  Gives Wikipedia and other Wikimedia projects one background colour, removing the grey margins around articles, in light and night modes.
// @author       toshiotomikawa
// @homepageURL  https://github.com/toshiotomikawa/ZenScripts/tree/main/wikipedia-seamless-background
// @supportURL   https://github.com/toshiotomikawa/ZenScripts/issues
// @updateURL    https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/wikipedia-seamless-background/wikipedia-seamless-background.user.js
// @downloadURL  https://raw.githubusercontent.com/toshiotomikawa/ZenScripts/main/wikipedia-seamless-background/wikipedia-seamless-background.user.js
// @license      MIT
// @match        *://*.wikipedia.org/*
// @match        *://*.wikimedia.org/*
// @match        *://*.wiktionary.org/*
// @match        *://*.wikibooks.org/*
// @match        *://*.wikidata.org/*
// @match        *://*.wikiquote.org/*
// @match        *://*.wikisource.org/*
// @match        *://*.wikiversity.org/*
// @match        *://*.wikivoyage.org/*
// @match        *://*.mediawiki.org/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STYLE_ID = 'wikipedia-seamless-background';

  // One canvas colour for the page, header, panels and buttons; table headers keep a slight tint.
  const canvas = (bg, th) => `
    &,
    & body {
      --background-color-neutral-subtle: ${bg} !important;
      --background-color-interactive-subtle: ${bg} !important;
      --background-color-base: ${bg} !important;
      --background-color-base-fixed: ${bg} !important;
    }

    &,
    & body,
    .mw-page-container,
    .mw-page-container-inner,
    .vector-body,
    .vector-header-container,
    .vector-header-container .mw-header,
    .vector-header-container .vector-sticky-header,
    .vector-sticky-header-container,
    .vector-main-menu-container,
    .mw-content-container,
    #content,
    #mw-page-base,
    #mw-head-base {
      background-color: ${bg} !important;
      background-image: none !important;
    }

    .infobox,
    .infobox-header,
    .infobox-subheader,
    .infobox-above,
    .infobox-below,
    .infobox-full-data,
    .infobox-data,
    .infobox-label,
    .infobox-image,
    .infobox td,
    .infobox th,
    .infobox caption,
    figure[typeof~='mw:File/Thumb'],
    figure[typeof~='mw:File/Frame'],
    figure[typeof~='mw:File/Thumb'] > figcaption,
    figure[typeof~='mw:File/Frame'] > figcaption,
    .thumbinner,
    .thumbcaption,
    div.thumb,
    .wikitable,
    .catlinks,
    .mw-footer,
    #footer,
    #footer-icons a,
    .vector-pinnable-header-toggle-button:hover,
    .vector-pinnable-header,
    .cdx-button:enabled,
    .cdx-button.cdx-button--fake-button--enabled,
    .cdx-text-input__input:enabled:read-only {
      background-color: ${bg} !important;
    }

    .wikitable > tr > th,
    .wikitable > * > tr > th {
      background-color: ${th} !important;
    }
  `;

  // Wikipedia's own article colours: white by day, #101418 at night.
  const light = canvas('#ffffff', '#f7f7f7');
  const night = canvas('#101418', '#27292d');

  // Night mode, or Automatic mode on a dark system, gets the night canvas.
  const css = `
    html.skin-theme-clientpref-night { ${night} }
    @media (prefers-color-scheme: dark) {
      html.skin-theme-clientpref-os { ${night} }
      html:not(.skin-theme-clientpref-night):not(.skin-theme-clientpref-os) { ${light} }
    }
    @media not (prefers-color-scheme: dark) {
      html:not(.skin-theme-clientpref-night) { ${light} }
    }
  `;

  function apply() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // Inject at document-start so the grey never flashes.
  apply();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  }
})();
