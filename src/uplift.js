/**
 * Uplift System
 * - Presents simple choices to enhance the BASIC ATTACK at milestone levels (every 5 levels by default)
 * - Persists choices in localStorage
 * - Exposes getters so combat systems (skills.js) can apply effects
 * - Exposes a minimal DOM popup prompt
 */

import { t } from "./i18n.js";

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
  if (!st.choices.length) return [t("uplift.none")];
  const out = [];
  for (const c of st.choices) {
    if (c.kind === "basic-aoe") out.push(`${t("uplift.lv")} ${c.level}: ${t("uplift.basic")} — ${t("uplift.btn.aoe")}`);
    else if (c.kind === "basic-chain") out.push(`${t("uplift.lv")} ${c.level}: ${t("uplift.basic")} — ${t("uplift.btn.chain")}`);
    else if (c.kind === "basic-impact") out.push(`${t("uplift.lv")} ${c.level}: ${t("uplift.basic")} — ${t("uplift.btn.impact")}`);
  }
  return out;
}

/* Minimal popup for choosing one uplift option at milestone levels.
   Refactored to use static DOM in index.html and css/uplift.css when available.
   Falls back to creating the DOM if the static markup is not present.
*/
export function promptBasicUpliftIfNeeded(player) {
  if (typeof document === "undefined") return;
  if (!player) return;
  const pending = getPendingMilestone(player.level);
  if (!pending) return;

  // Prefer existing markup in index.html
  let root = document.getElementById("upliftPopup");

  // If the popup is present and already visible, don't show duplicate
  if (root && root.getAttribute && root.getAttribute("aria-hidden") === "false") return;

  // Fallback: create the basic DOM structure if not present
  const createFallback = () => {
    const r = document.createElement("div");
    r.id = "upliftPopup";
    r.setAttribute("aria-hidden", "true");
    r.setAttribute("role", "dialog");
    r.setAttribute("aria-modal", "true");

    const card = document.createElement("div");
    card.className = "uplift-card";

    const title = document.createElement("div");
    title.className = "uplift-title";

    const desc = document.createElement("div");
    desc.className = "uplift-desc";

    const row = document.createElement("div");
    row.className = "uplift-btn-row";
    row.setAttribute("role", "list");

    const btnAoE = document.createElement("button");
    btnAoE.className = "uplift-btn";
    btnAoE.dataset.kind = "basic-aoe";
    btnAoE.setAttribute("role", "listitem");

    const btnChain = document.createElement("button");
    btnChain.className = "uplift-btn";
    btnChain.dataset.kind = "basic-chain";
    btnChain.setAttribute("role", "listitem");

    const btnImpact = document.createElement("button");
    btnImpact.className = "uplift-btn";
    btnImpact.dataset.kind = "basic-impact";
    btnImpact.setAttribute("role", "listitem");

    row.appendChild(btnAoE);
    row.appendChild(btnChain);
    row.appendChild(btnImpact);

    const footer = document.createElement("div");
    footer.className = "uplift-footer";

    const skip = document.createElement("button");
    skip.className = "uplift-skip";
    skip.dataset.action = "skip";

    footer.appendChild(skip);

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(row);
    card.appendChild(footer);
    r.appendChild(card);

    const toast = document.createElement("div");
    toast.id = "upliftToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    document.body.appendChild(r);
    document.body.appendChild(toast);

    return r;
  };

  if (!root) root = createFallback();

  const titleEl = root.querySelector(".uplift-title");
  const descEl = root.querySelector(".uplift-desc");
  const btns = Array.from(root.querySelectorAll(".uplift-btn"));
  const skipBtn = root.querySelector(".uplift-skip");
  const toast = document.getElementById("upliftToast");

  if (titleEl) titleEl.textContent = `${t("uplift.unlocked")} — ${t("uplift.lv")} ${pending}`;
  if (descEl) descEl.textContent = t("uplift.choose");

  const labels = {
    "basic-aoe": t("uplift.btn.aoe"),
    "basic-chain": t("uplift.btn.chain"),
    "basic-impact": t("uplift.btn.impact"),
  };

  // Replace buttons to remove old listeners, then attach fresh handlers
  btns.forEach((b) => {
    const kind = b.dataset.kind;
    const fresh = b.cloneNode(true);
    fresh.textContent = labels[kind] || kind;
    fresh.addEventListener("click", () => {
      const st = getUpliftState();
      st.choices.push({ level: pending, kind });
      saveUpliftState(st);
      try { root.setAttribute("aria-hidden", "true"); } catch (_) {}
      try {
        if (toast) {
          toast.textContent = t("uplift.applied");
          toast.classList.add("show");
          setTimeout(() => {
            try { toast.classList.remove("show"); toast.textContent = ""; } catch (_) {}
          }, 1100);
        }
      } catch (_) {}
    });
    b.parentNode.replaceChild(fresh, b);
  });

  if (skipBtn) {
    const s = skipBtn.cloneNode(true);
    s.textContent = t("uplift.decideLater");
    s.addEventListener("click", () => {
      try { root.setAttribute("aria-hidden", "true"); } catch (_) {}
    });
    skipBtn.parentNode.replaceChild(s, skipBtn);
  }

  try { root.setAttribute("aria-hidden", "false"); } catch (_) {}
}
