/**
 * carousel.js — Accessibility enhancements for Bootstrap 5 carousels.
 *
 * Behaviours:
 *  1. Focus pause/resume — pauses the carousel when any child receives keyboard
 *     focus; resumes when focus leaves the carousel container entirely.
 *  2. Hover pause/resume — pauses on mouseenter, resumes on mouseleave unless
 *     the carousel has been manually paused via the play/pause button.
 *     NOTE: data-bs-pause="false" is set on the carousel element so Bootstrap
 *     does NOT attach its own mouseleave→cycle() handler (which would override
 *     a manual pause). We handle hover entirely here.
 *  3. Play/pause toggle button — clicking a .carousel-play-pause button toggles
 *     the carousel cycle and updates aria-label + icon accordingly.
 *  4. prefers-reduced-motion — disables auto-play on page load and reacts if the
 *     OS preference changes mid-session.
 */

(function () {
  'use strict';

  var PLAY_LABEL = 'Play carousel';
  var PAUSE_LABEL = 'Pause carousel';
  // Labels are written directly into the visible span text, which becomes the
  // button's accessible name. No aria-label needed — one source of truth.
  var ICON_PLAY_CLASS = 'fa-regular fa-circle-play';
  var ICON_PAUSE_CLASS = 'fa-regular fa-circle-pause';

  /**
   * Return the Bootstrap Carousel instance for an element.
   * Uses getOrCreateInstance so we're never blocked by Bootstrap's own
   * DOMContentLoaded auto-init race condition.
   */
  function getCarouselInstance(el) {
    if (!window.bootstrap || !window.bootstrap.Carousel) return null;
    return window.bootstrap.Carousel.getOrCreateInstance(el);
  }

  /**
   * Swap the button icon. Font Awesome JS replaces <i> elements with <svg>
   * after init, so querySelector('i') finds nothing at runtime. Instead we
   * find the generated <svg> (or a surviving <i>), replace it with a fresh
   * <i> carrying the new classes, then ask FA to re-process it.
   */
  function setIconClass(btn, classString) {
    var existing = btn.querySelector('svg') || btn.querySelector('i');
    if (!existing) {
      console.warn('[carousel] setIconClass: no icon element found in button', btn);
      return;
    }
    var i = document.createElement('i');
    i.className = classString;
    i.setAttribute('aria-hidden', 'true');
    existing.parentNode.replaceChild(i, existing);
    if (window.FontAwesome && window.FontAwesome.dom) {
      window.FontAwesome.dom.i2svg({ node: btn });
    }
  }

  /** Set a play/pause button to its "paused" visual state. */
  function setButtonPaused(btn) {
    setIconClass(btn, ICON_PLAY_CLASS);
    var label = btn.querySelector('.carousel-play-pause-label');
    if (label) label.textContent = PLAY_LABEL;
  }

  /** Set a play/pause button to its "playing" visual state. */
  function setButtonPlaying(btn) {
    setIconClass(btn, ICON_PAUSE_CLASS);
    var label = btn.querySelector('.carousel-play-pause-label');
    if (label) label.textContent = PAUSE_LABEL;
  }

  function initCarousels() {
    var carousels = document.querySelectorAll('.carousel');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Track manual pause state per carousel, indexed parallel to the NodeList.
    // Using an array (not a closure variable) lets the reducedMotion change
    // handler below update the same state without closures that can't share scope.
    var manuallyPaused = [];

    carousels.forEach(function (carouselEl, i) {
      manuallyPaused[i] = false;

      // ----------------------------------------------------------------
      // 1. Focus pause/resume
      // ----------------------------------------------------------------
      carouselEl.addEventListener('focusin', function () {
        var instance = getCarouselInstance(carouselEl);
        if (instance) instance.pause();
      });

      carouselEl.addEventListener('focusout', function (e) {
        // Only resume if focus has moved entirely outside the carousel
        // AND the user hasn't manually paused it.
        if (!carouselEl.contains(e.relatedTarget) && !manuallyPaused[i]) {
          var instance = getCarouselInstance(carouselEl);
          if (instance) instance.cycle();
        }
      });

      // ----------------------------------------------------------------
      // 2. Hover pause/resume
      // Bootstrap's own hover handling is disabled via data-bs-pause="false"
      // on the element so that Bootstrap's mouseleave handler never calls
      // cycle() and overrides a manual pause. We implement hover here.
      // ----------------------------------------------------------------
      carouselEl.addEventListener('mouseenter', function () {
        var instance = getCarouselInstance(carouselEl);
        if (instance) instance.pause();
      });

      carouselEl.addEventListener('mouseleave', function () {
        // Only resume on mouse-out if the user has NOT manually paused.
        if (!manuallyPaused[i]) {
          var instance = getCarouselInstance(carouselEl);
          if (instance) instance.cycle();
        }
      });

      // ----------------------------------------------------------------
      // 3. Play/pause toggle button
      // ----------------------------------------------------------------
      var carouselId = carouselEl.id;
      var toggleBtn = carouselId
        ? document.querySelector('[data-carousel-id="' + carouselId + '"].carousel-play-pause')
        : null;

      if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
          // Look up (or create) the instance at click time to avoid init race
          var instance = getCarouselInstance(carouselEl);
          if (!instance) return;

          manuallyPaused[i] = !manuallyPaused[i];
          if (manuallyPaused[i]) {
            instance.pause();
            setButtonPaused(toggleBtn);
          } else {
            instance.cycle();
            setButtonPlaying(toggleBtn);
          }
        });
      }

      // ----------------------------------------------------------------
      // 4. prefers-reduced-motion (initial state)
      // ----------------------------------------------------------------
      if (reducedMotion.matches) {
        manuallyPaused[i] = true;
        var instance = getCarouselInstance(carouselEl);
        if (instance) instance.pause();
        if (toggleBtn) setButtonPaused(toggleBtn);
      }
    });

    // React to OS preference change mid-session
    reducedMotion.addEventListener('change', function (e) {
      carousels.forEach(function (carouselEl, i) {
        manuallyPaused[i] = e.matches;
        var instance = getCarouselInstance(carouselEl);
        if (!instance) return;

        var carouselId = carouselEl.id;
        var toggleBtn = carouselId
          ? document.querySelector('[data-carousel-id="' + carouselId + '"].carousel-play-pause')
          : null;

        if (e.matches) {
          instance.pause();
          if (toggleBtn) setButtonPaused(toggleBtn);
        } else {
          instance.cycle();
          if (toggleBtn) setButtonPlaying(toggleBtn);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarousels);
  } else {
    initCarousels();
  }
})();
