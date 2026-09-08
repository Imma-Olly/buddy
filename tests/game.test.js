import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ABSENT,
  CORRECT,
  MAX_GUESSES,
  PRESENT,
  WORD_LENGTH,
  dailyAnswer,
  guessProblem,
  keyboardStatuses,
  newGame,
  puzzleIndex,
  scoreGuess,
  seededShuffle,
  shareText,
  submitGuess,
} from '../src/game.js';
import { ANSWERS, allowedCount, isAllowedGuess } from '../src/words.js';

const C = CORRECT;
const P = PRESENT;
const A = ABSENT;

// ---------------------------------------------------------------------------
// scoreGuess — the tile colours
// ---------------------------------------------------------------------------

test('an exact guess is all green', () => {
  assert.deepEqual(scoreGuess('honey', 'honey'), [C, C, C, C, C]);
});

test('a guess sharing no letters is all grey', () => {
  assert.deepEqual(scoreGuess('brick', 'honey'), [A, A, A, A, A]);
});

test('a misplaced letter is yellow', () => {
  // "nohey" swaps the h and the n; o, e and y stay put.
  assert.deepEqual(scoreGuess('nohey', 'honey'), [P, C, P, C, C]);
});

test('scoreGuess is case-insensitive on both sides', () => {
  assert.deepEqual(scoreGuess('HoNeY', 'honey'), [C, C, C, C, C]);
  assert.deepEqual(scoreGuess('honey', 'HONEY'), [C, C, C, C, C]);
});

test('a length mismatch throws rather than scoring nonsense', () => {
  assert.throws(() => scoreGuess('bee', 'honey'), RangeError);
  assert.throws(() => scoreGuess('honeys', 'honey'), RangeError);
});

// Duplicate letters. This is where every Wordle clone breaks, so each case
// below is a different way of getting it wrong.

test('a duplicate in the guess is grey once the answer copy is used by a green', () => {
  // "sassy" vs "swarm": one s, already green in position 0.
  assert.deepEqual(scoreGuess('sassy', 'swarm'), [C, P, A, A, A]);
});

test('a duplicate in the guess is grey once the answer copy is used by a yellow', () => {
  // "amber" has one e. The first e claims it; the rest get nothing.
  assert.deepEqual(scoreGuess('eerie', 'amber'), [P, A, P, A, A]);
});

test('yellows are assigned left to right', () => {
  // Both e's in "sense" are candidates for the single e in "amber", and
  // neither is in the right place, so nothing is settled by a green. The
  // leftmost one wins; an implementation that scans right-to-left flips this.
  const score = scoreGuess('sense', 'amber');
  assert.deepEqual(score, [A, P, A, A, A]);
});

test('a green claims its letter even when a yellow appears earlier in the guess', () => {
  // "enter" vs "queen": the e in position 3 is green, so only ONE of the two
  // remaining e-slots in the guess can be yellow.
  assert.deepEqual(scoreGuess('enter', 'queen'), [P, P, A, C, A]);
});

test('an answer with two copies can light up two tiles, but not three', () => {
  // "queen" has two e's. "eerie" offers three, none of them in place: the
  // first two go yellow and the third gets nothing.
  assert.deepEqual(scoreGuess('eerie', 'queen'), [P, P, A, A, A]);
});

test('all three statuses can coexist for one repeated letter', () => {
  // "eerie" vs "there": one green e, one yellow e, one grey e.
  const score = scoreGuess('eerie', 'there');
  assert.deepEqual(score, [P, A, P, A, C]);
  assert.equal(score.filter((s) => s === CORRECT).length, 1);
  assert.equal(score.filter((s) => s === PRESENT).length, 2);
});

test('every guess scores exactly one status per position', () => {
  for (const answer of ANSWERS.slice(0, 40)) {
    for (const guess of ANSWERS.slice(0, 40)) {
      const score = scoreGuess(guess, answer);
      assert.equal(score.length, WORD_LENGTH);
      assert.ok(score.every((s) => s === C || s === P || s === A));
      // A green count can never exceed the number of shared positions.
      const shared = [...guess].filter((ch, i) => ch === answer[i]).length;
      assert.equal(score.filter((s) => s === C).length, shared);
    }
  }
});

