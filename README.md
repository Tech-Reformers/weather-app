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

The server serves only `index.html`, `styles.css`, and `weather.js`. Any other path returns 404.

## Deploy to AWS

The app is deployed as a static site. A private S3 bucket holds `index.html`, `styles.css`, and `weather.js`, and CloudFront serves them over HTTPS. Only CloudFront can read the bucket, through Origin Access Control (OAC). CloudFront also adds browser security headers, including a Content-Security-Policy that allows the page to call only Nominatim and the NWS API. The browser still calls those services directly; there is no server.

One CloudFormation template, `infra/weather-app.yaml`, creates:

- an S3 bucket with Block Public Access, SSE-S3 encryption, and versioning
- a CloudFront distribution (HTTPS redirect, compression, `*.cloudfront.net` address)
- an Origin Access Control and a bucket policy that admits only this distribution
- a CloudFront response headers policy with the security headers

The deployment runs from the notebook `deploy-aws.ipynb`, which explains each step.

**Prerequisite:** the CSS must be in `styles.css`, with no `<style>` block left in `index.html`. The Content-Security-Policy blocks inline styles. The notebook checks this before deploying.

### Sign in and start Jupyter

In a terminal:

```bash
aws sso login --profile <your-profile>
export AWS_PROFILE=<your-profile>        # PowerShell: $env:AWS_PROFILE = "<your-profile>"
aws sts get-caller-identity
jupyter notebook                          # or open the notebook in your editor from this terminal
```

Start Jupyter from this repo's top folder, in the same terminal, so the notebook uses that profile. The profile sets the account and region; nothing is hard-coded.

### Deploy, then clean up

Open `deploy-aws.ipynb` and run the cells in order.

- **Deploy (Parts 1–11):** creates the stack, uploads the three files, clears the CloudFront cache, checks the site, and lists where each resource appears in the console. Creating the CloudFront distribution takes about 5 minutes.
- **Clean up (Parts 12–13):** empties the bucket and deletes the stack. Deleting the distribution takes about 5–15 minutes. These cells work on their own, even after restarting Jupyter.

To publish app changes later, re-run Parts 6–8.

**Cost:** for a low-traffic site this normally stays within the CloudFront and S3 free tiers or costs a few cents a month. Run the cleanup cells when you are finished.

**Before committing:** run the notebook's last cell to clear saved outputs (they contain your account ID), then close the notebook without saving.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page markup |
| `styles.css` | Page styles |
| `weather.js` | Geocoding, NWS requests, rendering, unit toggle |
| `start-server.ps1` | Local HTTP server on `localhost:8080` |
| `infra/weather-app.yaml` | CloudFormation template for the AWS deployment |
| `deploy-aws.ipynb` | Notebook that deploys, checks, and removes the AWS deployment |
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
