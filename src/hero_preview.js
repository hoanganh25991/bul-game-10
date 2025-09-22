import { SKILLS } from "./constants.js";

/**
 * Initializes enhanced Skillbook preview flow:
 * - Prompt for key assignment (Q/W/E/R)
 * - Fade out Hero Screen
 * - Temporarily assign skill to the chosen key and cast it
 * - Wait 2 seconds
 * - Fade the Hero Screen back in
 *
 * Minimal integration: call initHeroPreview(skills) after SkillsSystem is created.
 * No CSS edits required; inline transitions are used for fades.
 */
export function initHeroPreview(skills, opts = {}) {
  if (!skills || typeof skills.previewSkill !== "function") return;
  const heroScreen = opts.heroScreen || document.getElementById("heroScreen");

  const originalPreview = skills.previewSkill.bind(skills);

  skills.previewSkill = function enhancedPreview(def) {
    try {
      // Ask for assignment key
      const ans = prompt("Assign to which key? (Q/W/E/R)", "Q");
      const key = String(ans || "").trim().toUpperCase();
      if (!["Q", "W", "E", "R"].includes(key)) {
        // Fallback: keep old preview if invalid/cancelled
        try { originalPreview(def); } catch (_) {}
        return;
      }

      // Fade out hero screen, cast, wait, fade in
      fadeOut(heroScreen, 300)
        .then(async () => {
          // Temporarily assign selected skill to the chosen key
          const prev = SKILLS[key];
          if (def) {
            // Shallow copy to avoid accidental shared references
            SKILLS[key] = Object.assign({}, def);
          }
          try {
            skills.castSkill(key);
          } catch (_) {}

          await waitMs(2000);

          // Restore original mapping
          SKILLS[key] = prev;
        })
        .finally(() => {
          // Fade back in regardless of success
          fadeIn(heroScreen, 300);
        });
    } catch (_) {
      // On any unexpected error, use the original preview
      try { originalPreview(def); } catch (_) {}
    }
  };
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fadeOut(el, dur = 300) {
  return new Promise((resolve) => {
    if (!el) return resolve();
    try {
      el.classList.remove("hidden");
      el.style.transition = `opacity ${dur}ms ease`;
      el.style.opacity = "1";
      requestAnimationFrame(() => {
        el.style.opacity = "0";
        setTimeout(() => {
          el.classList.add("hidden");
          resolve();
        }, dur + 20);
      });
    } catch (_) {
      // If any issue, just hide immediately
      try { el.classList.add("hidden"); } catch (_) {}
      resolve();
    }
  });
}

function fadeIn(el, dur = 300) {
  return new Promise((resolve) => {
    if (!el) return resolve();
    try {
      el.classList.remove("hidden");
      el.style.transition = `opacity ${dur}ms ease`;
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        setTimeout(() => {
          resolve();
        }, dur + 20);
      });
    } catch (_) {
      // If any issue, ensure visible
      try {
        el.classList.remove("hidden");
        el.style.opacity = "1";
      } catch (_) {}
      resolve();
    }
  });
}
