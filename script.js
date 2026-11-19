const searchForm = document.querySelector(".search");
const searchInput = document.querySelector(".search-bar");
const weatherPanel = document.querySelector(".weather");
const statusMessage = document.querySelector(".status");
const skeleton = document.querySelector(".skeleton");
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const differenceFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, signDisplay: "exceptZero" });

const forecastList = document.querySelector(".forecast-list");
const forecastStatus = document.querySelector(".forecast-status");
const forecastRange = document.querySelector(".forecast-range");
const forecastDetail = document.querySelector("#detalhes-do-dia");
const calendarPanel = document.querySelector("#calendario");
const calendarList = calendarPanel.querySelector(".calendar-days");
const calendarDetail = calendarPanel.querySelector(".forecast-detail");
const calendarStatus = calendarPanel.querySelector(".calendar-status");
const settingsPanel = document.querySelector("#configuracoes");
const hourlyList = document.querySelector(".hourly-list");
const hourlyStatus = document.querySelector(".hourly-status");
const chart = new ForecastChart(document.querySelector(".charts"), formatReading);
const chartReset = document.querySelector(".chart-reset");
const refreshButton = document.querySelector(".refresh-button");
const localClock = document.querySelector(".current-date");
const weekdayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });
const shortDateFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });

let activeRequest;
let selectedLocation;
let clockFormat;
let localHourFormat;
let displayedForecast;
let displayedHour;
let selectedDay;
let displayedWeather;
const locationCache = new Map();
const pendingLocations = new Map();

function setWeatherStatus(state, message = "") {
  const loading = state === "loading";
  refreshButton.disabled = loading;
  statusMessage.dataset.state = state;
  if (statusMessage.textContent !== message) statusMessage.textContent = message;
  skeleton.hidden = !loading || !weatherPanel.hidden;
  weatherPanel.setAttribute("aria-busy", String(loading));
  if (!displayedForecast) calendarStatus.textContent = loading
    ? "Carregando a previsão…" : "Previsão indisponível.";
}

function formatReading(value, unit, difference = false) {
  if (!Number.isFinite(value)) return "Indisponível";
  const key = unit.trim();
  const formatter = difference ? differenceFormat : numberFormat;
  const converted = convertReading(value, key, difference);
  if (!Number.isFinite(converted)) return "Indisponível";
  return formatter.format(converted) +
    (unit.startsWith(" ") ? " " : "") + readingUnit(key);
}

function configureClock(timezone) {
  clockFormat = undefined;
  localHourFormat = undefined;
  if (timezone) {
    try {
      clockFormat = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "full", timeStyle: "short", hourCycle: "h23", timeZone: timezone,
      });
      localHourFormat = new Intl.DateTimeFormat("pt-BR", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
        minute: "2-digit", hourCycle: "h23", timeZone: timezone, timeZoneName: "shortOffset",
      });
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
}

function updateClock(now) {
  const label = clockFormat
    ? "Horário local: " + clockFormat.format(now)
    : "Horário local indisponível.";
  if (localClock.textContent !== label) localClock.textContent = label;
}

function getLocalParts(timestamp) {
  if (!localHourFormat || !isTimestamp(timestamp)) return {};
  const parts = Object.fromEntries(localHourFormat.formatToParts(timestamp * 1000)
    .map(({ type, value }) => [type, value]));
  return { day: parts.year + "-" + parts.month + "-" + parts.day,
    time: parts.hour + ":" + parts.minute, offset: parts.timeZoneName };
}

function getLocalTime(timestamp) {
  return getLocalParts(timestamp).time ?? "Indisponível";
}

function displayPercentage(selector, value) {
  const label = weatherPanel.querySelector(selector);
  const ring = label.previousElementSibling;
  const available = Number.isFinite(value) && value >= 0 && value <= 100;
  label.textContent = formatReading(available ? value : null, "%");
  ring.hidden = !available;
  if (available) ring.style.setProperty("--fill", value + "%");
}

