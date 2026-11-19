const cityStorageKey = "atmos-cidades";

function isCity(location) {
  return Number.isSafeInteger(location?.id) && location.id > 0 &&
    typeof location.name === "string" && Boolean(location.name.trim()) &&
    Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 &&
    Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
}

function cityRegion(location) {
  return [...new Set([location.admin2, location.admin1, location.country])]
    .filter((part) => typeof part === "string" && part && part !== location.name)
    .join(", ");
}

function uniqueCities(list) {
  const ids = new Set();
  return Array.isArray(list) ? list.filter((city) => {
    if (!isCity(city) || ids.has(city.id)) return false;
    ids.add(city.id);
    return true;
  }) : [];
}

function appendCityLabels(location, element) {
  const name = document.createElement("strong");
  name.textContent = location.name;
  const region = document.createElement("span");
  region.textContent = cityRegion(location);
  region.hidden = !region.textContent;
  element.append(name, region);
}


class CitySearch {
  constructor(form, fetchLocations, search, select) {
    this.form = form;
    this.input = form.querySelector("input");
    this.popup = form.querySelector(".suggestion-popup");
    this.suggestionStatus = form.querySelector(".suggestion-status");
    this.listbox = form.querySelector("[role=listbox]");
    this.fetchLocations = fetchLocations;
    this.select = select;
    this.options = [];
    this.activeIndex = -1;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.composing) return;
      const query = this.input.value.trim();
      const results = this.suggestionQuery === query ? this.options : undefined;
      const choice = results?.[this.activeIndex];
      if (choice) select(choice, true);
      else search(query, results);
      this.close();
    });
    this.input.addEventListener("input", (event) => {
      if (!event.isComposing && !this.composing) this.schedule();
    });
    this.input.addEventListener("compositionstart", () => {
      this.composing = true;
      this.close();
    });
    this.input.addEventListener("compositionend", () => {
      this.composing = false;
      this.schedule();
    });
    this.input.addEventListener("keydown", (event) => this.handleKey(event));
    this.listbox.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") event.preventDefault();
    });
    this.listbox.addEventListener("click", (event) => {
      const option = event.target.closest("[role=option]");
      if (!option) return;
      const choice = this.options[Number(option.dataset.index)];
      this.close();
      this.input.focus();
      if (choice) select(choice, true);
    });
    document.addEventListener("pointerdown", (event) => {
      if (!form.contains(event.target)) this.close();
    });
    document.addEventListener("focusin", (event) => {
      if (!form.contains(event.target)) this.close();
    });
  }

  close() {
    clearTimeout(this.timer);
    this.request?.abort();
    this.request = undefined;
    this.popup.hidden = true;
    this.listbox.replaceChildren();
    this.options = [];
    this.activeIndex = -1;
    this.suggestionQuery = undefined;
    this.pendingDirection = undefined;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
  }

  schedule() {
    this.close();
    const query = this.input.value.trim();
    if (query.length < 2) return;
    this.timer = setTimeout(() => this.suggest(query), 250);
  }

  async suggest(query) {
    const request = new AbortController();
    this.request = request;
    this.popup.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    this.suggestionStatus.textContent = "Buscando cidades…";
    try {
      const results = await this.fetchLocations(query, request.signal);
      if (request.signal.aborted || this.input.value.trim() !== query) return;
      this.suggestionQuery = query;
      this.showSuggestions(results);
      if (this.pendingDirection && this.options.length) this.moveSelection(this.pendingDirection);
    } catch {
      if (request.signal.aborted) return;
      this.suggestionStatus.textContent = "Não foi possível obter sugestões. Pressione Enter para tentar a busca.";
    } finally {
      if (this.request === request) this.request = undefined;
    }
  }

  showSuggestions(results) {
    this.options = results;
    this.popup.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    this.suggestionStatus.textContent = results.length
      ? results.length + (results.length === 1 ? " cidade encontrada." : " cidades encontradas.")
      : "Nenhuma cidade encontrada.";
    this.listbox.replaceChildren(...results.map((location, index) => {
      const option = document.createElement("li");
      option.id = this.listbox.id + "-" + index;
      option.dataset.index = index;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      appendCityLabels(location, option);
      return option;
    }));
  }

  handleKey(event) {
    if (event.isComposing || this.composing) return;
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape" && !this.popup.hidden) event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const query = this.input.value.trim();
    if (query.length < 2) return;
    const direction = event.key === "ArrowDown" ? 1 : -1;
    event.preventDefault();
    if (this.options.length) this.moveSelection(direction);
    else {
      this.pendingDirection = direction;
      if (!this.request && this.suggestionQuery !== query) {
        clearTimeout(this.timer);
        this.suggest(query);
      }
    }
  }

  moveSelection(direction) {
    this.listbox.children[this.activeIndex]?.setAttribute("aria-selected", "false");
    this.activeIndex = this.activeIndex === -1 && direction < 0
      ? this.options.length - 1
      : (this.activeIndex + direction + this.options.length) % this.options.length;
    const option = this.listbox.children[this.activeIndex];
    option.setAttribute("aria-selected", "true");
    this.input.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  }
}

