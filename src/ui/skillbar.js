import { SKILLS } from "../constants.js";
import { t } from "../i18n.js";

/**
 * Returns an emoji icon for a skill label. Heuristic, no assets required.
 * Accepts skill short name or label; matches many archetypes.
 */
export function getSkillIcon(short) {
  if (!short) return "—";
  const s = String(short).toLowerCase();

  // Keyword helpers
  const has = (kw) => s.includes(kw);
  const any = (...kws) => kws.some((k) => has(k));

  // Healing / sustain
  if (any("heal", "mend", "restore")) return "💖";
  if (any("mana", "well", "sip")) return "💧";

  // Buffs / speed / attack speed / overload
  if (any("haste", "speed")) return "🏃‍♂️";
  if (any("buff", "over", "overload", "capacitor")) return "🔆";

  // Defense / shield / aegis / guard / barrier / aegis
  if (any("shield", "aegis", "guard", "barrier", "fort", "aeg")) return "🛡️";

  // Mobility
  if (any("dash")) return "💨";
  if (any("blink", "step", "tele")) return "✨";

  // Summons / companion / clone / image / totem / satellite
  if (any("clone", "image")) return "👥";
  if (any("totem", "rod", "tot")) return "🗿";
  if (any("sat", "satell")) return "🛰️";

  // Mark / vulnerability / rod / ionize
  if (any("mark", "rod", "ion")) return "🎯";

  // Chain / fork / tether
  if (any("chain", "fork", "tether")) return "🔗";

  // Beams / bolts / spears / sky spear
  if (any("bolt", "beam", "spear", "spear", "spear", "sky")) return "⚡";

  // AOEs / circles / rings / nova / pulse / burst / shockwave
  if (any("nova", "ring", "circle", "pulse", "burst", "aoe", "shock")) return "💥";

  // Storms / tempest / wrath / dome / mael / thunder
  if (any("storm", "tempest", "wrath", "dome", "mael", "thunder")) return "⛈️";

  // Prison / root / lock / static prison / conduct(ive) ground / rumble field
  if (any("prison", "root", "lock", "conduct", "ground", "rumble", "field")) return "⛓️";

  // Ball lightning
  if (any("ball", "orb", "sphere")) return "🧿";

  // Exotic/ultimates
  if (any("judg")) return "⚖️";
  if (any("atomic", "catacly", "supercell")) return "☢️";
  if (any("hammer")) return "🔨";
  if (any("mirror")) return "🪞";
  if (any("roar")) return "🗣️";
  if (any("rider", "cloud")) return "☁️";

  // Static / electric / battery
  if (any("static")) return "🔌";
  if (any("magnet", "magneto")) return "🧲";

  // Fallbacks
  const k = s.slice(0, 3);
  const map = {
    chn: "🔗",
    bol: "⚡",
    stc: "🔌",
    str: "⛈️",
    bam: "🔋",
    nov: "✴️",
    aoe: "💥",
    atk: "⚡",
  };
  return map[k] || "⚡";
}

/**
 * Update the skillbar labels to reflect the active SKILLS mapping.
 * Reads DOM elements by ids: #btnSkillQ, #btnSkillW, #btnSkillE, #btnSkillR, #btnBasic
 */
export function updateSkillBarLabels() {
  try {
    const tt = typeof t === "function" ? t : (x) => x;
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
      if (nameEl) {
        const nameKey = def && def.id ? `skills.names.${def.id}` : "";
        const shortKey = def && def.id ? `skills.shorts.${def.id}` : "";
        const tName = nameKey ? tt(nameKey) : "";
        const tShort = shortKey ? tt(shortKey) : "";
        const isNameTranslated = tName && tName !== nameKey;
        const isShortTranslated = tShort && tShort !== shortKey;
        const display = isShortTranslated ? tShort : (def.short || (isNameTranslated ? tName : def.name));
        nameEl.textContent = display || nameEl.textContent;
      }
      const keyEl = el.querySelector(".key");
      if (keyEl) keyEl.textContent = k;
      // accessibility: set button title to skill name if available (prefer localized)
      if (def && def.id) {
        const nmKey = `skills.names.${def.id}`;
        const nmTr = tt(nmKey);
        const isNmTr = nmTr && nmTr !== nmKey;
        if (isNmTr) el.title = nmTr;
        else if (def.name) el.title = def.name;
      } else {
        if (def.name) el.title = def.name;
      }
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