async function fetchJson(endpoint, params, signal) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams(params);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Falha na consulta à Open-Meteo");
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data) || data.error) {
      throw new Error("Resposta inválida da Open-Meteo");
    }
    return data;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

async function fetchForecast(location, signal, forecastDays = 7) {
  const result = await fetchJson("https://api.open-meteo.com/v1/forecast", {
    latitude: location.latitude,
    longitude: location.longitude,
    current: weatherFields.current.join(","),
    hourly: weatherFields.hourly.join(","),
    daily: weatherFields.daily.join(","),
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: forecastDays,
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  }, signal);
  return normalizeForecast(result, location);
}

function displayForecast(daily, today, tomorrow) {
  const rows = [];
  const days = Array.isArray(daily?.time) ? daily.time : [];
  const seen = new Set();
  for (const [index, day] of days.entries()) {
    if (!day || (today && day < today) || seen.has(day)) continue;
    const date = new Date(day + "T00:00:00Z");
    if (!Number.isFinite(date.getTime())) continue;
    seen.add(day);

    const [description, icon] = describeWeather(daily.weather_code?.[index]);
    const row = document.createElement("li");
    row.innerHTML = '<button type="button" class="forecast-choice" aria-controls="detalhes-do-dia">' +
      '<span><span class="forecast-day"></span><time class="forecast-date"></time></span>' +
      '<span class="forecast-icon" role="img"></span>' +
      '<span class="forecast-values"><span class="forecast-temps"><strong></strong><span class="forecast-min"></span></span>' +
      '<span class="forecast-rain"></span></span></button>';

    const button = row.querySelector("button");
    button.dataset.day = day;
    button.setAttribute("aria-pressed", String(day === selectedDay));
    if (day === today) button.setAttribute("aria-current", "date");
    button.addEventListener("click", () => {
      selectForecastDay(day);
      forecastDetail.focus();
    });

    const weekday = weekdayFormat.format(date);
    const dayLabel = day === today ? "Hoje · " + weekday : day === tomorrow ? "Amanhã · " + weekday : weekday;
    row.classList.toggle("forecast-today", day === today);
    row.querySelector(".forecast-day").textContent = dayLabel[0].toUpperCase() + dayLabel.slice(1);
    const dateLabel = row.querySelector("time");
    dateLabel.dateTime = day;
    dateLabel.textContent = shortDateFormat.format(date);

    const graphic = row.querySelector(".forecast-icon");
    graphic.textContent = icon;
    graphic.setAttribute("aria-label", description);
    graphic.title = description;

    const maximum = daily.temperature_2m_max?.[index];
    const minimum = daily.temperature_2m_min?.[index];
    const high = row.querySelector("strong");
    const low = row.querySelector(".forecast-min");
    high.textContent = formatReading(maximum, " °C");
    high.title = "Máxima";
    low.textContent = formatReading(minimum, " °C");
    low.title = "Mínima";
    row.querySelector(".forecast-temps").setAttribute("aria-label",
      "Máxima: " + formatReading(maximum, " °C") + ". Mínima: " + formatReading(minimum, " °C") + ".");
    const rain = formatReading(daily.precipitation_probability_max?.[index], "%");
    row.querySelector(".forecast-rain").textContent = "Precip.: " + rain;
    rows.push(row);
  }
  forecastList.replaceChildren(...rows);
  forecastStatus.hidden = rows.length > 0;
  forecastRange.hidden = rows.length === 0;
  forecastRange.textContent = rows.length === 1 ? "1 dia disponível" : rows.length + " dias disponíveis";
  calendarList.replaceChildren(...rows.map((row) => {
    const tile = row.cloneNode(true);
    const button = tile.querySelector("button");
    button.setAttribute("aria-controls", calendarDetail.id);
    const high = tile.querySelector("strong");
    const low = tile.querySelector(".forecast-min");
    high.textContent = "Máx. " + high.textContent;
    low.textContent = "Mín. " + low.textContent;
    button.addEventListener("click", () => {
      selectForecastDay(button.dataset.day);
      calendarDetail.focus();
    });
    return tile;
  }));
  calendarStatus.hidden = calendarList.childElementCount > 0;
  calendarStatus.textContent = "Previsão indisponível.";
}

