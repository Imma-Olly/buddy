// bee-dle game rules. No DOM, no storage, no randomness — everything here is a
// pure function of its arguments so the tests can pin it exactly.

import { ANSWERS, isAllowedGuess } from './words.js';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export const CORRECT = 'correct';
export const PRESENT = 'present';
export const ABSENT = 'absent';

/**
 * Score a guess against an answer, Wordle-style.
 *
 * The duplicate-letter rule is the whole reason this is its own function:
 * a letter is only yellow if the answer still has an *unaccounted-for* copy of
 * it after all the greens are assigned. So guessing "eerie" against "there"
 * yields one green e and one yellow e, not four yellows — the answer only has
 * two e's, and one of them is already spoken for by the green.
 *
 * @param {string} guess  five letters
 * @param {string} answer five letters
 * @returns {Array<'correct'|'present'|'absent'>} one status per position
 */
export function scoreGuess(guess, answer) {
  const g = String(guess).toLowerCase();
  const a = String(answer).toLowerCase();

  if (g.length !== a.length) {
    throw new RangeError(`guess "${g}" and answer "${a}" differ in length`);
  }

  const remaining = new Map();
  for (const letter of a) {
    remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
  }

  const score = new Array(g.length).fill(ABSENT);

  // Greens first, and they consume their letter from the pool.
  for (let i = 0; i < g.length; i += 1) {
    if (g[i] === a[i]) {
      score[i] = CORRECT;
      remaining.set(g[i], remaining.get(g[i]) - 1);
    }
  }

  // Then yellows, left to right, out of whatever is left.
  for (let i = 0; i < g.length; i += 1) {
    if (score[i] === CORRECT) continue;
    const left = remaining.get(g[i]) ?? 0;
    if (left > 0) {
      score[i] = PRESENT;
      remaining.set(g[i], left - 1);
    }
  }

  return score;
}

const RANK = { [ABSENT]: 0, [PRESENT]: 1, [CORRECT]: 2 };

/**
 * Best-known status for each letter the player has used, for colouring the
 * on-screen keyboard. A letter never downgrades: once a key is green it stays
 * green even if a later guess puts that letter somewhere wrong.
 *
 * @param {Array<{guess: string, score: string[]}>} rows
 * @returns {Record<string, string>}
 */
export function keyboardStatuses(rows) {
  const best = {};
  for (const row of rows) {
    const letters = String(row.guess).toLowerCase();
    for (let i = 0; i < letters.length; i += 1) {
      const letter = letters[i];
      const status = row.score[i];
      if (best[letter] === undefined || RANK[status] > RANK[best[letter]]) {
        best[letter] = status;
      }
    }
  }
  return best;
}

/**
 * Why a guess cannot be submitted, or null if it can.
 * @returns {null | {code: string, message: string}}
 */
export function guessProblem(guess) {
  const g = String(guess).toLowerCase();
  if (g.length < WORD_LENGTH) {
    return { code: 'too-short', message: 'Not enough letters' };
  }
  if (g.length > WORD_LENGTH) {
    return { code: 'too-long', message: 'Too many letters' };
  }
  if (!/^[a-z]{5}$/.test(g)) {
    return { code: 'not-letters', message: 'Letters only' };
  }
  if (!isAllowedGuess(g)) {
    return { code: 'unknown-word', message: 'Not in word list' };
  }
  return null;
}

export function newGame(answer) {
  return { answer: String(answer).toLowerCase(), rows: [], status: 'playing' };
}

/**
 * Apply a guess. Returns a new state — the input is never mutated — plus the
 * problem that blocked it, if any. A blocked guess leaves the state untouched
 * and does NOT burn a turn.
 *
 * @returns {{state: object, problem: null | {code: string, message: string}}}
 */
export function submitGuess(state, guess) {
  if (state.status !== 'playing') {
    return { state, problem: { code: 'finished', message: 'Game over' } };
  }

  const problem = guessProblem(guess);
  if (problem) return { state, problem };

  const g = String(guess).toLowerCase();
  const score = scoreGuess(g, state.answer);
  const rows = [...state.rows, { guess: g, score }];

  let status = 'playing';
  if (g === state.answer) status = 'won';
  else if (rows.length >= MAX_GUESSES) status = 'lost';

  return { state: { ...state, rows, status }, problem: null };
}

// ---------------------------------------------------------------------------
// Daily puzzle selection
// ---------------------------------------------------------------------------

// Puzzle #0 is 2026-01-01, local time. Using the player's local calendar date
// means everybody gets a fresh word at their own midnight, and everybody in the
// same calendar date gets the same word.
export const EPOCH = { year: 2026, month: 0, day: 1 };

// Changing this reshuffles every future puzzle. Don't.
export const SHUFFLE_SEED = 0xbeed1e;

/** Days between the epoch and `date`, in the local calendar. Can be negative. */
export function puzzleIndex(date = new Date()) {
  const epoch = Date.UTC(EPOCH.year, EPOCH.month, EPOCH.day);
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day - epoch) / 86400000);
}

// mulberry32: small, fast, and — the part we actually need — identical in every
// JS engine, so two players never see different words for the same day.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates against a seeded PRNG. Pure: the input list is not mutated. */
export function seededShuffle(list, seed) {
  const random = mulberry32(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const orderCache = new Map();

function order(answers, seed) {
  // The key has to identify the whole list. Keying on length and first word
  // was enough for the one list that ships and wrong for any second one: two
  // different lists that happen to agree on both would share a cached shuffle,
  // and `dailyAnswer` would hand back a word that is not in the list it was
  // given. Joining is O(n) on a few hundred short strings — it does not matter.
  const key = `${seed}\n${answers.join(' ')}`;
  if (!orderCache.has(key)) orderCache.set(key, seededShuffle(answers, seed));
  return orderCache.get(key);
}

/**
 * The word for a given day. Wraps in both directions, so dates before the
 * epoch are valid puzzles rather than a crash.
 */
export function dailyAnswer(date = new Date(), answers = ANSWERS, seed = SHUFFLE_SEED) {
  const list = order(answers, seed);
  const n = list.length;
  const i = ((puzzleIndex(date) % n) + n) % n;
  return list[i];
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

const EMOJI = { [CORRECT]: '🟩', [PRESENT]: '🟨', [ABSENT]: '⬜' };

/**
 * The spoiler-free grid players paste into chat. `index` is required on
 * purpose: defaulting it to today would pair today's puzzle number with
 * whatever grid it was handed, including a restored older one.
 */
export function shareText(state, index) {
  const attempts = state.status === 'won' ? `${state.rows.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const grid = state.rows.map((row) => row.score.map((s) => EMOJI[s]).join('')).join('\n');
  return `bee-dle ${index} ${attempts} 🐝\n\n${grid}`;
}
