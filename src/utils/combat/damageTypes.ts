import type { BleedSplit } from './bleedSplit';

/**
 * How the attacker delivers the blow — drives bleed/bruise channels.
 * Catalog weapon `damageType` is a default flavor tag; live mode can differ
 * (e.g. sword slash vs thrust).
 */
export type AttackMode = 'slash' | 'thrust' | 'blunt' | 'unarmed';

export const ATTACK_MODE_LABELS: Record<AttackMode, string> = {
  slash: 'Slash',
  thrust: 'Thrust',
  blunt: 'Blunt',
  unarmed: 'Unarmed',
};

/** Bleed channel mix per attack mode. */
export const DAMAGE_MODE_BLEED_SPLIT: Record<AttackMode, BleedSplit> = {
  slash: { external: 1, internal: 0 },
  thrust: { external: 0.6, internal: 0.4 },
  blunt: { external: 0.2, internal: 0.8 },
  unarmed: { external: 0, internal: 1 },
};

const SLASH_THRUST: AttackMode[] = ['slash', 'thrust'];
const SLASH_ONLY: AttackMode[] = ['slash'];
const THRUST_ONLY: AttackMode[] = ['thrust'];
const BLUNT_ONLY: AttackMode[] = ['blunt'];
const UNARMED_ONLY: AttackMode[] = ['unarmed'];

/**
 * Which delivery modes a weapon type supports.
 */
export function weaponAttackModes(weaponType: string): AttackMode[] {
  switch (weaponType) {
    case '1hSword':
    case '2hSword':
    case 'dagger':
    case 'throwingKnife':
      return [...SLASH_THRUST];
    case '1hAxe':
    case '2hAxe':
    case 'throwingAxe':
      return [...SLASH_ONLY];
    case 'lance':
    case 'ilianLance':
    case 'javelin':
    case 'shortbow':
    case 'recurveBow':
    case 'longbow':
      return [...THRUST_ONLY];
    case '1hMace':
    case '2hMace':
    case 'flail':
    case 'staff':
    case 'shield':
      return [...BLUNT_ONLY];
    case 'punch':
    case 'kick':
    case 'unequipped':
      return [...UNARMED_ONLY];
    default:
      // Unknown — treat as unarmed-safe default
      return [...UNARMED_ONLY];
  }
}

export function defaultAttackMode(weaponType: string): AttackMode {
  const modes = weaponAttackModes(weaponType);
  return modes[0] ?? 'unarmed';
}

export function clampAttackMode(
  weaponType: string,
  mode: AttackMode | null | undefined
): AttackMode {
  const modes = weaponAttackModes(weaponType);
  if (mode && modes.includes(mode)) return mode;
  return modes[0] ?? 'unarmed';
}

export function bleedSplitForAttackMode(mode: AttackMode): BleedSplit {
  return { ...DAMAGE_MODE_BLEED_SPLIT[mode] };
}

/**
 * Resolve bleed split for an attack.
 * Explicit `bleedSplit` wins (labs); else mode → table; else weapon default mode.
 */
export function resolveBleedSplitForAttack(
  weaponType: string,
  opts?: { attackMode?: AttackMode; bleedSplit?: BleedSplit }
): { mode: AttackMode; split: BleedSplit } {
  if (opts?.bleedSplit) {
    const mode = clampAttackMode(weaponType, opts.attackMode);
    return { mode, split: { ...opts.bleedSplit } };
  }
  const mode = clampAttackMode(weaponType, opts?.attackMode);
  return { mode, split: bleedSplitForAttackMode(mode) };
}
