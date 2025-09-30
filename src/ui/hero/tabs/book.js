import { SCALING } from "../../../constants.js";
import { getSkillIcon } from "../../skillbar.js";

/**
 * Render the Skillbook tab: list of skills with detail panel and preview button.
 * Expects panelEl to be #heroTabBook (container is static in HTML).
 */
export function renderBookTab(panelEl, ctx = {}) {
  const { SKILL_POOL = [], player, t } = ctx;
  const tt = typeof t === "function" ? t : (x) => x;
  if (!panelEl) return;

  // Clear panel content
  try {
    panelEl.innerHTML = "";
  } catch (_) {}

  const wrap = document.createElement("div");
  wrap.className = "skillbook";

  const list = document.createElement("div");
  list.className = "skillbook-list";
  const ul = document.createElement("div");
  ul.className = "skillbook-ul";
  list.appendChild(ul);

  const detail = document.createElement("div");
  detail.className = "skillbook-detail";
  const title = document.createElement("h3");
  const expl = document.createElement("div");
  expl.className = "sb-expl";
  const stats = document.createElement("div");
  stats.className = "sb-stats";
  const imgBox = document.createElement("div");
  imgBox.className = "sb-imgBox";

  detail.appendChild(title);
  detail.appendChild(expl);
  detail.appendChild(stats);
  detail.appendChild(imgBox);

  const typeExplain = {
    chain: "Chains between nearby enemies, hitting multiple targets.",
    aoe: "Ground-targeted area. Damages enemies within its radius.",
    aura: "Toggle aura around hero. Ticks damage periodically while draining mana.",
    storm: "Multiple random strikes in a radius over time.",
    beam: "Instant zap to nearest enemy in range.",
    nova: "Radial burst around hero.",
    heal: "Restores hero HP instantly.",
    mana: "Restores hero MP instantly.",
    buff: "Temporarily increases damage and speed.",
    dash: "Quickly dash forward.",
    blink: "Teleport toward direction/point.",
    clone: "Summons a lightning image that periodically zaps nearby foes.",
    shield: "Reduces incoming damage for a short time; may grant brief invulnerability on cast.",
  };

  function computeDamage(s) {
    const base = s.dmg || 0;
    const lvl = Math.max(1, (player && player.level) || 1);
    const mult = Math.pow(SCALING.hero.skillDamageGrowth, Math.max(0, lvl - 1));
    return Math.floor(base * mult);
  }

  function renderDetail(s) {
    try {
      const nameLocal = tt(`skills.names.${s.id}`) || s.name;
      const shortLocal = tt(`skills.shorts.${s.id}`) || s.short || "";
      title.textContent = `${nameLocal}${shortLocal ? " (" + shortLocal + ")" : ""}`;
      const dmgLine = typeof s.dmg === "number" ? `Damage: ${computeDamage(s)} (base ${s.dmg})` : "";
      const lines = [
        "---",
        `Type: ${s.type}`,
        s.cd != null ? `Cooldown: ${s.cd}s` : "",
        s.mana != null ? `Mana: ${s.mana}` : "",
        "---",
        s.radius != null ? `Radius: ${s.radius}` : "",
        s.range != null ? `Range: ${s.range}` : "",
        s.jumps != null ? `Jumps: ${s.jumps}` : "",
        s.jumpRange != null ? `Jump Range: ${s.jumpRange}` : "",
        s.tick != null ? `Tick: ${s.tick}s` : "",
        s.duration != null ? `Duration: ${s.duration}s` : "",
        s.slowFactor != null ? `Slow: ${Math.round(s.slowFactor * 100)}%` : "",
        s.slowDuration != null ? `Slow Duration: ${s.slowDuration}s` : "",
        dmgLine,
      ].filter(Boolean);
      stats.innerHTML = lines.map((x) => `<div>${x}</div>`).join("");
      expl.textContent = typeExplain[s.type] || "No description.";
    } catch (_) {}
  }

  // Build list (items-style rows)
  SKILL_POOL.forEach((s) => {
    const row = document.createElement("div");
    row.className = "items-row";
    row.dataset.skillId = s.id;

    const thumb = document.createElement("div");
    thumb.className = "items-thumb";
    const em = document.createElement("div");
    em.className = "items-thumb-ph";
    em.textContent = getSkillIcon(s.short || s.name);
    try {
      em.style.fontSize = "42px";
      em.style.lineHeight = "1";
    } catch (_) {}
    thumb.appendChild(em);

    const info = document.createElement("div");
    const titleRow = document.createElement("div");
    titleRow.className = "items-title";
    const nameLocal2 = tt(`skills.names.${s.id}`) || s.name;
    titleRow.textContent = `${nameLocal2}`;
    const desc = document.createElement("div");
    desc.className = "items-desc";
    desc.textContent = s.type || "";
    const req = document.createElement("div");
    req.className = "items-req";
    const parts = [];
    if (s.cd != null) parts.push(`CD ${s.cd}s`);
    if (s.mana != null) parts.push(`MP ${s.mana}`);
    if (parts.length) req.textContent = parts.join(" • ");

    info.appendChild(titleRow);
    if (desc.textContent) info.appendChild(desc);
    if (req.textContent) info.appendChild(req);

    const actions = document.createElement("div");
    actions.className = "items-actions";
    const preview = document.createElement("button");
    preview.className = "pill-btn pill-btn--yellow";
    preview.textContent = "▶️";
    preview.title = "Preview";
    preview.addEventListener("click", (e) => {
      e.stopPropagation();
      try { window.__skillsRef && window.__skillsRef.previewSkill(s); } catch (_) {}
    });
    actions.appendChild(preview);

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(actions);

    row.addEventListener("click", () => {
      renderDetail(s);
      try {
        ul.querySelectorAll(".items-row").forEach((it) => it.classList.remove("selected"));
        row.classList.add("selected");
      } catch (_) {}
    });

    ul.appendChild(row);
  });

  try {
    if (SKILL_POOL.length) {
      renderDetail(SKILL_POOL[0]);
      try { ul.querySelector(".items-row")?.classList.add("selected"); } catch (_) {}
    }
  } catch (_) {}

  wrap.appendChild(list);
  wrap.appendChild(detail);
  panelEl.appendChild(wrap);
}
