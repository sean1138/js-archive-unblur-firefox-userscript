# archive.org unblur images in shadow dom
Firefox Greasemonkey userscript for removing the preview blur in titles marked inappropriate on archive.org

# Features
* periodically enforces your changes (so if site code overwrites them, they get reapplied)
* also uses a `MutationObserver` to react fast to new content
* safely walks nested **open** shadow roots by selector chains you already built
* avoids replacing other classes (uses `classList.add`) and uses `style.setProperty(..., 'important')` where helpful
* has a keyboard toggle (Ctrl+Alt+Shift+S) and console logging for debugging
* is easy to tweak: adjust selector chains, styles, interval

# Credits
ChatGPT adapted the content.js code from [RefomerAgent's Archive-Unblur Chrome extension](https://github.com/ReformerAgent/Archive-Unblur) to work with the mess of javascript i was working on to do the same thing.  My js was failing to persist the unblurring (from infinite scrolling pages) before showing chatjibidy the content.js code from ReformerAgent.

# install
1, Copy code from greasemonkey-userscript.js into a greasemonkey script.
2, enjoy.

## ChatGPT Notes & Tips
* **This is basically the Chrome code adapted**: it no longer uses `chrome.runtime` or `chrome.storage`, it uses `MutationObserver` + periodic enforcement instead of `setInterval` only. That combination is usually robust for sites with virtualization.
* **Why periodic enforcement?** Some sites mutate the same element repeatedly (or re-apply classes/styles after our code runs). Re-applying the changes every \~1s (adjust `CHECK_INTERVAL_MS`) reduces flicker and keeps your tweaks present.
* **Performance:** `deepQueryAll` will walk nested shadow roots each run. The script tries to be conservative (debounce on DOM changes + small interval). If you see slowdowns, increase `CHECK_INTERVAL_MS` to 2000–3000 ms or narrow the `@match` to the exact host/path.
* **Avoid replacing className directly.** The script uses `classList.add('contain')` so you don't clobber other classes the site uses. If the site later removes that class, the interval re-applies it (might cause visual flicker).
* **Removing overlays:** we remove them if possible; if the site re-inserts them later the checker will remove again. If removal causes layout issues, consider `style.setProperty('display','none','important')` instead.
* **Closed shadow roots:** this WILL NOT work for closed shadow roots. You said they are open, so okay.
* **Restrict scope:** change the `@match` header to only the target site, e.g. `@match https://example.com/*` to avoid running everywhere.
* **If flicker persists:** try increasing `CHECK_INTERVAL_MS` and/or using `style.setProperty(..., 'important')` to increase priority. If the site’s script runs *after* our interval and has higher specificity, you may still see flicker — you can try running at a slightly slower cadence or inject CSS into shadow roots (if possible) with `!important`. If injection into every shadow root failed earlier, double-check the selectors and that you're injecting into the correct shadowRoot scope.

