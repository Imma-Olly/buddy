# bee-dle 🐝

A five-letter word game. Six guesses, one fresh puzzle a day, and everyone
playing on the same date gets the same word.

No build step, no dependencies, no framework — `index.html` plus three ES
modules. GitHub Pages can serve it straight off the default branch.

## Play locally

```sh
npm start          # http://localhost:8000
```

Any static server works; `npm start` just saves you picking one. Opening
`index.html` over `file://` will *not* work, because browsers refuse to load ES
modules from that scheme.

## Test

```sh
npm test
```

44 tests, no dependencies — `node --test` and nothing else. The bulk of them are
about the tile colours, which is the one rule in this kind of game that is
genuinely easy to get wrong. Guessing `eerie` against `there` has to produce one
green e, one yellow e and one grey e; the naive "is this letter anywhere in the
answer" implementation gets that wrong and is killed by six of the tests.

## How it fits together

| File | What it does |
| --- | --- |
| `src/game.js` | Every rule. Pure functions, no DOM, no storage, no randomness. |
| `src/words.js` | The guess dictionary — the generated list unioned with the answers. |
| `src/answers.js` | Hand-curated daily answers. Edit this to change the puzzles. |
| `src/allowed.js` | Generated. What counts as a real word. |
| `src/storage.js` | localStorage, defensively: a blocked or corrupt store loses progress, never the page. |
| `src/main.js` | Draws the rules. Board, keyboard, animations, sharing. |
| `tools/build-allowed.mjs` | Regenerates `src/allowed.js`. |
| `tools/serve.mjs` | The `npm start` server. |

### The daily word

`dailyAnswer()` shuffles `ANSWERS` with a fixed seed and indexes it by the
number of days since 2026-01-01 in the player's *local* calendar. So the word
turns over at each player's own midnight, two people in the same date always
see the same puzzle, and the sequence is identical in every browser because the
PRNG is written out rather than taken from `Math.random`.

Changing `SHUFFLE_SEED` — or inserting into the middle of `ANSWERS` — reshuffles
every future puzzle. Append instead.

### Words

The guess list is generated from `/usr/share/dict/web2` (Webster's Second,
shipped with macOS and the BSDs). It contains no inflected forms at all, so the
generator also adds *four-letter word* + `s`; without that, a player typing
`trees` gets told it isn't a word. 12,742 words in total, plus the answers.

## Deploying

Settings → Pages → Deploy from a branch → `main` / `/ (root)`. There is nothing
to build.
