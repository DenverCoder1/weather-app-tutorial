const preferenceKey = "atmos-configuracoes";
const preferenceOptions = {
  temperature: ["celsius", "fahrenheit"],
  wind: ["kmh", "mph"],
  theme: ["system", "light", "dark"],
};
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let storedPreferences;
let legacyTheme;
try {
  legacyTheme = localStorage.getItem("atmos-tema");
  storedPreferences = JSON.parse(localStorage.getItem(preferenceKey));
} catch {
  // As preferências padrão continuam disponíveis.
}

const preferences = Object.fromEntries(Object.entries(preferenceOptions).map(([key, options]) => {
  const value = storedPreferences?.[key] ?? (key === "theme" ? legacyTheme : undefined);
  return [key, options.includes(value) ? value : options[0]];
}));

function savePreferences() {
  try {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

function applyTheme() {
  const theme = preferences.theme === "system" ? (systemTheme.matches ? "dark" : "light") : preferences.theme;
  document.documentElement.dataset.theme = theme;
  const button = document.querySelector(".theme-button");
  if (!button) return;
  const light = theme === "light";
  button.setAttribute("aria-pressed", String(light));
  button.querySelector("span").textContent = light ? "☾" : "☀";
  button.title = light ? "Ativar tema escuro" : "Ativar tema claro";
}

applyTheme();
systemTheme.addEventListener("change", applyTheme);

function readingUnit(unit) {
  if (unit === "°C" && preferences.temperature === "fahrenheit") return "°F";
  if (unit === "km/h" && preferences.wind === "mph") return "mph";
  return unit;
}

function convertReading(value, unit, difference = false) {
  if (!Number.isFinite(value)) return value;
  if (unit === "°C" && preferences.temperature === "fahrenheit") return value * 1.8 + (difference ? 0 : 32);
  if (unit === "km/h" && preferences.wind === "mph") return value / 1.609344;
  return value;
}
