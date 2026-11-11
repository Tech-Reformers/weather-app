# Bugfix Requirements Document

## Introduction

The weather app's city search feature is broken for all user-entered cities. Every search returns a geocoding error message ("Unable to reach the geocoding service" or similar). The root cause is that the `geocode()` function in `weather.js` calls the Nominatim OpenStreetMap API (`https://nominatim.openstreetmap.org/search`) without supplying a `User-Agent` request header. Nominatim's usage policy requires a descriptive `User-Agent` on all requests; without it, Nominatim returns a 403 or silently rejects the request, causing the fetch to fail and the app to display the geocoding error.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits any city name via the search input THEN the system makes a Nominatim fetch request without a `User-Agent` header, Nominatim rejects the request with a 403 or silent block, and the app displays a geocoding failure error message.

1.2 WHEN the Nominatim request is rejected due to the missing `User-Agent` THEN the system catches the fetch failure and surfaces the message "Geocoding failed. Check your connection and try again." instead of returning weather data.

### Expected Behavior (Correct)

2.1 WHEN a user submits any valid US city name THEN the system SHALL include a descriptive `User-Agent` header (e.g., `WeatherApp/1.0`) in the Nominatim fetch request so that Nominatim accepts the request and returns geocoding results.

2.2 WHEN Nominatim returns valid geocoding results with the `User-Agent` header present THEN the system SHALL parse the latitude and longitude and proceed to fetch weather data from the National Weather Service API.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user submits a city name that does not exist in Nominatim's database THEN the system SHALL CONTINUE TO throw a "City not found. Please try a different city name." error.

3.2 WHEN a valid city is geocoded successfully THEN the system SHALL CONTINUE TO fetch the NWS forecast grid and render the 5-day daytime forecast in the weather display.

3.3 WHEN the Nominatim request times out (exceeds 10 seconds) THEN the system SHALL CONTINUE TO surface a timeout or connection error to the user.

3.4 WHEN a user submits an empty city name THEN the system SHALL CONTINUE TO display "Please enter a city name." without making any API requests.