function makeHourlySamples(hourly) {
  const counts = new Map();
  const samples = hourly.time.flatMap((timestamp, index) => {
    const { day, time, offset } = getLocalParts(timestamp);
    if (!day) return [];
    const localKey = day + "T" + time;
    counts.set(localKey, (counts.get(localKey) ?? 0) + 1);
    return [{
      timestamp, day, time, offset, localKey,
      temperature_2m: hourly.temperature_2m?.[index],
      wind_speed_10m: hourly.wind_speed_10m?.[index],
      precipitation_probability: hourly.precipitation_probability?.[index],
      relative_humidity_2m: hourly.relative_humidity_2m?.[index],
      cloud_cover: hourly.cloud_cover?.[index],
      weather_code: hourly.weather_code?.[index],
      is_day: hourly.is_day?.[index],
      uv_index: hourly.uv_index?.[index],
    }];
  });
  for (const sample of samples) {
    sample.displayTime = counts.get(sample.localKey) > 1 ? sample.time + " (" + sample.offset + ")" : sample.time;
    sample.label = shortDateFormat.format(new Date(sample.day + "T00:00:00Z")) + " às " + sample.displayTime;
  }
  return samples;
}

function displayHourly(samples, currentHour) {
  const rows = samples.map((sample, index) => {
    const row = document.createElement("li");
    row.innerHTML = '<time></time><span class="hourly-icon" role="img"></span>' +
      '<strong></strong><span class="hourly-rain"></span>';
    if (sample.timestamp === currentHour) row.setAttribute("aria-current", "time");
    const time = row.querySelector("time");
    time.dateTime = new Date(sample.timestamp * 1000).toISOString();
    time.textContent = sample.timestamp === currentHour ? "Agora · " + sample.displayTime : sample.displayTime;
    if (index > 0 && samples[index - 1].day !== sample.day) time.textContent = sample.label;
    time.setAttribute("aria-label", sample.timestamp === currentHour ? "Agora, " + sample.label : sample.label);
    const [description, icon] = describeWeather(sample.weather_code, sample.is_day !== 0);
    const graphic = row.querySelector(".hourly-icon");
    graphic.setAttribute("aria-label", description);
    graphic.title = description;
    graphic.textContent = icon;
    row.querySelector("strong").textContent = formatReading(sample.temperature_2m, " °C");
    const rain = formatReading(sample.precipitation_probability, "%");
    row.querySelector(".hourly-rain").textContent = "Precip.: " + rain;
    return row;
  });
  const scroll = hourlyList.scrollLeft;
  hourlyList.replaceChildren(...rows);
  hourlyList.scrollLeft = scroll;
  hourlyList.hidden = rows.length === 0;
  hourlyStatus.hidden = rows.length === 24;
  hourlyStatus.textContent = rows.length
    ? "Previsão disponível para " + rows.length + " das próximas 24 horas."
    : "Previsão horária indisponível.";
}

function selectForecastDay(day, updateChart = true) {
  selectedDay = day;
  const { daily, samples, upcoming } = displayedForecast;
  const index = day ? daily.time.indexOf(day) : -1;
  for (const button of document.querySelectorAll(".forecast-choice")) {
    button.setAttribute("aria-pressed", String(button.dataset.day === day));
  }
  forecastDetail.hidden = index < 0;
  calendarDetail.hidden = index < 0 || Boolean(displayedForecast.today && day < displayedForecast.today);
  chartReset.disabled = index < 0;
  if (index < 0) {
    if (updateChart) chart.setSamples(upcoming, "Próximas 24 horas · horário local");
    return;
  }
  const date = new Date(day + "T00:00:00Z");
  const label = weekdayFormat.format(date) + ", " + shortDateFormat.format(date);
  const [description] = describeWeather(daily.weather_code?.[index]);
  const summary = description + " · " +
    "Máxima: " + formatReading(daily.temperature_2m_max?.[index], " °C") + " · " +
    "Mínima: " + formatReading(daily.temperature_2m_min?.[index], " °C") + " · " +
    "Chance máxima de precipitação: " + formatReading(daily.precipitation_probability_max?.[index], "%");
  const extra =
    "Nascer do sol: " + getLocalTime(daily.sunrise?.[index]) + " · " +
    "Pôr do sol: " + getLocalTime(daily.sunset?.[index]) + " · " +
    "Índice UV máximo: " + formatReading(daily.uv_index_max?.[index], "");
  for (const detail of [forecastDetail, calendarDetail]) {
    detail.querySelector("h2, h3").textContent = label;
    detail.querySelector(".forecast-detail-summary").textContent = summary;
    detail.querySelector(".forecast-detail-extra").textContent = extra;
  }
  if (updateChart) chart.setSamples(samples.filter((sample) => sample.day === day), label + " · horário local");
}