class CityDirectory extends CitySearch {
  constructor(form, fetchLocations, search, select) {
    super(form, fetchLocations, search, select);
    this.favorites = document.querySelector(".favorite-list");
    this.history = document.querySelector(".history-list");
    this.toggle = document.querySelector(".favorite-toggle");
    this.clearButtons = document.querySelectorAll(".clear-history, .clear-favorites");
    this.dialog = document.querySelector(".history-dialog");
    this.feedback = document.querySelector(".city-feedback");
    this.state = this.read();
    this.render();
    this.toggle.addEventListener("click", () => this.toggleFavorite());
    for (const button of this.clearButtons) {
      button.addEventListener("click", () => {
        this.clearTarget = button.classList.contains("clear-history") ? "history" : "favorites";
        this.clearSection = button.closest("section");
        const label = this.clearTarget === "history" ? "buscas recentes" : "favoritos";
        this.dialog.querySelector("h2").textContent = "Limpar " + label + "?";
        this.dialog.querySelector("p").textContent = "A lista de " + label + " será apagada deste navegador.";
        this.dialog.querySelector('[value="limpar"]').textContent = "Limpar " + label;
        this.dialog.returnValue = "";
        this.dialog.showModal();
      });
    }
    this.dialog.addEventListener("close", () => {
      if (this.dialog.returnValue !== "limpar") return;
      this.state[this.clearTarget] = [];
      const persisted = this.save();
      this.render();
      this.clearSection.focus({ preventScroll: true });
      this.feedback.textContent = (this.clearTarget === "history" ? "Buscas recentes apagadas." : "Favoritos apagados.") +
        (persisted ? "" : " A alteração vale apenas nesta visita.");
    });
  }

  read() {
    let stored;
    try {
      stored = JSON.parse(localStorage.getItem(cityStorageKey));
    } catch {
      // O painel continua disponível com uma lista temporária.
    }
    return {
      favorites: uniqueCities(stored?.favorites),
      history: uniqueCities(stored?.history).slice(0, 10),
      last: isCity(stored?.last) ? stored.last : null,
    };
  }

  save() {
    try {
      localStorage.setItem(cityStorageKey, JSON.stringify(this.state));
      return true;
    } catch {
      return false;
    }
  }

  setCurrent(location, remember, recordSearch) {
    this.current = location;
    if (remember && isCity(location)) {
      this.state.last = location;
      if (recordSearch) {
        this.state.history = [location, ...this.state.history.filter((city) => city.id !== location.id)].slice(0, 10);
      }
      this.save();
    }
    this.render();
  }

  toggleFavorite() {
    const location = this.current;
    if (!isCity(location)) return;
    const saved = this.state.favorites.some((city) => city.id === location.id);
    this.state.favorites = saved
      ? this.state.favorites.filter((city) => city.id !== location.id)
      : [...this.state.favorites, location];
    const persisted = this.save();
    this.render();
    this.feedback.textContent = (saved ? "Cidade removida dos favoritos." : "Cidade adicionada aos favoritos.") +
      (persisted ? "" : " A alteração vale apenas nesta visita.");
  }

  render() {
    this.toggle.hidden = !isCity(this.current);
    const saved = this.state.favorites.some((city) => city.id === this.current?.id);
    this.toggle.setAttribute("aria-pressed", String(saved));
    this.toggle.title = saved ? "Remover cidade dos favoritos" : "Salvar cidade como favorita";
    this.toggle.querySelector("span").textContent = saved ? "♥" : "♡";
    this.renderList(this.favorites, this.state.favorites);
    this.renderList(this.history, this.state.history);
    document.querySelector(".favorites-empty").hidden = this.state.favorites.length > 0;
    document.querySelector(".history-empty").hidden = this.state.history.length > 0;
    for (const button of this.clearButtons) {
      const list = button.classList.contains("clear-history") ? this.state.history : this.state.favorites;
      button.disabled = list.length === 0;
    }
  }

  renderList(list, locations) {
    list.replaceChildren(...locations.map((location) => {
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "city-choice";
      appendCityLabels(location, button);
      button.addEventListener("click", () => this.select(location, false));
      row.append(button);
      return row;
    }));
  }

}
