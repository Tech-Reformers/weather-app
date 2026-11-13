# Weather App

A small browser app that shows a 5-day forecast for a U.S. city. It uses plain HTML and JavaScript, with no build step, dependencies, or framework.

## Features

- Enter a U.S. city name and press **Get Weather** or the Enter key.
- Current conditions: temperature, short forecast, and wind.
- 5-day forecast table (daytime periods only) with emoji icons.
- Toggle between °F and °C without refetching data.
- Error messages for empty input, unknown cities, network failures, and 10-second timeouts.

## How it works

1. **Geocoding:** the city name is sent to [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap), restricted to `countrycodes=us`. Nominatim is used because it avoids CORS errors, and the request carries a `User-Agent` header (`WeatherApp/1.0`).
2. **Grid lookup:** the latitude and longitude go to the [National Weather Service API](https://www.weather.gov/documentation/services-web-api) (`/points/{lat},{lon}`), which returns a forecast URL.
3. **Forecast:** the forecast URL is fetched, filtered to daytime periods, and the first five are rendered.

City names are never hardcoded. Whatever the user types is passed to the geocoder.

## Requirements

- A modern web browser
- Internet access
- Windows PowerShell (only to run the included local server)

## Running the app

From the project folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-server.ps1
```

Then open <http://localhost:8080>. The script exits with an error if port 8080 is already in use. Stop the server with Ctrl+C.

The server serves only `index.html` and `weather.js`. Any other path returns 404.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page markup and styles |
| `weather.js` | Geocoding, NWS requests, rendering, unit toggle |
| `start-server.ps1` | Local HTTP server on `localhost:8080` |
| `test-bug-condition.js` | Checks that `geocode()` sends the `User-Agent` header |
| `test-preservation.js` | Checks that `geocode()` error messages are unchanged |

## Tests

The tests are basic Node scripts with mocked `fetch`. Run them from the project folder:

```bash
node --check weather.js
node test-bug-condition.js
node test-preservation.js
```

## Limitations

- U.S. locations only, since the NWS API covers the U.S.
- Only the first Nominatim match is used, so ambiguous names (for example "Springfield") may resolve to an unexpected city.
- No caching. Each search makes three network requests.
- The "High" column shows the daytime temperature reported by the NWS.
