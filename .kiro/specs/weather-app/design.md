# Design Document: weather-app

## Overview

A single-page weather application built with plain HTML and JavaScript (no frameworks). The user types a U.S. city name, and the app resolves it to coordinates via Nominatim, fetches forecast data from the NWS API, and displays current conditions plus a 5-day forecast table with emoji weather icons. The app is served at `localhost:8080` by a PowerShell script.

The design is intentionally minimal: no build tooling, no classes, no caching, no external dependencies beyond the two public APIs.

---

## Architecture

```
Browser (index.html + weather.js)
        │
        │ 1. User submits city name
        ▼
Nominatim API  (https://nominatim.openstreetmap.org/search)
        │
        │ 2. Returns lat/lon
        ▼
NWS Points API  (https://api.weather.gov/points/{lat},{lon})
        │
        │ 3. Returns forecast URL
        ▼
NWS Forecast API  (properties.forecast URL)
        │
        │ 4. Returns periods array
        ▼
  Render Weather_Display (current + 5-day table)
```

Data flows in a straight sequential pipeline. Each step can fail independently and routes to the Error_Display. There is no state management layer — the DOM is the state.

---

## Components and Interfaces

### Files

```
environment/
├── index.html          # Page structure, input, display areas
├── weather.js          # All app logic (fetch, parse, render)
└── start-server.ps1    # PowerShell HTTP server on port 8080
```

All files live in the project root. `index.html` loads `weather.js` with a plain `<script src="weather.js">` tag.

### index.html

Responsibilities:
- Render City_Input (`<input type="text">`) and submit `<button>`
- Provide `#weather-display` and `#error-display` placeholder `<div>` elements
- Include minimal inline CSS for readable layout (no external stylesheet needed)
- Load `weather.js` at the bottom of `<body>`

### weather.js

Top-level functions (no classes):

| Function | Purpose |
|---|---|
| `getWeather()` | Entry point; reads input, clears displays, calls `geocode()` |
| `geocode(city)` | Fetches Nominatim, returns `{lat, lon}` or throws |
| `getNWSPoints(lat, lon)` | Fetches Points_Endpoint, returns `forecastUrl` or throws |
| `getForecast(forecastUrl)` | Fetches Forecast_Endpoint, returns `periods` array or throws |
| `getIcon(shortForecast)` | Maps shortForecast string → emoji character |
| `renderWeather(city, periods)` | Writes current conditions + table into `#weather-display` |
| `showError(message)` | Writes message into `#error-display`, clears `#weather-display` |
| `clearDisplays()` | Empties both display divs |

Event wiring in `weather.js`:
- `submit` button click → calls `getWeather()`
- `keydown` on City_Input for Enter key → calls `getWeather()`

### start-server.ps1

A self-contained PowerShell script that:
1. Checks if port 8080 is already in use with `New-Object System.Net.Sockets.TcpClient`
2. Exits with an error message if the port is taken
3. Otherwise starts a `System.Net.HttpListener` on `http://localhost:8080/`
4. Serves `index.html` and `weather.js` from the script's directory using `Get-Content` and sets `Content-Type` appropriately

---

## Data Models

No persistent data models. All state lives in memory within a single async call chain. Shapes described below are the raw API response structures the code reads.

### Nominatim Response (array)

```js
// GET https://nominatim.openstreetmap.org/search?q={city}&countrycodes=us&format=json
[
  {
    "lat": "38.8951",   // string — must be parsed with parseFloat()
    "lon": "-77.0364"
  }
  // ...additional results ignored
]
```

The app uses only index `[0]` and reads `lat` and `lon` as strings, converting them with `parseFloat()`.

### NWS Points Response

```js
// GET https://api.weather.gov/points/{lat},{lon}
{
  "properties": {
    "forecast": "https://api.weather.gov/gridpoints/LWX/97,70/forecast"
    // ...other fields ignored
  }
}
```

### NWS Forecast Response (periods)

```js
// GET {forecastUrl}
{
  "properties": {
    "periods": [
      {
        "name": "Today",
        "isDaytime": true,
        "temperature": 72,          // number, °F
        "temperatureUnit": "F",
        "windSpeed": "10 mph",
        "windDirection": "SW",
        "shortForecast": "Mostly Sunny",
        "detailedForecast": "..."
      }
      // ... more periods
    ]
  }
}
```

The app filters `periods` to only `isDaytime === true` and takes the first 5.

### Icon Mapping

Keyword matching runs in priority order on the lowercased `shortForecast` string:

| Keyword match | Emoji |
|---|---|
| `"thunder"` | ⛈️ |
| `"snow"` | ❄️ |
| `"rain"` or `"shower"` | 🌧️ |
| `"partly"` | ⛅ |
| `"cloud"` | ☁️ |
| `"sunny"` or `"clear"` | ☀️ |
| _(no match)_ | 🌡️ |

