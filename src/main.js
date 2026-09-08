// DOM wiring. All the rules live in game.js; this file only draws them.

import {
  MAX_GUESSES,
  WORD_LENGTH,
  dailyAnswer,
  keyboardStatuses,
  newGame,
  puzzleIndex,
  shareText,
  submitGuess,
} from './game.js';
import { loadProgress, loadStats, recordResult, saveProgress, saveStats } from './storage.js';

const KEY_ROWS = [
  [...'qwertyuiop'],
  [...'asdfghjkl'],
  ['enter', ...'zxcvbnm', 'back'],
];

const FLIP_MS = 520; // must match .tile.reveal in styles.css
const FLIP_STAGGER = 260;

const board = document.getElementById('board');
const keyboard = document.getElementById('keyboard');
const toast = document.getElementById('toast');
const helpSheet = document.getElementById('help');
const statsSheet = document.getElementById('stats');
const shareButton = document.getElementById('share');

const index = puzzleIndex();
let state = newGame(dailyAnswer());
let typed = '';
let busy = false; // true while tiles are flipping — swallow input
let stats = loadStats();

// ------------------------------------------------------------------ chrome

function showToast(message, ms = 1600) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), ms);
}

function buildBoard() {
  for (let r = 0; r < MAX_GUESSES; r += 1) {
    const row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('role', 'row');
    for (let c = 0; c < WORD_LENGTH; c += 1) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role', 'gridcell');
      row.append(tile);
    }
    board.append(row);
  }
}

function buildKeyboard() {
  for (const letters of KEY_ROWS) {
    const row = document.createElement('div');
    row.className = 'krow';
    for (const letter of letters) {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = letter.length > 1 ? 'key wide' : 'key';
      key.dataset.key = letter;
      key.textContent = letter === 'back' ? '⌫' : letter;
      key.setAttribute('aria-label', letter === 'back' ? 'Backspace' : letter);
      row.append(key);
    }
    keyboard.append(row);
  }
}

const rowAt = (i) => board.children[i];

/** Redraw the row the player is currently typing into. */
function paintTyping() {
  const row = rowAt(state.rows.length);
  if (!row) return;
  [...row.children].forEach((tile, i) => {
    const letter = typed[i] ?? '';
    if (tile.textContent !== letter) {
      tile.textContent = letter;
      tile.classList.toggle('filled', letter !== '');
    }
  });
}

/** Draw an already-scored row. `animate` staggers the flip; restores don't. */
function paintRow(rowIndex, { guess, score }, animate) {
  const row = rowAt(rowIndex);
  [...row.children].forEach((tile, i) => {
    tile.textContent = guess[i];
    tile.classList.add('filled');
    tile.setAttribute('aria-label', `${guess[i]}, ${score[i]}`);
    if (!animate) {
      tile.classList.add(score[i]);
      return;
    }
    tile.style.animationDelay = `${i * FLIP_STAGGER}ms`;
    tile.classList.add('reveal');
    // Swap the colour in while the tile is edge-on.
    setTimeout(() => tile.classList.add(score[i]), i * FLIP_STAGGER + FLIP_MS / 2);
  });
}

function paintKeyboard() {
  const statuses = keyboardStatuses(state.rows);
  for (const key of keyboard.querySelectorAll('.key')) {
    const status = statuses[key.dataset.key];
    key.classList.remove('correct', 'present', 'absent');
    if (status) key.classList.add(status);
  }
}

// ------------------------------------------------------------------- stats

function paintStats() {
  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const cells = [
    [stats.played, 'Played'],
    [winRate, 'Win %'],
    [stats.streak, 'Current streak'],
    [stats.maxStreak, 'Max streak'],
  ];
  document.getElementById('stat-row').replaceChildren(
    ...cells.map(([value, label]) => {
      const wrap = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = value;
      const dd = document.createElement('dd');
      dd.textContent = label;
      wrap.append(dt, dd);
      return wrap;
    }),
  );

  const max = Math.max(1, ...stats.distribution);
  const todaysRow = state.status === 'won' ? state.rows.length : 0;
  document.getElementById('distribution').replaceChildren(
    ...stats.distribution.map((count, i) => {
      const line = document.createElement('div');
      line.className = 'bar-line';
      const label = document.createElement('span');
      label.textContent = i + 1;
      const bar = document.createElement('span');
      bar.className = i + 1 === todaysRow ? 'bar current' : 'bar';
      bar.style.width = `${Math.max(8, (count / max) * 100)}%`;
      bar.textContent = count;
      line.append(label, bar);
      return line;
    }),
  );

  shareButton.hidden = state.status === 'playing';
}

