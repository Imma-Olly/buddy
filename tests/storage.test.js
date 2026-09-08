import test from 'node:test';
import assert from 'node:assert/strict';

import { emptyStats, recordResult } from '../src/storage.js';

// recordResult is pure — it touches no browser API — so it is tested here even
// though the rest of storage.js only runs in a page.

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
