/* Guided Instruction Overlay (focus ring + hand + tooltip)
   Extracted from main.js into a reusable module.
*/
export function startInstructionGuide() {
  if (typeof document === "undefined") return;

  if (window.__guideState && window.__guideState.active) return;

  const steps = [
    {
      key: "camera",
      get el() {
        return document.getElementById("btnCamera");
      },
      title: "Camera Toggle",
      desc: "Tap to toggle first-person camera.",
    },
    {
      key: "settings",
      get el() {
        return document.getElementById("btnSettingsScreen");
      },
      title: "Settings",
      desc: "Open and adjust game options, environment, and audio.",
    },
    {
      key: "hero",
      get el() {
        return document.getElementById("btnHeroScreen");
      },
      title: "Hero Screen",
      desc: "View hero info and configure skills and loadout.",
    },
    {
      key: "skills",
      get el() {
        return document.getElementById("skillWheel") || document.getElementById("btnBasic");
      },
      title: "Skills",
      desc: "Tap Basic or Q/W/E/R to use skills. Cooldown shows in the ring.",
    },
  ].filter((s) => !!s.el);

  if (!steps.length) return;

  const overlay = document.createElement("div");
  overlay.className = "guide-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  try {
    overlay.id = "guideOverlayRoot";
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.zIndex = "2147483647";
    overlay.style.pointerEvents = "none";
  } catch (_) {}

  const blocker = document.createElement("div");
  blocker.className = "guide-blocker";
  overlay.appendChild(blocker);

  const focus = document.createElement("div");
  focus.className = "guide-focus";
  overlay.appendChild(focus);

  const hand = document.createElement("div");
  hand.className = "guide-hand";
  hand.textContent = "👉";
  overlay.appendChild(hand);

  const tip = document.createElement("div");
  tip.className = "guide-tooltip";
  const tipHeader = document.createElement("div");
  tipHeader.className = "guide-tooltip-header";
  const tipTitle = document.createElement("div");
  tipTitle.className = "guide-tooltip-title";
  const tipClose = document.createElement("button");
  tipClose.className = "guide-close";
  tipClose.setAttribute("aria-label", "Close guide");
  tipClose.textContent = "✕";
  tipHeader.appendChild(tipTitle);
  tipHeader.appendChild(tipClose);
  const tipBody = document.createElement("div");
  tipBody.className = "guide-tooltip-body";
  const tipNav = document.createElement("div");
  tipNav.className = "guide-nav";
  const btnPrev = document.createElement("button");
  btnPrev.className = "secondary";
  btnPrev.textContent = "Previous";
  const btnNext = document.createElement("button");
  btnNext.className = "primary";
  btnNext.textContent = "Next";
  tipNav.appendChild(btnPrev);
  tipNav.appendChild(btnNext);
  tip.appendChild(tipHeader);
  tip.appendChild(tipBody);
  tip.appendChild(tipNav);
  overlay.appendChild(tip);

  document.body.appendChild(overlay);

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function positionFor(el, pad = 10) {
    const r = el.getBoundingClientRect();
    const rect = {
      left: r.left - pad,
      top: r.top - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    };
    rect.right = rect.left + rect.width;
    rect.bottom = rect.top + rect.height;
    return rect;
  }

  function placeFocus(rect) {
    focus.style.left = rect.left + "px";
    focus.style.top = rect.top + "px";
    focus.style.width = rect.width + "px";
    focus.style.height = rect.height + "px";
  }

  function placeHand(rect) {
    const hx = rect.right - 8;
    const hy = rect.bottom + 6;
    hand.style.left = hx + "px";
    hand.style.top = hy + "px";
  }

  function placeTip(rect) {
    const margin = 8;
    let tx = rect.left;
    let ty = rect.bottom + margin;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    tip.style.maxWidth = "320px";
    tip.style.visibility = "hidden";
    tip.style.left = "0px";
    tip.style.top = "-9999px";
    tip.style.display = "block";
    const tb = tip.getBoundingClientRect();
    let tw = tb.width || 280;
    let th = tb.height || 120;

    if (ty + th > vh - 12) {
      ty = rect.top - th - margin;
    }
    tx = clamp(tx, 12, vw - tw - 12);
    ty = clamp(ty, 12, vh - th - 12);

    tip.style.left = tx + "px";
    tip.style.top = ty + "px";
    tip.style.visibility = "visible";
  }

  function setStep(idx) {
    window.__guideState.index = idx;
    const s = steps[idx];
    if (!s || !s.el) return;
    try {
      s.el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    } catch (_) {}
    const rect = positionFor(s.el, 10);
    placeFocus(rect);
    placeHand(rect);
    tipTitle.textContent = s.title || "";
    tipBody.textContent = s.desc || "";
    placeTip(rect);

    btnPrev.disabled = idx === 0;
    btnNext.textContent = idx === steps.length - 1 ? "Done" : "Next";
  }

  function onNext() {
    if (window.__guideState.index >= steps.length - 1) {
      close();
      return;
    }
    setStep(window.__guideState.index + 1);
  }
  function onPrev() {
    if (window.__guideState.index <= 0) return;
    setStep(window.__guideState.index - 1);
  }
  function onResize() {
    const s = steps[window.__guideState.index];
    if (!s || !s.el) return;
    const rect = positionFor(s.el, 10);
    placeFocus(rect);
    placeHand(rect);
    placeTip(rect);
  }

  function close() {
    if (!window.__guideState || !window.__guideState.active) return;
    window.__guideState.active = false;
    btnPrev.removeEventListener("click", onPrev);
    btnNext.removeEventListener("click", onNext);
    tipClose.removeEventListener("click", close);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    try {
      overlay.remove();
    } catch (_) {}
    window.__guideState = null;
  }

  btnPrev.addEventListener("click", onPrev);
  btnNext.addEventListener("click", onNext);
  tipClose.addEventListener("click", close);
  blocker.addEventListener("click", () => {});
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  window.__guideState = { active: true, index: 0, steps, overlay, focus, hand, tip };
  setStep(0);

  try {
    window.__guideClose = close;
  } catch (_) {}
}

// Optional global fallback binding so legacy callers still work
try {
  window.startInstructionGuide = startInstructionGuide;
} catch (_) {}

// Convenience: enable delegated click on Guide button if present
document.addEventListener("click", (ev) => {
  const t = ev.target;
  if (t && t.id === "btnInstructionGuide") {
    try {
      startInstructionGuide();
    } catch (_) {}
  }
});
