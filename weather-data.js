const weatherFields = {
  current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day,apparent_temperature,cloud_cover,wind_direction_10m,wind_gusts_10m,precipitation,surface_pressure".split(","),
  hourly: "uv_index,temperature_2m,weather_code,is_day,precipitation_probability,wind_speed_10m,relative_humidity_2m,cloud_cover".split(","),
  daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset".split(","),
};

const conditions = new Map();
for (const [codes, description, icon] of [
  [[1], "Predominantemente limpo", "🌤️"],
  [[2], "Parcialmente nublado", "⛅"],
  [[3], "Encoberto", "☁️"],
  [[45], "Neblina", "🌫️"],
  [[48], "Neblina com formação de gelo", "🌫️"],
  [[51, 53, 55], "Garoa", "🌦️"],
  [[56, 57], "Garoa congelante", "🌧️"],
  [[61, 63, 65], "Chuva", "🌧️"],
  [[66, 67], "Chuva congelante", "🌧️"],
  [[71, 73, 75], "Neve", "🌨️"],
  [[77], "Grãos de neve", "🌨️"],
  [[80, 81, 82], "Pancadas de chuva", "🌧️"],
  [[85, 86], "Pancadas de neve", "🌨️"],
  [[95], "Trovoadas", "⛈️"],
  [[97], "Trovoadas fortes", "⛈️"],
  [[96, 99], "Trovoadas com granizo", "⛈️"],
]) {
  for (const code of codes) conditions.set(code, [description, icon]);
}

function describeWeather(code, isDay = true) {
  if (code === 0) return ["Céu limpo", isDay ? "☀️" : "🌙"];
  if (!isDay && code === 1) return ["Predominantemente limpo", "🌙"];
  if (!isDay && code === 2) return ["Parcialmente nublado", "☁️"];
  return conditions.get(code) ?? ["Condição indisponível", "—"];
}

const timestampLimit = Date.UTC(9999, 0, 1) / 1000;

function isTimestamp(value) {
  return Number.isSafeInteger(value) && value >= 0 && value < timestampLimit;
}

function timestampEntries(times) {
  const seen = new Set();
  if (!Array.isArray(times)) return [];
  return times.flatMap((time, index) => {
    if (!isTimestamp(time) || seen.has(time)) return [];
    seen.add(time);
    return [{ time, index }];
  }).sort((a, b) => a.time - b.time);
}

function validTimeZone(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate) continue;
    try {
      return new Intl.DateTimeFormat("pt-BR", { timeZone: candidate }).resolvedOptions().timeZone;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
}

function dailyDate(timestamp, offset, localDate) {
  // A API agrupa as previsões diárias pelo deslocamento fixo da resposta.
  if (!isTimestamp(timestamp)) return undefined;
  if (Number.isInteger(offset) && Math.abs(offset) < 86400 && isTimestamp(timestamp + offset)) {
    return new Date((timestamp + offset) * 1000).toISOString().split("T")[0];
  }
  return localDate(timestamp);
}

function fixedTimeZone(offset) {
  if (!Number.isInteger(offset) || Math.abs(offset) >= 86400 || offset % 60 !== 0) return undefined;
  const minutes = Math.abs(offset / 60);
  return (offset < 0 ? "-" : "+") + String(Math.floor(minutes / 60)).padStart(2, "0") +
    ":" + String(minutes % 60).padStart(2, "0");
}

function forecastValue(key, value) {
  if (!Number.isFinite(value)) return undefined;
  if (key === "sunrise" || key === "sunset") return isTimestamp(value) ? value : undefined;
  if (key === "weather_code") return value === 0 || conditions.has(value) ? value : undefined;
  if (key === "is_day") return value === 0 || value === 1 ? value : undefined;
  if (key.includes("temperature")) return value >= -273.15 ? value : undefined;
  if (value < 0) return undefined;
  if (key === "wind_direction_10m" && value > 360) return undefined;
  if ((key.includes("probability") || key === "relative_humidity_2m" || key === "cloud_cover") && value > 100) {
    return undefined;
  }
  return value;
}

function normalizeForecast(result, location) {
  const { current, utc_offset_seconds } = result;
  const normalized = {
    timezone: validTimeZone(result.timezone, location.timezone, fixedTimeZone(utc_offset_seconds)),
    utc_offset_seconds,
    current: {
      time: isTimestamp(current?.time) ? current.time : undefined,
      interval: Number.isInteger(current?.interval) && current.interval > 0 ? current.interval : undefined,
      ...Object.fromEntries(weatherFields.current.map((key) => [key, forecastValue(key, current?.[key])])),
    },
  };
  let available = weatherFields.current.some((key) => key !== "is_day" && normalized.current[key] !== undefined);
  for (const period of ["hourly", "daily"]) {
    const data = result[period];
    const keys = weatherFields[period];
    const rows = timestampEntries(data?.time).flatMap(({ time, index }) => {
      const values = Object.fromEntries(keys.map((key) =>
        [key, forecastValue(key, Array.isArray(data[key]) ? data[key][index] : undefined)]));
      if (values.temperature_2m_min > values.temperature_2m_max) {
        values.temperature_2m_min = undefined;
        values.temperature_2m_max = undefined;
      }
      return keys.some((key) => key !== "is_day" && values[key] !== undefined) ? [{ time, ...values }] : [];
    });
    normalized[period] = Object.fromEntries(["time", ...keys].map((key) =>
      [key, rows.map((row) => row[key])]));
    available ||= rows.length > 0;
  }
  return { ...normalized, available };
}
