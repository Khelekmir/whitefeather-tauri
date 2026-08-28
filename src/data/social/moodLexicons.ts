import { tintConjunction, type MoodClass } from './moodClasses';
import type { TemperamentBlendId } from './temperaments';
import type { Sex } from '../../types/characters';

/**
 * Temperament-flavored voice banks for mood classes.
 *
 * posture = short standalone mood line (primary-only on the card)
 * tell = observable beat; tint appends a secondary tell with and/yet
 * Both fields are sexed (F / M).
 *
 * Classical grounding (speed / strength / duration of reaction):
 * - Sanguine — quick, strong, short-lived; sociable, changeable (air)
 * - Choleric — quick, strong, enduring; forceful will (fire)
 * - Melancholic — slow, strong, enduring; deep, exacting (earth)
 * - Phlegmatic — slow, mild, short-lived; calm, steady (water)
 * Primary dominates; secondary colors heat, depth, and social style.
 */
export type SexedLine = { F: string; M: string };

export type MoodLexiconEntry = {
  posture: SexedLine;
  tell: SexedLine;
};

export type MoodLexicon = Record<MoodClass, MoodLexiconEntry>;

function pickSexed(line: SexedLine, sex: Sex): string {
  return sex === 'M' ? line.M : line.F;
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function e(posture: string | SexedLine, tell: SexedLine): MoodLexiconEntry {
  return {
    posture: typeof posture === 'string' ? { F: posture, M: posture } : posture,
    tell,
  };
}

function sheHe(verbPhrase: string): SexedLine {
  return { F: `she ${verbPhrase}`, M: `he ${verbPhrase}` };
}

function herHis(nounPhrase: string): SexedLine {
  return { F: `her ${nounPhrase}`, M: `his ${nounPhrase}` };
}

/** Neutral fallback if an unknown blend string appears. */
const generic: MoodLexicon = {
  open: e('open and receptive', sheHe('meets your eyes without flinching')),
  warm: e('warm and at ease', herHis('shoulders soften')),
  playful: e('lightly amused', sheHe('almost smiles')),
  driven: e('brisk and purposeful', sheHe('keeps moving')),
  affectionate: e('gently close', sheHe('lingers nearby')),
  withdrawn: e('quiet and inward', sheHe('answers briefly')),
  irritable: e('sharp and bristling', herHis('answers come short')),
  anxious: e('tight and watchful', herHis('gaze keeps sliding past you')),
  melancholy: e('heavy and subdued', herHis('gaze drops')),
  tired: e('slow and worn', sheHe('stifles a yawn')),
  overwhelmed: e('breathless and overfull', sheHe('loses the thread mid-thought')),
  frustrated: e('tight and blocked', herHis('jaw sets')),
};

/** Sanguine–Choleric — sociable fire + will; outward, impatient when blocked. */
const sanguineCholeric: MoodLexicon = {
  open: e(
    { F: 'bright and leaning in', M: 'bright and coming forward' },
    sheHe('treats the talk like a game worth winning')
  ),
  warm: e(
    { F: 'boldly glowing', M: 'bold and easy in his skin' },
    {
      F: 'she grins like she already decided you are safe',
      M: 'he grins like he already decided you are safe',
    }
  ),
  playful: e(
    { F: 'brazen and sparking', M: 'cocky and sparking' },
    sheHe('tosses a tease and watches for the hit')
  ),
  driven: e(
    { F: 'impatient and charging', M: 'impatient and charging ahead' },
    sheHe('cuts to the point before you finish')
  ),
  affectionate: e('eagerly claiming space', sheHe('finds excuses to stay in arm’s reach')),
  withdrawn: e(
    { F: 'unnaturally muted', M: 'unnaturally held back' },
    {
      F: 'she forces a smile that does not reach her eyes',
      M: 'he forces a smile that does not reach his eyes',
    }
  ),
  irritable: e(
    { F: 'hot and snapping', M: 'hot and sharp-edged' },
    herHis('words come clipped and a little too loud')
  ),
  anxious: e(
    { F: 'restless and wired', M: 'restless and wound tight' },
    sheHe('paces a half-step, then laughs it off')
  ),
  melancholy: e(
    { F: 'bruised-bright', M: 'bruised-bright, still standing' },
    sheHe('jokes once, then goes quiet')
  ),
  tired: e(
    { F: 'still sparking, edges fraying', M: 'still sparking on empty' },
    sheHe('keeps talking, but the wit thins')
  ),
  overwhelmed: e(
    { F: 'overbright and scattered', M: 'overbright and flooded' },
    {
      F: 'too many of her thoughts arrive at once, none finished',
      M: 'too many of his thoughts arrive at once, none finished',
    }
  ),
  frustrated: e(
    { F: 'fierce, blocked heat', M: 'fierce, bottled heat' },
    {
      F: 'she looks ready to fix something with her hands',
      M: 'he looks ready to fix something with his hands',
    }
  ),
};

/** Sanguine–Phlegmatic — warm sociability softened by calm; peacemaking spark. */
const sanguinePhlegmatic: MoodLexicon = {
  open: e('easy and inviting', sheHe('leaves room for you to speak')),
  warm: e(
    { F: 'sunlit and unhurried', M: 'easy warmth, no rush' },
    sheHe('settles in as if the company itself is the plan')
  ),
  playful: e('gently teasing', sheHe('offers a soft joke and waits for the smile')),
  driven: e('steadily helpful', sheHe('picks up the next chore without announcement')),
  affectionate: e(
    { F: 'comfortably near', M: 'comfortably close' },
    sheHe('leans a shoulder your way and stays')
  ),
  withdrawn: e('quietly checked out', sheHe('keeps the smile, loses the spark')),
  irritable: e('unusually short', herHis('usual patience thins into flat replies')),
  anxious: e('softly unsettled', sheHe('laughs a beat late, watching the room')),
  melancholy: e(
    'wistful under the smile',
    sheHe('talks of brighter days without quite reaching them')
  ),
  tired: e('amiably drained', sheHe('still nods along, eyelids heavier')),
  overwhelmed: e(
    'crowded past comfort',
    sheHe('goes quiet rather than ask anyone to leave')
  ),
  frustrated: e('mildly stuck', sheHe('sighs once, then tries again without drama')),
};

/** Sanguine–Melancholic — bright surface, tender depth; earnest under the sparkle. */
const sanguineMelancholic: MoodLexicon = {
  open: e(
    'open, then careful',
    sheHe('lights up, then checks your face for permission')
  ),
  warm: e(
    { F: 'glowing and sincere', M: 'warm and unexpectedly earnest' },
    sheHe('means the compliment more than the laugh suggests')
  ),
  playful: e(
    'witty with a soft undercurrent',
    sheHe('jokes, then glances to see if it landed kind')
  ),
  driven: e(
    'eager to get it right',
    {
      F: 'she rushes in, then redoes the detail that bothered her',
      M: 'he rushes in, then redoes the detail that bothered him',
    }
  ),
  affectionate: e(
    { F: 'tenderly attentive', M: 'tender and attentive' },
    sheHe('remembers small things you did not expect anyone to notice')
  ),
  withdrawn: e('spark dimmed', sheHe('pulls back mid-sentence, suddenly elsewhere')),
  irritable: e('hurt-sharp', herHis('teasing turns thin and a little too true')),
  anxious: e(
    'brightly nervous',
    sheHe('fills silences, then apologizes for filling them')
  ),
  melancholy: e(
    { F: 'beautiful-sad', M: 'quietly beautiful-sad' },
    sheHe('smiles at a memory that costs something')
  ),
  tired: e(
    'cheer worn thin',
    sheHe('still performs lightness, voice softer than usual')
  ),
  overwhelmed: e(
    'feeling too much at once',
    {
      F: 'her eyes shine, then she looks away',
      M: 'his eyes shine, then he looks away',
    }
  ),
  frustrated: e(
    'tangled between want and doubt',
    sheHe('starts three replies and finishes none cleanly')
  ),
};

/** Choleric–Sanguine — command with charisma; decisive, magnetic, restless. */
const cholericSanguine: MoodLexicon = {
  open: e(
    { F: 'commanding and open', M: 'commanding, doors open' },
    sheHe('invites input, then steers it')
  ),
  warm: e(
    { F: 'magnetic and sure', M: 'magnetic and sure of his ground' },
    sheHe('makes the circle feel chosen')
  ),
  playful: e(
    { F: 'competitive spark', M: 'competitive good humor' },
    sheHe('turns almost anything into a contest worth smiling over')
  ),
  driven: e('already three steps ahead', sheHe('assigns the next move before the last lands')),
  affectionate: e(
    { F: 'possessively warm', M: 'claiming and warm' },
    sheHe('pulls people close and expects them to keep pace')
  ),
  withdrawn: e('closed for business', sheHe('answers in clipped nods, charm shelved')),
  irritable: e('blazing impatience', herHis('orders come sharper than intended')),
  anxious: e(
    'restlessly in charge',
    {
      F: 'she rechecks plans aloud until someone stops her',
      M: 'he rechecks plans aloud until someone stops him',
    }
  ),
  melancholy: e(
    'pride gone quiet',
    sheHe('covers the drop with a brisk change of subject')
  ),
  tired: e('running on will', sheHe('keeps directing, voice flatter than the grin')),
  overwhelmed: e(
    'too many fronts at once',
    sheHe('snaps for silence, then tries to laugh it off')
  ),
  frustrated: e(
    'blocked and burning',
    sheHe('looks ready to push through whatever stands in the way')
  ),
};

/** Choleric–Melancholic — drive + exacting depth; high standards, cold fire. */
const cholericMelancholic: MoodLexicon = {
  open: e(
    'precise and listening',
    {
      F: 'she weighs your words before offering any of her own',
      M: 'he weighs your words before offering any of his own',
    }
  ),
  warm: e(
    { F: 'reserved heat', M: 'reserved, solid heat' },
    sheHe('shows favor by trusting you with the real plan')
  ),
  playful: e('dry, edged humor', sheHe('lands a line so exact it almost cuts')),
  driven: e('relentlessly exacting', sheHe('will not stop until the standard is met')),
  affectionate: e(
    'loyalty like a vow',
    sheHe('stands closer when the work is hard, not when it is easy')
  ),
  withdrawn: e('walled and assessing', herHis('silence feels like a verdict pending')),
  irritable: e('coldly cutting', herHis('corrections arrive without cushion')),
  anxious: e('tight over details', sheHe('rechecks what should already be finished')),
  melancholy: e(
    'heavy with unmet measure',
    sheHe('stares at the gap between ideal and real')
  ),
  tired: e('will worn against the grain', sheHe('keeps working, mouth a hard line')),
  overwhelmed: e(
    'standards collapsing inward',
    sheHe('catalogs failures faster than solutions')
  ),
  frustrated: e(
    'furious at the imperfect',
    herHis('hands go still, then restart with force')
  ),
};

/** Choleric–Phlegmatic — steel will, quiet delivery; patient force, slow-burn command. */
const cholericPhlegmatic: MoodLexicon = {
  open: e('steady and approachable', sheHe('hears you out without losing the thread')),
  warm: e(
    { F: 'solid, low-key warmth', M: 'solid, low-key warmth' },
    sheHe('shows care by making the path clearer')
  ),
  playful: e('understated amusement', sheHe('smiles with the eyes more than the mouth')),
  driven: e(
    { F: 'quietly inexorable', M: 'quietly inexorable' },
    sheHe('advances the plan without raising a voice')
  ),
  affectionate: e(
    'loyal without fuss',
    sheHe('stays put when others get dramatic')
  ),
  withdrawn: e('sealed calm', sheHe('goes still and unreadable')),
  irritable: e(
    'cold pressure',
    herHis('displeasure arrives as silence with weight')
  ),
  anxious: e(
    'controlled tension',
    herHis('jaw works once, then settles again')
  ),
  melancholy: e(
    'stoic and lowered',
    sheHe('carries the mood without asking company for it')
  ),
  tired: e('endurance thinning', sheHe('keeps the posture, loses the pace')),
  overwhelmed: e(
    'load held too long',
    sheHe('sets one thing down carefully, then another')
  ),
  frustrated: e(
    'immovable against the obstacle',
    sheHe('repeats the demand once, softer and firmer')
  ),
};

/** Melancholic–Choleric — deep feeling + will; principled intensity, loyal severity. */
const melancholicCholeric: MoodLexicon = {
  open: e(
    'serious and receptive',
    sheHe('listens as if the truth might be costly')
  ),
  warm: e(
    { F: 'deeply, carefully warm', M: 'deeply, carefully warm' },
    sheHe('offers warmth like something earned, not spent')
  ),
  playful: e(
    'rare, pointed humor',
    sheHe('allows one dry spark, then returns to gravity')
  ),
  driven: e(
    'principled and relentless',
    sheHe('pursues what ought to be, not what is easy')
  ),
  affectionate: e(
    'devotion with spine',
    {
      F: 'she stands with you as if desertion were unthinkable',
      M: 'he stands with you as if desertion were unthinkable',
    }
  ),
  withdrawn: e(
    'inward and armored',
    sheHe('answers from a long way inside')
  ),
  irritable: e(
    'righteous edge',
    herHis('anger has reasons and remembers them')
  ),
  anxious: e(
    'braced for failing the mark',
    sheHe('prepares for the worst outcome in careful detail')
  ),
  melancholy: e(
    'grave and enduring',
    herHis('sadness settles in like weather, not a shower')
  ),
  tired: e(
    'soul-weary resolve',
    sheHe('continues because stopping would feel like betrayal')
  ),
  overwhelmed: e(
    'crushed by consequence',
    {
      F: 'she goes quiet under the weight of what it all means',
      M: 'he goes quiet under the weight of what it all means',
    }
  ),
  frustrated: e(
    'outraged at the unfair',
    herHis('voice hardens around a principle')
  ),
};

/** Melancholic–Phlegmatic — thorough, stable, quiet depth; reliable, risk of paralysis. */
const melancholicPhlegmatic: MoodLexicon = {
  open: e(
    { F: 'careful and receptive', M: 'measured and receptive' },
    {
      F: 'she listens longer than she speaks',
      M: 'he listens longer than he speaks',
    }
  ),
  warm: e(
    { F: 'quietly steady-warm', M: 'quietly solid-warm' },
    {
      F: 'a small, real smile — not performed',
      M: 'a small, real smile — not performed',
    }
  ),
  playful: e(
    { F: 'dry, soft amusement', M: 'dry, understated amusement' },
    {
      F: 'one wry line from her, then soft eyes',
      M: 'one wry line from him, then softer eyes than expected',
    }
  ),
  driven: e('dutiful and methodical', sheHe('sets to the task without fanfare')),
  affectionate: e(
    { F: 'near without crowding', M: 'close without pressing' },
    sheHe('stays close and lets the silence hold')
  ),
  withdrawn: e(
    { F: 'folded inward', M: 'drawn inward' },
    sheHe('answers after a pause you almost miss')
  ),
  irritable: e(
    { F: 'thin-lipped patience', M: 'tight-jawed patience' },
    herHis('patience frays in silence, not volume')
  ),
  anxious: e(
    { F: 'softly braced', M: 'quietly braced' },
    {
      F: 'her hands find something to straighten',
      M: 'his hands find something to occupy',
    }
  ),
  melancholy: e('weathered and heavy', sheHe('looks past the fire into nowhere')),
  tired: e(
    { F: 'weary and sinking', M: 'weary and worn down' },
    herHis('shoulders drop a fraction more each hour')
  ),
  overwhelmed: e(
    'quietly flooded',
    sheHe('goes still, as if noise itself hurts')
  ),
  frustrated: e(
    'patiently strained',
    sheHe('keeps working, jaw a little too set')
  ),
};

/** Melancholic–Sanguine — introspective with flashes of warmth; shy brightness. */
const melancholicSanguine: MoodLexicon = {
  open: e(
    'guarded, then opening',
    sheHe('warms by degrees once trust is proven')
  ),
  warm: e(
    { F: 'shy radiance', M: 'quiet radiance' },
    sheHe('smiles as if surprised to feel it')
  ),
  playful: e(
    'hesitant spark',
    sheHe('risks a joke, then watches for kindness in the answer')
  ),
  driven: e(
    'earnestly purposeful',
    sheHe('works hard for the people who matter, not the crowd')
  ),
  affectionate: e(
    { F: 'softly devoted', M: 'quietly devoted' },
    sheHe('shows love in remembered details and sudden courage')
  ),
  withdrawn: e(
    'retreated behind the ribs',
    sheHe('goes small in the room without leaving it')
  ),
  irritable: e(
    'wounded and prickly',
    herHis('hurt shows before the anger does')
  ),
  anxious: e(
    'self-conscious and alert',
    sheHe('reads every face for signs of disappointment')
  ),
  melancholy: e(
    'aching and articulate',
    sheHe('names the sadness more clearly than most can bear')
  ),
  tired: e(
    'emotionally spent',
    sheHe('still polite, light gone from the eyes')
  ),
  overwhelmed: e(
    'flooded by feeling',
    {
      F: 'she laughs once, then cannot hide the tears under it',
      M: 'he laughs once, then cannot hide the shine in his eyes',
    }
  ),
  frustrated: e(
    'torn between hope and caution',
    sheHe('wants to push forward and flinch at the same time')
  ),
};

/** Phlegmatic–Sanguine — calm with social warmth; easy companion, low-key humor. */
const phlegmaticSanguine: MoodLexicon = {
  open: e('relaxed and welcoming', sheHe('makes space without making a show of it')),
  warm: e(
    { F: 'easygoing warmth', M: 'easygoing warmth' },
    sheHe('is simply glad you are there')
  ),
  playful: e(
    'lazy good humor',
    sheHe('delivers a slow joke that lands clean')
  ),
  driven: e(
    'unhurried but present',
    sheHe('gets there when it counts, not when it shines')
  ),
  affectionate: e(
    { F: 'amiably close', M: 'amiably close' },
    sheHe('stays nearby like furniture you are fond of')
  ),
  withdrawn: e('pleasant distance', sheHe('nods, drifts, stays polite')),
  irritable: e(
    'rare flat annoyance',
    herHis('voice loses its usual ease')
  ),
  anxious: e(
    'mildly off-balance',
    sheHe('fidgets once, then tries to look unbothered')
  ),
  melancholy: e(
    'softly blue',
    sheHe('grows quiet without needing an audience for it')
  ),
  tired: e('contentedly spent', sheHe('half-smiles through a yawn')),
  overwhelmed: e(
    'too much bustle',
    sheHe('steps back from the noise and waits it out')
  ),
  frustrated: e(
    'stuck without heat',
    sheHe('shrugs, then solves the smallest piece first')
  ),
};

/** Phlegmatic–Choleric — still waters, firm will; quiet resolve, stubborn calm. */
const phlegmaticCholeric: MoodLexicon = {
  open: e(
    'calm and unyielding-open',
    sheHe('listens fully, then states what will happen')
  ),
  warm: e(
    { F: 'steady allegiance', M: 'steady allegiance' },
    sheHe('shows care by protecting your time and ground')
  ),
  playful: e(
    'dry, grounded humor',
    sheHe('raises one eyebrow and lets that be the joke')
  ),
  driven: e(
    'immovable purpose',
    sheHe('does not argue the goal — only the steps')
  ),
  affectionate: e(
    'loyal as bedrock',
    sheHe('is simply there, again, without speech about it')
  ),
  withdrawn: e(
    'shut but upright',
    sheHe('gives the minimum and holds the rest')
  ),
  irritable: e(
    'quiet iron',
    herHis('no is final without being loud')
  ),
  anxious: e(
    'still, braced',
    herHis('hands go pocketed, posture unnaturally perfect')
  ),
  melancholy: e(
    'heavy calm',
    sheHe('endures the mood like weather on a long road')
  ),
  tired: e(
    'reserves running low',
    sheHe('speaks less, stands the same')
  ),
  overwhelmed: e(
    'capacity silently exceeded',
    sheHe('sets boundaries in one short sentence')
  ),
  frustrated: e(
    'stubborn against the snag',
    sheHe('repeats the workable plan until others catch up')
  ),
};

/** Phlegmatic–Melancholic — deep calm, thoughtful reserve; gentle gravity. */
const phlegmaticMelancholic: MoodLexicon = {
  open: e(
    'slow-opening and sincere',
    sheHe('takes time, then meets you without pretense')
  ),
  warm: e(
    { F: 'gentle, lasting warmth', M: 'gentle, lasting warmth' },
    sheHe('offers comfort the way a still room does')
  ),
  playful: e(
    'quiet, kind amusement',
    sheHe('smiles late, as if the joke matured')
  ),
  driven: e(
    'conscientious and unhurried',
    sheHe('finishes what was started, cleanly')
  ),
  affectionate: e(
    { F: 'softly steadfast', M: 'softly steadfast' },
    sheHe('keeps company without needing to fill it')
  ),
  withdrawn: e(
    'deeply recessed',
    sheHe('is present in body, gone in thought')
  ),
  irritable: e(
    'wounded quiet',
    herHis('disappointment shows as distance, not bite')
  ),
  anxious: e(
    'uneasy stillness',
    herHis('eyes linger on what might go wrong')
  ),
  melancholy: e(
    'soft and profound',
    sheHe('carries sorrow like a familiar coat')
  ),
  tired: e(
    'bone-deep weary',
    sheHe('moves as if each gesture costs a coin')
  ),
  overwhelmed: e(
    'sunk under the quiet weight',
    sheHe('stops answering until the room softens')
  ),
  frustrated: e(
    'sadly obstructed',
    sheHe('names the problem once, then waits')
  ),
};

const BY_BLEND: Record<TemperamentBlendId | 'generic', MoodLexicon> = {
  'Sanguine-Choleric': sanguineCholeric,
  'Sanguine-Phlegmatic': sanguinePhlegmatic,
  'Sanguine-Melancholic': sanguineMelancholic,
  'Choleric-Sanguine': cholericSanguine,
  'Choleric-Melancholic': cholericMelancholic,
  'Choleric-Phlegmatic': cholericPhlegmatic,
  'Melancholic-Choleric': melancholicCholeric,
  'Melancholic-Phlegmatic': melancholicPhlegmatic,
  'Melancholic-Sanguine': melancholicSanguine,
  'Phlegmatic-Sanguine': phlegmaticSanguine,
  'Phlegmatic-Choleric': phlegmaticCholeric,
  'Phlegmatic-Melancholic': phlegmaticMelancholic,
  generic,
};

export function getMoodLexicon(blend: string): MoodLexicon {
  return BY_BLEND[blend as TemperamentBlendId] ?? generic;
}

export function composeFlavor(
  lexicon: MoodLexicon,
  primary: MoodClass,
  sex: Sex,
  secondary?: MoodClass | null
): { line: string; tell: string } {
  const main = lexicon[primary];
  const line = capitalize(pickSexed(main.posture, sex));
  const mainTell = pickSexed(main.tell, sex);
  if (!secondary || secondary === primary) {
    return { line, tell: mainTell };
  }
  const tintTell = pickSexed(lexicon[secondary].tell, sex);
  // Same-sign moods join with "and"; cross-sign (pos↔neg) keeps "yet".
  // Tint only lands on the tell under the posture — never a second posture line.
  const conj = tintConjunction(primary, secondary);
  return {
    line,
    tell: `${mainTell} — ${conj} ${tintTell}`,
  };
}
