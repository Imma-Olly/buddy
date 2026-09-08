// The daily answers for bee-dle.
//
// Hand-curated: every entry is a common, guessable five-letter word. Order is
// irrelevant — `dailyAnswer` shuffles this list with a fixed seed, so editing
// the list changes which word lands on which day. Append rather than insert if
// you care about keeping past puzzles stable.
//
// Every answer is also folded into the allowed-guess set (see words.js), so an
// answer can never be rejected as "not in word list".

export const ANSWERS = [
  // hive
  'honey', 'queen', 'drone', 'larva', 'swarm', 'combs', 'hives', 'sting',
  'petal', 'bloom', 'wings', 'waxen', 'royal', 'flora',

  // garden
  'briar', 'thorn', 'stalk', 'roots', 'seeds', 'shrub', 'grove', 'ferns',
  'mossy', 'vines', 'reeds', 'gourd', 'bulbs', 'weeds', 'tulip', 'daisy',

  // weather
  'frost', 'storm', 'cloud', 'sunny', 'windy', 'hazes', 'sleet', 'flood',
  'blaze', 'chill', 'crisp', 'gusty', 'misty',

  // food
  'amber', 'clove', 'thyme', 'basil', 'sugar', 'syrup', 'cider', 'lemon',
  'peach', 'berry', 'grape', 'melon', 'olive', 'onion', 'wheat', 'grain',
  'bread', 'toast', 'cocoa', 'mocha', 'broth', 'salad', 'spice', 'roast',
  'flour', 'dough', 'yeast', 'crust', 'slice', 'cream', 'candy', 'jelly',

  // things
  'plate', 'spoon', 'knife', 'glass', 'straw', 'chair', 'table', 'clock',
  'brush', 'paper', 'ruler', 'ladle', 'towel', 'lamps', 'radio', 'phone',
  'piano', 'drums', 'flute',

  // places
  'field', 'beach', 'river', 'ocean', 'coast', 'cliff', 'ridge', 'plain',
  'marsh', 'creek', 'lakes', 'islet', 'attic', 'porch', 'cabin', 'tower',
  'plaza', 'alley', 'depot', 'motel',

  // people
  'baker', 'miner', 'pilot', 'nurse', 'actor', 'guest', 'child', 'elder',
  'crowd', 'squad', 'guide', 'scout', 'judge', 'clerk', 'rider', 'diver',

  // verbs
  'build', 'carry', 'climb', 'dance', 'drink', 'drive', 'enjoy', 'float',
  'greet', 'knock', 'learn', 'march', 'paint', 'reach', 'shine', 'sleep',
  'speak', 'spend', 'stand', 'teach', 'think', 'throw', 'touch', 'train',
  'watch', 'weave', 'write', 'yield',

  // qualities
  'brave', 'brief', 'clean', 'clear', 'eager', 'early', 'empty', 'exact',
  'faint', 'fancy', 'fresh', 'happy', 'heavy', 'human', 'jolly', 'large',
  'light', 'loyal', 'lucky', 'noble', 'quiet', 'quick', 'rapid', 'ready',
  'rough', 'round', 'sharp', 'short', 'silly', 'smart', 'solid', 'steep',
  'sweet', 'tidal', 'tight', 'vivid',

  // colours and shapes
  'black', 'white', 'green', 'brown', 'coral', 'ivory', 'ovals', 'prism',
  'curve', 'angle', 'edges',

  // misc
  'award', 'brain', 'chess', 'dream', 'earth', 'flame', 'ghost', 'heart',
  'ideas', 'jewel', 'knots', 'label', 'magic', 'north', 'opera', 'pride',
  'quilt', 'roads', 'stone', 'trust', 'unity', 'value', 'water', 'youth',
  'zebra',
];