chartReset.addEventListener("click", () => {
  selectForecastDay(undefined);
  (chart.content.hidden ? chart.metric : chart.range).focus();
});

function displayWeather(location, { current, daily, hourly, timezone, utc_offset_seconds }) {
  configureClock(timezone);
  displayedWeather = { location, current };
  displayCurrentWeather(location, current);
  calendarPanel.querySelector(".calendar-location").textContent =
    [location.name, cityRegion(location)].filter(Boolean).join(" · ");

  const days = daily.time.map((timestamp) => dailyDate(timestamp, utc_offset_seconds, (time) => getLocalParts(time).day));
  const sameLocation = location === selectedLocation || (isCity(location) && location.id === selectedLocation?.id);
  if (!sameLocation || !days.includes(selectedDay)) selectedDay = undefined;
  displayedForecast = { daily: { ...daily, time: days }, samples: makeHourlySamples(hourly) };
  const now = new Date();
  updateClock(now);
  weatherPanel.hidden = false;
  displayDailyMetrics(now, true);
}

function displayCurrentWeather(location, current) {
  const { temperature_2m, relative_humidity_2m, wind_speed_10m, weather_code, is_day } = current;
  const [description, icon] = describeWeather(weather_code, is_day !== 0);
  const region = cityRegion(location);
  const regionLabel = weatherPanel.querySelector(".region");
  regionLabel.textContent = region;
  regionLabel.hidden = !region;

  weatherPanel.querySelector(".city").textContent = location.name;
  weatherPanel.querySelector(".icon").textContent = icon;
  weatherPanel.querySelector(".description").textContent = description;
  const temperature = weatherPanel.querySelector(".temp");
  const convertedTemperature = convertReading(temperature_2m, "°C");
  temperature.classList.toggle("reading-unavailable", !Number.isFinite(convertedTemperature));
  if (Number.isFinite(convertedTemperature)) {
    const unit = document.createElement("span");
    unit.textContent = " " + readingUnit("°C");
    temperature.replaceChildren(numberFormat.format(convertedTemperature), unit);
  } else {
    temperature.textContent = "Temperatura indisponível";
  }
  weatherPanel.querySelector(".feels-like").textContent =
    "Sensação térmica: " + formatReading(current.apparent_temperature, " °C");
  const observation = getLocalParts(current.time);
  const observedDate = observation.day && new Date(observation.day + "T00:00:00Z");
  weatherPanel.querySelector(".observation-time").textContent = !observedDate || !Number.isFinite(observedDate.getTime())
    ? "Horário dos dados atuais indisponível."
    : "Dados de " + shortDateFormat.format(observedDate) + " às " + observation.time + " (horário local)";
  displayPercentage(".humidity", relative_humidity_2m);
  displayPercentage(".cloud-cover", current.cloud_cover);
  weatherPanel.querySelector(".wind").textContent = formatReading(wind_speed_10m, " km/h");
  weatherPanel.querySelector(".wind-gusts").textContent = formatReading(current.wind_gusts_10m, " km/h");
  const direction = current.wind_direction_10m;
  const compass = weatherPanel.querySelector(".compass");
  const validDirection = Number.isFinite(direction) && direction >= 0 && direction <= 360;
  compass.hidden = !validDirection;
  if (validDirection) compass.style.setProperty("--bearing", direction + "deg");
  const bearings = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  weatherPanel.querySelector(".wind-direction").textContent = validDirection
    ? bearings[Math.round(direction / 45) % bearings.length] + " · " + formatReading(direction, "°")
    : "Indisponível";
  weatherPanel.querySelector(".surface-pressure").textContent = formatReading(current.surface_pressure, " hPa");
  weatherPanel.querySelector(".precipitation-amount").textContent = formatReading(current.precipitation, " mm");
  const interval = weatherPanel.querySelector(".precipitation-interval");
  const showInterval = Number.isFinite(current.precipitation) && Number.isFinite(current.interval) && current.interval > 0;
  interval.hidden = !showInterval;
  interval.textContent = showInterval ? "Acumulada nos últimos " + formatReading(current.interval / 60, " min") : "";
  weatherPanel.querySelector(".current").dataset.sky = is_day === 0 ? "night" : weather_code <= 2 ? "clear" : "cloudy";
}

