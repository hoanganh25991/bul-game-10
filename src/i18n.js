/**
 * Simple i18n utility for Zeus RPG (default Vietnamese).
 * - Uses data-i18n attributes to populate textContent.
 * - Persists selected language in localStorage ("lang").
 * - Provides helper to render the instructions list into a container.
 */
const STORAGE_KEY = "lang";

const DICTS = {
  vi: {
    "settings.title": "Cài đặt",
    "settings.language": "Ngôn ngữ",
    "settings.instructions": "Hướng dẫn",
    "settings.openHero": "Màn hình anh hùng",
    "intro.tagline": "Thần sấm sét thức tỉnh.",
    "btn.start": "Bắt đầu",
    "btn.close": "Đóng",
    "btn.cancel": "Hủy",
    "hero.title": "Zeus",
    "hero.skills": "Kỹ năng",
    "camera.first": "Góc nhìn thứ nhất",
    "camera.third": "Góc nhìn thứ ba",
    // Instructions (settings panel)
    "instructions.title": "Điều khiển DOTA-style",
    "instructions.items": [
      "Chuột trái: chọn hero/kẻ địch; xác nhận mục tiêu khi đang nhắm (W/A).",
      "Chuột phải: di chuyển / tấn công kẻ địch được nhấn.",
      "A: Vào chế độ nhắm tấn công; nhấp kẻ địch để tấn công hoặc mặt đất để vừa đi vừa tấn công.",
      "W: Vào chế độ nhắm AOE; nhấp chuột để thi triển. ESC để hủy.",
      "Q/E/R: Kỹ năng.",
      "S: Dừng lệnh (hủy di chuyển/tự tìm mục tiêu tạm thời).",
      "B: Gọi cổng dịch chuyển về làng, sau đó nhấp cổng để quay lại."
    ],
  },
  en: {
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.instructions": "Instructions",
    "settings.openHero": "Hero Screen",
    "intro.tagline": "The thunder god awakens.",
    "btn.start": "Start",
    "btn.close": "Close",
    "btn.cancel": "Cancel",
    "hero.title": "Zeus",
    "hero.skills": "Skills",
    "camera.first": "First-person",
    "camera.third": "Third-person",
    // Instructions (settings panel)
    "instructions.title": "DOTA-style Controls",
    "instructions.items": [
      "Left click: select hero/enemy; confirm target while aiming (W/A).",
      "Right click: move / attack clicked enemy.",
      "A: Attack aim; left-click enemy to attack or ground to attack-move.",
      "W: AOE aim; left-click to cast. ESC cancels.",
      "Q/E/R: Skills.",
      "S: Stop orders (briefly suppress auto-acquire).",
      "B: Recall to village, then click portal to travel back."
    ],
  },
};

let currentLang = (() => {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return saved && DICTS[saved] ? saved : "vi";
})();

/**
 * Translate by key from current language.
 */
export function t(key) {
  const dict = DICTS[currentLang] || {};
  const val = dict[key];
  return Array.isArray(val) || typeof val === "string" ? val : key;
}

/**
 * Apply translations to all elements with [data-i18n] within root.
 */
export function applyTranslations(root = document) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = t(key);
    if (Array.isArray(val)) {
      // if array, join with line breaks by default
      el.textContent = val.join("\n");
    } else {
      el.textContent = val;
    }
  });
  // Reflect language on html tag
  if (root.documentElement) {
    root.documentElement.lang = currentLang;
  }
}

/**
 * Render the instructions list into a container element.
 */
export function renderInstructions(container) {
  if (!container) return;
  container.innerHTML = "";
  const title = document.createElement("div");
  title.className = "instr-title";
  title.textContent = t("instructions.title");
  const ul = document.createElement("ul");
  const items = t("instructions.items");
  if (Array.isArray(items)) {
    items.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      ul.appendChild(li);
    });
  }
  container.appendChild(title);
  container.appendChild(ul);
}

/**
 * Set active language and persist to localStorage.
 */
export function setLanguage(lang) {
  if (!DICTS[lang]) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
  applyTranslations(document);
  const instr = document.getElementById("settingsInstructions");
  if (instr) renderInstructions(instr);
}

/**
 * Initialize i18n. Default language is Vietnamese.
 */
export function initI18n() {
  // set default if missing
  if (!localStorage.getItem(STORAGE_KEY)) {
    try {
      localStorage.setItem(STORAGE_KEY, currentLang);
    } catch {}
  }
  applyTranslations(document);
  const instr = document.getElementById("settingsInstructions");
  if (instr) renderInstructions(instr);
}

export function getLanguage() {
  return currentLang;
}
