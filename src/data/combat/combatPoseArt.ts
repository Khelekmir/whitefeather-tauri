import type { CoverStanceId, Sex, StrikeStanceId, WeaponTypeId } from '../../types/characters';

/**
 * Flavor combat poses under public/combat/:
 *   {Name}_{WeaponLabel}_{Atk|Def}_{High|Mid|Low}.png
 *
 * Incomplete cast is OK — resolve with fallback chain, then silhouette.
 */

export type CombatPoseRole = 'Atk' | 'Def';
export type CombatPoseLine = 'High' | 'Mid' | 'Low';

/** WeaponTypeId → filename weapon token (art label, not engine id). */
export const WEAPON_TYPE_TO_ART_LABEL: Partial<Record<WeaponTypeId, string>> = {
  dagger: 'Dagger',
  throwingKnife: 'Dagger',
  '1hSword': 'Sword',
  '2hSword': 'Sword',
  lance: 'Lance',
  ilianLance: 'Lance',
  javelin: 'Lance',
};

/** Known authored basenames (no path, no extension). Keep in sync with public/combat. */
export const COMBAT_POSE_BASENAMES = [
  // Amberyl — dagger
  'Amberyl_Dagger_Atk_High',
  'Amberyl_Dagger_Atk_Mid',
  'Amberyl_Dagger_Atk_Low',
  'Amberyl_Dagger_Def_High',
  'Amberyl_Dagger_Def_Mid',
  'Amberyl_Dagger_Def_Low',
  // Sain — lance
  'Sain_Lance_Atk_High',
  'Sain_Lance_Atk_Mid',
  'Sain_Lance_Atk_Low',
  'Sain_Lance_Def_High',
  'Sain_Lance_Def_Mid',
  'Sain_Lance_Def_Low',
  // Kent — sword
  'Kent_Sword_Atk_High',
  'Kent_Sword_Atk_Mid',
  'Kent_Sword_Atk_Low',
  'Kent_Sword_Def_High',
  'Kent_Sword_Def_Mid',
  'Kent_Sword_Def_Low',
  // Florina — lance
  'Florina_Lance_Atk_High',
  'Florina_Lance_Atk_Mid',
  'Florina_Lance_Atk_Low',
  'Florina_Lance_Def_High',
  'Florina_Lance_Def_Mid',
  'Florina_Lance_Def_Low',
] as const;

const POSE_SET = new Set<string>(COMBAT_POSE_BASENAMES);

const LINE_FALLBACKS: CombatPoseLine[] = ['Mid', 'High', 'Low'];

export function strikeToPoseLine(strike: StrikeStanceId): CombatPoseLine {
  if (strike === 'strikeHigh') return 'High';
  if (strike === 'strikeLow') return 'Low';
  return 'Mid';
}

export function coverToPoseLine(cover: CoverStanceId): CombatPoseLine {
  if (cover === 'coverHigh') return 'High';
  if (cover === 'coverLow') return 'Low';
  return 'Mid';
}

export function artLabelForWeaponType(weaponType: string | undefined | null): string | null {
  if (!weaponType) return null;
  return WEAPON_TYPE_TO_ART_LABEL[weaponType as WeaponTypeId] ?? null;
}

function basename(name: string, weapon: string, role: CombatPoseRole, line: CombatPoseLine): string {
  return `${name}_${weapon}_${role}_${line}`;
}

function srcForBasename(base: string): string {
  return `/combat/${base}.png`;
}

export interface ResolveCombatPoseInput {
  /** Display name matching art files, e.g. "Amberyl". */
  characterName: string;
  weaponType?: string | null;
  role: CombatPoseRole;
  line: CombatPoseLine;
  sex?: Sex;
}

export interface ResolvedCombatPose {
  /** URL to show, or null if nothing usable. */
  src: string | null;
  /** Which basename matched, if a pose png. */
  basename: string | null;
  /** How we resolved the image. */
  via:
    | 'exact'
    | 'same-weapon-line-fallback'
    | 'any-weapon-same-line'
    | 'any-pose-same-role'
    | 'silhouette'
    | 'none';
  flipX: boolean;
}

/**
 * Fallback chain:
 * 1. exact Name_Weapon_Role_Line
 * 2. same Name_Weapon_Role with Mid → High → Low
 * 3. same Name + Role + Line, any known weapon for that character
 * 4. same Name + Role, any weapon/line
 * 5. sex silhouette
 */
export function resolveCombatPose(input: ResolveCombatPoseInput): ResolvedCombatPose {
  const name = input.characterName.trim();
  const weapon = artLabelForWeaponType(input.weaponType);
  const flipX = input.role === 'Def';

  const tryBase = (base: string, via: ResolvedCombatPose['via']): ResolvedCombatPose | null => {
    if (!POSE_SET.has(base)) return null;
    return { src: srcForBasename(base), basename: base, via, flipX };
  };

  if (weapon) {
    const exact = tryBase(basename(name, weapon, input.role, input.line), 'exact');
    if (exact) return exact;

    for (const line of LINE_FALLBACKS) {
      if (line === input.line) continue;
      const hit = tryBase(
        basename(name, weapon, input.role, line),
        'same-weapon-line-fallback'
      );
      if (hit) return hit;
    }
  }

  // Any weapon for this character + role + preferred line
  for (const base of COMBAT_POSE_BASENAMES) {
    const parts = base.split('_');
    // Name may be single token for now (Amberyl, Sain, Kent, Florina)
    if (parts.length < 4) continue;
    const line = parts[parts.length - 1] as CombatPoseLine;
    const role = parts[parts.length - 2] as CombatPoseRole;
    const charName = parts[0];
    if (charName !== name || role !== input.role) continue;
    if (line === input.line) {
      return {
        src: srcForBasename(base),
        basename: base,
        via: 'any-weapon-same-line',
        flipX,
      };
    }
  }

  for (const base of COMBAT_POSE_BASENAMES) {
    const parts = base.split('_');
    if (parts.length < 4) continue;
    const role = parts[parts.length - 2] as CombatPoseRole;
    const charName = parts[0];
    if (charName === name && role === input.role) {
      return {
        src: srcForBasename(base),
        basename: base,
        via: 'any-pose-same-role',
        flipX,
      };
    }
  }

  if (input.sex === 'F') {
    return {
      src: '/combat/silhouette_female_front.jpg',
      basename: null,
      via: 'silhouette',
      flipX,
    };
  }
  if (input.sex === 'M') {
    return {
      src: '/combat/silhouette_male_front.jpg',
      basename: null,
      via: 'silhouette',
      flipX,
    };
  }

  return { src: null, basename: null, via: 'none', flipX };
}
