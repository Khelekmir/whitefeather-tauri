/**
 * Ported from Coding_Notes/utilsLewd_old/LewdConfig.js — body regions, actions, part→action maps.
 * Content catalog for the Lewd encounter sandbox (lab).
 */

export type LewdSexKey = 'male' | 'female';

export interface LewdBit {
  sensitivity: number;
  intimacy: number;
  name: string;
  prose: string;
}

export type LewdPainKind = 'sting' | 'impact' | 'pinch' | 'stretch';

/**
 * How much bare skin the act needs at the target.
 * - any: ignore torso clothes (face/mouth kiss)
 * - clothOk: allowed through soft layers with stim/intimacy adjustment
 * - skin: needs clear skin (or displaced panel)
 * - orifice: needs clear path into orifice
 */
export type LewdAccessTier = 'any' | 'clothOk' | 'skin' | 'orifice';

export interface LewdActionDef {
  intimacy: number;
  stimulation: number;
  description: string;
  verb: string;
  targets: string[];
  /**
   * Nociception 0–1 (omit/0 = none). Mild play ~0.35–0.55.
   * Drives physical discomfort; psych share is bond/appetite-gated in resolve.
   */
  pain?: number;
  /** Optional flavor for prose / later rules. */
  painKind?: LewdPainKind;
  /** Clothing access requirement. Default treated as clothOk in resolve. */
  access?: LewdAccessTier;
}

export const gearLewdStatsDict = {
    genderMultiplier: 1.15, // keep for now
    multipliers: {
        male: {
            allure: 0.9,
            charisma: 1.1,
            libido: 1.2,
            dominance: 1.15
        },
        female: {
            allure: 1.1,
            charisma: 0.9,
            libido: 0.8,
            dominance: 0.85
        }
    },
    unequipped: {
        head: { allure: 0.02, charisma: 0.02 },
        shoulder: { allure: 0.02, charisma: 0.02 },
        back: { allure: 0.04, charisma: 0.04 },
        chest: { allure: 0.02, charisma: 0.02 },
        shirt: { allure: 0.1, charisma: 0.1 },
        undershirt: { allure: 0.3, charisma: 0.2 },
        waist: { allure: 0.02, charisma: 0.02 },
        underwear: { allure: 0.35, charisma: 0.25 },
        hand: { allure: 0.02, charisma: 0.02 },
        wrist: { allure: 0.01, charisma: 0.01 },
        offhand: { allure: 0.02, charisma: 0.02 },
        leg: { allure: 0.15, charisma: 0.15 },
        foot: { allure: 0.05, charisma: 0.05 },
    }
}

