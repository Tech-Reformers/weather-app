# Implementation Plan

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3.1"] },
    { "wave": 3, "tasks": ["3.2", "3.3"] },
    { "wave": 4, "tasks": ["4"] }
  ]
}
```

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Missing User-Agent Header Blocks Geocoding
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate that every geocode() call fails without a User-Agent header
  - **Scoped PBT Approach**: Scope the property to the concrete failing case: `geocode("Austin")` where fetch is mocked to reject when no User-Agent header is present
  - In `weather.js`, the bug condition is: `isBugCondition(input)` where `fetch(url)` is called without `{ headers: { 'User-Agent': 'WeatherApp/1.0' } }`
  - Mock `globalThis.fetch` to throw a network error (simulating Nominatim blocking a headerless request)
  - Call `geocode("Austin")` and assert it throws — the thrown message should be `'Geocoding failed. Check your connection and try again.'`
  - Run test using `node --check weather.js` to verify syntax, then run the test script with `node`
  - **EXPECTED OUTCOME**: Test FAILS at the assertion level if `geocode()` somehow succeeds, OR confirms the throw path matches the bug condition
  - Document the counterexample found: `geocode("Austin")` with no User-Agent always throws instead of returning `{ lat, lon }`
  - Mark task complete when test is written, run, and failure/bug is documented
  - _Requirements: 1.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Error-Path Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology — observe behavior on UNFIXED code first
  - Observe: `geocode("ZZZNonexistentCity999")` with `fetch` mocked to return `[]` throws `'City not found. Please try a different city name.'` on unfixed code
  - Observe: `geocode("Austin")` with `fetch` mocked to reject (TypeError) throws `'Geocoding failed. Check your connection and try again.'` on unfixed code
  - Write a test for each observed path: for all mock scenarios returning empty array, `geocode()` throws the city-not-found message; for all network errors, `geocode()` throws the connection error message
  - Verify both tests PASS on UNFIXED code (these paths are unaffected by the missing header)
  - **EXPECTED OUTCOME**: Tests PASS on unfixed code (confirms baseline error-path behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2_

- [x] 3. Fix missing User-Agent header in geocode()

  - [x] 3.1 Implement the fix in weather.js
    - Open `weather.js` and locate the `geocode()` function
    - Find the line: `const response = await Promise.race([fetch(url), timeout(10000)]);`
    - Replace it with: `const response = await Promise.race([fetch(url, { headers: { 'User-Agent': 'WeatherApp/1.0' } }), timeout(10000)]);`
    - Save the file; no other lines change
    - Run `node --check weather.js` to confirm syntax is valid
    - _Bug_Condition: isBugCondition(input) — any geocode(city) call where fetch is sent without a User-Agent header_
    - _Expected_Behavior: expectedBehavior(result) — result is { lat, lon } with valid finite numbers, no exception thrown for a valid US city_
    - _Preservation: error paths for empty-array response (3.1) and network errors (3.2) remain unchanged; all other functions untouched (3.3)_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Missing User-Agent Header Blocks Geocoding
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Update the mock so `fetch` succeeds (returns a valid Nominatim-style JSON array `[{ lat: "30.2672", lon: "-97.7431" }]`) only when the `User-Agent` header is present in the request options
    - Re-run the test and assert `geocode("Austin")` returns `{ lat: 30.2672, lon: -97.7431 }` without throwing
    - **EXPECTED OUTCOME**: Test PASSES (confirms the User-Agent header is now sent and Nominatim accepts the request)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Error-Path Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run the empty-array test: `fetch` returns `[]` → `geocode()` still throws `'City not found. Please try a different city name.'`
    - Run the network-error test: `fetch` rejects → `geocode()` still throws `'Geocoding failed. Check your connection and try again.'`
    - **EXPECTED OUTCOME**: Both tests PASS (confirms no regressions in error-path behavior)
    - Confirm all tests pass with no failures

- [x] 4. Checkpoint - Ensure all tests pass
  - Re-run the full test suite (tasks 1, 3.2, 3.3 and preservation tests from task 2)
  - Confirm `node --check weather.js` passes (no syntax errors)
  - Ensure all tests pass; ask the user if any questions arise
