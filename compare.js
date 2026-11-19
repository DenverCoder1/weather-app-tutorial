const comparisonMetrics = {
  current: [
    ["temperature_2m", "Temperatura", " °C"],
    ["apparent_temperature", "Sensação térmica", " °C"],
    ["relative_humidity_2m", "Umidade relativa", "%"],
    ["wind_speed_10m", "Velocidade do vento", " km/h"],
    ["cloud_cover", "Cobertura de nuvens", "%"],
    ["surface_pressure", "Pressão na superfície", " hPa"],
  ],
  daily: [
    ["temperature_2m_max", "Máxima", " °C"],
    ["temperature_2m_min", "Mínima", " °C"],
    ["uv_index_max", "Índice UV máximo", ""],
    ["precipitation_probability_max", "Chance máxima de precipitação", "%"],
  ],
};

function comparisonPeriod(location, forecast, now) {
  const timezone = forecast.timezone ?? location.timezone;
  if (!timezone) return {};
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset",
    });
  } catch (error) {
    if (error instanceof RangeError) return {};
    throw error;
  }
  const partsAt = (timestamp) => {
    if (!Number.isFinite(timestamp)) return {};
    const parts = Object.fromEntries(formatter.formatToParts(timestamp * 1000)
      .map(({ type, value }) => [type, value]));
    return {
      date: parts.year + "-" + parts.month + "-" + parts.day,
      label: parts.day + "/" + parts.month + "/" + parts.year,
      hour: Number(parts.hour),
      time: parts.hour + ":" + parts.minute + " (" + parts.timeZoneName + ")",
    };
  };
  const today = partsAt(now);
  const daily = forecast.daily;
  const dayIndex = Array.isArray(daily?.time) ? daily.time.findIndex((timestamp) => {
    if (!Number.isFinite(timestamp)) return false;
    // A data diária em Unix usa o deslocamento de referência informado pela API.
    const date = Number.isFinite(forecast.utc_offset_seconds)
      ? new Date((timestamp + forecast.utc_offset_seconds) * 1000).toISOString().slice(0, 10)
      : partsAt(timestamp).date;
    return date === today.date;
  }) : -1;
  const hours = Array.from({ length: 24 }, () => []);
  if (Array.isArray(forecast.hourly?.time)) {
    for (const [index, timestamp] of forecast.hourly.time.entries()) {
      const { date, hour, time } = partsAt(timestamp);
      if (date === today.date) hours[hour].push({
        localTime: time,
        temperature_2m: forecast.hourly.temperature_2m?.[index],
        wind_speed_10m: forecast.hourly.wind_speed_10m?.[index],
        precipitation_probability: forecast.hourly.precipitation_probability?.[index],
        relative_humidity_2m: forecast.hourly.relative_humidity_2m?.[index],
        cloud_cover: forecast.hourly.cloud_cover?.[index],
      });
    }
  }
  return {
    today,
    observed: partsAt(forecast.current?.time),
    current: forecast.current,
    daily: dayIndex < 0 ? undefined : Object.fromEntries(comparisonMetrics.daily
      .map(([key]) => [key, daily[key]?.[dayIndex]])),
    hours,
  };
}

function appendComparisonReading(list, label, reading) {
  const term = document.createElement("dt");
  const value = document.createElement("dd");
  term.textContent = label;
  value.textContent = reading;
  list.append(term, value);
  return value;
}

class WeatherComparison {
  constructor(panel, { fetchLocations, fetchForecast, describeWeather, formatReading }) {
    this.panel = panel;
    this.fetchLocations = fetchLocations;
    this.fetchForecast = fetchForecast;
    this.describeWeather = describeWeather;
    this.formatReading = formatReading;
    this.swap = panel.querySelector(".compare-swap");
    this.differences = panel.querySelector(".compare-differences");
    this.charts = panel.querySelector(".compare-charts");
    this.chart = new ForecastChart(this.charts, formatReading);
    this.slots = ["A", "B"].map((letter, index) => this.createSlot(letter, index));
    this.swap.addEventListener("click", () => {
      const [a, b] = this.slots;
      [a.result, b.result] = [b.result, a.result];
      [a.input.value, b.input.value] = [a.result.location.name, b.result.location.name];
      this.update();
      panel.querySelector(".compare-feedback").textContent = "As cidades A e B foram trocadas.";
    });
  }