function displayDailyMetrics(now, newForecast = false, unitsChanged = false) {
  const { daily, samples } = displayedForecast;
  const timestamp = now.getTime() / 1000;
  const current = samples.findLast((sample) => sample.timestamp <= timestamp && timestamp - sample.timestamp < 3600);
  const today = getLocalParts(timestamp).day;
  const oldDay = displayedForecast.today;
  const hourKey = current?.timestamp ?? Math.floor(timestamp / 3600);
  if (!newForecast && !unitsChanged && hourKey === displayedHour && oldDay === today) return;
  displayedHour = hourKey;
  displayedForecast.today = today;
  const selectionExpired = Boolean(selectedDay && today && selectedDay < today);
  if (selectionExpired) selectedDay = undefined;
  const start = current?.timestamp ?? timestamp;
  displayedForecast.upcoming = samples.filter((sample) =>
    sample.timestamp >= start && sample.timestamp < start + 24 * 3600);
  displayHourly(displayedForecast.upcoming, current?.timestamp);
  const tomorrow = today ? new Date(Date.parse(today + "T00:00:00Z") + 86400000).toISOString().slice(0, 10) : undefined;
  const dayIndex = Array.isArray(daily?.time) && today ? daily.time.indexOf(today) : -1;
  displayPercentage(".precipitation", daily?.precipitation_probability_max?.[dayIndex]);
  weatherPanel.querySelector(".uv-index").textContent = formatReading(daily?.uv_index_max?.[dayIndex], "");
  weatherPanel.querySelector(".uv-hourly").textContent = formatReading(current?.uv_index, "");
  weatherPanel.querySelector(".sunrise").textContent = getLocalTime(daily?.sunrise?.[dayIndex]);
  weatherPanel.querySelector(".sunset").textContent = getLocalTime(daily?.sunset?.[dayIndex]);
  weatherPanel.querySelector(".temperature-max").textContent = formatReading(daily?.temperature_2m_max?.[dayIndex], " °C");
  weatherPanel.querySelector(".temperature-min").textContent = formatReading(daily?.temperature_2m_min?.[dayIndex], " °C");
  if (newForecast || unitsChanged || oldDay !== today) displayForecast(daily, today, tomorrow);
  if (newForecast || unitsChanged || oldDay !== today || !selectedDay) {
    selectForecastDay(selectedDay, !unitsChanged || oldDay !== today || selectionExpired);
  }
}

