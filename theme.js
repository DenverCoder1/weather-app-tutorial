(() => {
  const root = document.documentElement;
  const systemTheme = matchMedia("(prefers-color-scheme: dark)");
  const storageKey = "atmos-tema";
  let preference;
  let button;

  try {
    preference = localStorage.getItem(storageKey);
  } catch {
    // O tema do sistema continua disponível sem acesso ao armazenamento.
  }
  if (preference !== "light" && preference !== "dark") preference = null;

  function applyTheme() {
    const theme = preference ?? (systemTheme.matches ? "dark" : "light");
    root.dataset.theme = theme;
    if (!button) return;
    const light = theme === "light";
    button.setAttribute("aria-pressed", String(light));
    button.querySelector("span").textContent = light ? "☾" : "☀";
    button.title = light ? "Ativar tema escuro" : "Ativar tema claro";
  }

  applyTheme();
  systemTheme.addEventListener("change", applyTheme);
  document.addEventListener("DOMContentLoaded", () => {
    button = document.querySelector(".theme-button");
    applyTheme();
    button.addEventListener("click", () => {
      preference = root.dataset.theme === "light" ? "dark" : "light";
      applyTheme();
      try {
        localStorage.setItem(storageKey, preference);
      } catch {
        // A escolha permanece válida durante a visita atual.
      }
    });
  });
})();
