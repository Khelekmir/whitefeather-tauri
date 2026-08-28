import type { CSSProperties } from 'react';
import {
  coverToPoseLine,
  resolveCombatPose,
  strikeToPoseLine,
  type ResolvedCombatPose,
} from '../data/combat/combatPoseArt';
import type { CoverStanceId, Sex, StrikeStanceId } from '../types/characters';

export interface CombatPoseFighter {
  name: string;
  sex: Sex;
  weaponType?: string | null;
  strike: StrikeStanceId;
  cover: CoverStanceId;
}

function PoseFrame({
  label,
  resolved,
  accent,
}: {
  label: string;
  resolved: ResolvedCombatPose;
  accent: string;
}) {
  const frameStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  };

  const imgWrap: CSSProperties = {
    width: '100%',
    aspectRatio: '2 / 3',
    maxHeight: 220,
    borderRadius: 10,
    overflow: 'hidden',
    border: `1px solid ${accent}55`,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={frameStyle}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: accent,
          opacity: 0.85,
        }}
      >
        {label}
      </div>
      <div style={imgWrap}>
        {resolved.src ? (
          <img
            src={resolved.src}
            alt={label}
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center bottom',
              transform: resolved.flipX ? 'scaleX(-1)' : undefined,
              filter:
                resolved.via === 'silhouette' ? 'opacity(0.85)' : undefined,
            }}
          />
        ) : (
          <span style={{ fontSize: 11, opacity: 0.45 }}>No pose art</span>
        )}
      </div>
    </div>
  );
}

/**
 * Center-lane flavor: attacker pose (left) + defender pose (right).
 * Defender art is horizontally flipped (source faces right).
 */
export function CombatPosePair({
  attacker,
  defender,
  attackerAccent = '#7dd3fc',
  defenderAccent = '#fca5a5',
}: {
  attacker: CombatPoseFighter;
  defender: CombatPoseFighter;
  attackerAccent?: string;
  defenderAccent?: string;
}) {
  const atk = resolveCombatPose({
    characterName: attacker.name,
    weaponType: attacker.weaponType,
    role: 'Atk',
    line: strikeToPoseLine(attacker.strike),
    sex: attacker.sex,
  });
  const def = resolveCombatPose({
    characterName: defender.name,
    weaponType: defender.weaponType,
    role: 'Def',
    line: coverToPoseLine(defender.cover),
    sex: defender.sex,
  });

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        width: '100%',
        alignItems: 'stretch',
      }}
    >
      <PoseFrame label={`${attacker.name} · Atk`} resolved={atk} accent={attackerAccent} />
      <PoseFrame label={`${defender.name} · Def`} resolved={def} accent={defenderAccent} />
    </div>
  );
}
