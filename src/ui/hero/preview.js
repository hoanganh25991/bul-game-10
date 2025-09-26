import { SKILLS } from "../../constants.js";
import { saveLoadout, loadOrDefault } from "../../loadout.js";
import { SKILL_POOL, DEFAULT_LOADOUT } from "../../skills_pool.js";
import { now } from "../../utils.js";
import { t } from "../../i18n.js";
const tt = typeof t === "function" ? t : (x) => x;

/**
 * Enhanced Skillbook preview flow:
 * - Native DOM overlay to select assignment key (Q/W/E/R) instead of prompt
 * - Shows option keys with current bindings for clarity
 * - After Hero Screen fades out, show countdown 2, 1 only (no extra overlay/backdrop)
 * - Then cast the selected key, show "⚡ Casted!" for 1.5s, and fade the Hero Screen back in
 *
 * Usage: call initHeroPreview(skills, { heroScreen }) after SkillsSystem is created.
 */
export function initHeroPreview(skills, opts = {}) {
  if (!skills || typeof skills.previewSkill !== "function") return;
  const heroScreen = opts.heroScreen || document.getElementById("heroScreen");

  const originalPreview = skills.previewSkill.bind(skills);

  skills.previewSkill = function enhancedPreview(def) {
    try {
      showKeySelectOverlay(def)
        .then((key) => {
          if (!key) {
            // cancelled or invalid -> fallback to old preview visuals (no cast)
            try { originalPreview(def); } catch (_) {}
            return;
          }
          // Fade out Hero Screen first
          return fadeOut(heroScreen, 300).then(async () => {
            // Countdown 2,1 and cast; confirmation handled inside
            await showCastingOverlayAndCast(skills, def, key);
          }).then(() => {
            // Fade back in after countdown + cast + display
            fadeIn(heroScreen, 300);
          });
        })
        .catch(() => {
          try { originalPreview(def); } catch (_) {}
        });
    } catch (_) {
      try { originalPreview(def); } catch (_) {}
    }
  };
}

/* ============================
   UI Overlays
============================ */

function showKeySelectOverlay(def) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(null); return; }

    // Prefer static DOM in index.html; create only if missing
    let root = document.getElementById("__previewKeySelect");
    let created = false;
    if (!root) {
      root = document.createElement("div");
      root.id = "__previewKeySelect";
      root.setAttribute("aria-hidden", "true");
      const box = document.createElement("div");
      box.className = "preview-box";
      box.innerHTML = `
        <div class="__preview-title"></div>
        <div class="__preview-grid"></div>
        <div class="__preview-tip"></div>
        <div class="__preview-actions"><button class="preview-cancel"></button></div>
      `;
      root.appendChild(box);
      document.body.appendChild(root);
      created = true;
    }

    const title = root.querySelector(".__preview-title");
    const grid = root.querySelector(".__preview-grid");
    const tip = root.querySelector(".__preview-tip");
    const cancel = root.querySelector(".preview-cancel");

    const nameLocal = def?.id ? (tt(`skills.names.${def.id}`) || def?.name || "Skill") : (def?.name || "Skill");
    title.textContent = `${tt("assign.assign")} "${nameLocal}" ${tt("assign.toKey")}`;

    // Populate keys
    grid.innerHTML = "";
    const keys = ["Q", "W", "E", "R"];
    keys.forEach((k) => {
      const nm = SKILLS[k]?.id ? (tt(`skills.names.${SKILLS[k].id}`) || SKILLS[k]?.name) : SKILLS[k]?.name;
      const infoText = nm ? `(${nm})` : `(${tt("hero.slot.empty") || "Empty"})`;
      const cell = document.createElement("div");
      cell.className = "__preview-cell";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preview-key-btn";
      btn.textContent = k;
      btn.title = (SKILLS[k]?.name || k);
      btn.addEventListener("click", () => {
        cleanup();
        resolve(k);
      });

      const info = document.createElement("div");
      info.className = "preview-key-info";
      info.textContent = infoText;

      cell.appendChild(btn);
      cell.appendChild(info);
      grid.appendChild(cell);
    });

    tip.textContent = tt("assign.tip");
    cancel.textContent = tt("btn.cancel");

    const onKey = (ev) => {
      const k = String(ev.key || "").toUpperCase();
      if (["Q", "W", "E", "R"].includes(k)) {
        ev.preventDefault?.();
        cleanup();
        resolve(k);
      } else if (k === "ESCAPE") {
        ev.preventDefault?.();
        cleanup();
        resolve(null);
      }
    };
    document.addEventListener("keydown", onKey, true);

    // Show overlay (use aria-hidden so static DOM persists)
    try { root.setAttribute("aria-hidden", "false"); } catch (_) {}

    cancel.onclick = () => {
      cleanup();
      resolve(null);
    };

    function cleanup() {
      document.removeEventListener("keydown", onKey, true);
      try { root.setAttribute("aria-hidden", "true"); } catch (_) {}
      if (created) {
        try { root.remove(); } catch (_) {}
      }
    }
  });
}

