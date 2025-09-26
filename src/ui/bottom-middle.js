// Small module to wire bottom-middle desktop controls to existing handlers.
// - For desktop the #bottomMiddle is visible (CSS), for mobile it's hidden.
// - We forward clicks to existing buttons so behavior is shared with mobile UI.
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
});
