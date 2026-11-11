# Design Document

## Overview

A one-line fix inside `geocode()` in `weather.js`: add a `User-Agent` header to the Nominatim `fetch` call. No architectural changes are needed.

## Bug Details

Every city entered in the weather app returns an error. The `geocode()` function calls `https://nominatim.openstreetmap.org/search` via `fetch(url)` with no options object and therefore no `User-Agent` header. Nominatim's usage policy blocks requests that lack a `User-Agent`, causing every geocoding request to fail. The `catch` block re-throws the network failure as `'Geocoding failed. Check your connection and try again.'`

Affected file: `weather.js`, inside the `geocode()` async function, at the line:
```js
const response = await Promise.race([fetch(url), timeout(10000)]);
```

## Hypothesized Root Cause

The `fetch` call was written without an options argument. Nominatim silently blocks requests missing a `User-Agent` header, which surfaces as a network error rather than a clear HTTP error code, making the root cause non-obvious from the error message alone.

## Expected Behavior

After the fix:
- `geocode(city)` for any valid US city name returns `{ lat: number, lon: number }` without throwing.
- The `fetch` call to Nominatim always includes `{ headers: { 'User-Agent': 'WeatherApp/1.0' } }`.
- Error-path behavior (city not found, network failure) remains identical to the pre-fix behavior.

```
expectedBehavior(result):
  result is { lat: number, lon: number }
  AND lat and lon are valid finite numbers
  AND no exception is thrown for a valid US city name
```

## Fix Implementation

### File

`weather.js` — `geocode()` function.

### Change

**Before:**
```js
const response = await Promise.race([fetch(url), timeout(10000)]);
```

**After:**
```js
const response = await Promise.race([
  fetch(url, { headers: { 'User-Agent': 'WeatherApp/1.0' } }),
  timeout(10000)
]);
```

No other lines change. The rest of `geocode()` and all other functions are untouched.

### Bug Condition

```
isBugCondition(input):
  input is any call to geocode(city) where city is a non-empty string
  AND the fetch to Nominatim does NOT include a User-Agent header
```

The condition applies to **all current calls** — every city lookup is affected because the header is universally absent.

## Preservation Requirements

The following behaviors of `geocode()` MUST be unchanged after the fix:

- **3.1** When Nominatim returns an empty array, throw `'City not found. Please try a different city name.'`
- **3.2** When a network error or unexpected failure occurs (unrelated to the missing header), throw `'Geocoding failed. Check your connection and try again.'`
- **3.3** All other functions (`getNWSPoints`, `getForecast`, `renderWeather`, `getWeather`) remain untouched.

## Testing Strategy

### Property 1: Bug Condition Exploration Test

Mock `fetch` to simulate Nominatim rejecting a request that has no `User-Agent` header (throws a network error). Run `geocode("Austin")` on the **unfixed** code — it should throw. This confirms the bug exists. After the fix, mock `fetch` to succeed only when the `User-Agent` header is present, and assert `geocode("Austin")` returns a `{ lat, lon }` object.

### Property 2: Preservation Tests

Observe and encode the error-path behavior on unfixed code:
- Mock `fetch` to return `[]` (empty array) → `geocode()` throws `'City not found. Please try a different city name.'`
- Mock `fetch` to reject (network error) → `geocode()` throws `'Geocoding failed. Check your connection and try again.'`

Verify these tests pass on both unfixed and fixed code — the error paths must not change.
