export const DEBUG = new URLSearchParams(location.search).has("debug");
export const HERO_MODEL_URL = new URLSearchParams(location.search).get("model") || "";
