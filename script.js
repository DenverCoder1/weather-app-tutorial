const searchForm = document.querySelector(".search");
const searchInput = document.querySelector(".search-bar");
const weatherPanel = document.querySelector(".weather");
const statusMessage = document.querySelector(".status");
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

let activeRequest;

async function fetchJson(endpoint, params, signal) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams(params);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Falha na consulta à Open-Meteo");
  return response.json();
}

function displayWeather(location, current) {
  const { temperature_2m, relative_humidity_2m, wind_speed_10m, weather_code, is_day } = current;
  if (![temperature_2m, relative_humidity_2m, wind_speed_10m, weather_code].every(Number.isFinite)) {
    throw new Error("Dados meteorológicos incompletos");
  }

  const [description, icon] = weather_code === 0
    ? ["Céu limpo", is_day ? "☀️" : "🌙"]
    : conditions.get(weather_code) ?? ["Condição indisponível", "—"];
  const place = [location.name, location.admin1, location.country]
    .filter(Boolean)
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(", ");

  weatherPanel.querySelector(".city").textContent = "Tempo em " + place;
  weatherPanel.querySelector(".icon").textContent = icon;
  weatherPanel.querySelector(".description").textContent = description;
  weatherPanel.querySelector(".temp").textContent = numberFormat.format(temperature_2m) + " °C";
  weatherPanel.querySelector(".humidity").textContent =
    "Umidade: " + numberFormat.format(relative_humidity_2m) + "%";
  weatherPanel.querySelector(".wind").textContent =
    "Velocidade do vento: " + numberFormat.format(wind_speed_10m) + " km/h";
  document.body.dataset.sky = is_day === 0 ? "night" : weather_code <= 2 ? "clear" : "cloudy";
  weatherPanel.hidden = false;
}

async function searchWeather(city) {
  activeRequest?.abort();
  if (city.length < 2) {
    statusMessage.textContent = "Digite pelo menos duas letras do nome da cidade.";
    return;
  }

  const request = new AbortController();
  activeRequest = request;
  statusMessage.textContent = "Carregando dados meteorológicos…";

  try {
    const { results } = await fetchJson("https://geocoding-api.open-meteo.com/v1/search", {
      name: city,
      count: 1,
      language: "pt",
    }, request.signal);
    if (request.signal.aborted) return;
    const location = results?.[0];
    if (!location) {
      statusMessage.textContent = "Cidade não encontrada. Confira o nome e tente novamente.";
      return;
    }

    const { current } = await fetchJson("https://api.open-meteo.com/v1/forecast", {
      latitude: location.latitude,
      longitude: location.longitude,
      current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
    }, request.signal);
    if (request.signal.aborted) return;
    displayWeather(location, current);
    statusMessage.textContent = "";
  } catch {
    if (!request.signal.aborted) {
      statusMessage.textContent =
        "Não foi possível carregar os dados meteorológicos. Verifique sua conexão e tente novamente.";
    }
  } finally {
    if (activeRequest === request) activeRequest = undefined;
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchWeather(searchInput.value.trim());
});

searchWeather("Denver");
