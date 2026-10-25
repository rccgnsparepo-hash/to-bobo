/**
 * Comprehensive Auto-Correct & Spelling Engine
 * Handles common typos, contractions, phonetic substitutions, capitalization, and quick predictive suggestions.
 */

// Common typos and misspellings map (lowercase key -> corrected value)
export const AUTOCORRECT_DICTIONARY: Record<string, string> = {
  // English common typos & misspellings
  teh: "the",
  hte: "the",
  adn: "and",
  nad: "and",
  waht: "what",
  wath: "what",
  whay: "why",
  taht: "that",
  tht: "that",
  thsi: "this",
  tihs: "this",
  wierd: "weird",
  recieve: "receive",
  recieved: "received",
  recieving: "receiving",
  seperate: "separate",
  seperated: "separated",
  definately: "definitely",
  definatly: "definitely",
  untill: "until",
  alot: "a lot",
  accross: "across",
  begining: "beginning",
  calender: "calendar",
  collegue: "colleague",
  embarass: "embarrass",
  goverment: "government",
  happended: "happened",
  intrest: "interest",
  intresting: "interesting",
  knowlege: "knowledge",
  neccessary: "necessary",
  necesary: "necessary",
  noticable: "noticeable",
  occured: "occurred",
  possession: "possession",
  pronounciation: "pronunciation",
  publically: "publicly",
  realy: "really",
  recomended: "recommended",
  remeber: "remember",
  resistence: "resistance",
  seens: "seems",
  succesful: "successful",
  suprise: "surprise",
  suprised: "surprised",
  tommorrow: "tomorrow",
  tomorow: "tomorrow",
  unfortunatly: "unfortunately",
  wich: "which",
  writting: "writing",
  truely: "truly",
  accomodate: "accommodate",
  foward: "forward",
  beleive: "believe",
  beleived: "believed",
  beleiving: "believing",

  // Contractions without apostrophes
  im: "I'm",
  ive: "I've",
  id: "I'd",
  ill: "I'll",
  dont: "don't",
  cant: "can't",
  wont: "won't",
  didnt: "didn't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  hasnt: "hasn't",
  havent: "haven't",
  hadnt: "hadn't",
  couldnt: "couldn't",
  shouldnt: "shouldn't",
  wouldnt: "wouldn't",
  youre: "you're",
  youve: "you've",
  youd: "you'd",
  theyre: "they're",
  theyve: "they've",
  weve: "we've",
  wed: "we'd",
  whats: "what's",
  hows: "how's",
  wheres: "where's",
  theres: "there's",
  thats: "that's",
  lets: "let's",
  itll: "it'll",
  thatll: "that'll",

  // Abbreviations, chatspeak & informal
  u: "you",
  ur: "your",
  ure: "you're",
  r: "are",
  y: "why",
  k: "okay",
  kk: "okay",
  ok: "okay",
  plz: "please",
  pls: "please",
  thx: "thanks",
  ty: "thank you",
  tysm: "thank you so much",
  bc: "because",
  bcz: "because",
  cuz: "because",
  abt: "about",
  smh: "shaking my head",
  tbh: "to be honest",
  idk: "I don't know",
  rn: "right now",
  brb: "be right back",
  btw: "by the way",
  omg: "OMG",
  hru: "how are you",
  gm: "good morning",
  gn: "good night",
  nvm: "never mind",
  wbu: "what about you",
  dm: "DM",
  dms: "DMs",
  flick: "Flick",
  flicks: "Flicks",
  flickering: "Flickering",
  opp: "opponent",
  vs: "VS",
};

/**
 * Returns matching suggestion or null
 */
export function getAutocorrectSuggestion(word: string): { original: string; suggestion: string } | null {
  if (!word || word.length < 1) return null;
  const clean = word.toLowerCase().trim();
  if (AUTOCORRECT_DICTIONARY[clean]) {
    const rawCorrected = AUTOCORRECT_DICTIONARY[clean];
    // Preserve initial capitalization if typed word was capitalized
    const isFirstUpper = word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
    const finalSuggestion = isFirstUpper && rawCorrected[0] !== rawCorrected[0].toUpperCase()
      ? rawCorrected.charAt(0).toUpperCase() + rawCorrected.slice(1)
      : rawCorrected;
    return { original: word, suggestion: finalSuggestion };
  }
  return null;
}

/**
 * Returns top 3 candidate suggestions for a partially typed or misspelled word
 */
export function getWordPredictions(word: string): string[] {
  if (!word || word.trim().length === 0) return [];
  const clean = word.toLowerCase().trim();

  const match = getAutocorrectSuggestion(word);
  const results: string[] = [];
  if (match && match.suggestion.toLowerCase() !== clean) {
    results.push(match.suggestion);
  }

  // Check prefix matches in dictionary
  for (const [key, val] of Object.entries(AUTOCORRECT_DICTIONARY)) {
    if (key.startsWith(clean) && !results.includes(val) && val.toLowerCase() !== clean) {
      results.push(val);
      if (results.length >= 3) break;
    }
  }

  return results.slice(0, 3);
}

/**
 * Auto-corrects the last word in a text string if followed by space or punctuation.
 */
export function applyInlineAutocorrect(
  text: string,
  cursorPos?: number
): { newText: string; newCursorPos?: number; corrected: boolean } {
  const effectiveCursor = cursorPos ?? text.length;
  const beforeCursor = text.slice(0, effectiveCursor);
  const afterCursor = text.slice(effectiveCursor);

  // Match the word preceding the last delimiter (e.g. space)
  const match = beforeCursor.match(/([a-zA-Z0-9']+)(\s+)$/);
  if (!match) return { newText: text, newCursorPos: cursorPos, corrected: false };

  const word = match[1];
  const trailing = match[2];
  const suggestionObj = getAutocorrectSuggestion(word);

  if (suggestionObj && suggestionObj.suggestion !== word) {
    const prefix = beforeCursor.slice(0, beforeCursor.length - (word.length + trailing.length));
    const replaced = prefix + suggestionObj.suggestion + trailing;
    const newText = replaced + afterCursor;
    const newCursorPos = replaced.length;
    return { newText, newCursorPos, corrected: true };
  }

  return { newText: text, newCursorPos: cursorPos, corrected: false };
}
