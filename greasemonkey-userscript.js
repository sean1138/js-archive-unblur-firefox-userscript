// ==UserScript==
// @name         target Shadow DOM .blur Image
// @namespace    https://vsxd.com/userscripts
// @version      1.0
// @description  Apply custom CSS to an <img class="blur"> nested inside shadow roots, chatgpt adapted from https://github.com/ReformerAgent/Archive-Unblur/blob/main/content.js
// @match        *://*.archive.org/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /***************************************************************************
   * CONFIG
   ***************************************************************************/
  // Chains of selectors — each array element is a selector at the next depth.
  // The final selector in imageSelectors should match the <img> node itself (so we get the image elements).
  // general browsing collections
  const imageSelectors = [
    "app-root",
    "collection-page",
    "collection-browser",
    "infinite-scroller",
    "tile-dispatcher",
    "item-tile",
    "image-block",
    "item-image",
    "img"                // final target: the <img> element (we will add class, style)
  ];
  const overlaySelectors = [
    "app-root",
    "collection-page",
    "collection-browser",
    "infinite-scroller",
    "tile-dispatcher",
    "item-tile",
    "image-block",
    "text-overlay"       // final target: overlay element (we will remove or hide)
  ];

  // user uplaods
  const imageSelectorsU = [
    "app-root",
    "user-profile",
    "collection-browser",
    "infinite-scroller",
    "tile-dispatcher",
    "item-tile",
    "image-block",
    "item-image",
    "img"                // final target: the <img> element (we will add class, style)
  ];
  const overlaySelectorsU = [
    "app-root",
    "user-profile",
    "collection-browser",
    "infinite-scroller",
    "tile-dispatcher",
    "item-tile",
    "image-block",
    "text-overlay"       // final target: overlay element (we will remove or hide)
  ];

  // search pages
  const imageSelectorsSP = [
    "app-root",
    "search-page",
    "collection-browser",
    "infinite-scroller",
    "tile-dispatcher",
    "item-tile",
    "image-block",
    "item-image",
    "img"                // final target: the <img> element (we will add class, style)
  ];
  const overlaySelectorsSP = [
    "app-root",
    "search-page",
    "collection-browser",
    "infinite-scroller",
    "tile-dispatcher",
    "item-tile",
    "image-block",
    "text-overlay"       // final target: overlay element (we will remove or hide)
  ];

  // How often (ms) to force-check everything as a fallback. Lower = more aggressive.
  let CHECK_INTERVAL_MS = 1000;

  // Style/action functions
  function styleImage(img) {
    try {
      // only proceed if the img already has the 'blur' class
      if (img.classList.contains('blur')) {
        // add your desired class (safer than replacing className)
        img.classList.add('blurbegone'); // archive.org uses 'blur' class to censor
        // also apply inline fallbacks in case class is overwritten
        img.style.setProperty('filter', 'none', 'important');
        img.style.setProperty('background', '#F003', 'important');
        // mark as styled for debugging
        img.dataset._gm_styled = '1';
      }
    } catch (e) {
      // ignore
    }
  }

  function styleOverlay(el) {
    try {
      // remove if you want it gone:
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      } else {
        // fallback: hide with important flag
        el.style.setProperty('display', 'none', 'important');
      }
    } catch (e) {
      // ignore
    }
  }

  /***************************************************************************
   * Helper: recursively walk nested shadow roots and return final matched nodes
   * Returns array of elements matched at the final selector level.
   ***************************************************************************/
  function deepQueryAll(root, selectors) {
    if (!selectors || selectors.length === 0) return [];

    // Start with an array containing the root
    let nodes = [root];

    for (const sel of selectors) {
      const next = [];
      for (const node of nodes) {
        // choose where to search: node.shadowRoot (if present) OR the node itself
        const scope = node && node.shadowRoot ? node.shadowRoot : node;
        if (!scope) continue;
        // guard querySelectorAll in try/catch (some scopes may not support it)
        try {
          const found = scope.querySelectorAll(sel);
          for (const f of found) next.push(f);
        } catch (err) {
          // invalid selector or other issue — skip
        }
      }
      nodes = next;
      if (nodes.length === 0) break; // nothing found; short-circuit
    }

    return nodes;
  }

  /***************************************************************************
   * Main enforcement function - runs periodically and via mutation observation
   ***************************************************************************/
  let enabled = true;
  function checkAndModifyElements() {
    if (!enabled) return;

    try {
      // Grab all image <img> elements via the deep selector chain
      const imgs = deepQueryAll(document, imageSelectors);
      for (const img of imgs) {
        // if you need to filter (only jpg/png) you can check src or dataset here
        styleImage(img);
      }
      // user profile
      const imgsU = deepQueryAll(document, imageSelectorsU);
      for (const img of imgsU) {
        // if you need to filter (only jpg/png) you can check src or dataset here
        styleImage(img);
      }
      // search page
      const imgsSP = deepQueryAll(document, imageSelectorsSP);
      for (const img of imgsSP) {
        // if you need to filter (only jpg/png) you can check src or dataset here
        styleImage(img);
      }

      // Grab overlays and remove/hide them
      const overlays = deepQueryAll(document, overlaySelectors);
      for (const ov of overlays) {
        styleOverlay(ov);
      }
      // user profile
      const overlaysU = deepQueryAll(document, overlaySelectorsU);
      for (const ov of overlaysU) {
        styleOverlay(ov);
      }
      // search page
      const overlaysSP = deepQueryAll(document, overlaySelectorsSP);
      for (const ov of overlaysSP) {
        styleOverlay(ov);
      }
    } catch (err) {
      console.error('shadow-styler: checkAndModifyElements error', err);
    }
  }

  /***************************************************************************
   * Fast-path: when mutations add nodes, schedule an immediate re-check.
   * Debounce so bursts of mutations don't thrash the function.
   ***************************************************************************/
  let scheduled = false;
  function scheduleQuickRun() {
    if (scheduled) return;
    scheduled = true;
    // small debounce window
    setTimeout(() => {
      scheduled = false;
      checkAndModifyElements();
    }, 150);
  }

  const observer = new MutationObserver((mutations) => {
    // Quick heuristic: only schedule when nodes were added (this catches infinite scroll)
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        scheduleQuickRun();
        return;
      }
      // optionally trigger on attribute changes on interesting nodes
    }
  });

  // Start observing document for added nodes (subtree)
  try {
    observer.observe(document, { childList: true, subtree: true });
  } catch (e) {
    console.warn('shadow-styler: observer failed to start', e);
  }

  // Periodic fallback enforcement in case mutation observer misses something or site overrides after our change
  const intervalId = setInterval(() => {
    if (enabled) checkAndModifyElements();
  }, CHECK_INTERVAL_MS);

  /***************************************************************************
   * Toggle via keyboard: Ctrl+Alt+Shift+S to enable/disable
   ***************************************************************************/
  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey && ev.altKey && ev.shiftKey && ev.code === 'KeyS') {
      enabled = !enabled;
      console.info('shadow-styler: enabled =', enabled);
      if (enabled) {
        checkAndModifyElements();
      }
    }
  });

  /***************************************************************************
   * Initial run (delayed a bit to let site initialize)
   ***************************************************************************/
  setTimeout(() => {
    checkAndModifyElements();
  }, 500);

  // Clean up on unload (not strictly necessary, but polite)
  window.addEventListener('unload', () => {
    observer.disconnect();
    clearInterval(intervalId);
  });

  console.info('shadow-styler: loaded (press Crtl+Alt+Shift+S to toggle)');

})();
