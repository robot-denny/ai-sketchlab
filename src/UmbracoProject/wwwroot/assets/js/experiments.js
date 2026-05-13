/*
 * Experiments page — algorithmic-art sketch lazy loader.
 *
 * For every <figure class="exp-sketch">: when its inner .exp-sketch__slot
 * scrolls into the viewport, mount an <iframe src="{data-sketch-url}">
 * inside the slot. When it scrolls out of view, remove the iframe so the
 * sketch's RAF loop / WebGL context is released. Under
 * `prefers-reduced-motion: reduce`, never mount the iframe — the poster
 * image is the entire experience.
 *
 * Iframe load failure (404 / network) is the same end state as reduced
 * motion: the iframe is removed and the poster stays visible.
 */
// Deferrals (MEDIUM perf, MINOR code-review): HEAD preflight adds one RTT — kept for 404 safety. IntersectionObserver disconnect on pagehide skipped (full-page nav releases context).
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  var prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    // The poster is already in the DOM — nothing more to do.
    return;
  }

  if (typeof window.IntersectionObserver !== 'function') {
    // No IO support — leave the poster in place rather than blasting iframes
    // into every sketch on page load.
    return;
  }

  function removeIframe(slot) {
    var iframe = slot.querySelector('iframe');
    if (iframe) {
      iframe.remove();
    }
    slot.classList.remove('is-running');
    var poster = slot.querySelector('.exp-sketch__poster');
    if (poster) poster.removeAttribute('aria-hidden');
  }

  function mountIframe(slot) {
    if (slot.querySelector('iframe')) return; // already running
    if (slot.dataset.sketchPending === '1') return; // preflight in flight
    var url = slot.getAttribute('data-sketch-url');
    if (!url) return;

    slot.dataset.sketchPending = '1';

    // Browsers don't fire the iframe `error` event for HTTP errors like 404 —
    // they happily render the response body. Preflight the URL with a HEAD
    // request so a missing sketch never gets mounted in the first place.
    fetch(url, { method: 'HEAD', credentials: 'same-origin' })
      .then(function (resp) {
        delete slot.dataset.sketchPending;
        if (!resp.ok) return;
        if (slot.querySelector('iframe')) return; // raced
        if (!slot.isConnected) return; // detached while we waited

        var iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'Algorithmic art sketch');
        iframe.setAttribute('loading', 'lazy');
        iframe.setAttribute('aria-hidden', 'true');

        iframe.addEventListener('error', function () {
          removeIframe(slot);
        });

        iframe.addEventListener('load', function () {
          slot.classList.add('is-running');
          var poster = slot.querySelector('.exp-sketch__poster');
          if (poster) poster.setAttribute('aria-hidden', 'true');
        });

        slot.insertBefore(iframe, slot.firstChild);
        iframe.src = url;
      })
      .catch(function () {
        delete slot.dataset.sketchPending;
      });
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var slot = entry.target;
        if (entry.isIntersecting) {
          mountIframe(slot);
        } else {
          removeIframe(slot);
        }
      });
    },
    { rootMargin: '100px 0px', threshold: 0.01 },
  );

  function init() {
    var slots = document.querySelectorAll('figure.exp-sketch .exp-sketch__slot[data-sketch-url]');
    slots.forEach(function (slot) {
      observer.observe(slot);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
