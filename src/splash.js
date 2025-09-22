/**
 * Simple splash controller for Zeus RPG.
 *
 * Behavior:
 * - Shows the #flashOverlay full-screen overlay at startup.
 * - Animates a progress bar while the page/resources load.
 * - Waits at least 1 second before finishing so the user can see the splash.
 * - Considers the page "loaded" when window.load fires (network JS/modules loaded).
 * - Hides the overlay when complete.
 *
 * Usage: import and call initSplash() early in your main entry (before heavy init).
 */

export function initSplash() {
  const overlay = document.getElementById("flashOverlay");
  const progressBar = document.getElementById("flashProgressBar");
  if (!overlay || !progressBar) return;

  // Ensure overlay is visible and mark document so underlying .screen-content is hidden
  overlay.classList.remove("hidden");
  overlay.style.display = "flex";
  try { document.documentElement.classList.add("splash-active"); } catch (e) {}

  const minDisplayMs = 1000; // minimum visible time
  const startTs = Date.now();

  let progress = 0;
  function setProgress(p) {
    progress = Math.max(progress, Math.min(100, p));
    progressBar.style.width = progress + "%";
  }

  // Gentle auto-increment until we hit ~70% while waiting for load
  const autoTicker = setInterval(() => {
    if (progress < 70) {
      setProgress(progress + (Math.random() * 3 + 1)); // small random increments
    }
  }, 80);

  function finish() {
    // Stop auto increments
    clearInterval(autoTicker);

    // Ensure minimum display time
    const elapsed = Date.now() - startTs;
    const wait = Math.max(0, minDisplayMs - elapsed);

    setTimeout(() => {
      // Animate remaining progress to 100%
      let cur = progress;
      const interval = setInterval(() => {
        cur += 4;
        setProgress(cur);
        if (cur >= 100) {
          clearInterval(interval);

          // Hide loader UI (title, desc, progress, note) now that loading is complete
          try {
            const titleEl = overlay.querySelector(".flash-title");
            const descEl = overlay.querySelector(".flash-desc");
            const progressWrap = overlay.querySelector(".progress");
            const noteEl = overlay.querySelector(".flash-note");
            if (titleEl) titleEl.style.display = "none";
            if (descEl) descEl.style.display = "none";
            if (progressWrap) progressWrap.style.display = "none";
            if (noteEl) noteEl.style.display = "none";
          } catch (e) {}

          // Reveal the start screen (keeps overlay visible) and wait for player to click Start.
          const startScreen = document.getElementById("startScreen");
          const startBtn = document.getElementById("btnStartGame");

          if (startScreen) {
            startScreen.style.display = "block";
            // Ensure translated text is applied if i18n has loaded later
            try {
              // applyTranslations is exported by src/i18n.js; if available on window, call it
              if (typeof window !== "undefined" && window.applyTranslations) {
                window.applyTranslations(document);
              }
            } catch (e) {}
          }

          // Cleanup function to hide splash and restore UI
          function cleanupAndCloseSplash() {
            // short fade-out
            overlay.style.transition = "opacity 320ms ease";
            overlay.style.opacity = "0";
            setTimeout(() => {
              overlay.classList.add("hidden");
              overlay.style.display = "";
              overlay.style.opacity = "";
              overlay.style.transition = "";
              // Remove splash-active marker so underlying screens return to normal
              try { document.documentElement.classList.remove("splash-active"); } catch (e) {}
              // Reset progress for future uses (optional)
              progressBar.style.width = "0%";
              progress = 0;
            }, 340);
          }

          if (startBtn) {
            // Wait for explicit player action
            startBtn.addEventListener("click", () => {
              // Best-effort fullscreen request (desktop browsers)
              try {
                const el = document.documentElement;
                if (el.requestFullscreen) {
                  el.requestFullscreen().catch(() => {});
                } else if (el.webkitRequestFullscreen) {
                  el.webkitRequestFullscreen();
                } else if (el.mozRequestFullScreen) {
                  el.mozRequestFullScreen();
                } else if (el.msRequestFullscreen) {
                  el.msRequestFullscreen();
                }
              } catch (e) {}
              cleanupAndCloseSplash();
            }, { once: true });
          } else {
            // Fallback: auto-close after a short delay
            setTimeout(() => {
              cleanupAndCloseSplash();
            }, 800);
          }
        }
      }, 30);
    }, wait);
  }

  if (document.readyState === "complete") {
    // already loaded
    finish();
  } else {
    // Wait for the window load event (modules and assets)
    window.addEventListener("load", () => {
      finish();
    }, { once: true });
    // As a safety, also hide after 10s
    setTimeout(() => {
      if (progress < 100) finish();
    }, 10000);
  }
}
