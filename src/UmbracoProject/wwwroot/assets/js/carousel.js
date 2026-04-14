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
 *     the carousel cycle, swaps the aria-label, and switches between the two
 *     pre-rendered inline SVG icons (.image-carousel__icon--pause /
 *     .image-carousel__icon--play) by toggling the `hidden` attribute. The
 *     button has no visible text — the aria-label is the accessible name.
 *  4. prefers-reduced-motion — disables auto-play on page load and reacts if
 *     the OS preference changes mid-session.
 */

(function () {
  'use strict';

  var PLAY_LABEL = 'Play carousel';
  var PAUSE_LABEL = 'Pause carousel';

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
   * Show/hide the two pre-rendered icon SVGs inside a play/pause button.
   * The button markup contains both icons; we flip which one is hidden.
   */
  function setButtonIcon(btn, state) {
    var pauseIcon = btn.querySelector('.image-carousel__icon--pause');
    var playIcon  = btn.querySelector('.image-carousel__icon--play');
    if (!pauseIcon || !playIcon) return;
    if (state === 'paused') {
      pauseIcon.hidden = true;
      playIcon.hidden = false;
    } else {
      pauseIcon.hidden = false;
      playIcon.hidden = true;
    }
  }

  /** Set a play/pause button to its "paused" visual + accessible state. */
  function setButtonPaused(btn) {
    setButtonIcon(btn, 'paused');
    btn.setAttribute('aria-label', PLAY_LABEL);
  }

  /** Set a play/pause button to its "playing" visual + accessible state. */
  function setButtonPlaying(btn) {
    setButtonIcon(btn, 'playing');
    btn.setAttribute('aria-label', PAUSE_LABEL);
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

      // Scope hover/focus events to the outer .image-carousel wrapper so that
      // moving the mouse (or keyboard focus) from the slide image to an
      // adjacent control (prev arrow, indicators, next arrow, play/pause)
      // does not cross a boundary. Without this, mouseleave on the inner
      // Bootstrap element would fire cycle() as the user moves to the play/
      // pause button and override a manual pause.
      var hoverHost = carouselEl.closest('.image-carousel') || carouselEl;

      // ----------------------------------------------------------------
      // 1. Focus pause/resume
      // ----------------------------------------------------------------
      hoverHost.addEventListener('focusin', function () {
        var instance = getCarouselInstance(carouselEl);
        if (instance) instance.pause();
      });

      hoverHost.addEventListener('focusout', function (e) {
        // Only resume if focus has moved entirely outside the carousel
        // wrapper AND the user hasn't manually paused it.
        if (!hoverHost.contains(e.relatedTarget) && !manuallyPaused[i]) {
          var instance = getCarouselInstance(carouselEl);
          if (instance) instance.cycle();
        }
      });

      // ----------------------------------------------------------------
      // 2. Hover pause/resume
      // Bootstrap's own hover handling is disabled via data-bs-pause="false"
      // on the element so that Bootstrap's mouseleave handler never calls
      // cycle() and overrides a manual pause. We implement hover here,
      // scoped to the full wrapper.
      // ----------------------------------------------------------------
      hoverHost.addEventListener('mouseenter', function () {
        var instance = getCarouselInstance(carouselEl);
        if (instance) instance.pause();
      });

      hoverHost.addEventListener('mouseleave', function () {
        // Only resume on mouse-out if the user has NOT manually paused.
        if (!manuallyPaused[i]) {
          var instance = getCarouselInstance(carouselEl);
          if (instance) instance.cycle();
        }
      });

      // ----------------------------------------------------------------
      // 2b. Sync external indicator state on slide change
      // Indicators live outside the Bootstrap .carousel element (inside
      // the .image-carousel wrapper) so Bootstrap won't update their
      // .active class or aria-current attribute. We listen for Bootstrap's
      // slid.bs.carousel event and sync manually.
      // ----------------------------------------------------------------
      carouselEl.addEventListener('slid.bs.carousel', function (e) {
        var indicators = hoverHost.querySelectorAll('.image-carousel__indicator');
        indicators.forEach(function (btn, idx) {
          var isCurrent = idx === e.to;
          btn.classList.toggle('active', isCurrent);
          if (isCurrent) {
            btn.setAttribute('aria-current', 'true');
          } else {
            btn.removeAttribute('aria-current');
          }
        });
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
