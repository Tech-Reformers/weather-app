# Requirements Document

## Introduction

A simple, single-page weather application that lets users enter a U.S. city name and view current weather conditions plus a 5-day forecast. The app is built with plain HTML and JavaScript (no frameworks), retrieves geolocation data from Nominatim (OpenStreetMap), and fetches weather from the National Weather Service (NWS) API. Weather conditions are represented with emoji icons. It runs on a local HTTP server at localhost:8080, started via a PowerShell script named `start-server.ps1`.

## Glossary

- **App**: The single-page HTML/JavaScript weather application served at localhost:8080.
- **User**: A person interacting with the App in a browser.
- **City_Input**: The text input field where the User types a U.S. city name.
- **Geocoder**: The Nominatim (OpenStreetMap) geocoding service at `https://nominatim.openstreetmap.org/search`.
- **NWS_API**: The National Weather Service API at `https://api.weather.gov`.
- **Points_Endpoint**: The NWS endpoint `https://api.weather.gov/points/{lat},{lon}` that returns forecast office metadata for a coordinate.
- **Forecast_Endpoint**: The NWS standard forecast URL returned by the Points_Endpoint response (`properties.forecast`).
- **Weather_Display**: The area of the page that renders current conditions and the 5-day forecast table after a successful lookup.
- **Forecast_Table**: A table inside the Weather_Display showing one row per forecast day with icon, high/low temperatures, and short description.
- **Weather_Icon**: An emoji character chosen based on keywords in the `shortForecast` field (e.g., ☀️ sunny, 🌧️ rain, ☁️ cloudy, ⛅ partly cloudy, ❄️ snow, ⛈️ thunderstorm).
- **Error_Display**: The area of the page that renders error messages when a lookup fails.
- **HTTP_Server**: The local PowerShell-started HTTP server listening on localhost:8080.

---

## Requirements

### Requirement 1: City Name Input and Submission

**User Story:** As a User, I want to type a U.S. city name and submit it, so that I can retrieve current weather and a 5-day forecast for that city.

#### Acceptance Criteria

1. THE App SHALL render a City_Input text field and a submit button on page load.
2. WHEN the User activates the submit button or presses Enter while City_Input is focused, THE App SHALL trim leading and trailing whitespace from the City_Input value before processing it.
3. IF the trimmed City_Input value is empty when submitted, THEN THE App SHALL display an error message in the Error_Display instructing the User to enter a city name, and SHALL NOT send any request to the Geocoder.
4. WHEN the trimmed City_Input value is non-empty, THE App SHALL pass it directly to the Geocoder without storing or hardcoding it.
5. WHEN a new lookup is initiated, THE App SHALL clear all content from both the Weather_Display and the Error_Display before sending any request.

---

### Requirement 2: Geocoding and NWS Grid Resolution

**User Story:** As a User, I want the app to automatically resolve the city name into geographic coordinates and identify the correct NWS forecast office, so that accurate weather data is retrieved.

#### Acceptance Criteria

1. WHEN a non-empty city name is submitted, THE Geocoder SHALL be queried with the city name, a `countrycodes=us` filter, and `format=json` to receive a JSON array response.
2. WHEN the Geocoder returns at least one result, THE App SHALL extract latitude and longitude from the first result as numeric decimal values.
3. IF the Geocoder returns an empty array, THEN THE App SHALL display a message in the Error_Display stating the city could not be found and SHALL NOT proceed further.
4. IF the Geocoder request fails or does not respond within 10 seconds, THEN THE App SHALL display a message in the Error_Display referencing the geocoding step.
5. IF latitude and longitude are available, THEN THE App SHALL send a GET request to the Points_Endpoint using those coordinates rounded to 4 decimal places, and extract the Forecast_Endpoint URL from `properties.forecast` in the response.
6. IF the Points_Endpoint returns a non-2xx response, a null `properties.forecast`, or fails to respond within 10 seconds, THEN THE App SHALL display a message in the Error_Display referencing the weather grid step.

---

### Requirement 3: Weather Data Retrieval

**User Story:** As a User, I want the app to fetch current and 5-day forecast data from the NWS, so that I can see both today's conditions and the upcoming week at a glance.

#### Acceptance Criteria

1. IF the Forecast_Endpoint URL is a non-empty string, THEN THE App SHALL send a GET request to that URL to retrieve forecast data.
2. WHEN the forecast response contains a `properties.periods` array with at least one entry, THE App SHALL treat the first daytime period as the current conditions.
3. THE App SHALL collect up to 5 consecutive daytime periods from `properties.periods` for display in the Forecast_Table.
4. IF the `properties.periods` array is absent, empty, or the request returns a non-2xx response or network error, THEN THE App SHALL display a message in the Error_Display referencing the forecast step.

---

### Requirement 4: Weather Display with Icons and Forecast Table

**User Story:** As a User, I want to see current conditions with a weather icon and a 5-day forecast table, so that I can understand today's weather and plan for the week ahead.

#### Acceptance Criteria

1. WHEN forecast data is available, THE Weather_Display SHALL show the city name exactly as entered by the User (after trimming), the current temperature in °F, the current `shortForecast` text, and the current wind speed and direction.
2. WHEN forecast data is available, THE Weather_Display SHALL show a Weather_Icon alongside the current conditions chosen by matching keywords in `shortForecast`: "thunder" → ⛈️, "snow" → ❄️, "rain" or "shower" → 🌧️, "partly" → ⛅, "cloud" → ☁️, "sunny" or "clear" → ☀️, and a default of 🌡️ for unmatched values.
3. WHEN forecast data is available, THE App SHALL render the Forecast_Table below the current conditions showing one row per daytime forecast period (up to 5 days) with columns: Day, Icon, High °F, and Forecast.
4. WHEN the Error_Display shows any error message, THE Weather_Display SHALL display no forecast content.
5. WHEN a lookup completes successfully, THE Error_Display SHALL be empty.

---

### Requirement 5: Local HTTP Server

**User Story:** As a developer, I want a PowerShell script to start a local HTTP server, so that the app can be served at localhost:8080 without manual configuration.

#### Acceptance Criteria

1. THE HTTP_Server SHALL serve the App's HTML and JavaScript files from the project root directory on port 8080.
2. THE HTTP_Server SHALL be startable by running a single PowerShell script named `start-server.ps1` from the project root.
3. WHEN the HTTP_Server is running, a GET request to `http://localhost:8080` SHALL return an HTTP 200 response with an HTML document as the response body.
4. IF port 8080 is already in use when `start-server.ps1` is executed, THEN THE script SHALL display an error message stating the port is in use and exit without starting the server.
