import { PlayerBarsUI } from "./hudparts/player_bars.js";
import { MinimapUI } from "./hudparts/minimap.js";

/**
 * UIManager (orchestrator)
 * - Delegates player bars (HP/MP/XP, center message, level-up FX) to PlayerBarsUI
 * - Delegates minimap rendering to MinimapUI
 * - Keeps public API stable for callers (main.js)
 */
export class UIManager {
  constructor() {
    // Subsystems
    this.bars = new PlayerBarsUI();
    this.minimapUI = new MinimapUI();

    // Cooldown UI containers (passed to SkillsSystem)
    this.cdUI = {
      Q: document.getElementById("cdQ"),
      W: document.getElementById("cdW"),
      E: document.getElementById("cdE"),
      R: document.getElementById("cdR"),
      Basic: document.getElementById("cdBasic"),
    };
  }

  // Exposed for SkillsSystem
  getCooldownElements() {
    return this.cdUI;
  }

  // Center message helpers
  setCenterMsg(text) {
    this.bars?.setCenterMsg?.(text);
  }
  clearCenterMsg() {
    this.bars?.clearCenterMsg?.();
  }

  // Called each frame
  updateHUD(player) {
    this.bars?.update?.(player);
  }

  updateMinimap(player, enemies, portals, villages) {
    this.minimapUI?.update?.(player, enemies, portals, villages);
  }

  // Backward-compat entry for external level-up events
  showLevelUp(detail) {
    this.bars?.showLevelUp?.(detail);
  }
}
