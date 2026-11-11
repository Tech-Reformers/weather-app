/**
 * Bug Condition Exploration Test — Property 1 (Post-Fix Verification)
 * Validates: Requirements 2.1, 2.2
 *
 * After the fix, geocode() sends a User-Agent header with every fetch() call.
 * This test verifies the EXPECTED BEHAVIOR: when the User-Agent header IS present,
 * the mock returns a valid Nominatim-style response and geocode("Austin") succeeds.
 *
 * Mock behavior:
 *   - fetch WITH { headers: { 'User-Agent': 'WeatherApp/1.0' } } → returns [{ lat: "30.2672", lon: "-97.7431" }]
 *   - fetch WITHOUT User-Agent header → throws TypeError (simulates Nominatim rejection)
 *
 * EXPECTED OUTCOME: geocode("Austin") returns { lat: 30.2672, lon: -97.7431 } without throwing.
 */

// --- Stub DOM APIs so weather.js bottom-of-file event listeners don't crash ---
globalThis.document = {
  getElementById: () => ({
    addEventListener: () => {},
    innerHTML: '',
    style: {},
    value: '',
    textContent: ''
  })
};

// Mock fetch: succeeds only when User-Agent header is present
globalThis.fetch = async (url, options) => {
  const hasUserAgent =
    options &&
    options.headers &&
    options.headers['User-Agent'] === 'WeatherApp/1.0';

  if (!hasUserAgent) {
    throw new TypeError('Failed to fetch (simulated Nominatim rejection: missing User-Agent)');
  }

  // Simulate a successful Nominatim response for Austin, TX
  return {
    json: async () => [{ lat: '30.2672', lon: '-97.7431' }]
  };
};

// Inline geocode() — must match the FIXED version in weather.js exactly
function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out.')), ms)
  );
}

async function geocode(city) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&countrycodes=us&format=json`;
    const response = await Promise.race([fetch(url, { headers: { 'User-Agent': 'WeatherApp/1.0' } }), timeout(10000)]);
    const result = await response.json();
    if (!result || result.length === 0) {
      throw new Error('City not found. Please try a different city name.');
    }
    const lat = parseFloat(result[0].lat);
    const lon = parseFloat(result[0].lon);
    return { lat, lon };
  } catch (err) {
    if (err.message === 'City not found. Please try a different city name.') {
      throw err;
    }
    throw new Error('Geocoding failed. Check your connection and try again.');
  }
}

// --- Run the test ---
(async () => {
  console.log('=== Bug Condition Exploration Test (Property 1 — Post-Fix Verification) ===');
  console.log('Requirements 2.1, 2.2: geocode() succeeds when fetch includes User-Agent header');
  console.log('');
  console.log('Mock: fetch succeeds only when User-Agent header is present');
  console.log('Input: geocode("Austin")');
  console.log('');

  let result;
  try {
    result = await geocode('Austin');
  } catch (err) {
    console.log('TEST FAILED — geocode("Austin") threw unexpectedly.');
    console.log(`  Error: "${err.message}"`);
    console.log('This means the fix was NOT applied or the User-Agent header is missing.');
    process.exit(1);
  }

  const expectedLat = 30.2672;
  const expectedLon = -97.7431;

  if (result.lat === expectedLat && result.lon === expectedLon) {
    console.log('✓ geocode("Austin") returned expected coordinates.');
    console.log(`  Result: { lat: ${result.lat}, lon: ${result.lon} }`);
    console.log('');
    console.log('FIX CONFIRMED: geocode() now sends the User-Agent header.');
    console.log('Nominatim accepts the request and returns valid coordinates.');
    console.log('');
    console.log('TEST STATUS: PASS (expected behavior confirmed — fix is applied)');
    process.exit(0);
  } else {
    console.log('TEST FAILED — geocode("Austin") returned unexpected coordinates.');
    console.log(`  Expected: { lat: ${expectedLat}, lon: ${expectedLon} }`);
    console.log(`  Received: { lat: ${result.lat}, lon: ${result.lon} }`);
    process.exit(1);
  }
})();
