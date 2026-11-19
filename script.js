const searchForm = document.querySelector(".search");
const searchInput = document.querySelector(".search-bar");
const weatherPanel = document.querySelector(".weather");
const statusMessage = document.querySelector(".status");
const skeleton = document.querySelector(".skeleton");
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const conditions = new Map();
for (const [codes, description, icon] of [
  [[1], "Predominantemente limpo", "🌤️"],
  [[2], "Parcialmente nublado", "⛅"],
  [[3], "Encoberto", "☁️"],
  [[45, 48], "Neblina", "🌫️"],
  [[51, 53, 55], "Garoa", "🌦️"],
  [[56, 57], "Garoa congelante", "🌧️"],
  [[61, 63, 65], "Chuva", "🌧️"],
  [[66, 67], "Chuva congelante", "🌧️"],
  [[71, 73, 75, 77], "Neve", "🌨️"],
  [[80, 81, 82], "Pancadas de chuva", "🌧️"],
  [[85, 86], "Pancadas de neve", "🌨️"],
  [[95], "Trovoadas", "⛈️"],
  [[96, 99], "Trovoadas com granizo", "⛈️"],
]) {
  for (const code of codes) conditions.set(code, [description, icon]);
}

const forecastList = document.querySelector(".forecast-list");
const forecastStatus = document.querySelector(".forecast-status");
const forecastDetail = document.querySelector(".forecast-detail");
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

function setWeatherStatus(state, message = "") {
  const loading = state === "loading";
  statusMessage.dataset.state = state;
  statusMessage.textContent = message;
  skeleton.hidden = !loading || !weatherPanel.hidden;
  weatherPanel.setAttribute("aria-busy", String(loading));
}

function describeWeather(code, isDay = true) {
  if (code === 0) return ["Céu limpo", isDay ? "☀️" : "🌙"];
  if (!isDay && code === 1) return ["Predominantemente limpo", "🌙"];
  if (!isDay && code === 2) return ["Parcialmente nublado", "☁️"];
  return conditions.get(code) ?? ["Condição indisponível", "—"];
}

function formatReading(value, unit) {
  return Number.isFinite(value) ? numberFormat.format(value) + unit : "Indisponível";
}