export const lewdBits = {
    male: {
        head: { sensitivity: 1.1, intimacy: 0.7, name: "head", prose: "The top and sides of the head." },
        ear: { sensitivity: 4.7, intimacy: 3.7, name: "ear", prose: "The top of the ear." },
        forehead: { sensitivity: 0.9, intimacy: 0.4, name: "forehead", prose: "A broad brow." },
        nose: { sensitivity: 3.0, intimacy: 2.5, name: "nose", prose: "The nose." },
        cheeks: { sensitivity: 1.7, intimacy: 1.1, name: "cheek", prose: "The soft skin on either side of the face." },
        lips: { sensitivity: 6.2, intimacy: 6.9, name: "lips", prose: "Soft but masculine lips." },
        teeth: { sensitivity: 0.7, intimacy: 8.0, name: "teeth", prose: "the teeth, strong and sharp." },
        tongue: { sensitivity: 7.6, intimacy: 7.3, name: "tongue", prose: "Hot, wet, and versatile." },
        mouthShallow: { sensitivity: 3.8, intimacy: 7.2, name: "mouth", prose: "the cavern of the mouth." },
        mouthDeep: { sensitivity: 4.5, intimacy: 7.9, name: "open mouth", prose: "the back of the mouth, prone to reflex responses." },
        chin: { sensitivity: 1.2, intimacy: 0.8, name: "chin", prose: "A strong jawline that tilts now and then." },
        neckNape: { sensitivity: 4.5, intimacy: 4.2, name: "nape", prose: "The back of the neck." },
        neckSide: { sensitivity: 4.2, intimacy: 3.9, name: "neck", prose: "The sides of the neck." },
        throat: { sensitivity: 2.6, intimacy: 2.1, name: "throat", prose: "The front of the neck." },
        clavicle: { sensitivity: 2.8, intimacy: 2.3, name: "clavicle", prose: "The collarbone area." },
        breast: { sensitivity: 2.0, intimacy: 1.6, name: "male breast", prose: "The flat chest area, firm with muscles." },
        areola: { sensitivity: 2.5, intimacy: 2.2, name: "areola", prose: "The pigmented area around the nipple." },
        nipple: { sensitivity: 4.3, intimacy: 4.5, name: "male nipple", prose: "A small protrusion at the center of the areola." },
        shoulder: { sensitivity: 1.4, intimacy: 0.8, name: "shoulder", prose: "The strong curve connecting the arm and torso." },
        armPit: { sensitivity: 1.3, intimacy: 1.8, name: "armpit", prose: "the pit of the arm." },
        armUpper: { sensitivity: 1.1, intimacy: 0.6, name: "upper arm", prose: "The area between the shoulder and elbow." },
        armLower: { sensitivity: 0.9, intimacy: 0.5, name: "lower arm", prose: "The forearm, between elbow and wrist." },
        wrist: { sensitivity: 1.2, intimacy: 0.6, name: "wrist", prose: "The joint connecting the hand and forearm." },
        handBack: { sensitivity: 1.1, intimacy: 0.4, name: "hand", prose: "The back side of the hand." },
        handPalm: { sensitivity: 3.2, intimacy: 1.3, name: "palm", prose: "The inner side of the hand." },
        handFinger: { sensitivity: 3.0, intimacy: 1.6, name: "fingers", prose: "The digits of the hand." },
        sternum: { sensitivity: 1.9, intimacy: 0.9, name: "sternum", prose: "The center of the chest." },
        bellyUpper: { sensitivity: 2.0, intimacy: 1.3, name: "upper belly", prose: "The area above the navel." },
        bellyButton: { sensitivity: 3.3, intimacy: 2.3, name: "navel", prose: "The navel, or belly button." },
        bellyLower: { sensitivity: 3.8, intimacy: 2.8, name: "lower belly", prose: "The area below the navel to the pelvis." },
        backUpper: { sensitivity: 1.7, intimacy: 1.0, name: "upper back", prose: "The upper section of the back." },
        backLower: { sensitivity: 2.0, intimacy: 1.2, name: "lower back", prose: "The lower back region." },
        oblique: { sensitivity: 1.9, intimacy: 1.3, name: "side", prose: "The sides of the torso near the ribs." },
        iliacRegion: { sensitivity: 4.0, intimacy: 3.3, name: "pelvis", prose: "The area over the pelvic bones." },
        urethra: { sensitivity: 6.7, intimacy: 8.0, name: "urethra", prose: "The opening at the tip of the penis." },
        penisHead: { sensitivity: 9.8, intimacy: 9.7, name: "penis", prose: "The sensitive rounded tip of the penis." },
        penisHeadUnderside: { sensitivity: 9.9, intimacy: 9.8, name: "penis underside", prose: "The underside of the glans, highly sensitive." },
        penisShaft: { sensitivity: 7.4, intimacy: 8.8, name: "shaft", prose: "The cylindrical shaft of the penis." },
        penisShaftUnderside: { sensitivity: 8.1, intimacy: 9.1, name: "shaft underside", prose: "The lower side of the penis shaft." },
        testicles: { sensitivity: 8.7, intimacy: 9.0, name: "testicles", prose: "The pair of sensitive reproductive organs in the scrotum." },
        perinium: { sensitivity: 5.9, intimacy: 6.5, name: "perinium", prose: "The area between the testicles and anus." },
        buttockMain: { sensitivity: 3.2, intimacy: 2.4, name: "buttock", prose: "The main rounded portion of the buttocks." },
        buttockUnderside: { sensitivity: 4.0, intimacy: 3.2, name: "buttock underside", prose: "The lower curve of the buttocks." },
        anus: { sensitivity: 7.9, intimacy: 9.2, name: "anus", prose: "The opening at the end of the digestive tract." },
        rectumShallow: { sensitivity: 6.6, intimacy: 8.9, name: "rectum", prose: "The outer part of the rectal canal." },
        rectumDeep: { sensitivity: 6.2, intimacy: 9.0, name: "rectal depths", prose: "The deeper part of the rectal canal." },
        hip: { sensitivity: 2.0, intimacy: 1.3, name: "hip", prose: "The area over the hip bones." },
        thighInner: { sensitivity: 5.1, intimacy: 4.2, name: "inner thigh", prose: "The soft inner thigh area." },
        thighBack: { sensitivity: 2.8, intimacy: 2.0, name: "backside of the thigh", prose: "The back of the upper leg." },
        thighFront: { sensitivity: 2.3, intimacy: 1.6, name: "thigh", prose: "The front side of the upper leg." },
        calf: { sensitivity: 1.6, intimacy: 0.9, name: "calf", prose: "The back part of the lower leg." },
        kneeFront: { sensitivity: 1.1, intimacy: 0.6, name: "knee", prose: "The front of the knee joint." },
        kneeBack: { sensitivity: 2.2, intimacy: 1.1, name: "backside of the knee", prose: "The soft area behind the knee." },
        ankle: { sensitivity: 1.2, intimacy: 0.4, name: "ankle", prose: "The joint between foot and leg." },
        footTop: { sensitivity: 1.5, intimacy: 0.5, name: "foot", prose: "The top side of the foot." },
        footBottom: { sensitivity: 3.6, intimacy: 1.5, name: "foot sole", prose: "The sole of the foot." },
        footToe: { sensitivity: 2.4, intimacy: 0.9, name: "toes", prose: "The toes of the foot." }
    },
    female: {
        head: { sensitivity: 1.2, intimacy: 0.8, name: "head", prose: "the crown of the head, perfect for displays of gentle affection." },
        ear: { sensitivity: 4.7, intimacy: 3.7, name: "ear", prose: "the ears, delicate and sensitive." },
        forehead: { sensitivity: 1.0, intimacy: 0.5, name: "forehead", prose: "a delicate brow furrowed by quiet glances." },
        nose: { sensitivity: 2.1, intimacy: 2.5, name: "nose", prose: "the nose, straight and noble." },
        cheeks: { sensitivity: 1.8, intimacy: 1.5, name: "cheek", prose: "the soft, rosy skin on either side of the face." },
        lips: { sensitivity: 6.5, intimacy: 7.0, name: "lips", prose: "lips full and curved, tender with promise." },
        teeth: { sensitivity: 0.7, intimacy: 8.0, name: "teeth", prose: "the teeth, bright and sharp." },
        tongue: { sensitivity: 7.8, intimacy: 7.5, name: "tongue", prose: "hot, wet, and pliable, playful and tantalizing." },
        mouthShallow: { sensitivity: 3.8, intimacy: 7.2, name: "mouth", prose: "the hot, wet cavern of the mouth." },
        mouthDeep: { sensitivity: 4.5, intimacy: 7.9, name: "open mouth", prose: "the back of the mouth, prone to reflex responses." },
        mouthThroat: { sensitivity: 2.9, intimacy: 8.5, name: "throat", prose: "the constricting passage of the throat." },
        chin: { sensitivity: 1.3, intimacy: 0.9, name: "chin", prose: "a feminine point, prone to tilt with curiosity or thought." },
        neckNape: { sensitivity: 4.8, intimacy: 4.5, name: "nape", prose: "the nape of the neck, strangely intimate." },
        neckSide: { sensitivity: 4.5, intimacy: 4.2, name: "neck", prose: "the slender column of the neck, pulsing with life." },
        throat: { sensitivity: 2.8, intimacy: 2.2, name: "throat", prose: "the hollow of the throat, vibrating with the sound of her voice." },
        clavicle: { sensitivity: 3.0, intimacy: 2.5, name: "clavicle", prose: "the graceful line of the collarbone, elegant and quietly alluring." },
        breast: { sensitivity: 6.9, intimacy: 7.2, name: "breast", prose: "the full swell of the breast, soft and warm to the touch." },
        areola: { sensitivity: 7.3, intimacy: 7.9, name: "areola", prose: "the rose-colored halo around the nipple." },
        nipple: { sensitivity: 9.0, intimacy: 9.2, name: "nipple", prose: "the sensitive peak of desire, responsive to touch." },
        shoulder: { sensitivity: 1.5, intimacy: 0.9, name: "shoulder", prose: "the curve of the shoulder, strong yet inviting." },
        armPit: { sensitivity: 1.7, intimacy: 1.8, name: "armpit", prose: "the soft pit of the arm, devilishly ticklish." },
        armUpper: { sensitivity: 1.2, intimacy: 0.7, name: "upper arm", prose: "the upper arm, smooth but firm to the touch." },
        armLower: { sensitivity: 1.0, intimacy: 0.6, name: "forearm", prose: "the lower arm, rippling with the motions of the hand." },
        wrist: { sensitivity: 1.4, intimacy: 0.6, name: "wrist", prose: "a slender wrist, flickering with the beat of the heart." },
        handBack: { sensitivity: 1.2, intimacy: 0.5, name: "hand", prose: "the back of the hand, graceful in repose." },
        handPalm: { sensitivity: 3.5, intimacy: 1.4, name: "palm", prose: "an open palm, warm and giving." },
        handFinger: { sensitivity: 3.2, intimacy: 1.8, name: "fingers", prose: "fingers elegant and expressive." },
        sternum: { sensitivity: 2.0, intimacy: 1.0, name: "sternum", prose: "the valley between the breasts, expanding with each breath." },
        bellyUpper: { sensitivity: 2.2, intimacy: 1.5, name: "upper belly", prose: "the vulnerable upper belly, soft to the touch." },
        bellyButton: { sensitivity: 3.6, intimacy: 2.5, name: "navel", prose: "the dip of the navel, shy and suggestive." },
        bellyLower: { sensitivity: 4.0, intimacy: 3.0, name: "lower belly", prose: "the lower expanse of the belly, curving towards the feminine center." },
        backUpper: { sensitivity: 1.8, intimacy: 1.0, name: "upper back", prose: "the lightly toned upper back, contoured by feminine shoulderblades." },
        backLower: { sensitivity: 2.2, intimacy: 1.3, name: "lower back", prose: "the small of the back, arched and delicate." },
        oblique: { sensitivity: 2.0, intimacy: 1.4, name: "side", prose: "feminine obliques, ticklish and waiting to be touched." },
        iliacRegion: { sensitivity: 4.3, intimacy: 3.7, name: "iliac region", prose: "the tender slope above the hips, below the iliac crest." },
        monsVenus: { sensitivity: 6.7, intimacy: 7.8, name: "pubic mound", prose: "the soft mound at the center, secreted by coarse curls." },
        labiaMajora: { sensitivity: 7.4, intimacy: 8.2, name: "outer labia", prose: "the outer folds of the vulva, plush and sensitive." },
        labiaMinora: { sensitivity: 8.7, intimacy: 9.1, name: "inner labia", prose: "the silken inner vulvic petals, warm with hidden promise." },
        clitoris: { sensitivity: 9.9, intimacy: 9.8, name: "clitoris", prose: "the secret bud of intense pleasure, responsive and pulsing with life." },
        urethra: { sensitivity: 7.0, intimacy: 8.5, name: "urethra", prose: "the small entrance below, delicate and easily overlooked." },
        vaginaShallow: { sensitivity: 8.2, intimacy: 9.0, name: "vagina", prose: "the welcoming femininity of the body, soft and yielding." },
        vaginaDeep: { sensitivity: 7.9, intimacy: 9.4, name: "vaginal depths", prose: "the hidden depths of womanhood, intimate and warm." },
        perinium: { sensitivity: 6.0, intimacy: 6.8, name: "perineum", prose: "the tender bridge between pleasure and surprise." },
        buttockMain: { sensitivity: 3.5, intimacy: 2.8, name: "fleshy buttock", prose: "the full but firm pillow of a shapely feminine buttock." },
        buttockUnderside: { sensitivity: 4.2, intimacy: 3.5, name: "lower curve of the buttock", prose: "the enticing bottom curve of a comely feminine backside." },
        anus: { sensitivity: 8.0, intimacy: 9.3, name: "anus", prose: "a secret entrance, sensitive and reluctant to be explored." },
        rectumShallow: { sensitivity: 6.9, intimacy: 9.0, name: "rectum", prose: "just within, a place of rare intimacy and trust." },
        rectumDeep: { sensitivity: 6.5, intimacy: 9.1, name: "rectal depths", prose: "the deeper reaches, hidden and guarded by closeness." },
        hip: { sensitivity: 2.2, intimacy: 1.5, name: "hip", prose: "the outward curve of the hips, swaying with natural rhythm." },
        thighInner: { sensitivity: 5.5, intimacy: 4.7, name: "inner thigh", prose: "the smooth inner thigh, smooth and warmth." },
        thighBack: { sensitivity: 3.0, intimacy: 2.2, name: "backside of the thigh", prose: "the strong back of the thigh, taut and tempting." },
        thighFront: { sensitivity: 2.5, intimacy: 1.8, name: "thigh", prose: "the front of the thigh, soft yet powerful." },
        kneeFront: { sensitivity: 1.2, intimacy: 0.7, name: "knee", prose: "the front bend of the leg, a hard and threatening joint." },
        kneeBack: { sensitivity: 2.4, intimacy: 1.3, name: "backside of the knee", prose: "the crook of the knee, unexpectedly sensitive." },
        calf: { sensitivity: 1.8, intimacy: 1.0, name: "calf", prose: "the gentle curve of the calf, shaped by grace and motion." },
        ankle: { sensitivity: 1.3, intimacy: 0.5, name: "ankle", prose: "the well-turned joint, graceful and highly maneuverable." },
        footTop: { sensitivity: 1.6, intimacy: 0.6, name: "foot", prose: "the slender top of the foot, smooth and fair." },
        footBottom: { sensitivity: 3.8, intimacy: 1.7, name: "foot sole", prose: "the sole of the foot, incredibly ticklish." },
        footToe: { sensitivity: 2.6, intimacy: 1.0, name: "toes", prose: "dainty toes, waiting to be curled in pleasure or play." }
    }
}

