import type { MoodClass } from './moodClasses';

/**
 * Small voice banks per temperament blend.
 * Flavor = "{adverb} {posture}" — not a 81-cell grid.
 *
 * Only sanCho + melPhl are filled for the lab sketch (opposite poles).
 * Others fall back to `generic`.
 */
export type MoodLexicon = Record<
  MoodClass,
  { adverb: string; posture: string; tell: string }
>;

const generic: MoodLexicon = {
  open: { adverb: 'openly', posture: 'receptive', tell: 'meets your eyes' },
  warm: { adverb: 'warmly', posture: 'at ease', tell: 'softens in the shoulders' },
  playful: { adverb: 'lightly', posture: 'amused', tell: 'almost smiles' },
  driven: { adverb: 'briskly', posture: 'purposeful', tell: 'keeps moving' },
  affectionate: { adverb: 'gently', posture: 'close', tell: 'lingers nearby' },
  withdrawn: { adverb: 'quietly', posture: 'inward', tell: 'answers briefly' },
  irritable: { adverb: 'sharply', posture: 'bristling', tell: 'short answers' },
  anxious: { adverb: 'tightly', posture: 'watchful', tell: 'glances past you' },
  melancholy: { adverb: 'heavily', posture: 'subdued', tell: 'gaze drops' },
  tired: { adverb: 'slowly', posture: 'worn', tell: 'stifles a yawn' },
  overwhelmed: { adverb: 'breathlessly', posture: 'overfull', tell: 'loses the thread' },
  frustrated: { adverb: 'tightly', posture: 'blocked', tell: 'jaw sets' },
};

/** Amberyl-style: Sanguine primary, Choleric secondary — bright, forward, can snap. */
const sanguineCholeric: MoodLexicon = {
  open: {
    adverb: 'brightly',
    posture: 'forward',
    tell: 'leans in as if the talk is a game',
  },
  warm: {
    adverb: 'boldly',
    posture: 'glowing',
    tell: 'grins like she already decided you are safe',
  },
  playful: {
    adverb: 'brazenly',
    posture: 'sparking',
    tell: 'tosses a tease and watches for the hit',
  },
  driven: {
    adverb: 'impatiently',
    posture: 'charging',
    tell: 'cuts to the point before you finish',
  },
  affectionate: {
    adverb: 'eagerly',
    posture: 'claiming space',
    tell: 'finds excuses to stay in arm’s reach',
  },
  withdrawn: {
    adverb: 'unusually',
    posture: 'muted',
    tell: 'forces a smile that does not reach her eyes',
  },
  irritable: {
    adverb: 'hotly',
    posture: 'snapping',
    tell: 'words come clipped and a little too loud',
  },
  anxious: {
    adverb: 'restlessly',
    posture: 'wired',
    tell: 'paces a half-step, then laughs it off',
  },
  melancholy: {
    adverb: 'defiantly',
    posture: 'bruised-bright',
    tell: 'jokes once, then goes quiet',
  },
  tired: {
    adverb: 'thinly',
    posture: 'running on sparks',
    tell: 'still talks, but the edges fray',
  },
  overwhelmed: {
    adverb: 'frantically',
    posture: 'overbright',
    tell: 'too many thoughts at once, none finished',
  },
  frustrated: {
    adverb: 'fiercely',
    posture: 'blocked heat',
    tell: 'looks ready to fix something with her hands',
  },
};

/** Opposite pole: Melancholic primary, Phlegmatic secondary — deep, slow, loyal. */
const melancholicPhlegmatic: MoodLexicon = {
  open: {
    adverb: 'carefully',
    posture: 'receptive',
    tell: 'listens longer than she speaks',
  },
  warm: {
    adverb: 'quietly',
    posture: 'steady-warm',
    tell: 'a small, real smile — not performed',
  },
  playful: {
    adverb: 'dryly',
    posture: 'softly amused',
    tell: 'one wry line, then soft eyes',
  },
  driven: {
    adverb: 'dutifully',
    posture: 'methodical',
    tell: 'sets to the task without fanfare',
  },
  affectionate: {
    adverb: 'tenderly',
    posture: 'near-but-still',
    tell: 'stays close without crowding',
  },
  withdrawn: {
    adverb: 'inwardly',
    posture: 'folded',
    tell: 'answers after a pause you almost miss',
  },
  irritable: {
    adverb: 'thinly',
    posture: 'tight-lipped',
    tell: 'patience frays in silence, not volume',
  },
  anxious: {
    adverb: 'softly',
    posture: 'braced',
    tell: 'hands find something to straighten',
  },
  melancholy: {
    adverb: 'heavily',
    posture: 'weathered',
    tell: 'looks past the fire into nowhere',
  },
  tired: {
    adverb: 'wearily',
    posture: 'sinking',
    tell: 'shoulders drop a fraction more each hour',
  },
  overwhelmed: {
    adverb: 'quietly',
    posture: 'flooded',
    tell: 'goes still, as if noise itself hurts',
  },
  frustrated: {
    adverb: 'patiently-strained',
    posture: 'enduring',
    tell: 'keeps working, jaw a little too set',
  },
};

const BY_BLEND: Record<string, MoodLexicon> = {
  'Sanguine-Choleric': sanguineCholeric,
  'Melancholic-Phlegmatic': melancholicPhlegmatic,
  generic,
};

export function getMoodLexicon(blend: string): MoodLexicon {
  return BY_BLEND[blend] ?? generic;
}

export function composeFlavor(
  lexicon: MoodLexicon,
  moodClass: MoodClass
): { line: string; tell: string } {
  const entry = lexicon[moodClass];
  return {
    line: `${capitalize(entry.adverb)} ${entry.posture}`,
    tell: entry.tell,
  };
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
