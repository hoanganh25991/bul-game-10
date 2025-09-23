import { SCALING } from "../../../constants.js";
import { getSkillIcon } from "../../skillbar.js";

/**
 * Render the Skillbook tab: list of skills with detail panel and preview button.
 * Expects panelEl to be #heroTabBook (container is static in HTML).
 */
export function renderBookTab(panelEl, ctx = {}) {
  const { SKILL_POOL = [], player } = ctx;
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
  const icon = document.createElement("div");
  icon.className = "sb-icon";
  const expl = document.createElement("div");
  expl.className = "sb-expl";
  const stats = document.createElement("div");
  stats.className = "sb-stats";
  const imgBox = document.createElement("div");
  imgBox.className = "sb-imgBox";
  const previewBtn = document.createElement("button");
  previewBtn.className = "pill-btn pill-btn--yellow sb-preview";
  previewBtn.textContent = "▶️";

  detail.appendChild(title);
  detail.appendChild(expl);
  detail.appendChild(icon);
  detail.appendChild(stats);
  detail.appendChild(imgBox);
  detail.appendChild(previewBtn);

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
  };

  function computeDamage(s) {
    const base = s.dmg || 0;
    const lvl = Math.max(1, (player && player.level) || 1);
    const mult = Math.pow(SCALING.hero.skillDamageGrowth, Math.max(0, lvl - 1));
    return Math.floor(base * mult);
  }

  function renderDetail(s) {
    try {
      title.textContent = `${s.name} (${s.short || ""})`;
      icon.textContent = getSkillIcon(s.short || s.name);
      const dmgLine = typeof s.dmg === "number" ? `Damage: ${computeDamage(s)} (base ${s.dmg})` : "";
      const lines = [
        `Type: ${s.type}`,
        s.cd != null ? `Cooldown: ${s.cd}s` : "",
        s.mana != null ? `Mana: ${s.mana}` : "",
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
      previewBtn.onclick = () => {
        try {
          window.__skillsRef && window.__skillsRef.previewSkill(s);
        } catch (_) {}
      };
    } catch (_) {}
  }

  // Build list
  SKILL_POOL.forEach((s) => {
    const btn = document.createElement("div");
    btn.className = "skillbook-item";
    const ic = document.createElement("span");
    ic.textContent = getSkillIcon(s.short || s.name);
    const nm = document.createElement("span");
    nm.textContent = s.name;
    btn.appendChild(ic);
    btn.appendChild(nm);
    btn.addEventListener("click", () => renderDetail(s));
    ul.appendChild(btn);
  });

  try {
    if (SKILL_POOL.length) renderDetail(SKILL_POOL[0]);
  } catch (_) {}

  wrap.appendChild(list);
  wrap.appendChild(detail);
  panelEl.appendChild(wrap);
}