async function showCastingOverlayAndCast(skills, def, key) {
  if (typeof document === "undefined") return;
  // Prefer static DOM in index.html; create only if missing
  let root = document.getElementById("__previewCasting");
  let created = false;
  if (!root) {
    root = document.createElement("div");
    root.id = "__previewCasting";
    root.setAttribute("aria-hidden", "true");
    const card = document.createElement("div");
    card.className = "__preview-card";
    card.innerHTML = `<div class="__preview-number"></div>`;
    root.appendChild(card);
    document.body.appendChild(root);
    created = true;
  }

  const number = root.querySelector(".__preview-number");
  try {
    // Countdown over total wait = remaining cooldown + 2s; show ceiling seconds down to 1
    const rem = Math.max(0, (skills.cooldowns?.[key] || 0) - now());
    const total = rem + 2;
    const steps = Math.max(1, Math.ceil(total));
    const frac = total - Math.floor(total);
    number.classList.add("__preview-number--large");
    if (steps > 0) {
      const firstMs = Math.round((frac > 0 ? frac : 1) * 1000);
      await setNumber(number, String(steps), firstMs);
      for (let n = steps - 1; n >= 1; n--) {
        await setNumber(number, String(n), 1000);
      }
    }

    // Persist assignment, then cast
    if (def) {
      SKILLS[key] = Object.assign({}, def);
      // Persist selection to storage and refresh labels if available
      persistAssignment(key, def);
    }
    try {
      skills.castSkill(key);
    } catch (_) {}

    // Show brief confirmation (keep small); mapping remains assigned and persisted
    number.classList.remove("__preview-number--large");
    await setNumber(number, `⚡ ${tt("assign.casted")}`, 1500);
  } finally {
    try {
      // Hide or remove according to whether we created it
      if (created) {
        try { root.remove(); } catch (_) {}
      } else {
        try { root.setAttribute("aria-hidden", "true"); } catch (_) {}
      }
    } catch (_) {}
  }
}

function persistAssignment(key, def) {
  try {
    const idx = { Q: 0, W: 1, E: 2, R: 3 }[key] ?? 0;
    const ids = loadOrDefault(SKILL_POOL, DEFAULT_LOADOUT).slice();
    if (def && def.id) {
      ids[idx] = def.id;
      saveLoadout(ids);
    }
    // Update runtime labels if main.js exposed it
    try { window.updateSkillBarLabels && window.updateSkillBarLabels(); } catch (_) {}
    // Notify app to re-apply loadout and refresh screens
    try { window.dispatchEvent(new CustomEvent("loadout-changed")); } catch (_) {}
  } catch (_) {}
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setNumber(el, txt, ms) {
  return new Promise((resolve) => {
    try {
      el.style.opacity = "0";
      el.style.transform = "scale(0.9)";
      el.style.transition = "opacity 140ms ease, transform 140ms ease";
      setTimeout(() => {
        el.textContent = txt;
        el.style.opacity = "1";
        el.style.transform = "scale(1)";
        setTimeout(resolve, ms);
      }, 140);
    } catch (_) {
      el.textContent = txt;
      setTimeout(resolve, ms);
    }
  });
}

/* ============================
   Fade helpers
============================ */

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
      try {
        el.classList.remove("hidden");
        el.style.opacity = "1";
      } catch (_) {}
      resolve();
    }
  });
}