async function loadWeather(resolveLocation, {
  loadingMessage = "Carregando dados meteorológicos…", remember = false, recordSearch = false,
} = {}) {
  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  setWeatherStatus("loading", loadingMessage);

  try {
    const location = await resolveLocation(request.signal);
    if (request.signal.aborted || !location) return;
    setWeatherStatus("loading", "Carregando dados meteorológicos…");

    const forecast = await fetchForecast(location, request.signal);
    if (request.signal.aborted) return;
    if (!forecast.available) {
      setWeatherStatus("empty", "Não há dados meteorológicos disponíveis para esta cidade." +
        (selectedLocation ? " Exibindo a última previsão carregada." : ""));
      return;
    }
    displayWeather(location, forecast);
    selectedLocation = location;
    cityDirectory.setCurrent(location, remember, recordSearch);
    setWeatherStatus("ready");
    if (window.location.hash === "#graficos" &&
        [document.body, statusMessage].includes(document.activeElement)) {
      document.querySelector("#graficos").focus();
    }
    showActiveEnvironment();
  } catch {
    if (!request.signal.aborted) {
      setWeatherStatus("error",
        "Não foi possível carregar os dados meteorológicos. Verifique sua conexão e tente novamente." +
        (selectedLocation ? " Exibindo os dados da última consulta bem-sucedida." : ""));
    }
  } finally {
    if (activeRequest === request) activeRequest = undefined;
  }
}

async function fetchLocations(city, signal) {
  if (signal.aborted) throw signal.reason;
  const name = city.trim().normalize("NFC");
  const key = name.toLocaleLowerCase("pt-BR");
  const cached = locationCache.get(key);
  if (cached && Date.now() - cached.time < 5 * 60 * 1000) return cached.results;
  let pending = pendingLocations.get(key);
  if (!pending || pending.controller.signal.aborted) {
    const controller = new AbortController();
    pending = { controller, consumers: new Set() };
    pendingLocations.set(key, pending);
    pending.result = fetchJson("https://geocoding-api.open-meteo.com/v1/search", {
      name, count: 8, language: "pt",
    }, controller.signal).then(({ results }) => {
      const cities = uniqueCities(results);
      if (!controller.signal.aborted) {
        locationCache.delete(key);
        locationCache.set(key, { time: Date.now(), results: cities });
        if (locationCache.size > 50) locationCache.delete(locationCache.keys().next().value);
      }
      return cities;
    }).finally(() => {
      if (pendingLocations.get(key) === pending) pendingLocations.delete(key);
    });
  }
  return new Promise((resolve, reject) => {
    const consumer = {};
    pending.consumers.add(consumer);
    const release = () => {
      signal.removeEventListener("abort", abort);
      pending.consumers.delete(consumer);
    };
    const abort = () => {
      release();
      if (!pending.consumers.size) pending.controller.abort();
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    pending.result.then((results) => {
      release();
      resolve(results);
    }, (error) => {
      release();
      reject(error);
    });
  });
}

function searchWeather(city, cached, remember = true) {
  if (city.length < 2) {
    activeRequest?.abort();
    setWeatherStatus("error", "Digite pelo menos duas letras do nome da cidade.");
    return;
  }
  return loadWeather(async (signal) => {
    try {
      const results = cached ?? await fetchLocations(city, signal);
      if (signal.aborted) return;
      if (!results.length) {
        setWeatherStatus("empty", "Cidade não encontrada. Confira o nome e tente novamente.");
        return;
      }
      searchInput.value = results[0].name;
      return results[0];
    } catch {
      if (!signal.aborted) {
        setWeatherStatus("error", "Não foi possível buscar cidades. Verifique a conexão e tente novamente.");
      }
    }
  }, { loadingMessage: "Buscando cidade…", remember, recordSearch: remember });
}

function selectCity(location, recordSearch) {
  searchInput.value = location.name;
  if (window.location.hash === "#favoritos") {
    window.location.hash = "#painel";
    document.querySelector("#painel").focus();
  }
  return loadWeather(() => location, { remember: true, recordSearch });
}

function locateUser(signal) {
  if (!navigator.geolocation) {
    setWeatherStatus("error", "A localização não está disponível neste navegador. Busque pelo nome da cidade.");
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      resolve({ name: "Minha localização", latitude: coords.latitude, longitude: coords.longitude });
    }, (error) => {
      if (!signal.aborted) {
        setWeatherStatus("error", error.code === 1
          ? "A permissão de localização foi negada. Libere o acesso no navegador ou busque pelo nome da cidade."
          : "Não foi possível obter sua localização. Tente novamente ou busque pelo nome da cidade.");
      }
      resolve(null);
    }, { timeout: 10000 });
  });
}