// Built once so the ticking value can be written with textContent — no
// innerHTML anywhere in this file.
const countdownLabel = document.createElement('span');
const countdownClock = document.createElement('strong');
document.getElementById('countdown').append(countdownLabel, countdownClock);

let rolledOver = false;

function tickCountdown() {
  // The puzzle number is captured once at boot, so a tab left open past local
  // midnight is still playing yesterday's word. Say so rather than resetting
  // the clock to 24h and pretending.
  if (!rolledOver && puzzleIndex() !== index) {
    rolledOver = true;
    countdownLabel.textContent = 'A new bee-dle is ready';
    countdownClock.textContent = 'Refresh to play it';
    showToast('A new bee-dle is ready — refresh', 6000);
    return;
  }
  if (rolledOver) return;

  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const left = midnight - now;
  const pad = (n) => String(n).padStart(2, '0');
  const hh = pad(Math.floor(left / 3600000));
  const mm = pad(Math.floor(left / 60000) % 60);
  const ss = pad(Math.floor(left / 1000) % 60);
  countdownLabel.textContent = 'Next bee-dle';
  countdownClock.textContent = `${hh}:${mm}:${ss}`;
}

// -------------------------------------------------------------------- play

function finish() {
  const won = state.status === 'won';
  stats = recordResult(stats, { index, won, guesses: state.rows.length });
  saveStats(stats);

  if (won) {
    rowAt(state.rows.length - 1).classList.add('win');
    const praise = ['Genius 🐝', 'Sharp', 'Nice', 'Sweet', 'Phew', 'Just in time'];
    showToast(praise[state.rows.length - 1] ?? 'Nice');
  } else {
    showToast(state.answer.toUpperCase(), 4000);
  }

  paintStats();
  setTimeout(() => statsSheet.showModal(), won ? 2200 : 2600);
}

function commit() {
  const rowIndex = state.rows.length;
  const { state: next, problem } = submitGuess(state, typed);

  if (problem) {
    const row = rowAt(rowIndex) ?? rowAt(MAX_GUESSES - 1);
    row.classList.remove('invalid');
    void row.offsetWidth; // restart the animation
    row.classList.add('invalid');
    showToast(problem.message);
    return;
  }

  state = next;
  typed = '';
  busy = true;

  paintRow(rowIndex, state.rows[rowIndex], true);
  saveProgress(index, state.rows.map((row) => row.guess));

  const settle = (WORD_LENGTH - 1) * FLIP_STAGGER + FLIP_MS;
  setTimeout(() => {
    busy = false;
    paintKeyboard();
    if (state.status !== 'playing') finish();
  }, settle);
}

function handleKey(raw) {
  if (busy || state.status !== 'playing') return;
  const key = raw.toLowerCase();

  if (key === 'enter') {
    commit();
  } else if (key === 'back' || key === 'backspace') {
    typed = typed.slice(0, -1);
    paintTyping();
  } else if (/^[a-z]$/.test(key) && typed.length < WORD_LENGTH) {
    typed += key;
    paintTyping();
  }
}

async function share() {
  const text = shareText(state, index);
  try {
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  } catch {
    showToast('Could not copy');
  }
}

// -------------------------------------------------------------------- boot

function restore() {
  const saved = loadProgress(index);
  if (!saved) return;
  for (const guess of saved) {
    const { state: next, problem } = submitGuess(state, guess);
    if (problem) break; // saved board is stale or corrupt; keep what loaded
    state = next;
    paintRow(state.rows.length - 1, state.rows[state.rows.length - 1], false);
  }
  paintKeyboard();
  if (state.status !== 'playing') {
    if (state.status === 'lost') showToast(state.answer.toUpperCase(), 4000);
    paintStats();
    statsSheet.showModal();
  }
}

buildBoard();
buildKeyboard();
restore();
paintStats();
tickCountdown();
setInterval(tickCountdown, 1000);

keyboard.addEventListener('click', (event) => {
  const key = event.target.closest('.key');
  if (key) handleKey(key.dataset.key);
});

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  if (event.key === 'Enter' || event.key === 'Backspace' || /^[a-zA-Z]$/.test(event.key)) {
    event.preventDefault();
    handleKey(event.key);
  }
});

document.getElementById('help-button').addEventListener('click', () => helpSheet.showModal());
document.getElementById('stats-button').addEventListener('click', () => {
  paintStats();
  statsSheet.showModal();
});
shareButton.addEventListener('click', share);

for (const sheet of document.querySelectorAll('dialog')) {
  sheet.querySelector('[data-close]').addEventListener('click', () => sheet.close());
  // Click outside the card closes it.
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) sheet.close();
  });
}

// First visit: explain the rules before they start typing.
if (stats.played === 0 && state.rows.length === 0) helpSheet.showModal();
