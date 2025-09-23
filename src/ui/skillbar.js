import { SKILLS } from "../constants.js";

/**
 * Returns a small emoji/SVG-like placeholder for a skill short name.
 * Kept minimal to avoid asset dependencies.
 */
export function getSkillIcon(short) {
  if (!short) return "—";
  const k = String(short).slice(0, 3).toLowerCase();
  const map = {
    chn: "⚡", // chain
    bol: "⚡", // bolt/chain-ish
    stc: "🔌", // static
    str: "⛈️", // storm
    bam: "🔋",
    nov: "✴️",
    aoe: "💥",
    "n/a": "⚡",
    atk: "⚡", // basic attack icon
  };
  return map[k] || "⚡";
}

/**
 * Update the skillbar labels to reflect the active SKILLS mapping.
 * Reads DOM elements by ids: #btnSkillQ, #btnSkillW, #btnSkillE, #btnSkillR, #btnBasic
 */
export function updateSkillBarLabels() {
  try {
    const map = { Q: "#btnSkillQ", W: "#btnSkillW", E: "#btnSkillE", R: "#btnSkillR" };
    for (const k of Object.keys(map)) {
      const el = document.querySelector(map[k]);
      if (!el) continue;
      const def = SKILLS[k] || {};
      // icon (emoji/SVG placeholder)
      const iconEl = el.querySelector(".icon");
      if (iconEl) iconEl.textContent = getSkillIcon(def.short || def.name);
      // name / short label
      const nameEl = el.querySelector(".name");
      if (nameEl) nameEl.textContent = def.short || def.name || nameEl.textContent;
      const keyEl = el.querySelector(".key");
      if (keyEl) keyEl.textContent = k;
      // accessibility: set button title to skill name if available
      if (def.name) el.title = def.name;
    }

    // Update central basic button icon (larger visual)
    try {
      const basicBtn = document.getElementById("btnBasic");
      if (basicBtn) {
        const icon = basicBtn.querySelector(".icon");
        if (icon) icon.textContent = getSkillIcon("atk");
        basicBtn.title = basicBtn.title || "Basic Attack";
      }
    } catch (_) {
      // ignore
    }
  } catch (err) {
    console.warn("updateSkillBarLabels error", err);
  }
}