const cityDirectory = new CityDirectory(searchForm, fetchLocations, searchWeather, selectCity);
const comparePanel = document.querySelector("#comparar");
const comparison = new WeatherComparison(comparePanel, { fetchLocations, fetchForecast, describeWeather, formatReading });
const mapPanel = document.querySelector("#mapas");
const airPanel = document.querySelector("#qualidade-do-ar");
const weatherMap = new WeatherMap(mapPanel, { fetchJson, describeWeather, formatReading });
const airQuality = new AirQuality(airPanel, { fetchJson, formatReading });

if (isCity(storedPreferences?.defaultCity)) preferences.defaultCity = storedPreferences.defaultCity;
const settingsFeedback = settingsPanel.querySelector(".settings-feedback");
const themeSelect = document.querySelector("#theme-preference");
const defaultCityForm = settingsPanel.querySelector(".default-city-search");
const resetDefaultCity = settingsPanel.querySelector(".reset-default-city");
let defaultCityRequest;

function persistSettings(message) {
  settingsFeedback.textContent = savePreferences()
    ? message : "Preferência aplicada nesta visita. Não foi possível salvá-la no navegador.";
}

function updateWeatherUnits() {
  if (displayedWeather) {
    displayCurrentWeather(displayedWeather.location, displayedWeather.current);
    displayDailyMetrics(new Date(), false, true);
    chart.refresh();
  }
  comparison.update({ preserveHour: true });
  if (weatherMap.pointWeather) weatherMap.renderPointWeather();
}

for (const [key, control] of [
  ["temperature", document.querySelector("#temperature-unit")],
  ["wind", document.querySelector("#wind-unit")],
  ["theme", themeSelect],
]) {
  control.value = preferences[key];
  control.addEventListener("change", () => {
    if (!preferenceOptions[key].includes(control.value)) return;
    preferences[key] = control.value;
    if (key === "theme") applyTheme();
    else updateWeatherUnits();
    persistSettings("Preferência salva.");
  });
}
applyTheme();
document.querySelector(".theme-button").addEventListener("click", () => {
  themeSelect.value = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  themeSelect.dispatchEvent(new Event("change"));
});

function renderDefaultCity() {
  const city = preferences.defaultCity;
  settingsPanel.querySelector(".default-city-label").textContent = city
    ? [city.name, cityRegion(city)].filter(Boolean).join(" · ")
    : "Última cidade consultada. Na primeira visita, Denver.";
  resetDefaultCity.disabled = !city;
}

function setDefaultCity(city) {
  defaultCityRequest?.abort();
  if (!isCity(city)) {
    settingsFeedback.textContent = "Cidade não encontrada. Confira o nome e tente novamente.";
    return;
  }
  preferences.defaultCity = city;
  defaultCityForm.querySelector("input").value = "";
  renderDefaultCity();
  persistSettings(city.name + " será aberta ao iniciar o ATMOS.");
}

new CitySearch(defaultCityForm, fetchLocations, async (query, cached) => {
  defaultCityRequest?.abort();
  if (query.length < 2) {
    settingsFeedback.textContent = "Digite pelo menos duas letras do nome da cidade.";
    return;
  }
  const request = new AbortController();
  defaultCityRequest = request;
  settingsFeedback.textContent = "Buscando cidade…";
  try {
    const results = cached ?? await fetchLocations(query, request.signal);
    if (!request.signal.aborted) setDefaultCity(results[0]);
  } catch {
    if (!request.signal.aborted) settingsFeedback.textContent = "Não foi possível buscar a cidade. Tente novamente.";
  }
}, setDefaultCity);
defaultCityForm.querySelector("input").addEventListener("input", () => {
  defaultCityRequest?.abort();
  settingsFeedback.textContent = "";
});
resetDefaultCity.addEventListener("click", () => {
  defaultCityRequest?.abort();
  delete preferences.defaultCity;
  renderDefaultCity();
  defaultCityForm.querySelector("input").focus();
  persistSettings("A última cidade consultada será aberta ao iniciar o ATMOS.");
});
renderDefaultCity();

