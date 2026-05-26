// Simple client-side profanity dictionary for basic safety filtering
const PROFANE_WORDS = [
  "abuse",
  "asshole",
  "bitch",
  "bastard",
  "crap",
  "cunt",
  "dick",
  "fucker",
  "fuck",
  "idiot",
  "motherfucker",
  "nigger",
  "pussy",
  "retard",
  "shit",
  "slut",
  "whore",
];

/**
 * Basic profanity filter that replaces profane words with asterisks.
 * Matches whole words case-insensitively.
 */
export function censorText(text: string): string {
  if (!text) return "";
  let censored = text;

  for (const word of PROFANE_WORDS) {
    // \b is word boundary to prevent partial matches (e.g. "classic" shouldn't trigger "ass")
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    censored = censored.replace(regex, "*".repeat(word.length));
  }

  return censored;
}
