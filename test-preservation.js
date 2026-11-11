/**
 * Preservation Property Tests (Property 2)
 * Validates: Requirements 3.1, 3.2
 *
 * These tests run against UNFIXED code and must PASS —
 * they confirm the baseline error-path behavior that must
 * be preserved after the User-Agent fix is applied.
 *
 * Observation methodology:
 *   - 3.1: fetch returns [] → geocode() throws 'City not found...'
 *   - 3.2: fetch rejects with TypeError → geocode() throws 'Geocoding failed...'
 */

// --- Minimal async test harness ---
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

async function assert_rejects(fn, expectedMessage) {
  try {
    await fn();
    throw new Error(`Expected rejection with "${expectedMessage}" but resolved successfully.`);
  } catch (err) {
    if (err.message === expectedMessage) {
      return; // expected
    }
    throw new Error(`Rejected with wrong message.\n        Expected : "${expectedMessage}"\n        Received : "${err.message}"`);
  }
}

// --- Load geocode() from weather.js ---
// weather.js uses DOM APIs and event listeners at module level.
// We stub the minimum DOM surface needed to load the file, then
// extract geocode() via globalThis after eval.

import { readFileSync } from 'fs';

// Stub DOM elements so the addEventListener calls at the bottom of
// weather.js don't throw ReferenceError in Node.
globalThis.document = {
  getElementById: () => ({
    addEventListener: () => {},
    innerHTML: '',
    value: '',
    style: {},
    textContent: '',
  }),
};

const src = readFileSync(new URL('./weather.js', import.meta.url), 'utf8');
// Wrap in an IIFE that captures the functions we need
const wrapped = `
${src}
globalThis.__geocode = geocode;
`;
eval(wrapped);

const geocode = globalThis.__geocode;

// ─────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────
console.log('\nPreservation Property Tests (unfixed code)\n');

// Property 2 — Requirement 3.1
// Observation: fetch returns an empty array [] →
//   geocode() throws 'City not found. Please try a different city name.'
await test('3.1 empty-array response throws city-not-found error', async () => {
  globalThis.fetch = async () => ({
    json: async () => [],
  });

  await assert_rejects(
    () => geocode('ZZZNonexistentCity999'),
    'City not found. Please try a different city name.'
  );
});

// Property 2 — Requirement 3.2
// Observation: fetch rejects with a TypeError (network error) →
//   geocode() throws 'Geocoding failed. Check your connection and try again.'
await test('3.2 network error (fetch rejects) throws connection error', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  await assert_rejects(
    () => geocode('Austin'),
    'Geocoding failed. Check your connection and try again.'
  );
});

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
