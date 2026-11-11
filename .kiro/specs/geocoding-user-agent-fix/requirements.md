# Requirements Document

## Introduction

The weather app's city search is broken. Every city entered returns an error or the message "Unable to reach the geocoding service". The root cause is that the `geocode()` function in `weather.js` calls the Nominatim geocoding API (`https://nominatim.openstreetmap.org/search`) without a `User-Agent` header. Nominatim's usage policy requires a valid `User-Agent`; without it the request is blocked and geocoding fails for all inputs.

The fix is to add `{ headers: { 'User-Agent': 'WeatherApp/1.0' } }` as the second argument to the `fetch` call inside `geocode()`.

## Requirements

### 1. Bug Condition

- 1.1 Any call to `geocode(city)` for any non-empty city string fails because the `fetch` request to Nominatim is sent without a `User-Agent` header, causing Nominatim to block or reject the request.

### 2. Expected Behavior

- 2.1 The `geocode()` function MUST include a `User-Agent` header (value `WeatherApp/1.0`) in every fetch request to `https://nominatim.openstreetmap.org/search`.
- 2.2 After the fix, a valid US city name (e.g. `"Austin"`) MUST resolve to a latitude/longitude pair without error.

### 3. Preservation Requirements

- 3.1 The `geocode()` function MUST still throw `'City not found. Please try a different city name.'` when Nominatim returns an empty result array.
- 3.2 The `geocode()` function MUST still throw `'Geocoding failed. Check your connection and try again.'` for network errors or unexpected failures unrelated to the missing header.
- 3.3 All other functions (`getNWSPoints`, `getForecast`, `renderWeather`, `getWeather`) MUST remain functionally unchanged.
