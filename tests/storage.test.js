import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_GUESSES } from '../src/game.js';
import { emptyStats, loadProgress, loadStats, recordResult } from '../src/storage.js';

// storage.js reads `window.localStorage` inside its functions rather than at
// import time, so a stub is enough to exercise the real read paths here.
function stubStorage(values = {}) {
  const store = { ...values };
  globalThis.window = {
    localStorage: {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => {
        store[key] = value;
      },
    },
  };
  return store;
}

test('a fresh win records one played game and a streak of one', () => {
  const stats = recordResult(emptyStats(), { index: 10, won: true, guesses: 3 });
  assert.equal(stats.played, 1);
  assert.equal(stats.wins, 1);
  assert.equal(stats.streak, 1);
  assert.equal(stats.maxStreak, 1);
  assert.deepEqual(stats.distribution, [0, 0, 1, 0, 0, 0]);
});

test('recording the same puzzle twice changes nothing', () => {
  const once = recordResult(emptyStats(), { index: 10, won: true, guesses: 3 });
  const twice = recordResult(once, { index: 10, won: true, guesses: 3 });
  assert.equal(twice, once, 'a reload must not inflate the streak');
});

test('consecutive wins extend the streak', () => {
  let stats = emptyStats();
  for (let i = 1; i <= 4; i += 1) {
    stats = recordResult(stats, { index: i, won: true, guesses: 4 });
  }
  assert.equal(stats.streak, 4);
  assert.equal(stats.maxStreak, 4);
});

test('a skipped day breaks the streak even if the next day is a win', () => {
  let stats = recordResult(emptyStats(), { index: 1, won: true, guesses: 4 });
  stats = recordResult(stats, { index: 5, won: true, guesses: 4 });
  assert.equal(stats.streak, 1, 'day 5 starts a new streak');
  assert.equal(stats.maxStreak, 1);
  assert.equal(stats.played, 2);
});

test('a loss zeroes the streak but keeps the best', () => {
  let stats = emptyStats();
  stats = recordResult(stats, { index: 1, won: true, guesses: 2 });
  stats = recordResult(stats, { index: 2, won: true, guesses: 2 });
  stats = recordResult(stats, { index: 3, won: false, guesses: 6 });
  assert.equal(stats.streak, 0);
  assert.equal(stats.maxStreak, 2);
  assert.equal(stats.played, 3);
  assert.equal(stats.wins, 2);
});

test('a loss is not counted in the guess distribution', () => {
  const stats = recordResult(emptyStats(), { index: 1, won: false, guesses: 6 });
  assert.deepEqual(stats.distribution, [0, 0, 0, 0, 0, 0]);
});

test('recordResult does not mutate the stats it is given', () => {
  const before = emptyStats();
  recordResult(before, { index: 1, won: true, guesses: 1 });
  assert.deepEqual(before, emptyStats());
});

// ---------------------------------------------------------------------------
// Reading untrusted storage
//
// On GitHub Pages every repo an account publishes shares one origin, so these
// keys are writable by anything else hosted alongside the game. A saved value
// is untrusted input. Before this was fixed, loadStats spread the saved object
// over the defaults, so a `distribution` of the wrong type reached the render
// path and threw *after* the board was drawn but *before* the key listeners
// were attached — a page that looked perfect and ignored every keystroke.
// ---------------------------------------------------------------------------

const KEY = 'beedle:stats';

/** Everything the app does with a stats object, in one call. */
function useStats(stats) {
  Math.max(1, ...stats.distribution); // main.js, drawing the bars
  stats.distribution.map((count, i) => `${i}:${count}`); // ditto
  return recordResult(stats, { index: 5, won: true, guesses: 2 });
}

test('an empty store gives the empty stats (control)', () => {
  stubStorage();
  assert.deepEqual(loadStats(), emptyStats());
});

test('a well-formed store round-trips', () => {
  const saved = {
    played: 9,
    wins: 7,
    streak: 2,
    maxStreak: 5,
    distribution: [0, 1, 3, 2, 1, 0],
    lastIndex: 42,
  };
  stubStorage({ [KEY]: JSON.stringify(saved) });
  assert.deepEqual(loadStats(), saved);
});

for (const [label, value] of [
  ['a distribution that is a number', { distribution: 7 }],
  ['a distribution that is a string', { distribution: 'xxxxxx' }],
  ['a distribution that is an object', { distribution: { 0: 1 } }],
  ['a distribution of the wrong length', { distribution: [1, 2] }],
  ['a distribution holding junk', { distribution: [1, 'x', null, {}, -4, 1.5] }],
  ['counts that are strings', { played: '9', wins: 'x', streak: null }],
  ['counts that are negative or fractional', { played: -3, wins: 2.5 }],
  ['a lastIndex that is a string', { lastIndex: 'yesterday' }],
  ['injected extra keys', { injected: 1, __proto__: { polluted: true } }],
  ['a stats value that is an array', []],
  ['a stats value that is a string', 'nope'],
  ['a stats value that is null', null],
  ['unparseable JSON', undefined],
]) {
  test(`${label} still yields a usable board`, () => {
    const raw = value === undefined ? '{not json' : JSON.stringify(value);
    stubStorage({ [KEY]: raw });

    const stats = loadStats();
    assert.equal(Array.isArray(stats.distribution), true, 'distribution must be an array');
    assert.equal(stats.distribution.length, MAX_GUESSES);
    assert.ok(stats.distribution.every(Number.isInteger), 'every bar must be a number');
    for (const field of ['played', 'wins', 'streak', 'maxStreak']) {
      assert.ok(Number.isInteger(stats[field]) && stats[field] >= 0, `${field}: ${stats[field]}`);
    }
    assert.ok(stats.lastIndex === null || Number.isInteger(stats.lastIndex));
    assert.deepEqual(Object.keys(stats).sort(), Object.keys(emptyStats()).sort(), 'no extra keys');

    assert.doesNotThrow(() => useStats(stats));
  });
}

test('saved progress for another day is ignored', () => {
  stubStorage({ 'beedle:progress': JSON.stringify({ index: 4, guesses: ['crane'] }) });
  assert.equal(loadProgress(5), null);
  assert.deepEqual(loadProgress(4), ['crane']);
});

test('progress that is not a list of strings is refused whole', () => {
  for (const guesses of [7, 'crane', { 0: 'crane' }, ['crane', 5], [null]]) {
    stubStorage({ 'beedle:progress': JSON.stringify({ index: 4, guesses }) });
    assert.equal(loadProgress(4), null, `guesses: ${JSON.stringify(guesses)}`);
  }
});
