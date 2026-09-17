import type { AttackTargetKey } from './attackTargets';
import type { Sex } from '../../types/characters';

/**
 * SVG aim-zone polygons for combat silhouettes.
 *
 * viewBox: 0 0 200 300 (matches 2:3 art in public/combat/).
 * Front-facing: screen-left = character's RIGHT, screen-right = character's LEFT.
 *
 * Paint order = hit priority (later paths win overlaps):
 * torso → legs → arms → head so limb clicks aren't stolen by chest/stomach.
 *
 * Fine-tune tips:
 * - Edit only the sex you care about (F / M are independent).
 * - Coordinates are absolute in the 200×300 viewBox.
 * - After edits, hover/select on Battleground to check coverage.
 */

export interface AimRegion {
  key: AttackTargetKey;
  /** SVG path `d` in viewBox coords */
  d: string;
}

/**
 * Female front silhouette — hand-tuned to Silhouette_Female_Front.
 * Keep this set as the reference quality bar for the male pass.
 */
export const AIM_REGIONS_FEMALE: AimRegion[] = [
  {
    key: 'chest',
    d: 'M 85 69 L 120 65 L 117 85 L 118 90 L 110 115 L 85 109 L 80 88 Z',
  },
  {
    key: 'stomach',
    d: 'M 82 110 L 110 115 L 115 135 L 89 135 L 70 125 Z',
  },
  {
    key: 'groin',
    d: 'M 70 125 L 88 135 L 112 135 L 90 152 L 85 148 Z',
  },
  {
    key: 'legRight',
    // Character's right leg (viewer's left)
    d: 'M 70 125 L 80 145 L 89 153 L 89 206 L 92 216 L 93 245 L 94 257 L 87 260 L 76 225 L 77 205 L 65 155 L 66 135 Z',
  },
  {
    key: 'legLeft',
    // Character's left leg (viewer's right)
    d: 'M 90 152 L 113 136 L 118 156 L 122 201 L 132 220 L 140 260 L 133 262 L 115 225 L 112 212 L 103 185 Z',
  },
  {
    key: 'armRight',
    // Character's right arm (viewer's left)
    d: 'M 76 75 L 80 71 L 84 75 L 80 85 L 80 95 L 84 100 L 84 110 L 73 120 L 65 135 L 63 148 L 59 147 L 68 120 L 72 112 L 76 85 Z',
  },
  {
    key: 'armLeft',
    // Character's left arm (viewer's right)
    d: 'M 115 66 L 125 63 L 130 75 L 132 110 L 134 115 L 133 145 L 127 145 L 122 120 L 123 111 L 118 80 Z',
  },
  {
    key: 'head',
    d: 'M 84 30 L 90 21 L 97 19 L 105 20 L 110 22 L 115 35 L 112 50 L 107 57 L 102 57 L 93 52 L 92 50 L 87 46 L 84 37 Z',
  },
];

/**
 * Male front silhouette — separate from female.
 * Tuned toward Silhouette_Male_Front (broader chest, arms farther from torso).
 * Edit freely; changes here never affect AIM_REGIONS_FEMALE.
 *
 * Tip: duplicate a female path into the matching male key if you want a
 * known-good starting contour, then nudge points against the male art.
 */
export const AIM_REGIONS_MALE: AimRegion[] = [
  {
    key: 'chest',
    // Broader shoulders / ribcage than female
    d: 'M 80 69 L 100 62 L 120 65 L 120 85 L 122 95 L 115 115 L 82 109 L 76 82 Z', // detailed contour
  },
  {
    key: 'stomach',
    d: 'M 82 110 L 115 115 L 118 133 L 90 135 L 76 131 Z', // detailed contour
  },
  {
    key: 'groin',
    d: 'M 75 130 L 90 136 L 117 133 L 100 148 L 95 153 L 90 153 Z', // detailed contour
  },
  {
    key: 'legRight',
    // Character's right leg (viewer's left)
    d: 'M 74 131 L 89 154 L 94 154 L 94 166 L 92 205 L 96 222 L 94 240 L 95 260 L 86 260 L 78 222 L 78 200 L 71 164 L 73 142 Z', // detailed contour
  },
  {
    key: 'legLeft',
    // Character's left leg (viewer's right)
    d: 'M 97 154 L 118 135 L 124 164 L 125 194 L 133 222 L 136 261 L 128 262 L 116 227 L 115 214 L 106 190 Z',
  },
  {
    key: 'armRight',
    // Character's right arm (viewer's left) — follows outstretched male arm
    d: 'M 70 75 L 77 68 L 80 75 L 78 85 L 80 95 L 81 102 L 78 112 L 78 120 L 67 148 L 62 147 L 64 120 L 67 112 L 69 85 Z', // detailed contour
  },
  {
    key: 'armLeft',
    // Character's left arm (viewer's right)
    d: 'M 120 66 L 125 64 L 130 67 L 134 74 L 138 110 L 139 115 L 136 145 L 129 145 L 125 120 L 126 111 L 120 80 Z', // detailed contour
  },
  {
    key: 'head',
    // Nudged down slightly vs first male pass to sit on the skull
    d: 'M 84 30 L 90 21 L 97 19 L 105 20 L 113 25 L 113 35 L 110 50 L 105 57 L 102 57 L 94 52 L 92 50 L 88 46 L 84 37 Z', // detailed contour
  },
];

export const AIM_REGIONS_BY_SEX: Record<Sex, AimRegion[]> = {
  F: AIM_REGIONS_FEMALE,
  M: AIM_REGIONS_MALE,
};

export function getAimRegionsForSex(sex: Sex): AimRegion[] {
  return AIM_REGIONS_BY_SEX[sex];
}

/** viewBox size shared by silhouette overlays (matches AimTargetPanel). */
export const AIM_VIEWBOX = { width: 200, height: 300 } as const;

/**
 * Parse simple SVG path `d` (M/L/Z only) into absolute points.
 * Enough for our hand-authored aim polygons.
 */
export function parseAimPathPoints(d: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const re = /([MLZmlz])|(-?\d*\.?\d+)/g;
  let cmd = 'M';
  let nums: number[] = [];
  let m: RegExpExecArray | null;
  const flush = () => {
    if (cmd === 'M' || cmd === 'L' || cmd === 'm' || cmd === 'l') {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        points.push({ x: nums[i]!, y: nums[i + 1]! });
      }
    }
    nums = [];
  };
  while ((m = re.exec(d))) {
    if (m[1]) {
      flush();
      cmd = m[1];
    } else if (m[2] != null) {
      nums.push(Number(m[2]));
    }
  }
  flush();
  return points;
}

/** Axis-aligned bbox center of an aim region in viewBox coords. */
export function getAimRegionCenter(
  sex: Sex,
  key: AttackTargetKey
): { x: number; y: number } {
  const region = getAimRegionsForSex(sex).find((r) => r.key === key);
  if (!region) {
    return { x: AIM_VIEWBOX.width / 2, y: AIM_VIEWBOX.height / 2 };
  }
  const pts = parseAimPathPoints(region.d);
  if (pts.length === 0) {
    return { x: AIM_VIEWBOX.width / 2, y: AIM_VIEWBOX.height / 2 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