```js
function getIcon(shortForecast) {
  const s = shortForecast.toLowerCase();
  if (s.includes('thunder')) return '⛈️';
  if (s.includes('snow'))    return '❄️';
  if (s.includes('rain') || s.includes('shower')) return '🌧️';
  if (s.includes('partly'))  return '⛅';
  if (s.includes('cloud'))   return '☁️';
  if (s.includes('sunny') || s.includes('clear'))  return '☀️';
  return '🌡️';
}
```

---


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Input trimming and empty-input rejection

*For any* string input (including strings composed entirely of whitespace), trimming the input and checking for emptiness must behave consistently: the trimmed value must equal the original string with leading/trailing whitespace removed, and any trimmed value that is empty (length zero) must be rejected with an error displayed and no geocoder request sent.

**Validates: Requirements 1.2, 1.3**

### Property 2: Nominatim lat/lon parsed as numbers

*For any* Nominatim response array whose first element has `lat` and `lon` fields as numeric strings, the app's geocoding step shall extract those values as JavaScript numbers (not strings), and their numeric values shall equal `parseFloat` of the original strings.

**Validates: Requirements 2.2**

### Property 3: Coordinates rounded to 4 decimal places in NWS Points URL

*For any* latitude and longitude values, the URL constructed for the NWS Points_Endpoint shall contain those coordinates rounded to exactly 4 decimal places (no more, no fewer significant decimals).

**Validates: Requirements 2.5**

### Property 4: Daytime period filtering and collection

*For any* `properties.periods` array (of any length ≥ 0, with any mix of `isDaytime` values), filtering to daytime periods and collecting the forecast must produce: (a) a result set containing only entries where `isDaytime === true`, (b) at most 5 entries, and (c) the first entry in the result used as the current conditions display.

**Validates: Requirements 3.2, 3.3**

### Property 5: Icon mapping covers all keyword cases

*For any* `shortForecast` string, `getIcon()` shall return the highest-priority matching emoji according to the keyword table (thunder → ⛈️, snow → ❄️, rain/shower → 🌧️, partly → ⛅, cloud → ☁️, sunny/clear → ☀️), and shall return 🌡️ when no keyword matches. Keyword matching shall be case-insensitive.

**Validates: Requirements 4.2**

---

## Error Handling

All errors are displayed in `#error-display` and cause `#weather-display` to be cleared. There are no retry mechanisms.

| Failure point | Error message strategy |
|---|---|
| Empty/whitespace city input | "Please enter a city name." — shown immediately, no network call made |
| Nominatim returns empty array | "City not found. Please try a different city name." |
| Nominatim network error / timeout | "Geocoding failed. Check your connection and try again." |
| NWS Points non-2xx or missing forecast URL | "Could not retrieve weather grid for that location." |
| NWS Points network error / timeout | "Weather grid lookup failed. Check your connection and try again." |
| NWS Forecast non-2xx or empty periods | "Forecast data unavailable for that location." |
| NWS Forecast network error | "Forecast fetch failed. Check your connection and try again." |

Error display strategy in code:
- `showError(msg)` sets `#error-display` innerHTML to the message string and clears `#weather-display`.
- `clearDisplays()` sets both divs to empty string — called at the top of every new `getWeather()` invocation.
- Timeouts are implemented with `Promise.race([fetch(...), timeout(10000)])` where `timeout` returns a rejecting promise after 10 s.

---

## Testing Strategy

Per project steering, testing is intentionally minimal. `node --check weather.js` validates syntax. No test framework is set up.

**What is verified:**
- `node --check index.html` is not applicable (HTML), but `node --check weather.js` confirms valid JavaScript syntax.
- Manual smoke test: run `start-server.ps1`, open `http://localhost:8080`, enter "Austin, TX", verify forecast renders.
- Manual error test: submit empty input, submit a nonsense city name — verify appropriate error messages appear.

**Property-based testing assessment:** The feature is a simple HTML/JavaScript UI app with direct DOM manipulation and sequential API calls. There is no pure algorithmic layer that would benefit from a property-based testing library (e.g., fast-check). The logic is straightforward — `getIcon()` is a pure function but trivially testable by example, and the filtering/rendering logic is simple enough that manual + `node --check` verification satisfies the project's stated goal of completing quickly.

PBT is **not applied** to this project. The correctness properties above serve as formal specifications for manual test verification and future automated testing if the project grows.

**Unit test targets (if tests are added later):**
- `getIcon(shortForecast)` — example-based: one call per keyword, one for default
- Input trimming logic — examples: `"  Austin  "` → `"Austin"`, `"   "` → rejected
- Daytime filtering — examples: mixed periods array → only daytime, max 5 returned

