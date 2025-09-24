/**
 * Uplift System
 * - Presents simple choices to enhance the BASIC ATTACK at milestone levels (every 5 levels by default)
 * - Persists choices in localStorage
 * - Exposes getters so combat systems (skills.js) can apply effects
 * - Exposes a minimal DOM popup prompt
 */

const LS_KEY = "upliftChoices_v1";

// Milestones: every N levels starting at 'start'
const MILESTONE = { start: 5, step: 5 };

export function loadUpliftState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { choices: [] };
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.choices)) return { choices: [] };
    return data;
  } catch {
    return { choices: [] };
  }
}

export function saveUpliftState(st) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (_) {}
}

export function getUpliftState() {
  return loadUpliftState();
}

// Return the highest milestone level reached by the player
export function getReachedMilestones(level) {
  if (!Number.isFinite(level) || level < MILESTONE.start) return [];
  const ms = [];
  for (let l = MILESTONE.start; l <= level; l += MILESTONE.step) ms.push(l);
  return ms;
}

// Return the next milestone not yet chosen
export function getPendingMilestone(level) {
  const st = getUpliftState();
  const taken = new Set(st.choices.map((c) => c.level));
  const reached = getReachedMilestones(level);
  for (const l of reached) {
    if (!taken.has(l)) return l;
  }
  return null;
}

/**
 * Compute basic-attack uplift effects aggregated from choices:
 * - aoe: adds small explosion around the hit target; each pick increases radius
 * - chain: bounces to another nearby enemy; each pick increases jumps by +1
 * - impact: improves on-hit VFX and adds slight damage multiplier; each pick +5%
 */
export function getBasicUplift() {
  const st = getUpliftState();
  let aoePicks = 0, chainPicks = 0, impactPicks = 0;
  for (const c of st.choices) {
    if (c.kind === "basic-aoe") aoePicks += 1;
    else if (c.kind === "basic-chain") chainPicks += 1;
    else if (c.kind === "basic-impact") impactPicks += 1;
  }
  const aoeRadius = aoePicks > 0 ? 2 + (aoePicks - 1) * 1.5 : 0; // 2, 3.5, 5.0, ...
  const chainJumps = chainPicks; // 0,1,2,3...
  const dmgMul = 1 + impactPicks * 0.05; // +5% per pick
  const fx = impactPicks > 0 ? { impactColor: 0xffee88 } : null;
  return { aoeRadius, chainJumps, dmgMul, fx };
}

// Human-readable summary for UI
export function getUpliftSummary() {
  const st = getUpliftState();
  if (!st.choices.length) return ["No uplifts chosen yet"];
  const out = [];
  for (const c of st.choices) {
    if (c.kind === "basic-aoe") out.push(`Lv ${c.level}: Basic Uplift — AOE`);
    else if (c.kind === "basic-chain") out.push(`Lv ${c.level}: Basic Uplift — Chain`);
    else if (c.kind === "basic-impact") out.push(`Lv ${c.level}: Basic Uplift — Impact FX`);
  }
  return out;
}

// Minimal popup for choosing one uplift option at milestone levels
export function promptBasicUpliftIfNeeded(player) {
  if (typeof document === "undefined") return;
  if (!player) return;
  const pending = getPendingMilestone(player.level);
  if (!pending) return;

  // Prevent multiple
  if (document.getElementById("upliftPopup")) return;

  const root = document.createElement("div");
  root.id = "upliftPopup";
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.top = "0";
  root.style.right = "0";
  root.style.bottom = "0";
  root.style.background = "rgba(0,0,0,0.6)";
  root.style.zIndex = "9999";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";

  const card = document.createElement("div");
  card.style.minWidth = "280px";
  card.style.maxWidth = "90vw";
  card.style.background = "rgba(12,28,52,0.95)";
  card.style.border = "1px solid rgba(124,196,255,0.35)";
  card.style.boxShadow = "0 12px 28px rgba(0,0,0,0.6)";
  card.style.borderRadius = "10px";
  card.style.padding = "16px";
  card.style.color = "#fff";
  card.style.textAlign = "center";

  const title = document.createElement("div");
  title.textContent = `Uplift Unlocked — Level ${pending}`;
  title.style.fontSize = "18px";
  title.style.marginBottom = "8px";
  title.style.color = "#ffd86a";

  const desc = document.createElement("div");
  desc.textContent = "Choose an enhancement for your Basic Attack:";
  desc.style.opacity = "0.9";
  desc.style.marginBottom = "12px";

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "8px";
  btnRow.style.justifyContent = "center";
  btnRow.style.flexWrap = "wrap";

  function mkBtn(label, kind) {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.padding = "10px 12px";
    b.style.borderRadius = "8px";
    b.style.border = "1px solid rgba(124,196,255,0.35)";
    b.style.background = "linear-gradient(180deg, #1b3c6b, #0f294a)";
    b.style.color = "#fff";
    b.style.cursor = "pointer";
    b.addEventListener("click", () => {
      const st = getUpliftState();
      st.choices.push({ level: pending, kind });
      saveUpliftState(st);
      try { document.body.removeChild(root); } catch (_) {}
      // Optional small toast
      try {
        const msg = document.createElement("div");
        msg.textContent = "Uplift applied!";
        msg.style.position = "fixed";
        msg.style.left = "50%";
        msg.style.top = "12%";
        msg.style.transform = "translateX(-50%)";
        msg.style.background = "rgba(20,40,70,0.95)";
        msg.style.border = "1px solid rgba(124,196,255,0.35)";
        msg.style.borderRadius = "8px";
        msg.style.padding = "8px 12px";
        msg.style.color = "#fff";
        msg.style.zIndex = "9999";
        document.body.appendChild(msg);
        setTimeout(() => { try { document.body.removeChild(msg); } catch(_) {} }, 1100);
      } catch (_) {}
    });
    return b;
  }

  btnRow.appendChild(mkBtn("AOE", "basic-aoe"));
  btnRow.appendChild(mkBtn("Chain", "basic-chain"));
  btnRow.appendChild(mkBtn("Impact FX", "basic-impact"));

  const closeRow = document.createElement("div");
  closeRow.style.marginTop = "10px";
  const skip = document.createElement("button");
  skip.textContent = "Decide later";
  skip.style.padding = "6px 10px";
  skip.style.borderRadius = "6px";
  skip.style.border = "1px solid rgba(124,196,255,0.25)";
  skip.style.background = "rgba(12,28,52,0.85)";
  skip.style.color = "#ddd";
  skip.addEventListener("click", () => {
    try { document.body.removeChild(root); } catch (_) {}
  });
  closeRow.appendChild(skip);

  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(btnRow);
  card.appendChild(closeRow);
  root.appendChild(card);
  document.body.appendChild(root);
}
