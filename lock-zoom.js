/*!
 * lock-zoom.js
 * Prevent pinch-zoom and double-tap zoom on mobile (esp. iOS/Safari)
 * Also reduces double-tap zoom triggers on common interactive UI elements.
 */
(function () {
  'use strict';

  // Reduce double-tap zoom triggers on interactive UI
  try {
    var style = document.createElement('style');
    style.id = 'lock-zoom-style';
    style.textContent =
      "html, body, canvas, #ui-root, #skillWheel, button, .icon-btn, .skill-btn, #bottomLeftGroup button { -webkit-tap-highlight-color: rgba(0,0,0,0); touch-action: manipulation; -ms-touch-action: manipulation; }";
    document.head.appendChild(style);
  } catch (e2) {}

  // // Global guards: prevent pinch-zoom and double-tap zoom (iOS/Safari)
  // try {
  //   document.addEventListener(
  //     'gesturestart',
  //     function (e) {
  //       e.preventDefault();
  //     },
  //     { passive: false }
  //   );
  //   document.addEventListener(
  //     'gesturechange',
  //     function (e) {
  //       e.preventDefault();
  //     },
  //     { passive: false }
  //   );
  //   document.addEventListener(
  //     'gestureend',
  //     function (e) {
  //       e.preventDefault();
  //     },
  //     { passive: false }
  //   );
  //   document.addEventListener(
  //     'touchstart',
  //     function (e) {
  //       if (e.touches && e.touches.length > 1) e.preventDefault(); // block pinch
  //     },
  //     { passive: false }
  //   );
  //   var __lastTouchEnd = 0;
  //   document.addEventListener(
  //     'touchend',
  //     function (e) {
  //       var now = Date.now();
  //       if (now - __lastTouchEnd <= 300) {
  //         e.preventDefault(); // block double-tap zoom
  //       }
  //       __lastTouchEnd = now;
  //     },
  //     { passive: false }
  //   );
  //   document.addEventListener(
  //     'dblclick',
  //     function (e) {
  //       e.preventDefault();
  //     },
  //     { passive: false }
  //   );
  // } catch (e3) {}
})();
