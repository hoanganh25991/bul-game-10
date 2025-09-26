/* Small module to wire bottom-middle desktop controls to existing handlers.
   - For desktop the #bottomMiddle is visible (CSS), for mobile it's hidden.
   - We forward clicks to existing buttons so behavior is shared with mobile UI.
   - Additionally: sync icons, keys and skill names from the main skill wheel
     and rely on SkillsSystem to mirror cooldown visuals into .cooldown[data-cd="..."].
*/
document.addEventListener("DOMContentLoaded", () => {
  const bmCamera = document.getElementById("bmCamera");
  const bmPortal = document.getElementById("bmPortal");
  const bmMark = document.getElementById("bmMark");
  const bmSkills = Array.from(document.querySelectorAll("#bottomMiddle .square-skill"));

  function forwardClick(srcElId, targetId) {
    const src = document.getElementById(srcElId);
    const target = document.getElementById(targetId);
    if (!src || !target) return;
    src.addEventListener("click", (e) => {
      e.preventDefault();
      try { target.click(); } catch(_) {}
    });
  }

  // Forward action buttons to existing handlers
  if (bmCamera) forwardClick("bmCamera", "btnCamera");
  if (bmPortal) forwardClick("bmPortal", "btnPortal");
  if (bmMark) forwardClick("bmMark", "btnMark");

  // Map square-skill buttons to the skill buttons on the right
  const keyToBtn = {
    "basic": "btnBasic",
    "Q": "btnSkillQ",
    "W": "btnSkillW",
    "E": "btnSkillE",
    "R": "btnSkillR",
  };

  // Forward clicks from bottom-middle skill tiles to main skill buttons (or emit a request event)
  bmSkills.forEach((s) => {
    const key = s.dataset.key;
    const targetId = keyToBtn[key];
    if (!targetId) return;
    const target = document.getElementById(targetId);
    s.addEventListener("click", (e) => {
      e.preventDefault();
      // If skill button exists, trigger it
      if (target) {
        try { target.click(); } catch(_) {}
      } else {
        // fallback: dispatch a custom event indicating a requested cast
        try { window.dispatchEvent(new CustomEvent("request-skill-cast", { detail: { key } })); } catch(_) {}
      }
    });
  });

  // Sync labels/icons/keys from the main skill wheel into bottom-middle buttons
  function syncLabels() {
    bmSkills.forEach((s) => {
      const key = s.dataset.key;
      const targetId = keyToBtn[key];
      const source = targetId ? document.getElementById(targetId) : null;
      const iconEl = s.querySelector(".icon");
      const nameEl = s.querySelector(".name");
      const keyEl = s.querySelector(".key");

      if (source) {
        const srcIcon = source.querySelector(".icon");
        const srcName = source.querySelector(".name");
        const srcKey = source.querySelector(".key");
        if (iconEl && srcIcon) iconEl.textContent = srcIcon.textContent;
        if (nameEl && srcName) nameEl.textContent = srcName.textContent;
        if (keyEl) keyEl.textContent = (srcKey && srcKey.textContent) ? srcKey.textContent : (key === "basic" ? "" : key);
        if (source.title) s.title = source.title;
      } else {
        // fallback content (use central basic as fallback for basic)
        if (key === "basic") {
          const basic = document.getElementById("btnBasic");
          if (basic) {
            const srcIcon = basic.querySelector(".icon");
            if (iconEl && srcIcon) iconEl.textContent = srcIcon.textContent;
            if (basic.title) s.title = basic.title;
          }
        }
        if (keyEl && !keyEl.textContent) keyEl.textContent = key;
        if (nameEl && !nameEl.textContent) nameEl.textContent = "";
      }
    });
  }

  // Initial sync
  syncLabels();

  // Observe skillWheel for changes (updateSkillBarLabels writes into those nodes).
  const skillWheel = document.getElementById("skillWheel");
  if (skillWheel) {
    const mo = new MutationObserver((mutations) => {
      let need = false;
      for (const m of mutations) {
        if (m.type === "characterData" || m.type === "childList" || m.type === "attributes") { need = true; break; }
      }
      if (need) {
        clearTimeout(window.__bmSyncTimer);
        window.__bmSyncTimer = setTimeout(syncLabels, 30);
      }
    });
    mo.observe(skillWheel, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  // Note: cooldown visuals are mirrored by src/skills.js which copies the conic-gradient/text
  // into any .cooldown inside #bottomMiddle that has data-cd="cdX" matching the master id.
});
