const key = "university-theme";
let volatilePreference = null;
function preference() {
  if (volatilePreference) return volatilePreference;
  try { const value = localStorage.getItem(key); return value === "light" || value === "dark" ? value : null; }
  catch { return null; }
}
function applyTheme() {
  const theme = preference() || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
export function subscribeTheme(notify) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const update = () => { applyTheme(); notify(); };
  const storage = event => { if (event.key === key || event.key === null) { volatilePreference = null; update(); } };
  window.addEventListener("theme-change", update);
  window.addEventListener("storage", storage);
  media.addEventListener("change", update);
  return () => {
    window.removeEventListener("theme-change", update);
    window.removeEventListener("storage", storage);
    media.removeEventListener("change", update);
  };
}
export const getTheme = () => document.documentElement.dataset.theme || "light";
export function toggleTheme() {
  volatilePreference = getTheme() === "dark" ? "light" : "dark";
  try { localStorage.setItem(key, volatilePreference); } catch { /* The theme still works when storage is blocked. */ }
  window.dispatchEvent(new Event("theme-change"));
}
