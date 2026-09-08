// localStorage wrappers. Every read is defensive: a player who clears storage,
// blocks it, or arrives with a half-written value from an older version should
// get a fresh game, never a broken page.

const PROGRESS_KEY = 'beedle:progress';
const STATS_KEY = 'beedle:stats';

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing, quota, or storage disabled. The game still plays; it
    // just won't survive a reload.
  }
}

export const emptyStats = () => ({
  played: 0,
  wins: 0,
  streak: 0,
  maxStreak: 0,
  distribution: [0, 0, 0, 0, 0, 0],
  lastIndex: null,
});

export function loadStats() {
  const saved = read(STATS_KEY);
  if (!saved || typeof saved !== 'object') return emptyStats();
  return { ...emptyStats(), ...saved };
}

export function saveStats(stats) {
  write(STATS_KEY, stats);
}

/**
 * Fold a finished game into the stats. Pure, so it can be tested without a
 * browser. Recording the same puzzle twice is a no-op — reloading a finished
 * page must not inflate the streak.
 */
export function recordResult(stats, { index, won, guesses }) {
  if (stats.lastIndex === index) return stats;

  const consecutive = stats.lastIndex === index - 1;
  const streak = won ? (consecutive ? stats.streak : 0) + 1 : 0;

  const distribution = [...stats.distribution];
  if (won && guesses >= 1 && guesses <= distribution.length) {
    distribution[guesses - 1] += 1;
  }

  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    distribution,
    lastIndex: index,
  };
}

/** Today's in-progress board, or null if the saved board is for another day. */
export function loadProgress(index) {
  const saved = read(PROGRESS_KEY);
  if (!saved || saved.index !== index || !Array.isArray(saved.guesses)) return null;
  return saved.guesses;
}

export function saveProgress(index, guesses) {
  write(PROGRESS_KEY, { index, guesses });
}