  createSlot(letter, index) {
    const card = document.querySelector("#compare-city-template").content.firstElementChild.cloneNode(true);
    const name = "Cidade " + letter;
    card.querySelector("h2").textContent = name;
    const form = card.querySelector("form");
    form.setAttribute("aria-label", "Buscar " + name.toLowerCase());
    const input = form.querySelector("input");
    const listbox = form.querySelector("[role=listbox]");
    listbox.id = "compare-options-" + letter.toLowerCase();
    input.setAttribute("aria-label", "Buscar " + name.toLowerCase());
    input.setAttribute("aria-controls", listbox.id);
    const slot = { card, input, name, index, result: { message: "Busque uma cidade para começar." } };
    new CitySearch(form, this.fetchLocations,
      (query, cached) => this.load(slot, query, cached),
      (location) => this.load(slot, location));
    this.panel.querySelector(".compare-grid").append(card);
    this.renderSlot(slot);
    return slot;
  }

  async load(slot, query, cached) {
    slot.request?.abort();
    const request = new AbortController();
    slot.request = request;
    slot.result = { state: "loading", message: "Buscando cidade…" };
    this.update();
    try {
      if (typeof query === "string" && query.length < 2) {
        slot.result = { state: "error", message: "Digite pelo menos duas letras do nome da cidade." };
        return;
      }
      const location = typeof query === "string"
        ? (cached ?? await this.fetchLocations(query, request.signal))[0] : query;
      if (request.signal.aborted) return;
      if (!location) {
        slot.result = { state: "empty", message: "Cidade não encontrada. Confira o nome e tente novamente." };
        return;
      }
      const other = this.slots[1 - slot.index].result.location;
      const duplicate = other && (isCity(location) && isCity(other)
        ? location.id === other.id
        : location.latitude === other.latitude && location.longitude === other.longitude);
      if (duplicate) {
        slot.result = { state: "error", message: "Esta cidade já está do outro lado. Selecione uma cidade diferente." };
        return;
      }
      slot.input.value = location.name;
      slot.result = { location, state: "loading", message: "Carregando a previsão de " + location.name + "…" };
      this.update();
      const forecast = await this.fetchForecast(location, request.signal, 1);
      if (request.signal.aborted) return;
      if (!forecast?.current && !forecast?.daily && !forecast?.hourly) {
        slot.result = { location, state: "empty", message: "Não há dados meteorológicos para esta cidade." };
        return;
      }
      slot.result = { location, forecast, requestedAt: Date.now() / 1000 };
    } catch {
      if (!request.signal.aborted) {
        const location = slot.result.location;
        const message = location
          ? "Não foi possível obter a previsão de " + location.name + ". Tente novamente."
          : "Não foi possível buscar cidades. Verifique a conexão e tente novamente.";
        slot.result = { location, state: "error", message };
      }
    } finally {
      if (slot.request === request) {
        slot.request = undefined;
        this.update();
      }
    }
  }

  update() {
    for (const slot of this.slots) this.renderSlot(slot);
    const [a, b] = this.slots;
    this.swap.disabled = !a.result.location || !b.result.location || Boolean(a.request || b.request);
    const ready = Boolean(a.result.forecast && b.result.forecast);
    this.differences.hidden = !ready;
    this.charts.hidden = !ready;
    if (!ready) return;
    this.renderDifferences(a.period, b.period);
    this.renderChart();
  }

