# Implementation Plan: weather-app

## Overview

Build a plain HTML + JavaScript single-page weather app served by a PowerShell HTTP server. Implementation follows the sequential API pipeline: Nominatim geocoding → NWS Points → NWS Forecast. All logic lives in `weather.js`; `index.html` provides structure; `start-server.ps1` handles local serving.

No frameworks, no classes, no caching, no test framework. Verification is `node --check weather.js`.

---

## Tasks

- [x] 1. Create `index.html` with page structure and styling
  - [x] 1.1 Write `index.html` with City_Input, submit button, `#weather-display`, and `#error-display` divs
    - Add `<input type="text" id="city-input">` and `<button id="submit-btn">` elements
    - Add `<div id="weather-display"></div>` and `<div id="error-display"></div>` placeholder divs
    - Include minimal inline CSS for readable layout (centered content, legible font, table borders)
    - Load `weather.js` via `<script src="weather.js"></script>` at the bottom of `<body>`
    - _Requirements: 1.1, 5.3_

- [x] 2. Implement utility and display functions in `weather.js`
  - [x] 2.1 Implement `getIcon(shortForecast)` — pure emoji mapping function
    - Lowercase the input string and check keywords in priority order: thunder → ⛈️, snow → ❄️, rain/shower → 🌧️, partly → ⛅, cloud → ☁️, sunny/clear → ☀️, default → 🌡️
    - _Requirements: 4.2_
  - [x] 2.2 Implement `showError(message)` and `clearDisplays()`
    - `showError(msg)`: set `#error-display` innerHTML to `msg`, clear `#weather-display` innerHTML
    - `clearDisplays()`: set both `#weather-display` and `#error-display` innerHTML to empty string
    - _Requirements: 1.5, 4.4, 4.5_

- [x] 3. Implement API pipeline functions in `weather.js`
  - [x] 3.1 Implement `geocode(city)` — Nominatim fetch
    - Build URL: `https://nominatim.openstreetmap.org/search?q={city}&countrycodes=us&format=json`
    - Use `Promise.race([fetch(...), timeout(10000)])` for the 10-second timeout
    - If response array is empty, throw an error with the "City not found" message
    - Parse `lat` and `lon` from `result[0]` using `parseFloat()` and return `{lat, lon}`
    - On network error or timeout, throw with the geocoding failure message
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 Implement `getNWSPoints(lat, lon)` — NWS Points_Endpoint fetch
    - Round lat/lon to 4 decimal places with `.toFixed(4)` before building the URL
    - URL: `https://api.weather.gov/points/{lat},{lon}`
    - Use `Promise.race` with 10-second timeout
    - On non-2xx status or missing `properties.forecast`, throw with the weather grid error message
    - Return the forecast URL string from `data.properties.forecast`
    - _Requirements: 2.5, 2.6_
  - [x] 3.3 Implement `getForecast(forecastUrl)` — NWS Forecast_Endpoint fetch
    - Use `Promise.race` with 10-second timeout
    - On non-2xx status, missing or empty `properties.periods`, throw with the forecast unavailable message
    - Filter `properties.periods` to entries where `isDaytime === true` and slice to the first 5
    - Return the filtered periods array
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Implement `renderWeather(city, periods)` in `weather.js`
  - [x] 4.1 Write current conditions block into `#weather-display`
    - Display the city name exactly as trimmed by the user, current temperature in °F, `shortForecast` text, and wind speed/direction from `periods[0]`
    - Prepend the emoji from `getIcon(periods[0].shortForecast)` next to the current conditions
    - _Requirements: 4.1, 4.2_
  - [x] 4.2 Append the Forecast_Table to `#weather-display`
    - Build an HTML `<table>` with columns: Day, Icon, High °F, Forecast
    - Add one `<tr>` per entry in `periods` (up to 5 daytime entries)
    - Each row uses `period.name`, `getIcon(period.shortForecast)`, `period.temperature`, `period.shortForecast`
    - _Requirements: 4.3_

- [x] 5. Implement `getWeather()` entry point and wire up events in `weather.js`
  - [x] 5.1 Write `getWeather()` — the main async orchestration function
    - Read `City_Input` value, trim it
    - If trimmed value is empty, call `showError("Please enter a city name.")` and return immediately without making any network request
    - Call `clearDisplays()`, then sequentially: `geocode()` → `getNWSPoints()` → `getForecast()` → `renderWeather()`
    - Wrap the pipeline in try/catch; on any thrown error call `showError(error.message)`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [x] 5.2 Wire submit button click and Enter keydown events
    - Add `document.getElementById('submit-btn').addEventListener('click', getWeather)`
    - Add `document.getElementById('city-input').addEventListener('keydown', e => { if (e.key === 'Enter') getWeather(); })`
    - _Requirements: 1.1_

- [x] 6. Checkpoint — verify JavaScript syntax
  - Run `node --check weather.js` and confirm it exits with no errors.
  - _Requirements: all_

- [x] 7. Create `start-server.ps1` — PowerShell HTTP server
  - [x] 7.1 Write port-in-use check using `System.Net.Sockets.TcpClient`
    - Attempt `New-Object System.Net.Sockets.TcpClient('localhost', 8080)` inside a try/catch
    - If the connection succeeds, write an error message stating port 8080 is in use and call `exit 1`
    - _Requirements: 5.4_
  - [x] 7.2 Write `System.Net.HttpListener` serving loop
    - If port is free, create and start a `System.Net.HttpListener` on `http://localhost:8080/`
    - For each incoming request, determine the requested path (default `/` → `index.html`, `/weather.js` → `weather.js`)
    - Read the matching file with `Get-Content -Raw`, set the correct `Content-Type` (`text/html` or `application/javascript`), write the response and close it
    - Print a startup message: "Server running at http://localhost:8080"
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 8. Final checkpoint — full smoke test readiness
  - Ensure all files exist: `index.html`, `weather.js`, `start-server.ps1`
  - Run `node --check weather.js` one final time to confirm valid syntax
  - Confirm event wiring, error paths, and render functions are all connected with no orphaned code

---

## Notes

- No test framework is needed; `node --check weather.js` is the only automated verification step
- The correctness properties in `design.md` (Properties 1–5) serve as acceptance criteria for manual testing
- All timeout handling uses `Promise.race` with a local `timeout(ms)` helper that returns a rejecting promise
- The DOM is the only state; no variables persist between `getWeather()` calls
- Tasks marked with `*` are optional — none in this plan since PBT is not applied

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2"] }
  ]
}
```
