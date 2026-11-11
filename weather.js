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

function showError(msg) {
  document.getElementById('error-display').innerHTML = msg;
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
    const response = await Promise.race([fetch(url), timeout(10000)]);
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
    return data.properties.forecast;
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
  const display = document.getElementById('weather-display');
  const current = periods[0];
  const icon = getIcon(current.shortForecast);

  // Current conditions block (Task 4.1)
  let html = `
    <div class="current-conditions">
      <h2>${icon} ${city}</h2>
      <p><strong>Temperature:</strong> ${current.temperature}°F</p>
      <p><strong>Conditions:</strong> ${current.shortForecast}</p>
      <p><strong>Wind:</strong> ${current.windSpeed} ${current.windDirection}</p>
    </div>
  `;

  // Forecast table (Task 4.2)
  html += `
    <table>
      <thead>
        <tr>
          <th>Day</th>
          <th>Icon</th>
          <th>High °F</th>
          <th>Forecast</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const period of periods) {
    html += `
        <tr>
          <td>${period.name}</td>
          <td>${getIcon(period.shortForecast)}</td>
          <td>${period.temperature}</td>
          <td>${period.shortForecast}</td>
        </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  display.innerHTML = html;
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
