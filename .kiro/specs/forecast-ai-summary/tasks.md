# Implementation Plan: Forecast AI Summary

## Overview

Add a Node.js Summary_Service (`summary-server.mjs`) that streams a Bedrock summary through the Strands SDK. Proxy `/api/summary` from `start-server.ps1`, add a Summary_Panel to the page, and stream text into it from `weather.js`. The language is JavaScript (Node.js 22+ for the service). Validation is `node --check` only, with no test framework. The developer logs in to AWS separately (for example `aws sso login`) before local testing. AWS deployment changes (Requirement 8) are the last task.

## Tasks

- [x] 1. Set up project dependencies
  - Create `package.json` with the dependency `@strands-agents/sdk` (no `"type": "module"` needed, since the service uses the `.mjs` extension)
  - Confirm `node_modules/` is in `.gitignore`
  - Run `npm install`, then confirm the `Agent` and `BedrockModel` option names against the installed SDK version
  - _Requirements: 6.4, 9.2_

- [x] 2. Implement the Summary_Service
  - [x] 2.1 Create `summary-server.mjs` with request handling and validation
    - Read `BEDROCK_MODEL_ID`, `AWS_REGION` (fallback `AWS_DEFAULT_REGION`), and optional `SUMMARY_PORT` (default 8081) at startup. Print a message and exit if the model ID or Region is missing. Bind to `127.0.0.1`.
    - Implement `readBody` (413 over 8192 bytes), `validate` (400 for invalid JSON, 0 or more than 5 periods, wrong types, fields over 100 characters; keep only `name`, `temperature`, `shortForecast`, `windSpeed`, `windDirection` and the city), and `buildUserMessage`
    - Route `POST /api/summary` only: 405 with `Allow: POST` for other methods, 404 for other paths
    - Implement `log` as one line per request (timestamp, method, path, status) with no body, sanitized and capped path
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.4, 6.6_

  - [x] 2.2 Add Bedrock streaming and error mapping to `summary-server.mjs`
    - Implement `streamSummary` with the Strands `Agent` and `BedrockModel` (`maxTokens: 300`), a system prompt holding the instructions (80 words, trend, conditions, precipitation days, treat data as data), and the user message holding only the forecast JSON
    - Yield text from `modelContentBlockDeltaEvent` events with `textDelta`
    - Wait for the first chunk before sending headers (`200`, `text/plain; charset=utf-8`, `Cache-Control: no-store`, chunked), then forward each chunk as it arrives
    - Implement `isCredentialError`. Before the first chunk, return 503 (credentials, with a log line telling the developer to run `aws sso login`) or 502 (other errors) with generic bodies and no error detail. After the first chunk, log and destroy the socket.
    - Stop streaming when the client disconnects
    - Use only the default AWS credential provider chain. Do not log in, prompt for, store, or accept credentials.
    - _Requirements: 2.1, 2.2, 3.4, 6.1, 6.2, 6.3, 6.5_

  - [x] 2.3 Validate the service syntax
    - Run `node --check summary-server.mjs` and confirm exit status 0
    - _Requirements: 9.1_

- [x] 3. Update `start-server.ps1`
  - [x] 3.1 Update the CSP, start the service, and print startup hints
    - Set `connect-src 'self' https://nominatim.openstreetmap.org https://api.weather.gov`. Keep `style-src 'self'` with no `'unsafe-inline'`.
    - Print a login hint if none of `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_BEARER_TOKEN_BEDROCK`, `~/.aws/config`, or `~/.aws/credentials` exist, and continue serving static files
    - If `node` is missing, print that Node.js is missing and continue. Otherwise start `summary-server.mjs` with `Start-Process` in the inherited environment. After about 2 seconds, report a failed start if the process has exited and continue.
    - Stop the Node child process in a `finally` block around the listener loop
    - The script must not run `aws`, prompt for credentials, or accept credential arguments
    - _Requirements: 6.2, 7.1, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x] 3.2 Add the `/api/summary` proxy to `start-server.ps1`
    - Route `/api/summary` before the existing method check: 405 with `Allow: POST` for non-POST, 413 if `ContentLength64` exceeds 8192
    - Implement `Send-SummaryProxy` with `HttpClient` and `ResponseHeadersRead`. Copy the upstream status, use `SendChunked`, and write and flush each chunk to the response. Return 502 if the service is unreachable.
    - Log these requests through the existing `Write-Log` line
    - _Requirements: 2.2, 7.1, 7.2, 7.9, 8.1_