function configureClock(timezone) {
  clockFormat = undefined;
  localHourFormat = undefined;
  if (timezone) {
    try {
      clockFormat = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "full", timeStyle: "short", hourCycle: "h23", timeZone: timezone,
      });
      localHourFormat = new Intl.DateTimeFormat("sv-SE", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
        minute: "2-digit", hourCycle: "h23", timeZone: timezone,
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
  if (!localHourFormat || !Number.isFinite(timestamp)) return {};
  const parts = Object.fromEntries(localHourFormat.formatToParts(timestamp * 1000)
    .map(({ type, value }) => [type, value]));
  return { day: parts.year + "-" + parts.month + "-" + parts.day, time: parts.hour + ":" + parts.minute };
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
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Falha na consulta à Open-Meteo");
  return response.json();
}

function fetchForecast(location, signal, forecastDays = 7) {
  return fetchJson("https://api.open-meteo.com/v1/forecast", {
    latitude: location.latitude,
    longitude: location.longitude,
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day,apparent_temperature,cloud_cover,wind_direction_10m,wind_gusts_10m,precipitation,surface_pressure",
    hourly: "uv_index,temperature_2m,weather_code,is_day,precipitation_probability,wind_speed_10m,relative_humidity_2m,cloud_cover",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset",
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: forecastDays,
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  }, signal);
}

function displayForecast(daily, today, tomorrow) {
  const rows = [];
  const days = Array.isArray(daily?.time) ? daily.time : [];
  for (const [index, day] of days.entries()) {
    const date = new Date(day + "T00:00:00Z");
    if (!Number.isFinite(date.getTime())) continue;

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
    button.addEventListener("click", () => selectForecastDay(day));

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
    high.textContent = formatReading(maximum, "°");
    high.title = "Máxima";
    low.textContent = formatReading(minimum, "°");
    low.title = "Mínima";
    row.querySelector(".forecast-temps").setAttribute("aria-label",
      "Máxima: " + formatReading(maximum, " °C") + ". Mínima: " + formatReading(minimum, " °C") + ".");
    const rain = formatReading(daily.precipitation_probability_max?.[index], "%");
    row.querySelector(".forecast-rain").textContent = "Precip.: " + rain;
    rows.push(row);
  }
  forecastList.replaceChildren(...rows);
  forecastStatus.hidden = rows.length > 0;
}

function makeHourlySamples(hourly) {
  if (!Array.isArray(hourly?.time)) return [];
  return hourly.time.flatMap((timestamp, index) => {
    const { day, time } = getLocalParts(timestamp);
    if (!day) return [];
    const date = new Date(day + "T00:00:00Z");
    return [{
      timestamp, day, time, label: shortDateFormat.format(date) + " às " + time,
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
}

function displayHourly(samples, currentHour) {
  const rows = samples.map((sample, index) => {
    const row = document.createElement("li");
    row.innerHTML = '<time></time><span class="hourly-icon" role="img"></span>' +
      '<strong></strong><span class="hourly-rain"></span>';
    if (sample.timestamp === currentHour) row.setAttribute("aria-current", "time");
    const time = row.querySelector("time");
    time.dateTime = new Date(sample.timestamp * 1000).toISOString();
    time.textContent = sample.timestamp === currentHour ? "Agora · " + sample.time : sample.time;
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
  hourlyList.replaceChildren(...rows);
  hourlyList.hidden = rows.length === 0;
  hourlyStatus.hidden = rows.length === 24;
  hourlyStatus.textContent = rows.length
    ? "Previsão disponível para " + rows.length + " das próximas 24 horas."
    : "Previsão horária indisponível.";
}

function selectForecastDay(day) {
  selectedDay = day;
  const { daily, samples, upcoming } = displayedForecast;
  const index = day ? daily.time.indexOf(day) : -1;
  for (const button of forecastList.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.day === day));
  }
  forecastDetail.hidden = index < 0;
  chartReset.disabled = index < 0;
  if (index < 0) {
    chart.setSamples(upcoming, "Próximas 24 horas · horário local");
    return;
  }
  const date = new Date(day + "T00:00:00Z");
  const label = weekdayFormat.format(date) + ", " + shortDateFormat.format(date);
  const [description] = describeWeather(daily.weather_code?.[index]);
  forecastDetail.querySelector("h3").textContent = label;
  forecastDetail.querySelector(".forecast-detail-summary").textContent = description + " · " +
    "Máxima: " + formatReading(daily.temperature_2m_max?.[index], " °C") + " · " +
    "Mínima: " + formatReading(daily.temperature_2m_min?.[index], " °C") + " · " +
    "Chance máxima de precipitação: " + formatReading(daily.precipitation_probability_max?.[index], "%");
  forecastDetail.querySelector(".forecast-detail-extra").textContent =
    "Nascer do sol: " + getLocalTime(daily.sunrise?.[index]) + " · " +
    "Pôr do sol: " + getLocalTime(daily.sunset?.[index]) + " · " +
    "Índice UV máximo: " + formatReading(daily.uv_index_max?.[index], "");
  chart.setSamples(samples.filter((sample) => sample.day === day), label + " · horário local");
}

chartReset.addEventListener("click", () => selectForecastDay(undefined));

function displayWeather(location, { current = {}, daily, hourly, timezone, utc_offset_seconds }) {
  current ??= {};
  if (!Object.keys(current).some((key) => key !== "interval" && key !== "is_day" && Number.isFinite(current[key]))
      && !daily?.time?.length && !hourly?.time?.length) {
    throw new Error("Dados meteorológicos incompletos");
  }

  configureClock(timezone ?? location.timezone);
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
  temperature.classList.toggle("reading-unavailable", !Number.isFinite(temperature_2m));
  if (Number.isFinite(temperature_2m)) {
    const unit = document.createElement("span");
    unit.textContent = " °C";
    temperature.replaceChildren(numberFormat.format(temperature_2m), unit);
  } else {
    temperature.textContent = "Temperatura indisponível";
  }
  weatherPanel.querySelector(".feels-like").textContent =
    "Sensação térmica: " + formatReading(current.apparent_temperature, " °C");
  const observationTime = getLocalTime(current.time);
  weatherPanel.querySelector(".observation-time").textContent = observationTime === "Indisponível"
    ? "Horário dos dados atuais indisponível."
    : "Dados das " + observationTime + " (horário local)";
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

  // A data diária usa o deslocamento informado pela API. As horas usam o fuso IANA.
  const days = Array.isArray(daily?.time) ? daily.time.map((timestamp) => {
    if (!Number.isFinite(timestamp)) return null;
    return Number.isFinite(utc_offset_seconds)
      ? new Date((timestamp + utc_offset_seconds) * 1000).toISOString().slice(0, 10)
      : getLocalParts(timestamp).day;
  }) : [];
  const sameLocation = location === selectedLocation || (isCity(location) && location.id === selectedLocation?.id);
  if (!sameLocation || !days.includes(selectedDay)) selectedDay = undefined;
  displayedForecast = { daily: { ...daily, time: days }, samples: makeHourlySamples(hourly) };
  const now = new Date();
  updateClock(now);
  weatherPanel.hidden = false;
  displayDailyMetrics(now, true);
}

function displayDailyMetrics(now, newForecast = false) {
  const { daily, samples } = displayedForecast;
  const timestamp = now.getTime() / 1000;
  const current = samples.findLast((sample) => sample.timestamp <= timestamp && timestamp - sample.timestamp < 3600);
  const today = getLocalParts(timestamp).day;
  const oldDay = displayedForecast.today;
  const hourKey = current?.timestamp ?? today;
  if (!newForecast && hourKey === displayedHour && oldDay === today) return;
  displayedHour = hourKey;
  displayedForecast.today = today;
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
  if (newForecast || oldDay !== today) displayForecast(daily, today, tomorrow);
  if (newForecast || !selectedDay) selectForecastDay(selectedDay);
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
    displayWeather(location, forecast);
    selectedLocation = location;
    cityDirectory.setCurrent(location, remember, recordSearch);
    setWeatherStatus("ready");
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
  const { results } = await fetchJson("https://geocoding-api.open-meteo.com/v1/search", {
    name: city,
    count: 8,
    language: "pt",
  }, signal);
  if (!Array.isArray(results)) return [];
  const ids = new Set();
  return results.filter((location) => {
    if (typeof location?.name !== "string" || !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude) || ids.has(location.id)) return false;
    if (Number.isInteger(location.id)) ids.add(location.id);
    return true;
  });
}

function searchWeather(city, cached, remember = true) {
  if (city.length < 2) {
    activeRequest?.abort();
    setWeatherStatus("error", "Digite pelo menos duas letras do nome da cidade.");
    return;
  }
  return loadWeather(async (signal) => {
    const results = cached ?? await fetchLocations(city, signal);
    if (!signal.aborted && !results.length) {
      setWeatherStatus("empty", "Cidade não encontrada. Confira o nome e tente novamente.");
    }
    return results[0];
  }, { remember, recordSearch: remember });
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
new WeatherComparison(comparePanel, { fetchLocations, fetchForecast, describeWeather, formatReading });
const mapPanel = document.querySelector("#mapas");
const airPanel = document.querySelector("#qualidade-do-ar");
const weatherMap = new WeatherMap(mapPanel, { fetchJson, describeWeather, formatReading });
const airQuality = new AirQuality(airPanel, { fetchJson, formatReading });

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
  link.addEventListener("click", () => {
    if (mobileViewport.matches) setMenuCollapsed(true);
  });
}

function updateCurrentSection() {
  const target = ["#graficos", "#favoritos", "#comparar", "#mapas", "#qualidade-do-ar"].includes(location.hash)
    ? location.hash : "#painel";
  const library = document.querySelector("#favoritos");
  const comparing = target === "#comparar";
  comparePanel.hidden = !comparing;
  mapPanel.hidden = target !== "#mapas";
  airPanel.hidden = target !== "#qualidade-do-ar";
  document.querySelector(".main-dashboard").hidden = comparing || !mapPanel.hidden || !airPanel.hidden;
  document.querySelector(".main").classList.toggle("show-comparison", comparing);
  library.hidden = target !== "#favoritos";
  if (!library.hidden) library.focus();
  if (comparing) comparePanel.focus();
  if (!mapPanel.hidden) mapPanel.focus();
  if (!airPanel.hidden) airPanel.focus();
  showActiveEnvironment();
  for (const link of sectionLinks) {
    if (link.hash === target) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", updateCurrentSection);
updateCurrentSection();

function loadDefaultCity() {
  const saved = cityDirectory.state.last;
  if (saved) return loadWeather(() => saved);
  return searchWeather("Denver", undefined, false);
}

loadDefaultCity();
setInterval(() => {
  if (!clockFormat || !displayedForecast) return;
  const now = new Date();
  updateClock(now);
  displayDailyMetrics(now);
}, 15000);
