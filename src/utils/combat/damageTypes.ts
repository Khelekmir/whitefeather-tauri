import type { BleedSplit } from './bleedSplit';

/**
 * How the attacker delivers the blow — drives bleed/bruise / glancing.
 * Catalog weapon `damageType` uses the same slash/thrust/blunt vocabulary
 * (primary flavor); live mode can still differ (e.g. sword slash vs thrust).
 */
export type AttackMode =
  | 'slash'
  | 'thrust'
  | 'blunt'
  | 'unarmed'
  | 'projectile';

export const ATTACK_MODE_LABELS: Record<AttackMode, string> = {
  slash: 'Slash',
  thrust: 'Thrust',
  blunt: 'Blunt',
  unarmed: 'Unarmed',
  projectile: 'Projectile',
};

/** Bleed channel mix per attack mode. Projectile mirrors thrust for now. */
export const DAMAGE_MODE_BLEED_SPLIT: Record<AttackMode, BleedSplit> = {
  slash: { external: 1, internal: 0 },
  thrust: { external: 0.6, internal: 0.4 },
  blunt: { external: 0.2, internal: 0.8 },
  unarmed: { external: 0, internal: 1 },
  projectile: { external: 0.6, internal: 0.4 },
};

const SLASH_THRUST: AttackMode[] = ['slash', 'thrust'];
const SLASH_ONLY: AttackMode[] = ['slash'];
const THRUST_ONLY: AttackMode[] = ['thrust'];
const BLUNT_ONLY: AttackMode[] = ['blunt'];
const UNARMED_ONLY: AttackMode[] = ['unarmed'];
const PROJECTILE_ONLY: AttackMode[] = ['projectile'];

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
      return [...THRUST_ONLY];
    case 'shortbow':
    case 'recurveBow':
    case 'longbow':
      return [...PROJECTILE_ONLY];
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
