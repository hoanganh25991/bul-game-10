import { SKILLS } from "./constants.js";

/**
 * Enhanced Skillbook preview flow:
 * - Native DOM overlay to select assignment key (Q/W/E/R) instead of prompt
 * - Shows option keys with current bindings for clarity
 * - After Hero Screen fades out, show "Casting" text with countdown 2, 1
 * - Then cast the selected key, show "Casted ⚡", and fade the Hero Screen back in
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
            // Show "Casting" with 2,1 countdown, then cast and show "Casted ⚡"
            await showCastingOverlayAndCast(skills, def, key);
          }).finally(() => {
            // Fade back in (always)
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
    const root = document.createElement("div");
    root.id = "__previewKeySelect";
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.35)",
      zIndex: "9999",
      backdropFilter: "blur(2px)",
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      minWidth: "300px",
      maxWidth: "90vw",
      background: "rgba(10,20,30,0.9)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "10px",
      padding: "14px",
      color: "#dfefff",
      boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
      textAlign: "center",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif",
    });

    const title = document.createElement("div");
    title.textContent = `Assign "${def?.name || "Skill"}" to key:`;
    Object.assign(title.style, { fontWeight: "600", marginBottom: "10px", fontSize: "16px" });

    const grid = document.createElement("div");
    Object.assign(grid.style, {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "10px",
      marginTop: "6px",
      marginBottom: "10px",
    });

    const keys = ["Q", "W", "E", "R"];
    const btns = [];
    keys.forEach((k) => {
      const btn = document.createElement("button");
      btn.setAttribute("type", "button");
      btn.textContent = k;
      btn.title = (SKILLS[k]?.name || k);
      Object.assign(btn.style, {
        padding: "12px 6px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(40,60,90,0.85)",
        color: "#eaf6ff",
        fontSize: "18px",
        fontWeight: "700",
        cursor: "pointer",
      });
      btn.addEventListener("mouseenter", () => (btn.style.background = "rgba(60,90,140,0.9)"));
      btn.addEventListener("mouseleave", () => (btn.style.background = "rgba(40,60,90,0.85)"));
      btn.addEventListener("click", () => {
        cleanup();
        resolve(k);
      });

      // Key info below the button
      const wrap = document.createElement("div");
      Object.assign(wrap.style, { display: "flex", flexDirection: "column", gap: "6px" });

      wrap.appendChild(btn);
      const info = document.createElement("div");
      info.textContent = SKILLS[k]?.name ? `(${SKILLS[k].name})` : "(empty)";
      Object.assign(info.style, { fontSize: "11px", opacity: "0.8" });
      wrap.appendChild(info);

      const cell = document.createElement("div");
      cell.appendChild(wrap);
      grid.appendChild(cell);
      btns.push(btn);
    });

    const tip = document.createElement("div");
    tip.textContent = "Tip: press Q, W, E or R to choose quickly";
    Object.assign(tip.style, { fontSize: "12px", opacity: "0.8", marginTop: "6px" });

    const actions = document.createElement("div");
    Object.assign(actions.style, { marginTop: "10px", display: "flex", gap: "8px", justifyContent: "center" });

    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    Object.assign(cancel.style, {
      padding: "8px 12px",
      borderRadius: "6px",
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(120,40,40,0.85)",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "600",
    });
    cancel.addEventListener("mouseenter", () => (cancel.style.background = "rgba(160,60,60,0.9)"));
    cancel.addEventListener("mouseleave", () => (cancel.style.background = "rgba(120,40,40,0.85)"));
    cancel.addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    actions.appendChild(cancel);

    box.appendChild(title);
    box.appendChild(grid);
    box.appendChild(tip);
    box.appendChild(actions);
    root.appendChild(box);

    // Keyboard access
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

    document.body.appendChild(root);

    function cleanup() {
      document.removeEventListener("keydown", onKey, true);
      try {
        root.remove();
      } catch (_) {
        if (root && root.parentNode) root.parentNode.removeChild(root);
      }
    }
  });
}

async function showCastingOverlayAndCast(skills, def, key) {
  // Root overlay
  const root = document.createElement("div");
  root.id = "__previewCasting";
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.35)",
    zIndex: "9999",
    pointerEvents: "none",
    backdropFilter: "blur(2px)",
  });

  // Card
  const card = document.createElement("div");
  Object.assign(card.style, {
    minWidth: "240px",
    background: "rgba(10,20,30,0.9)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "12px",
    padding: "18px",
    color: "#e8f6ff",
    textAlign: "center",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
  });

  const title = document.createElement("div");
  title.textContent = "Casting";
  Object.assign(title.style, { fontSize: "20px", fontWeight: "700", marginBottom: "8px", letterSpacing: "0.3px" });

  const subtitle = document.createElement("div");
  subtitle.textContent = def?.name ? `Skill: ${def.name} → ${key}` : `Key: ${key}`;
  Object.assign(subtitle.style, { fontSize: "12px", opacity: "0.8", marginBottom: "8px" });

  const number = document.createElement("div");
  Object.assign(number.style, {
    fontSize: "42px",
    fontWeight: "800",
    color: "#bfe9ff",
    textShadow: "0 0 12px rgba(100,180,255,0.6)",
    minHeight: "1.2em",
  });

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(number);
  root.appendChild(card);
  document.body.appendChild(root);

  try {
    // Countdown 2, 1 (like portal)
    await setNumber(number, "2", 800);
    await setNumber(number, "1", 800);

    // Perform temporary assignment, cast, then restore
    const prev = SKILLS[key];
    if (def) {
      SKILLS[key] = Object.assign({}, def);
    }
    try {
      skills.castSkill(key);
    } catch (_) {}

    // Show casted confirmation
    await setNumber(number, "⚡ Casted!", 550);

    // Restore mapping
    SKILLS[key] = prev;
  } finally {
    // Cleanup overlay
    try {
      root.remove();
    } catch (_) {
      if (root && root.parentNode) root.parentNode.removeChild(root);
    }
  }
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