  renderSlot(slot) {
    const { card, result } = slot;
    const { location, forecast, state, message, requestedAt } = result;
    const status = card.querySelector(".compare-status");
    if (status.textContent !== (message ?? "")) status.textContent = message ?? "";
    status.dataset.state = state ?? "";
    card.querySelector(".compare-details").hidden = !forecast;
    if (!forecast) return;
    const period = comparisonPeriod(location, forecast, requestedAt);
    slot.period = period;
    card.querySelector("h3").textContent = location.name;
    card.querySelector(".compare-region").textContent = cityRegion(location);
    const [description, icon] = this.describeWeather(forecast.current?.weather_code, forecast.current?.is_day !== 0);
    card.querySelector(".compare-condition").textContent = description;
    card.querySelector(".compare-icon").textContent = icon;
    card.querySelector(".compare-observed").textContent = period.observed?.time
      ? "Dados de " + period.observed.label + " às " + period.observed.time
      : "Horário dos dados atuais indisponível.";
    card.querySelector(".compare-date").textContent = period.today?.label
      ? period.today.label + " · dia local, da meia-noite à meia-noite"
      : "Data local indisponível.";
    for (const [group, metrics] of Object.entries(comparisonMetrics)) {
      const list = card.querySelector(".compare-" + group);
      list.replaceChildren();
      for (const [key, label, unit] of metrics) {
        appendComparisonReading(list, label, this.formatReading(period[group]?.[key], unit));
      }
    }
  }

  renderDifferences(a, b) {
    const sameInstant = Number.isFinite(a.current?.time) && a.current.time === b.current?.time;
    const sameDay = Boolean(a.today?.date && a.today.date === b.today?.date);
    const context = "Condições atuais: " + (sameInstant ? "mesmo instante. " : "sem diferença calculada para horários distintos ou indisponíveis. ") +
      "Previsão do dia: " + (sameDay ? "cada cidade no mesmo dia do calendário local."
        : "sem diferença calculada para datas locais distintas ou indisponíveis.");
    this.differences.querySelector(".difference-context").textContent = context;
    const list = this.differences.querySelector(".difference-values");
    list.replaceChildren();
    for (const [group, metrics] of Object.entries(comparisonMetrics)) {
      for (const [key, label, unit] of metrics) {
        const first = a[group]?.[key];
        const second = b[group]?.[key];
        const comparable = (group === "current" ? sameInstant : sameDay) && Number.isFinite(first) && Number.isFinite(second);
        const difference = comparable ? Math.round((second - first) * 10) / 10 : undefined;
        const reading = this.formatReading(difference, unit === "%" ? " p.p." : unit);
        const value = appendComparisonReading(list, label, difference > 0 ? "+" + reading : reading);
        if (comparable && difference !== 0) value.classList.add("difference-highlight");
      }
    }
  }

  renderChart() {
    const samples = [];
    for (let hour = 0; hour < 24; hour++) {
      const readings = this.slots.map(({ period }) => period.hours?.[hour] ?? []);
      const occurrences = Math.max(1, ...readings.map((hours) => hours.length));
      for (let occurrence = 0; occurrence < occurrences; occurrence++) {
        const time = String(hour).padStart(2, "0") + " h";
        const label = occurrences > 1 ? time + " · ocorrência " + (occurrence + 1) : time;
        // O eixo ordena faixas locais, mantendo separadas as horas repetidas.
        samples.push({ timestamp: samples.length * 3600, time, label,
          cities: readings.map((hours) => hours[occurrence]) });
      }
    }
    const names = this.slots.map(({ name, result }) => name + " · " + result.location.name);
    const dates = this.slots.map(({ name, period }) => name + ": " + (period.today?.label ?? "data indisponível"));
    const legend = this.charts.querySelectorAll(".compare-legend li");
    for (const [index, name] of names.entries()) legend[index].textContent = name;
    this.chart.setSamples(samples,
      "Hora local de cada cidade, em instantes que podem ser diferentes. " + dates.join(" · "), names);
  }
}
