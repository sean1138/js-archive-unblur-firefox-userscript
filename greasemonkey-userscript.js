// ==UserScript==
// @name         archive.org uncensored
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
  const baseImageSelectors = [
    "app-root",
    "__PAGE_TYPE__", // placeholder string
    "collection-browser",
    "infinite-scroller",
    "tile-dispatcher",
    "item-tile",
    "image-block",
    "item-image",
    "img" // final target: the <img> element (we will add class, style)
  ];

  const pageVariants = {
    standard: "collection-page",
    user: "user-profile",
    search: "search-page"
  };

  function buildSelectors(pageType) {
    return baseImageSelectors.map(sel =>
      sel === "__PAGE_TYPE__" ? pageVariants[pageType] : sel
    );
  }

  const baseOverlaySelectors = [
    "app-root",
    "__PAGE_TYPE__", // placeholder string
    "collection-browser",
    "infinite-scroller",
    "tile-dispatcher",
    "item-tile",
    "image-block",
    "text-overlay" // final target: overlay element (we will remove or hide)
  ];

  function buildSelectorsOv(pageType) {
    return baseOverlaySelectors.map(sel =>
      sel === "__PAGE_TYPE__" ? pageVariants[pageType] : sel
    );
  }

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
        img.dataset.gm_styled = '1';
      }
    } catch (e) {
      // ignore
    }
  }

  function styleOverlay(el) {
    try {

      if (el.parentNode) {
      // remove if you want it gone:
      //   el.parentNode.removeChild(el);
      // } else {
        // fallback: hide with important flag
        el.style.setProperty('display', 'none', 'important');
        // mark as styled for debugging
        el.dataset.gm_styled = '1';
      }
    } catch (e) {
      // ignore
    }
  }

  // Unstyle/disable functions
  function unstyleAll() {
    try {
      for (const type of ["standard", "user", "search"]) {
        // --- undo for images ---
        const imgs = deepQueryAll(
          document,
          buildSelectors(type).slice(0, -1).concat('[data-gm_styled="1"]')
        );
        for (const img of imgs) {
          img.style.setProperty('filter', '', 'important');
          img.style.setProperty('background', '', 'important');
          img.classList.remove('blurbegone');
          delete img.dataset.gm_styled;
        }

        // --- undo for overlays ---
        const overlays = deepQueryAll(
          document,
          buildSelectorsOv(type).slice(0, -1).concat('[data-gm_styled="1"]')
        );
        for (const ov of overlays) {
          ov.style.setProperty('display', '', 'important');
          ov.style.setProperty('visibility', '', 'important');
          delete ov.dataset.gm_overlay;
        }
      }
    } catch (err) {
      console.error('shadow-styler: unstyleAll error', err);
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
      for (const type of ["standard", "user", "search"]) {
        const imgs = deepQueryAll(document, buildSelectors(type));
        for (const img of imgs) styleImage(img);
        // Grab overlays and remove/hide them
        const overlays = deepQueryAll(document, buildSelectorsOv(type));
        for (const ov of overlays) styleOverlay(ov);
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
      } else {
        unstyleAll();
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