export const sensitivityDescriptors = {
    1: "Barely responsive",
    2: "Mildly ticklish",
    3: "Gently sensitive",
    4: "Warmly receptive",
    5: "Noticeably arousing",
    6: "Pleasurably tender",
    7: "Highly responsive",
    8: "Intensely sensitive",
    9: "Exquisitely electric",
    10: "Overwhelmingly erogenous"
}

export const genderSpecificParts = {
    female: [
        "monsVenus",
        "labiaMajora",
        "labiaMinora",
        "clitoris",
        "vaginaShallow",
        "vaginaDeep"
    ],
    male: [
        "penisHead",
        "penisHeadUnderside",
        "penisShaft",
        "penisShaftUnderside",
        "testicles"
    ]
}

export const lewdActionList = {
    kissLips: { intimacy: 3.8, stimulation: 4.0, access: 'any', description: "a kiss of the lips", verb: "kiss", targets: ["head", "ear", "forehead", "nose", "cheeks", "lips", "mouthShallow", "chin", "neckNape", "neckSide", "throat", "clavicle", "breast", "areola", "nipple", "shoulder", "armPit", "armUpper", "armLower", "wrist", "handBack", "handPalm", "handFinger", "sternum", "bellyUpper", "bellyButton", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "labiaMinora", "clitoris", "urethra", "vaginaShallow", "perinium", "buttockMain", "buttockUnderside", "anus", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "footToe", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    /**
     * Deep / tongue kiss — affectionately intense, not penetration-tier.
     * Retuned from 8.4 so mouth soft-cap (~44) can sustain the gate.
     */
    kissTongue: { intimacy: 5.4, stimulation: 6.2, access: 'orifice', description: "a deep kiss, using the tongue", verb: "intimately kiss", targets: ["mouthShallow", "vaginaShallow", "rectumShallow"] },
    suckShallow: { intimacy: 6.2, stimulation: 7.1, access: 'skin', description: "sucking a target that can be taken taken between the lips", verb: "suck", targets: ["ear", "nipple", "handFinger", "labiaMajora", "clitoris", "footToe", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    suckDeep: { intimacy: 6.5, stimulation: 7.2, access: 'skin', description: "sucking a target that can be taken deeply into the mouth", verb: "deeply suck", targets: ["handFinger", "penisHead", "penisShaft", "testicles"] },
    lick: { intimacy: 3.8, stimulation: 4.1, access: 'clothOk', description: "running the tongue over the target surface", verb: "lick", targets: ["ear", "forehead", "nose", "cheeks", "lips", "mouthShallow", "neckNape", "neckSide", "throat", "clavicle", "breast", "areola", "nipple", "shoulder", "armPit", "armUpper", "armLower", "wrist", "handBack", "handPalm", "handFinger", "sternum", "bellyUpper", "bellyButton", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "labiaMinora", "clitoris", "urethra", "perinium", "buttockMain", "buttockUnderside", "anus", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "footToe", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    /** Tongue probe — intimate teasing; was 7.6 (near penetration). */
    tongueProbe: { intimacy: 5.8, stimulation: 5.9, access: 'orifice', description: "probing the target area with the tongue", verb: "probe", targets: ["mouthShallow", "mouthDeep", "bellyButton", "urethra", "vaginaShallow", "anus", "rectumShallow"] },
    tongueTrace: { intimacy: 3.7, stimulation: 4.1, access: 'clothOk', description: "circling or pattern tracing the target area with the tongue", verb: "trace", targets: ["ear", "nose", "cheeks", "lips", "chin", "neckNape", "neckSide", "throat", "clavicle", "breast", "areola", "nipple", "shoulder", "armPit", "armUpper", "armLower", "wrist", "handBack", "handPalm", "handFinger", "sternum", "bellyUpper", "bellyButton", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "labiaMinora", "clitoris", "urethra", "perinium", "buttockMain", "buttockUnderside", "anus", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "footToe", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    bite: { intimacy: 3.6, stimulation: 4.0, pain: 0.45, painKind: 'sting', description: "biting the target area with the teeth", verb: "bite", targets: ["ear", "nose", "cheeks", "lips", "tongue", "chin", "neckNape", "neckSide", "clavicle", "breast", "areola", "nipple", "shoulder", "armUpper", "armLower", "wrist", "handBack", "handPalm", "handFinger", "sternum", "bellyUpper", "bellyButton", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "labiaMinora", "clitoris", "buttockMain", "buttockUnderside", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "footToe", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    handHold: { intimacy: 2.2, stimulation: 2.9, description: "holding the target area with the hand", verb: "hold", targets: ["head", "cheeks", "neckSide", "throat", "breast", "shoulder", "armPit", "armUpper", "armLower", "wrist", "handBack", "handPalm", "handFinger", "buttockMain", "buttockUnderside", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "footToe", "penisShaft", "testicles"] },
    handPat: { intimacy: 2.8, stimulation: 3.3, description: "patting the target area with the hand", verb: "pat", targets: ["head", "cheeks", "breast", "shoulder", "armUpper", "armLower", "wrist", "handBack", "bellyUpper", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "clitoris", "buttockMain", "buttockUnderside", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "penisShaft", "testicles"] },
    fingerTap: { intimacy: 4.2, stimulation: 4.5, description: "tapping or drumming the target area with a finger or fingers", verb: "tap", targets: ["head", "nose", "lips", "chin", "clavicle", "nipple", "shoulder", "wrist", "handBack", "handPalm", "handFinger", "bellyButton", "iliacRegion", "monsVenus", "clitoris", "urethra", "perinium", "anus", "kneeFront", "footToe", "penisHead", "testicles"] },
    fingerTrace: { intimacy: 3.7, stimulation: 4.1, description: "circling or pattern tracing the target area with a finger or fingers", verb: "trace", targets: ["ear", "nose", "cheeks", "lips", "chin", "neckNape", "neckSide", "throat", "clavicle", "breast", "areola", "nipple", "shoulder", "armPit", "armUpper", "armLower", "wrist", "handBack", "handPalm", "handFinger", "sternum", "bellyUpper", "bellyButton", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "labiaMinora", "clitoris", "urethra", "perinium", "buttockMain", "buttockUnderside", "anus", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "footToe", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    palmRub: { intimacy: 3.5, stimulation: 3.9, description: "rubbing the target area with an open palm", verb: "rub", targets: ["cheeks", "neckNape", "neckSide", "breast", "shoulder", "armUpper", "armPit", "armLower", "handPalm", "bellyUpper", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "buttockMain", "buttockUnderside", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "calf", "ankle", "footTop", "footBottom", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    thumbRub: { intimacy: 4.4, stimulation: 4.8, access: 'clothOk', description: "rubbing the target area with the thumb", verb: "rub", targets: ["cheeks", "lips", "neckNape", "neckSide", "throat", "areola", "nipple", "wrist", "handPalm", "handFinger", "clitoris", "anus", "calf", "footBottom", "penisHead", "penisHeadUnderside"] },
    tickle: { intimacy: 4.8, stimulation: 5.0, description: "tickling the target area with the fingers", verb: "tickle", targets: ["cheeks", "neckNape", "neckSide", "armPit", "breast", "areola", "nipple", "bellyUpper", "bellyButton", "bellyLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "anus", "thighInner", "thighBack", "kneeBack", "footBottom", "penisHeadUnderside", "penisShaftUnderside", "testicles"] },
    pinch: { intimacy: 4.6, stimulation: 5.0, pain: 0.4, painKind: 'pinch', description: "pinching the target area with the fingers", verb: "pinch", targets: ["ear", "nose", "cheeks", "nipple", "handFinger", "bellyUpper", "bellyLower", "oblique", "labiaMajora", "labiaMinora", "clitoris", "buttockMain", "buttockUnderside", "thighInner", "thighBack", "thighFront", "footToe", "penisHead", "penisShaft", "testicles"] },
    /**
     * Finger probe — still deep for genital/anal; mouth pairs rely on soft-cap clamp.
     * Slightly eased from 8.5 so oral finger-play is not gate-locked above mouth soft-cap.
     */
    fingerProbe: { intimacy: 7.8, stimulation: 6.2, access: 'orifice', description: "probing into the target area with a finger or fingers", verb: "probe", targets: ["mouthShallow", "mouthDeep", "vaginaShallow", "anus", "rectumShallow"] },
    fingerStroke: { intimacy: 3.9, stimulation: 4.2, description: "stroking the target area with a finger or fingers", verb: "stroke", targets: ["head", "ear", "forehead", "cheeks", "lips", "neckNape", "neckSide", "throat", "clavicle", "armPit", "breast", "areola", "nipple", "shoulder", "armUpper", "armLower", "wrist", "handBack", "handPalm", "handFinger", "sternum", "bellyUpper", "bellyButton", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "labiaMinora", "clitoris", "urethra", "vaginaShallow", "perinium", "buttockMain", "buttockUnderside", "anus", "rectumShallow", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "footToe", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    spankSlap: { intimacy: 3.4, stimulation: 3.8, pain: 0.5, painKind: 'impact', description: "striking the target area with an open hand", verb: "spankSlap", targets: ["head", "ear", "cheeks", "lips", "breast", "shoulder", "armUpper", "armLower", "handBack", "handPalm", "bellyUpper", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "buttockMain", "buttockUnderside", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "calf", "ankle", "footTop", "footBottom", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    footRub: { intimacy: 3.3, stimulation: 3.7, description: "stroking or rubbing the target area with a foot", verb: "rub", targets: ["head", "cheeks", "lips", "chin", "clavicle", "breast", "shoulder", "armPit", "armUpper", "armLower", "wrist", "handBack", "sternum", "bellyUpper", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "buttockMain", "buttockUnderside", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "calf", "footTop", "footBottom", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    step: { intimacy: 3.1, stimulation: 3.6, description: "applying pressure to the target area with a foot", verb: "step on", targets: ["head", "cheeks", "chin", "clavicle", "breast", "shoulder", "armUpper", "armLower", "wrist", "handBack", "sternum", "bellyUpper", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "buttockMain", "buttockUnderside", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "calf", "footTop", "footBottom", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    breastRub: { intimacy: 2.3, stimulation: 2.9, description: "applying rubbing pressure to the target area with the breasts", verb: "rub against", targets: ["head", "forehead", "cheeks", "lips", "chin", "neckNape", "breast", "shoulder", "armUpper", "armLower", "handBack", "handPalm", "bellyUpper", "bellyLower", "backUpper", "backLower", "buttockMain", "buttockUnderside", "hip", "thighBack", "thighFront", "calf", "ankle", "footTop", "footBottom", "penisHead", "penisShaft"] },
    paizuri: { intimacy: 8.4, stimulation: 7.6, description: "stroking an object between the breasts", verb: "surround and rub", targets: ["penisHead", "penisShaft"] },
    frotFemale: { intimacy: 3.1, stimulation: 3.6, description: "rubbing, rocking, or grinding against the target area with the female genitalia", verb: "rub against", targets: ["head", "tongue", "chin", "throat", "shoulder", "armPit", "armUpper", "armLower", "wrist", "handBack", "handPalm", "handFinger", "bellyUpper", "bellyLower", "backUpper", "backLower", "oblique", "monsVenus", "labiaMajora", "labiaMinora", "clitoris", "hip", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "penisHeadUnderside", "penisShaft", "penisShaftUnderside"] },
    vaginalContraction: { intimacy: 8.9, stimulation: 7.9, access: 'orifice', description: "flexing and clenching the vagina around an inserted member", verb: "clench around", targets: ["tongue", "handFinger", "penisHead", "penisShaft"] },
    analContraction: { intimacy: 8.7, stimulation: 9.9, access: 'orifice', description: "flexing and clenching the anus around an inserted member", verb: "clench around", targets: ["tongue", "handFinger", "penisHead", "penisShaft"] },
    thighSqueeze: { intimacy: 3.0, stimulation: 2.6, description: "squeezing the inner thighs of a member mounted under the pelvis", verb: "squeeze", targets: ["head", "armUpper", "armLower", "wrist", "handBack", "handPalm", "oblique", "thighInner", "thighBack", "thighFront", "calf"] },
    intercruralSqueeze: { intimacy: 6.0, stimulation: 5.6, description: "simulated intercourse by squeezing the inner thighs around a penis", verb: "squeeze", targets: ["penisShaft"] },
    frotMale: { intimacy: 3.3, stimulation: 3.6, description: "rubbing, rocking, or grinding against the target area with the penis", verb: "rub against", targets: ["head", "ear", "forehead", "nose", "cheeks", "lips", "tongue", "mouthShallow", "mouthDeep", "chin", "neckNape", "neckSide", "throat", "clavicle", "armPit", "breast", "areola", "nipple", "shoulder", "armUpper", "armLower", "wrist", "handBack", "handPalm", "handFinger", "sternum", "bellyUpper", "bellyButton", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "labiaMinora", "clitoris", "urethra", "perinium", "buttockMain", "buttockUnderside", "anus", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "footToe"] },
    grind: { intimacy: 8.6, stimulation: 5.8, access: 'orifice', description: "grinding or gyrating of the penis within the specified area", verb: "grind within", targets: ["armPit", "thighInner", "mouthShallow", "mouthDeep", "mouthThroat", "vaginaShallow", "vaginaDeep", "rectumShallow", "rectumDeep"] },
    thrust: { intimacy: 8.6, stimulation: 5.8, access: 'orifice', description: "rythmic thrusting of the penis into the specified area", verb: "thrust into", targets: ["armPit", "thighInner", "mouthShallow", "mouthDeep", "mouthThroat", "vaginaShallow", "vaginaDeep", "rectumShallow", "rectumDeep"] },
    toeTrace: { intimacy: 4.1, stimulation: 3.1, access: 'clothOk', description: "circling or pattern tracing the target area with a toe or toes", verb: "trace", targets: ["armPit", "cheeks", "lips", "chin", "neckNape", "neckSide", "throat", "clavicle", "breast", "areola", "nipple", "shoulder", "armUpper", "armLower", "wrist", "handBack", "handPalm", "handFinger", "sternum", "bellyUpper", "bellyButton", "bellyLower", "backUpper", "backLower", "oblique", "iliacRegion", "monsVenus", "labiaMajora", "labiaMinora", "clitoris", "buttockMain", "buttockUnderside", "anus", "hip", "thighInner", "thighBack", "thighFront", "kneeFront", "kneeBack", "calf", "ankle", "footTop", "footBottom", "footToe", "penisHead", "penisHeadUnderside", "penisShaft", "penisShaftUnderside", "testicles"] },
    toeProbe: { intimacy: 5.4, stimulation: 3.6, access: 'orifice', description: "probing into the target area with a toe or toes", verb: "probe", targets: ["mouthShallow", "vaginaShallow"] },
}

export const lewdActionParts = {
    unisex: {
        lips: ["kissLips", "kissTongue", "suckShallow", "suckDeep"],
        tongue: ["lick", "tongueProbe", "tongueTrace"],
        teeth: ["bite"],
        handPalm: ["handHold", "handPat", "palmRub", "spankSlap"],
        handFinger: ["fingerTap", "fingerTrace", "fingerProbe", "fingerStroke", "thumbRub", "tickle", "pinch"],
        footBottom: ["footRub", "step"],
        footToe: ["toeTrace", "toeProbe"],
        anus: ["analContraction"]
    },
    female: {
        breast: ["breastRub", "paizuri"],
        monsVenus: ["frotFemale"],
        vaginaShallow: ["vaginalContraction"],
        thighs: ["thighSqueeze", "intercruralSqueeze"]
    },
    male: {
        penisHead: ["frotMale", "thrust"],
        penisShaft: ["frotMale", "grind"]
    }
}

export const lewdTalentConversionTable = {
    // mouth
    lips: "mouth",
    tongue: "mouth",
    teeth: "mouth",
    // hands
    handPalm: "hands",
    handFinger: "hands",
    // feet
    footBottom: "feet",
    footToe: "feet",
    // breasts
    breast: "breasts",
    // vagina
    monsVenus: "vagina",
    vaginaShallow: "vagina",
    // anus
    anus: "anus",
    // thighs
    thighs: "thighs",
    // penis
    penisHead: "penis",
    penisShaft: "penis",
}