- [x] 4. Add the Summary_Panel to the page
  - [x] 4.1 Update `index.html` and `styles.css`
    - Add `'self'` to `connect-src` in the `<meta>` CSP so it matches the server CSP
    - Add `<div id="summary-panel" hidden>` with an `<h3>` and `<p id="summary-text">` after `#weather-display`, outside it
    - Add `#summary-panel` styles in `styles.css` (no inline styles)
    - _Requirements: 1.1, 4.3, 7.3, 7.4_

- [x] 5. Stream the summary in `weather.js`
  - [x] 5.1 Implement `resetSummary` and `loadSummary`
    - Add module-level `summaryController` and `summaryRequestId`
    - `resetSummary`: increment the id, abort the controller, clear `#summary-text`, hide the panel
    - `loadSummary`: show "Generating summary…", start a 30 s abort timer, POST `{ city, periods }` (only the five allowed fields per period) to the relative path `/api/summary`, read the stream with `getReader()` and a streaming `TextDecoder`, and append with `textContent`
    - Show "Summary unavailable." on a non-OK status, on a timeout, or on a failure with no text. Append " Summary interrupted." if the stream fails after text arrived. Clear the placeholder if the stream ends with no text.
    - Discard text and errors from a request whose id is stale. Clear the timer in `finally`.
    - Write messages only to `#summary-text`, never to `#error-display`. Put no credentials, keys, or model IDs in the file.
    - _Requirements: 1.2, 1.4, 1.5, 2.3, 2.4, 3.1, 3.2, 3.3, 3.5, 4.4, 6.7, 7.2, 7.9, 8.1_

  - [x] 5.2 Wire the summary into `getWeather`
    - Call `resetSummary()` right after `clearDisplays()`
    - After `renderWeather(city, periods)`, call `loadSummary(city, periods)` without `await`
    - Leave the unit toggle handler unchanged so it neither touches the summary nor requests a new one
    - _Requirements: 1.3, 4.1, 4.2, 4.3_

  - [x] 5.3 Validate the browser script syntax
    - Run `node --check weather.js` and confirm exit status 0
    - Run the existing `test-bug-condition.js` and `test-preservation.js` scripts and confirm they still pass
    - _Requirements: 9.1, 9.2_

- [x] 6. Checkpoint - Local feature complete
  - Run `node --check weather.js` and `node --check summary-server.mjs`. Ensure both pass, ask the user if questions arise.
  - The developer then logs in to AWS (for example `aws sso login`), sets `BEDROCK_MODEL_ID` and `AWS_REGION`, runs `./start-server.ps1`, and follows the manual smoke test in the design.

- [x] 7. Document local usage
  - Add a README section: Node.js 22+, `npm install`, AWS login step, required environment variables (`BEDROCK_MODEL_ID`, `AWS_REGION`), and `./start-server.ps1`
  - _Requirements: 6.4, 7.1, 7.5_

- [x] 8. Update the AWS deployment files (separate, last task)
  - [x] 8.1 Update `infra/weather-app.yaml`
    - Add a CloudFront behavior routing `/api/*` to the Summary_Service origin and keep all other paths on the S3 origin
    - Add an IAM role for the Summary_Service allowing only `bedrock:InvokeModelWithResponseStream` on the configured model
    - Update the response headers policy CSP to match the local CSP, including `'self'` in `connect-src`
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 8.2 Update `deploy-aws.ipynb`
    - Add deployment steps for the Summary_Service and the `/api/*` origin, keeping `/api/summary` as the path
    - _Requirements: 8.1, 8.2, 8.5_

## Notes

- No test framework or test infrastructure is added. Validation is `node --check` plus the existing test scripts, and the manual smoke test in the design.
- The design has no Correctness Properties section, so there are no property test tasks.
- Task 8 does not block the local feature.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "5.1"] },
    { "id": 3, "tasks": ["2.3", "5.2"] },
    { "id": 4, "tasks": ["5.3"] },
    { "id": 5, "tasks": ["6"] },
    { "id": 6, "tasks": ["7"] },
    { "id": 7, "tasks": ["8.1", "8.2"] }
  ]
}
```