function showActiveEnvironment() {
  if (!mapPanel.hidden) weatherMap.show(selectedLocation);
  if (!airPanel.hidden) airQuality.show(selectedLocation);
}
document.querySelector(".location-button").addEventListener("click", () => {
  cityDirectory.close();
  loadWeather(locateUser, { loadingMessage: "Obtendo sua localização…" });
});
refreshButton.addEventListener("click", () => {
  if (selectedLocation) loadWeather(() => selectedLocation);
  else if (searchInput.value.trim()) searchWeather(searchInput.value.trim());
  else loadDefaultCity();
});

const layout = document.querySelector(".layout");
const sidebarToggle = document.querySelector(".sidebar-toggle");
const sidebar = document.querySelector(".sidebar");
const sectionLinks = sidebar.querySelectorAll("nav a");
const mobileViewport = matchMedia("(max-width: 720px)");

function setMenuCollapsed(collapsed) {
  layout.classList.toggle("menu-collapsed", collapsed);
  const label = collapsed ? "Expandir menu" : "Recolher menu";
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", label);
  sidebarToggle.title = label;
}
setMenuCollapsed(mobileViewport.matches);
mobileViewport.addEventListener("change", (event) => setMenuCollapsed(event.matches));
sidebarToggle.addEventListener("click", () => {
  setMenuCollapsed(!layout.classList.contains("menu-collapsed"));
});
sidebar.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && mobileViewport.matches && !layout.classList.contains("menu-collapsed")) {
    setMenuCollapsed(true);
    sidebarToggle.focus();
  }
});
for (const link of sectionLinks) {
  link.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (mobileViewport.matches) setMenuCollapsed(true);
    if (location.hash === link.hash) {
      event.preventDefault();
      updateCurrentSection();
    }
  });
}

document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  document.querySelector("main").focus();
});

function updateCurrentSection() {
  const target = [...sectionLinks].some((link) => link.hash === location.hash) ? location.hash : "#painel";
  const library = document.querySelector("#favoritos");
  const comparing = target === "#comparar";
  comparePanel.hidden = !comparing;
  mapPanel.hidden = target !== "#mapas";
  airPanel.hidden = target !== "#qualidade-do-ar";
  calendarPanel.hidden = target !== "#calendario";
  settingsPanel.hidden = target !== "#configuracoes";
  document.querySelector(".main-dashboard").hidden = comparing || !mapPanel.hidden || !airPanel.hidden ||
    !calendarPanel.hidden || !settingsPanel.hidden;
  document.querySelector(".main").classList.toggle("show-comparison", comparing);
  library.hidden = target !== "#favoritos";
  if (!library.hidden) library.focus();
  if (comparing) comparePanel.focus();
  if (!mapPanel.hidden) mapPanel.focus();
  if (!airPanel.hidden) airPanel.focus();
  if (!calendarPanel.hidden) calendarPanel.focus();
  if (!settingsPanel.hidden) settingsPanel.focus();
  if (target === "#graficos") (weatherPanel.hidden ? statusMessage : document.querySelector("#graficos")).focus();
  if (target === "#painel" && location.hash === target) document.querySelector("#painel").focus();
  showActiveEnvironment();
  for (const link of sectionLinks) {
    if (link.hash === target) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", updateCurrentSection);
updateCurrentSection();

function loadDefaultCity() {
  const saved = preferences.defaultCity ?? cityDirectory.state.last;
  if (saved) {
    searchInput.value = saved.name;
    return loadWeather(() => saved);
  }
  return searchWeather("Denver", undefined, false);
}

loadDefaultCity();
setInterval(() => {
  if (!clockFormat || !displayedForecast) return;
  const now = new Date();
  updateClock(now);
  displayDailyMetrics(now);
}, 15000);
