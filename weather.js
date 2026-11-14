// Unit toggle state
let useCelsius = false;
let lastCity = '';
let lastPeriods = null;

function toC(f) {
  return Math.round((f - 32) * 5 / 9);
}

function formatTemp(f) {
  return useCelsius ? `${toC(f)}°C` : `${f}°F`;
}

function getIcon(shortForecast) {
  const s = shortForecast.toLowerCase();
  if (s.includes('thunder'))                       return '⛈️';
  if (s.includes('snow'))                          return '❄️';
  if (s.includes('rain') || s.includes('shower'))  return '🌧️';
  if (s.includes('partly'))                        return '⛅';
  if (s.includes('cloud'))                         return '☁️';
  if (s.includes('sunny') || s.includes('clear'))  return '☀️';
  return '🌡️';
}

function el(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function labeledLine(label, value) {
  const p = el('p');
  p.appendChild(el('strong', label));
  p.appendChild(document.createTextNode(` ${value}`));
  return p;
}

function showError(msg) {
  document.getElementById('error-display').textContent = msg;
  document.getElementById('weather-display').innerHTML = '';
}

function clearDisplays() {
  document.getElementById('weather-display').innerHTML = '';
  document.getElementById('error-display').innerHTML = '';
}

function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out.')), ms)
  );
}

async function geocode(city) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&countrycodes=us&format=json`;
    const response = await Promise.race([fetch(url, { headers: { 'User-Agent': 'WeatherApp/1.0' } }), timeout(10000)]);
    const result = await response.json();
    if (!result || result.length === 0) {
      throw new Error('City not found. Please try a different city name.');
    }
    const lat = parseFloat(result[0].lat);
    const lon = parseFloat(result[0].lon);
    return { lat, lon };
  } catch (err) {
    if (err.message === 'City not found. Please try a different city name.') {
      throw err;
    }
    throw new Error('Geocoding failed. Check your connection and try again.');
  }
}

async function getNWSPoints(lat, lon) {
  try {
    const latStr = lat.toFixed(4);
    const lonStr = lon.toFixed(4);
    const url = `https://api.weather.gov/points/${latStr},${lonStr}`;
    const response = await Promise.race([fetch(url), timeout(10000)]);
    if (!response.ok) {
      throw new Error('Could not retrieve weather grid for that location.');
    }
    const data = await response.json();
    if (!data.properties || !data.properties.forecast) {
      throw new Error('Could not retrieve weather grid for that location.');
    }
    // Only follow the forecast URL if it stays on the NWS API over HTTPS.
    const forecastUrl = new URL(data.properties.forecast, 'https://api.weather.gov');
    if (forecastUrl.protocol !== 'https:' || forecastUrl.hostname !== 'api.weather.gov') {
      throw new Error('Could not retrieve weather grid for that location.');
    }
    return forecastUrl.href;
  } catch (err) {
    if (err.message === 'Could not retrieve weather grid for that location.') {
      throw err;
    }
    throw new Error('Weather grid lookup failed. Check your connection and try again.');
  }
}

async function getForecast(forecastUrl) {
  try {
    const response = await Promise.race([fetch(forecastUrl), timeout(10000)]);
    if (!response.ok) {
      throw new Error('Forecast data unavailable for that location.');
    }
    const data = await response.json();
    if (!data.properties || !data.properties.periods || data.properties.periods.length === 0) {
      throw new Error('Forecast data unavailable for that location.');
    }
    const daytimePeriods = data.properties.periods
      .filter(period => period.isDaytime === true)
      .slice(0, 5);
    return daytimePeriods;
  } catch (err) {
    if (err.message === 'Forecast data unavailable for that location.') {
      throw err;
    }
    throw new Error('Forecast fetch failed. Check your connection and try again.');
  }
}

function renderWeather(city, periods) {
  lastCity = city;
  lastPeriods = periods;

  const display = document.getElementById('weather-display');
  const current = periods[0];
  const icon = getIcon(current.shortForecast);
  const unit = useCelsius ? '°C' : '°F';

  // All text is set with textContent so user and API data are never parsed as HTML.
  // Current conditions block
  const box = el('div');
  box.className = 'current-conditions';
  box.appendChild(el('h2', `${icon} ${city}`));
  box.appendChild(labeledLine('Temperature:', formatTemp(current.temperature)));
  box.appendChild(labeledLine('Conditions:', current.shortForecast));
  box.appendChild(labeledLine('Wind:', `${current.windSpeed} ${current.windDirection}`));

  // Forecast table
  const table = el('table');
  const headRow = el('tr');
  for (const label of ['Day', 'Icon', `High ${unit}`, 'Forecast']) {
    headRow.appendChild(el('th', label));
  }
  table.appendChild(el('thead')).appendChild(headRow);

  const tbody = el('tbody');
  for (const period of periods) {
    const row = el('tr');
    row.appendChild(el('td', period.name));
    row.appendChild(el('td', getIcon(period.shortForecast)));
    row.appendChild(el('td', formatTemp(period.temperature)));
    row.appendChild(el('td', period.shortForecast));
    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  display.replaceChildren(box, table);

  // Show the toggle button now that we have results
  document.getElementById('unit-toggle').style.display = 'inline-block';
}

async function getWeather() {
  const city = document.getElementById('city-input').value.trim();
  if (city === '') {
    showError('Please enter a city name.');
    return;
  }

  clearDisplays();

  try {
    const { lat, lon } = await geocode(city);
    const forecastUrl = await getNWSPoints(lat, lon);
    const periods = await getForecast(forecastUrl);
    renderWeather(city, periods);
  } catch (error) {
    showError(error.message);
  }
}

document.getElementById('submit-btn').addEventListener('click', getWeather);
document.getElementById('city-input').addEventListener('keydown', e => { if (e.key === 'Enter') getWeather(); });
document.getElementById('unit-toggle').addEventListener('click', () => {
  useCelsius = !useCelsius;
  document.getElementById('unit-toggle').textContent = useCelsius ? 'Switch to °F' : 'Switch to °C';
  if (lastPeriods) renderWeather(lastCity, lastPeriods);
});