test('the number of coloured tiles for a letter never exceeds its count in the answer', () => {
  for (const answer of ANSWERS.slice(0, 60)) {
    for (const guess of ANSWERS.slice(0, 60)) {
      const score = scoreGuess(guess, answer);
      const coloured = new Map();
      for (let i = 0; i < guess.length; i += 1) {
        if (score[i] !== ABSENT) {
          coloured.set(guess[i], (coloured.get(guess[i]) ?? 0) + 1);
        }
      }
      for (const [letter, n] of coloured) {
        const inAnswer = [...answer].filter((ch) => ch === letter).length;
        assert.ok(n <= inAnswer, `${guess}/${answer}: ${n} × ${letter} > ${inAnswer}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// keyboardStatuses
// ---------------------------------------------------------------------------

test('keyboard keys upgrade but never downgrade', () => {
  const rows = [
    { guess: 'nohey', score: scoreGuess('nohey', 'honey') }, // n and o yellow
    { guess: 'honey', score: scoreGuess('honey', 'honey') }, // both now green
  ];
  const keys = keyboardStatuses(rows);
  assert.equal(keys.n, CORRECT);
  assert.equal(keys.o, CORRECT);

  const reversed = keyboardStatuses([...rows].reverse());
  assert.equal(reversed.n, CORRECT, 'a later yellow must not undo an earlier green');
  assert.equal(reversed.o, CORRECT);
});

test('unguessed letters have no keyboard status', () => {
  const keys = keyboardStatuses([{ guess: 'honey', score: scoreGuess('honey', 'honey') }]);
  assert.equal(keys.z, undefined);
  assert.equal(Object.keys(keys).length, 5);
});

test('a grey letter is recorded, not omitted', () => {
  const keys = keyboardStatuses([{ guess: 'brick', score: scoreGuess('brick', 'honey') }]);
  assert.equal(keys.b, ABSENT);
});

// ---------------------------------------------------------------------------
// guessProblem
// ---------------------------------------------------------------------------

test('a real five-letter word is accepted', () => {
  assert.equal(guessProblem('crane'), null);
});

test('short, long, non-alphabetic and unknown guesses are each rejected by code', () => {
  assert.equal(guessProblem('bee').code, 'too-short');
  assert.equal(guessProblem('beetle').code, 'too-long');
  assert.equal(guessProblem('be3ee').code, 'not-letters');
  assert.equal(guessProblem('zzzzz').code, 'unknown-word');
});

test('every answer is a legal guess', () => {
  for (const answer of ANSWERS) {
    assert.equal(guessProblem(answer), null, `${answer} is not guessable`);
  }
});

// ---------------------------------------------------------------------------
// The word lists themselves
// ---------------------------------------------------------------------------

test('answers are five lowercase letters and unique', () => {
  for (const answer of ANSWERS) {
    assert.match(answer, /^[a-z]{5}$/, `bad answer: ${JSON.stringify(answer)}`);
  }
  assert.equal(new Set(ANSWERS).size, ANSWERS.length, 'duplicate answer');
});

test('the allowed list is large enough to be worth calling a dictionary', () => {
  assert.ok(allowedCount() > 5000, `only ${allowedCount()} allowed words`);
  assert.ok(isAllowedGuess('CRANE'), 'lookup must be case-insensitive');
  assert.equal(isAllowedGuess('qqqqq'), false);
});

test('plurals of common four-letter words are guessable', () => {
  // The raw dictionary has no inflections; this is the generator's whole job.
  for (const word of ['trees', 'bakes', 'seeds', 'hives', 'forks']) {
    assert.ok(isAllowedGuess(word), `${word} should be guessable`);
  }
});

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

test('a rejected guess does not burn a turn or mutate the state', () => {
  const before = newGame('honey');
  const { state, problem } = submitGuess(before, 'zzzzz');
  assert.equal(problem.code, 'unknown-word');
  assert.equal(state, before, 'state should be returned unchanged');
  assert.equal(before.rows.length, 0);
});

test('a valid guess appends a row without mutating the previous state', () => {
  const before = newGame('honey');
  const { state } = submitGuess(before, 'crane');
  assert.equal(before.rows.length, 0);
  assert.equal(state.rows.length, 1);
  assert.equal(state.rows[0].guess, 'crane');
  assert.equal(state.status, 'playing');
});

test('guessing the answer wins, at any turn', () => {
  let state = newGame('honey');
  state = submitGuess(state, 'crane').state;
  state = submitGuess(state, 'honey').state;
  assert.equal(state.status, 'won');
  assert.equal(state.rows.length, 2);
});

test('running out of guesses loses', () => {
  let state = newGame('honey');
  for (let i = 0; i < MAX_GUESSES; i += 1) {
    assert.equal(state.status, 'playing', `turn ${i} should still be playable`);
    state = submitGuess(state, 'crane').state;
  }
  assert.equal(state.status, 'lost');
  assert.equal(state.rows.length, MAX_GUESSES);
});

test('a finished game accepts no further guesses', () => {
  let state = newGame('honey');
  state = submitGuess(state, 'honey').state;
  const { state: after, problem } = submitGuess(state, 'crane');
  assert.equal(problem.code, 'finished');
  assert.equal(after.rows.length, 1);
});

// ---------------------------------------------------------------------------
// Daily puzzle
// ---------------------------------------------------------------------------

const day = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

test('the epoch is puzzle 0 and days count up from it', () => {
  assert.equal(puzzleIndex(day(2026, 1, 1)), 0);
  assert.equal(puzzleIndex(day(2026, 1, 2)), 1);
  assert.equal(puzzleIndex(day(2026, 2, 1)), 31);
  assert.equal(puzzleIndex(day(2025, 12, 31)), -1);
});

test('puzzle index is unaffected by the time of day', () => {
  assert.equal(
    puzzleIndex(new Date(2026, 8, 8, 0, 0, 1)),
    puzzleIndex(new Date(2026, 8, 8, 23, 59, 59)),
  );
});

test('the same date always yields the same word', () => {
  const first = dailyAnswer(day(2026, 9, 8));
  const second = dailyAnswer(new Date(2026, 8, 8, 4, 30));
  assert.equal(first, second);
  assert.ok(ANSWERS.includes(first));
});

test('consecutive days differ', () => {
  const words = [];
  for (let d = 1; d <= 14; d += 1) words.push(dailyAnswer(day(2026, 3, d)));
  assert.equal(new Set(words).size, words.length);
});

test('one full cycle uses every answer exactly once before repeating', () => {
  const n = ANSWERS.length;
  const seen = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(2026, 0, 1);
    d.setDate(d.getDate() + i);
    seen.push(dailyAnswer(d));
  }
  assert.equal(new Set(seen).size, n, 'the cycle should be a permutation');
  assert.deepEqual(new Set(seen), new Set(ANSWERS));
});

test('dates before the epoch are valid puzzles, not a crash', () => {
  const word = dailyAnswer(day(2020, 5, 17));
  assert.ok(ANSWERS.includes(word), `got ${word}`);
});

test('the shuffle is a fixed permutation, not sorted or reversed', () => {
  const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const once = seededShuffle(input, 1234);
  const twice = seededShuffle(input, 1234);
  assert.deepEqual(once, twice, 'same seed must give the same order');
  assert.deepEqual([...once].sort(), input, 'shuffle must not drop or add items');
  assert.notDeepEqual(once, input);
  assert.notDeepEqual(seededShuffle(input, 5678), once, 'different seed, different order');
});

test('a different answer list gives a different daily word', () => {
  const other = ['aaaaa', 'bbbbb', 'ccccc'];
  assert.ok(other.includes(dailyAnswer(day(2026, 9, 8), other)));
});

test('two lists that agree on length and first word do not share a shuffle', () => {
  // The shuffle is memoised. Keying that cache on anything less than the whole
  // list means the second caller gets the first caller's order — and so a word
  // that is not in the list they passed.
  const a = ['crane', 'tiger', 'mango', 'stone'];
  const b = ['crane', 'zebra', 'olive', 'plumb'];
  const when = day(2026, 9, 8);

  const fromA = dailyAnswer(when, a, 999);
  const fromB = dailyAnswer(when, b, 999);

  assert.ok(a.includes(fromA), `${fromA} is not in the first list`);
  assert.ok(b.includes(fromB), `${fromB} is not in the second list`);
});

test('the memo still returns the same order for the same list', () => {
  const list = ['crane', 'tiger', 'mango', 'stone'];
  const when = day(2026, 9, 8);
  assert.equal(dailyAnswer(when, list, 999), dailyAnswer(when, [...list], 999));
});

// ---------------------------------------------------------------------------
// Share text
// ---------------------------------------------------------------------------

test('the share grid reports the score without leaking the word', () => {
  let state = newGame('honey');
  state = submitGuess(state, 'crane').state;
  state = submitGuess(state, 'honey').state;

  const text = shareText(state, 42);
  assert.equal(text.split('\n')[0], 'bee-dle 42 2/6 🐝');
  assert.ok(text.endsWith('🟩🟩🟩🟩🟩'));
  assert.ok(!text.toLowerCase().includes('honey'), 'must not spoil the answer');
});

test('shareText requires the puzzle number rather than assuming today', () => {
  // Defaulting it would stamp today's number onto a restored older grid.
  assert.equal(shareText.length, 2);
});

test('a loss shares as X/6', () => {
  let state = newGame('honey');
  for (let i = 0; i < MAX_GUESSES; i += 1) state = submitGuess(state, 'crane').state;
  assert.ok(shareText(state, 7).startsWith('bee-dle 7 X/6'));
});
