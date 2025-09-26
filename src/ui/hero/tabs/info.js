import { getUpliftSummary } from "../../../uplift.js";
import { now } from "../../../utils.js";
/**
 * Render the Info tab: basic hero info (level, HP/MP).
 * Expects the panel element to be #heroTabInfo.
 */
export function renderInfoTab(panelEl, ctx = {}) {
  const { t, player } = ctx;
  if (!panelEl) return;

  // Prefer static DOM provided in index.html when available
  let list = panelEl.querySelector(".maps-list");
  if (list) {
    // Clear existing list content but keep the shell provided in the HTML
    try { list.innerHTML = ""; } catch (_) {}
  } else {
    // Create shell like before if not present (fallback)
    try { panelEl.innerHTML = ""; } catch (_) {}

    const wrap = document.createElement("div");
    wrap.className = "maps-panel";
    try {
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.flex = "1 1 auto";
      wrap.style.minHeight = "0";
    } catch (_) {}

    list = document.createElement("div");
    list.className = "maps-list";
    try {
      list.style.flex = "1 1 auto";
      list.style.minHeight = "0";
      list.style.overflow = "auto";
      list.style.maxHeight = "none";
    } catch (_) {}

    wrap.appendChild(list);
    panelEl.appendChild(wrap);
  }

  try {
    const tt = typeof t === "function" ? t : (x) => x;
    const level = Math.max(1, player?.level ?? 1);
    const hp = `${Math.floor(player?.hp ?? 0)}/${Math.floor(player?.maxHP ?? 0)}`;
    const mp = `${Math.floor(player?.mp ?? 0)}/${Math.floor(player?.maxMP ?? 0)}`;
    const baseDmg = Math.floor(player?.baseDamage ?? 0);
    const moveSpd = (player?.speed ?? 0).toFixed(1);
    const atkSpdMul = (player?.atkSpeedPerma ?? 1);
    const atkSpdPct = Math.round((atkSpdMul - 1) * 100);

    // Map info (name/depth/emoji) if available
    let mapName = "";
    let mapDepth = 0;
    let mapEmoji = "🗺️";
    try {
      const mods = ctx?.mapManager?.getModifiers?.() || {};
      mapName = mods.name || "";
      mapDepth = mods.depth || 0;
      const curIdx = ctx?.mapManager?.getCurrentIndex?.();
      mapEmoji = ctx?.mapManager?.emojiForIndex?.(curIdx) || "🗺️";
    } catch (_) {}

    // Uplifts summary
    let upliftLines = [];
    try { upliftLines = getUpliftSummary?.() || []; } catch (_) {}

    // Defense stat and status lists
    const defPct = Math.round((player?.defensePct ?? 0) * 100);
    const defActive = !!(player?.defenseUntil && now() < player.defenseUntil);
    const defRem = defActive ? Math.ceil(player.defenseUntil - now()) : 0;

    const buffs = [];
    const debuffs = [];

    if (defActive) {
      buffs.push(`Defense ${defPct}% (${defRem}s)`);
    }

    if (player?.speedBoostUntil && now() < player.speedBoostUntil && (player.speedBoostMul || 1) > 1) {
      const pmul = Math.round(((player.speedBoostMul || 1) - 1) * 100);
      const rem = Math.ceil(player.speedBoostUntil - now());
      buffs.push(`Move Speed +${pmul}% (${rem}s)`);
    }

    if (player?.atkSpeedUntil && now() < player.atkSpeedUntil && (player.atkSpeedMul || 1) !== 1) {
      const mul = player.atkSpeedMul || 1;
      const pct = Math.round((mul - 1) * 100);
      const rem = Math.ceil(player.atkSpeedUntil - now());
      buffs.push(`Attack Speed ${pct >= 0 ? "+" : ""}${pct}% (${rem}s)`);
    }

    if (player?.invulnUntil && now() < player.invulnUntil) {
      const rem = Math.ceil(player.invulnUntil - now());
      buffs.push(`Invulnerable (${rem}s)`);
    }

    if (player?.slowUntil && now() < player.slowUntil) {
      const slowF = player.slowFactor ?? 1;
      const red = Math.max(0, Math.round((1 - slowF) * 100));
      const rem = Math.ceil(player.slowUntil - now());
      debuffs.push(`Slowed ${red > 0 ? "-" + red : "?"}% (${rem}s)`);
    }

    if (player?.vulnUntil && now() < player.vulnUntil) {
      const vm = player.vulnMult || 1.25;
      const pct = Math.round((vm - 1) * 100);
      const rem = Math.ceil(player.vulnUntil - now());
      debuffs.push(`Vulnerable +${pct}% dmg taken (${rem}s)`);
    }

    function addRow(emoji, titleText, descText = "", reqText = "") {
      const row = document.createElement("div");
      row.className = "maps-row";

      const thumb = document.createElement("div");
      thumb.className = "maps-thumb";
      const em = document.createElement("div");
      em.className = "maps-thumb-ph";
      em.textContent = emoji;
      try { em.style.fontSize = "42px"; em.style.lineHeight = "1"; } catch (_) {}
      thumb.appendChild(em);

      const info = document.createElement("div");
      const title = document.createElement("div");
      title.className = "maps-title";
      title.textContent = titleText || "";
      const desc = document.createElement("div");
      desc.className = "maps-desc";
      desc.textContent = descText || "";
      const req = document.createElement("div");
      req.className = "maps-req";
      req.textContent = reqText || "";

      info.appendChild(title);
      if (desc.textContent) info.appendChild(desc);
      if (req.textContent) info.appendChild(req);

      const actions = document.createElement("div");
      actions.className = "maps-actions";

      row.appendChild(thumb);
      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    }

    // Rows
    addRow("👤", tt("hero.info.title") || "Hero", `${tt("hero.info.level")} ${level} • ${tt("hero.info.move")} ${moveSpd} • ${tt("hero.info.baseDmg")} ${baseDmg}`, `${tt("hero.info.hp")} ${hp} • ${tt("hero.info.mp")} ${mp}`);
    addRow("⚡", tt("hero.info.attack"), `${tt("hero.info.attackSpeed")} ${atkSpdMul.toFixed(2)}x (${atkSpdPct >= 0 ? "+" : ""}${atkSpdPct}%)`, "");
    addRow("🛡️", tt("hero.info.defense"), `${tt("hero.info.defense")} ${defPct}%${defActive ? ` (${defRem}s)` : ""}`, defActive ? tt("hero.info.active") : tt("hero.info.inactive"));
    if (mapName) {
      addRow(mapEmoji, tt("hero.info.map"), mapName, mapDepth ? `${tt("hero.info.depth")} +${mapDepth}` : "");
    }
    addRow("🟢", tt("hero.info.buffs"), (buffs.length ? buffs.join(", ") : "—"), "");
    addRow("🔻", tt("hero.info.debuffs"), (debuffs.length ? debuffs.join(", ") : "—"), "");
    addRow("📈", tt("hero.info.uplifts"), (upliftLines.length ? upliftLines.join(", ") : tt("uplift.none")), "");
  } catch (_) {
    const row = document.createElement("div");
    row.className = "maps-row";
    const thumb = document.createElement("div");
    thumb.className = "maps-thumb";
    const em = document.createElement("div");
    em.className = "maps-thumb-ph";
    em.textContent = "ℹ️";
    try { em.style.fontSize = "42px"; em.style.lineHeight = "1"; } catch (_) {}
    thumb.appendChild(em);
    const infoDiv = document.createElement("div");
    const title = document.createElement("div");
    title.className = "maps-title";
    title.textContent = "Info";
    const desc = document.createElement("div");
    desc.className = "maps-desc";
    desc.textContent = "—";
    infoDiv.appendChild(title);
    infoDiv.appendChild(desc);
    const actions = document.createElement("div");
    actions.className = "maps-actions";
    row.appendChild(thumb);
    row.appendChild(infoDiv);
    row.appendChild(actions);
    list.appendChild(row);
  }

  wrap.appendChild(list);
  panelEl.appendChild(wrap);
}
