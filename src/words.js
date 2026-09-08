import { ANSWERS } from './answers.js';
import { ALLOWED } from './allowed.js';

// A guess is legal if it is in the generated dictionary OR is a past/future
// answer. The union matters: answers are hand-curated and a few of them
// (plurals, modern words) are absent from the generated list.
const ALLOWED_SET = new Set([...ALLOWED, ...ANSWERS]);

export { ANSWERS };

export function isAllowedGuess(word) {
  return ALLOWED_SET.has(String(word).toLowerCase());
}

export function allowedCount() {
  return ALLOWED_SET.size;
}
