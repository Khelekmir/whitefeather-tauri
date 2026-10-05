import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getDetailedCharacter,
  listDetailedCharacters,
} from './data/detailedPlaceholderCharacters';
import { getCombatCastInventory } from './data/starters/combatCastInventory';
import type { AttackTargetKey } from './data/combat/attackTargets';
import type { Item } from './types/items';
import {
  BODY_PARTS,
  COVER_STANCES,
  STRIKE_STANCES,
  formatBodyPartLabel,
  formatStanceLabel,
  type BodyPartId,
  type CombatStance,
  type CoverStanceId,
  type StrikeStanceId,
  type Unit as DetailedUnit,
} from './types/characters';
import {
  evaluateStanceMatchupFromSkills,
  summarizeRemappedAim,
} from './utils/combat/calcStanceMatchup';
import { formatAimSpillPreview } from './utils/combat/aimSpill';
import { compileCombatant, type CombatantSnapshot } from './utils/combat/compileCombatant';
import {
  calcBloodCombatPenalties,
  getBloodStatus,
} from './utils/combat/bloodVolume';
import {
  deriveHealthFromItemized,
  summarizeBleed,
} from './utils/combat/deriveHealthPool';
import {
  calcPerformanceFromItemized,
  mobilityProblemParts,
} from './utils/combat/performanceFromItemized';
import { calcTraumaPenalties, highestTrauma } from './utils/combat/traumaFlags';
import {
  resolveBasicAttack,
  type FighterState,
} from './utils/combat/resolveBasicAttack';
import { tickBleed } from './utils/combat/tickBleed';
import {
  calcDefenseChancesVsAttacker,
  type DefenseChances,
} from './utils/combat/calcDefenseChances';
import {
  applyNpcDefenseOutcome,
  resolveNpcDefense,
} from './utils/combat/resolveNpcDefense';
import { AimTargetPanel, AIM_ZONE_LABELS } from './components/AimTargetPanel';
import { AttackRhythmQte } from './components/AttackRhythmQte';
import {
  canBlockWith,
  canParryWith,
  scaleBlockRhythmWindow,
  scaleDefenseRhythmWindow,
  type BlockPriorAttempt,
  type DefenseVerb,
} from './utils/combat/defenseRhythm';
import {
  ATTACK_MODE_LABELS,
  clampAttackMode,
  weaponAttackModes,
  type AttackMode,
} from './utils/combat/damageTypes';
import { rollAttackerMiss } from './utils/combat/attackerMiss';
import {
  assessDraw,
  bandToMeters,
  calcChestFringeShare,
  calcRangedAccuracy,
  calcRangedAimPrecisionMult,
  isBowItem,
  listOwnedArrows,
} from './utils/combat/calcRangedAttack';
import { resolveRangedAttack } from './utils/combat/resolveRangedAttack';
import {
  aggravateLodgedArrows,
  extractLodgedArrow,
  listLodgedArrowParts,
} from './utils/combat/lodgedArrow';
import { formatArrowComposition } from './data/combat/arrowHeadStyles';
import { CombatPosePair } from './components/CombatPosePair';
import {
  bandDurationsMs,
  scaleRhythmWindow,
  scaleRhythmWindowFromCompetence,
  type AttackTimingZone,
  type RhythmGrade,
  type RhythmWindow,
} from './utils/combat/attackRhythm';
import { calcRhythmCompetence } from './utils/combat/rhythmCompetence';
import { COMBAT_TUNING } from './utils/combat/combatTuning';
import {
  calcAttackerSwingStamina,
  calcDodgeStamina,
  calcParryStamina,
} from './utils/combat/calcStaminaLoss';
import { getItemTemplate } from './data/catalog/itemTemplates';
import { calcItemWeight } from './utils/items/resolveItem';
import { discardEquipped } from './utils/items/equipGear';
import { roundToThousandths } from './utils/combat/penalties';
import type { ItemSlot } from './types/items';
import {
  findOwnedConsumable,
  hasFreeHandForPressure,
  removeBandage,
  removeVulnerary,
  syncDirectPressureHold,
  useBandageOnPart,
  useVulneraryOnPart,
  BANDAGE_TEMPLATE_ID,
  VULNERARY_TEMPLATE_ID,
} from './utils/combat/woundCare';

const DEFAULT_LEFT = 'unit_amberyl';
const DEFAULT_RIGHT = 'unit_sain';

type AttackDirection = 'leftToRight' | 'rightToLeft';

interface PendingRhythmAttack {
  direction: AttackDirection;
  rhythmWindow: RhythmWindow;
}

/** Player (left) defense QTE — LMB dodge / RMB parry. */
interface PendingPlayerDefense {
  direction: AttackDirection;
  critMultiplier: number;
  aim: AttackTargetKey;
  tag: string;
  dodgeWindow: RhythmWindow;
  parryWindow: RhythmWindow;
  canParry: boolean;
  attackMode: AttackMode;
}

/** Player shield-block QTE — after dodge/parry fail with offhand shield. */
interface PendingPlayerBlock {
  direction: AttackDirection;
  critMultiplier: number;
  aim: AttackTargetKey;
  tag: string;
  attackMode: AttackMode;
  blockWindow: RhythmWindow;
  adjustedChance: number;
  baseChance: number;
  blockValue: number;
  priorAttempt: BlockPriorAttempt;
}

function resolveAttackerWeaponType(snap: CombatantSnapshot | null): string {
  if (!snap) return 'unequipped';
  return (
    snap.mainhand?.template.weaponType ??
    snap.mainhand?.instance.weaponType ??
    (snap.mainhand?.instance.itemType === 'weapon' ? 'dagger' : 'unequipped')
  );
}
const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '28px 32px 48px',
  fontFamily: 'system-ui, sans-serif',
  background: 'linear-gradient(180deg, #1a0a12 0%, #0a0a12 35%, #0a1018 100%)',
  color: '#f0f0f5',
  boxSizing: 'border-box',
};

function cloneFighter(unitId: string): FighterState | null {
  const unit = getDetailedCharacter(unitId);
  if (!unit) return null;
  const kit = getCombatCastInventory(unitId);
  const cloned = structuredClone(unit) as DetailedUnit;
  if (cloned.combatStats.base.bloodLoss === undefined) {
    cloned.combatStats.base.bloodLoss = 0;
  }
  if (!cloned.combatStats.organs) {
    cloned.combatStats.organs = { heart: 1, lungLeft: 1, lungRight: 1 };
  }
  if (cloned.combatStats.incapacitated == null) {
    cloned.combatStats.incapacitated = false;
  }
  const blood = getBloodStatus(cloned);
  const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
  const derived = deriveHealthFromItemized(
    cloned.combatStats.itemizedHealth,
    cloned.combatStats.base.health,
    cloned.combatStats.base.bloodLoss,
    bloodPen.vitality
  );
  cloned.combatStats.base.healthCurrent = derived.healthCurrent;
  return {
    unit: cloned,
    itemsById: structuredClone(kit?.items ?? {}) as Record<string, Item>,
  };
}

function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          marginBottom: 3,
          opacity: 0.9,
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}/{max}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function PortraitPlaceholder({
  name,
  className,
  side,
}: {
  name: string;
  className?: string;
  side: 'left' | 'right';
}) {
  const accent = side === 'left' ? '#7dd3fc' : '#fca5a5';
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '3 / 4',
        maxHeight: 280,
        borderRadius: 12,
        border: `2px solid ${accent}55`,
        background: `linear-gradient(160deg, ${accent}22 0%, #12121a 55%, #0a0a10 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: '50%',
          border: `2px dashed ${accent}66`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.75rem',
          fontWeight: 700,
          color: accent,
        }}
      >
        {initials}
      </div>
      <div style={{ fontSize: 12, opacity: 0.55, textAlign: 'center', padding: '0 12px' }}>
        Portrait placeholder
        {className ? (
          <>
            <br />
            <span style={{ opacity: 0.8 }}>{className}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ItemizedHealthLabList({
  itemized,
  onExtractArrow,
}: {
  itemized: DetailedUnit['combatStats']['itemizedHealth'];
  onExtractArrow?: (part: BodyPartId) => void;
}) {
  const rows = BODY_PARTS.map((part) => {
    const s = itemized[part];
    const trauma = highestTrauma(s);
    const notable =
      s.health < 0.999 ||
      s.bleed > 0 ||
      s.internalBleed > 0 ||
      (s.bruise ?? 0) > 0.05 ||
      trauma !== 'none' ||
      s.dressed ||
      s.vulnerary ||
      s.directPressure ||
      !!s.lodgedArrow;
    return { part, s, trauma, notable };
  });
  const show = rows.filter((r) => r.notable);

  if (show.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>
        All parts healthy · no bleed / trauma / care flags.
      </p>
    );
  }

  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        fontSize: 11,
        lineHeight: 1.45,
        maxHeight: 220,
        overflowY: 'auto',
      }}
    >
      {show.map(({ part, s, trauma }) => {
        const bits: string[] = [`${(s.health * 100).toFixed(0)}%`];
        if (s.bleed > 0) bits.push(`ext ${(s.bleed * 100).toFixed(0)}%`);
        if (s.internalBleed > 0)
          bits.push(`int ${(s.internalBleed * 100).toFixed(0)}%`);
        if ((s.bruise ?? 0) > 0.05)
          bits.push(`bruise ${(s.bruise * 100).toFixed(0)}%`);
        if (s.lodgedArrow)
          bits.push(`shaft:${s.lodgedArrow.headStyle}`);
        if (trauma !== 'none') bits.push(trauma);
        if (s.dressed) bits.push('dressed');
        if (s.vulnerary) bits.push('vulnerary');
        if (s.directPressure) bits.push('pressure');
        const hurt =
          s.health < 0.85 ||
          s.bleed > 0 ||
          s.internalBleed > 0 ||
          !!s.lodgedArrow;
        return (
          <li
            key={part}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              padding: '3px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: hurt ? '#fecaca' : '#e5e7eb',
              opacity: hurt ? 1 : 0.85,
            }}
          >
            <span style={{ opacity: 0.75 }}>{formatBodyPartLabel(part)}</span>
            <span
              style={{
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 2,
              }}
            >
              <span>{bits.join(' · ')}</span>
              {s.lodgedArrow && onExtractArrow ? (
                <button
                  type="button"
                  onClick={() => onExtractArrow(part)}
                  title={`Extract ${formatArrowComposition(s.lodgedArrow)} — spikes bleed`}
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(251, 191, 36, 0.5)',
                    background: 'rgba(251, 191, 36, 0.12)',
                    color: '#fde68a',
                    cursor: 'pointer',
                  }}
                >
                  Extract arrow
                </button>
              ) : null}
            </span>
          </li>
        );
      })}
      <li style={{ marginTop: 4, opacity: 0.45, fontSize: 10 }}>
        Showing {show.length} notable / {BODY_PARTS.length} parts
      </li>
    </ul>
  );
}

function FighterCard({
  snapshot,
  side,
  selectedId,
  onSelect,
  onStanceChange,
  onDiscardRuined,
  defenseChances,
  onToggleBandage,
  onToggleVulnerary,
  onExtractArrow,
}: {
  snapshot: CombatantSnapshot | null;
  side: 'left' | 'right';
  selectedId: string;
  onSelect: (id: string) => void;
  onStanceChange: (patch: Partial<CombatStance>) => void;
  onDiscardRuined?: (slot: ItemSlot) => void;
  /** Live NPC dodge/parry % vs current opponent (stance-aware). */
  defenseChances?: DefenseChances | null;
  onExtractArrow?: (part: BodyPartId) => void;
  onToggleBandage?: (part: BodyPartId) => void;
  onToggleVulnerary?: (part: BodyPartId) => void;
}) {
  const cast = listDetailedCharacters();
  const accent = side === 'left' ? '#7dd3fc' : '#fca5a5';
  const label = side === 'left' ? 'Player' : 'NPC';

  if (!snapshot) {
    return (
      <div style={{ border: '1px solid #444', borderRadius: 12, padding: 16 }}>
        <p>Character not found.</p>
        <select value={selectedId} onChange={(e) => onSelect(e.target.value)} style={selectStyle}>
          {cast.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const {
    unit,
    mainhand,
    offhand,
    gearWeight,
    avgArmorDurability,
    trainedWeaponSkills,
    trainedStanceSkills,
  } = snapshot;
  const { currentStance } = unit.combatStats;
  const { base } = unit.combatStats;
  const blood = getBloodStatus(unit);
  const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
  const bleed = summarizeBleed(
    unit.combatStats.itemizedHealth,
    blood.lostFraction
  );
  const performance = calcPerformanceFromItemized(
    unit.combatStats.itemizedHealth,
    unit.combatStats.organs
  );
  const mobilityIssues = mobilityProblemParts(unit.combatStats.itemizedHealth);
  const trauma = calcTraumaPenalties(
    unit.combatStats.itemizedHealth,
    unit.combatStats.organs
  );
  const mobilityEffective = performance.mobility * bloodPen.mobility;
  const dodgeEffective = performance.dodge * bloodPen.dodge;
  const npcDodge = defenseChances?.dodge ?? null;
  const npcParry = defenseChances?.parry ?? null;
  const npcBlock = defenseChances?.block ?? null;
  const npcBlockValue = defenseChances?.blockValue ?? null;

  const primaryStats: { key: keyof typeof base; label: string }[] = [
    { key: 'strength', label: 'STR' },
    { key: 'skill', label: 'SKL' },
    { key: 'speed', label: 'SPD' },
    { key: 'luck', label: 'LCK' },
    { key: 'defense', label: 'DEF' },
    { key: 'resistance', label: 'RES' },
    { key: 'magic', label: 'MAG' },
    { key: 'agility', label: 'AGI' },
    { key: 'reflex', label: 'RFX' },
    { key: 'constitution', label: 'CON' },
    { key: 'movement', label: 'MOV' },
  ];

  return (
    <div
      style={{
        border: `1px solid ${accent}44`,
        borderRadius: 12,
        padding: 16,
        background: 'linear-gradient(180deg, rgba(30,30,40,0.95) 0%, rgba(16,16,22,0.98) 100%)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: 0.8, color: accent, textTransform: 'uppercase' }}>
          {label}
        </span>
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          style={{ ...selectStyle, borderColor: `${accent}66` }}
        >
          {cast.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.class})
            </option>
          ))}
        </select>
      </div>

      <PortraitPlaceholder name={unit.name} className={unit.class} side={side} />

      <div style={{ marginTop: 14 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.45rem' }}>{unit.name}</h2>
        <p style={{ margin: 0, opacity: 0.75, fontSize: 13 }}>
          {unit.class} · Lv. {unit.level ?? 1} · {unit.sex} · age {unit.age}
          {unit.combatStats.incapacitated ? (
            <span style={{ color: '#f87171', fontWeight: 600 }}> · INCAPACITATED</span>
          ) : null}
        </p>
        {(() => {
          const o = unit.combatStats.organs;
          if (!o) return null;
          const bits: string[] = [];
          if (o.heart < 0.999) bits.push(`heart ${(o.heart * 100).toFixed(0)}%`);
          if (o.lungLeft < 0.999)
            bits.push(`L lung ${(o.lungLeft * 100).toFixed(0)}%`);
          if (o.lungRight < 0.999)
            bits.push(`R lung ${(o.lungRight * 100).toFixed(0)}%`);
          if (bits.length === 0) return null;
          return (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#fca5a5' }}>
              Organs · {bits.join(' · ')}
            </p>
          );
        })()}
      </div>

      <div style={{ marginTop: 16 }}>
        <StatBar label="HP" value={base.healthCurrent} max={base.health} color="#f87171" />
        <StatBar
          label="Stamina"
          value={base.staminaCurrent}
          max={base.staminaCap}
          color="#38bdf8"
        />
        <StatBar
          label="Armor durability (avg)"
          value={Math.round(avgArmorDurability * 100)}
          max={100}
          color="#a78bfa"
        />
        <StatBar
          label={`Blood volume (${blood.lossClass})`}
          value={Number(blood.remainingLiters.toFixed(2))}
          max={Number(blood.volumeLiters.toFixed(2))}
          color={
            blood.remainingFraction > 0.92
              ? '#f87171'
              : blood.remainingFraction > 0.7
                ? '#fb7185'
                : blood.remainingFraction > 0.55
                  ? '#e11d48'
                  : '#7f1d1d'
          }
        />
        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
          <div>
            {blood.lostLiters.toFixed(2)} L lost ·{' '}
            {(blood.remainingFraction * 100).toFixed(0)}% remaining
          </div>
          <div style={{ marginTop: 2 }}>
            Stamina factor {(bloodPen.stamina * 100).toFixed(0)}%
            <span style={{ opacity: 0.55 }}> (from blood)</span>
            {' · '}
            Mobility {(mobilityEffective * 100).toFixed(0)}% · Parts dodge{' '}
            {(dodgeEffective * 100).toFixed(0)}%
            <span style={{ opacity: 0.55 }}> (perf × blood)</span>
          </div>
          {npcDodge != null && npcParry != null ? (
            <div style={{ marginTop: 2, color: '#86efac' }}>
              NPC defense · dodge {(npcDodge * 100).toFixed(0)}% · parry{' '}
              {(npcParry * 100).toFixed(0)}%
              {npcBlock != null && npcBlock > 0 ? (
                <>
                  {' '}
                  · block {(npcBlock * 100).toFixed(0)}% (absorb{' '}
                  {npcBlockValue?.toFixed(1)})
                </>
              ) : null}
              <span style={{ opacity: 0.65 }}>
                {' '}
                (health×stam×weight
                {defenseChances?.breakdown.avoidanceDelta
                  ? ` +stance`
                  : ''}
                )
              </span>
            </div>
          ) : null}
          {mobilityIssues.length > 0 && (
            <div style={{ color: '#fbbf24', marginTop: 2 }}>
              Limping:{' '}
              {mobilityIssues
                .slice(0, 3)
                .map(
                  (p) =>
                    `${formatBodyPartLabel(p.part)} ${(p.health * 100).toFixed(0)}%`
                )
                .join(', ')}
            </div>
          )}
          {trauma.flagged.length > 0 && (
            <div style={{ color: '#fda4af', marginTop: 2 }}>
              Trauma:{' '}
              {trauma.flagged
                .slice(0, 4)
                .map((t) => `${formatBodyPartLabel(t.part)} ${t.level}`)
                .join(' · ')}
              {trauma.flagged.length > 4 ? '…' : ''}
              {trauma.chestBroken ? ' · breathing!' : ''}
            </div>
          )}
        </div>
        {bleed.totalBleedRate > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5' }}>
            Bleed rate: {bleed.totalBleedRate.toFixed(2)}
            <ul style={{ margin: '4px 0 0', paddingLeft: 0, listStyle: 'none', opacity: 0.9 }}>
              {bleed.partsBleeding
                .filter((p) => p.rate > 0)
                .slice(0, 6)
                .map((p) => {
                  const st = unit.combatStats.itemizedHealth[p.part];
                  const dressed = !!st?.dressed;
                  const salved = !!st?.vulnerary;
                  const tinyBtn: CSSProperties = {
                    padding: '2px 6px',
                    fontSize: 10,
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#f8fafc',
                  };
                  return (
                    <li
                      key={p.part}
                      style={{
                        marginBottom: 6,
                        paddingBottom: 4,
                        borderBottom: '1px solid rgba(248,113,113,0.15)',
                      }}
                    >
                      <div>
                        {formatBodyPartLabel(p.part)} · health{' '}
                        {(p.health * 100).toFixed(0)}% · ext{' '}
                        {(p.bleedIntensity * 100).toFixed(0)}%
                        {p.internalBleedIntensity > 0
                          ? ` · int ${(p.internalBleedIntensity * 100).toFixed(0)}%`
                          : ''}{' '}
                        · {p.criticality} · rate {p.rate.toFixed(2)}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 4,
                          marginTop: 3,
                        }}
                      >
                        <button
                          type="button"
                          style={{
                            ...tinyBtn,
                            background: dressed
                              ? 'rgba(74,222,128,0.25)'
                              : tinyBtn.background,
                            borderColor: dressed
                              ? 'rgba(74,222,128,0.55)'
                              : 'rgba(255,255,255,0.25)',
                          }}
                          disabled={!onToggleBandage}
                          onClick={() => onToggleBandage?.(p.part)}
                        >
                          {dressed ? 'Remove bandage' : 'Bandage'}
                        </button>
                        <button
                          type="button"
                          style={{
                            ...tinyBtn,
                            background: salved
                              ? 'rgba(167,139,250,0.3)'
                              : tinyBtn.background,
                            borderColor: salved
                              ? 'rgba(196,181,253,0.6)'
                              : 'rgba(255,255,255,0.25)',
                          }}
                          disabled={!onToggleVulnerary}
                          onClick={() => onToggleVulnerary?.(p.part)}
                        >
                          {salved ? 'Remove vulnerary' : 'Vulnerary'}
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>

      <h3 style={{ margin: '18px 0 8px', fontSize: 13, opacity: 0.7, letterSpacing: 0.4 }}>
        ITEMIZED HEALTH
      </h3>
      <ItemizedHealthLabList
        itemized={unit.combatStats.itemizedHealth}
        onExtractArrow={onExtractArrow}
      />

      <h3 style={{ margin: '18px 0 8px', fontSize: 13, opacity: 0.7, letterSpacing: 0.4 }}>
        BASE COMBAT STATS
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {primaryStats.map(({ key, label: lab }) => (
          <div
            key={key}
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 6,
              padding: '6px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.55 }}>{lab}</div>
            <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {base[key]}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '18px 0 8px', fontSize: 13, opacity: 0.7, letterSpacing: 0.4 }}>
        LOADOUT
      </h3>
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>
        <div>
          <span style={{ opacity: 0.55 }}>Main-hand · </span>
          {mainhand
            ? `${mainhand.instance.name}${mainhand.instance.weaponType ? ` (${mainhand.instance.weaponType})` : ''} · dur ${(mainhand.durabilityRatio * 100).toFixed(0)}%`
            : '— empty / punch'}
        </div>
        <div>
          <span style={{ opacity: 0.55 }}>Off-hand · </span>
          {offhand
            ? `${offhand.instance.name} · dur ${(offhand.durabilityRatio * 100).toFixed(0)}%`
            : '— empty'}
        </div>
        <div>
          <span style={{ opacity: 0.55 }}>Gear weight · </span>
          {gearWeight.toFixed(2)}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
          {snapshot.equipped
            .filter(
              (e) =>
                e.resolved.durabilityRatio <= 0 &&
                e.resolved.instance.itemType === 'armor'
            )
            .map((e) => (
              <div
                key={e.slot}
                style={{
                  color: '#f9a8d4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span>
                  Ruined: {e.resolved.instance.name}{' '}
                  <span style={{ opacity: 0.6 }}>({e.slot})</span>
                </span>
                {onDiscardRuined ? (
                  <button
                    type="button"
                    onClick={() => onDiscardRuined(e.slot)}
                    style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      background: 'rgba(244,114,182,0.15)',
                      color: '#fbcfe8',
                      border: '1px solid rgba(244,114,182,0.45)',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Discard
                  </button>
                ) : null}
              </div>
            ))}
        </div>
      </div>

      <h3 style={{ margin: '18px 0 8px', fontSize: 13, opacity: 0.7, letterSpacing: 0.4 }}>
        STANCE
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ fontSize: 12, opacity: 0.75 }}>
          Cover
          <select
            value={currentStance.cover}
            onChange={(e) =>
              onStanceChange({ cover: e.target.value as CoverStanceId })
            }
            style={{ ...selectStyle, width: '100%', marginTop: 4, borderColor: `${accent}66` }}
          >
            {COVER_STANCES.map((id) => (
              <option key={id} value={id}>
                {formatStanceLabel(id)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, opacity: 0.75 }}>
          Strike
          <select
            value={currentStance.strike}
            onChange={(e) =>
              onStanceChange({ strike: e.target.value as StrikeStanceId })
            }
            style={{ ...selectStyle, width: '100%', marginTop: 4, borderColor: `${accent}66` }}
          >
            {STRIKE_STANCES.map((id) => (
              <option key={id} value={id}>
                {formatStanceLabel(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11, opacity: 0.6 }}>
        Preferred {formatStanceLabel(unit.combatStats.preferredCover)} /{' '}
        {formatStanceLabel(unit.combatStats.preferredStrike)}
      </p>
      {trainedStanceSkills.length > 0 && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, opacity: 0.85 }}>
          {trainedStanceSkills.map((s) => (
            <li key={s.id}>
              {formatStanceLabel(s.id)}: {s.rank}
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ margin: '18px 0 8px', fontSize: 13, opacity: 0.7, letterSpacing: 0.4 }}>
        TRAINED WEAPON SKILLS
      </h3>
      {trainedWeaponSkills.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>None above baseline.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {trainedWeaponSkills.slice(0, 6).map((s) => (
            <li key={s.type}>
              <code>{s.type}</code>: {s.rank}
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 14 }}>
        <Link to={`/characters/detailed/${unit.id}`} style={{ fontSize: 12, color: accent }}>
          Open full detail →
        </Link>
      </div>
    </div>
  );
}

const selectStyle: CSSProperties = {
  background: '#1a1a24',
  color: '#eee',
  border: '1px solid #555',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 13,
  maxWidth: '100%',
};

function MatchupPreview({
  attacker,
  defender,
  aim,
  label,
}: {
  attacker: CombatantSnapshot | null;
  defender: CombatantSnapshot | null;
  aim: AttackTargetKey;
  label: string;
}) {
  if (!attacker || !defender) return null;
  const strike = attacker.unit.combatStats.currentStance.strike;
  const cover = defender.unit.combatStats.currentStance.cover;
  const weaponType = resolveAttackerWeaponType(attacker);
  const matchup = evaluateStanceMatchupFromSkills(
    strike,
    cover,
    attacker.unit.combatStats.stanceSkill,
    defender.unit.combatStats.stanceSkill,
    weaponType
  );
  const spillSkills = {
    attackerWeaponSkill:
      (attacker.unit.combatStats.weaponSkill as Record<string, number>)[
        weaponType
      ] ?? 1,
    attackerSkill: attacker.unit.combatStats.base.skill,
    defenderCoverSkill:
      (defender.unit.combatStats.stanceSkill as Record<string, number>)[
        cover
      ] ?? 1,
  };
  const presented = summarizeRemappedAim(aim, cover, 4, undefined, spillSkills);
  const competence = calcRhythmCompetence(attacker.unit, weaponType, strike, {
    itemsById: attacker.itemsById,
  });
  const rhythmWindow = scaleRhythmWindowFromCompetence(
    matchup.windowFactor,
    competence
  );
  const bands = bandDurationsMs(rhythmWindow);
  const relationColor =
    matchup.relation === 'opposite'
      ? '#86efac'
      : matchup.relation === 'same'
        ? '#fca5a5'
        : '#fde68a';
  return (
    <div
      style={{
        width: '100%',
        fontSize: 11,
        lineHeight: 1.45,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '8px 10px',
        textAlign: 'left',
      }}
    >
      <div style={{ opacity: 0.55, marginBottom: 4 }}>{label}</div>
      <div>
        {formatStanceLabel(strike)} vs {formatStanceLabel(cover)}
      </div>
      <div style={{ color: relationColor, fontWeight: 600 }}>
        {matchup.relation}
        {matchup.relation === 'same'
          ? ' (guarded)'
          : matchup.relation === 'opposite'
            ? ' (exposed)'
            : ''}
      </div>
      <div style={{ opacity: 0.8 }}>
        net guard {matchup.netGuard.toFixed(2)} · attack window ×{matchup.windowFactor.toFixed(2)} ·
        parry window ×{matchup.parryWindowFactor.toFixed(2)}
        <span style={{ opacity: 0.55 }}> preview</span>
      </div>
      <div style={{ opacity: 0.8, marginTop: 2 }}>
        {formatAimSpillPreview(spillSkills)}
      </div>
      <div style={{ opacity: 0.75, marginTop: 2 }}>
        {aim} presents:{' '}
        {presented
          .map((p) => `${formatBodyPartLabel(p.part)} ${(p.ratio * 100).toFixed(0)}%`)
          .join(', ')}
      </div>
      <div style={{ opacity: 0.8, marginTop: 2 }}>
        competence {competence.competence.toFixed(2)} (weapon {competence.weaponEff.toFixed(2)} ·
        strike {competence.strikeEff.toFixed(2)})
      </div>
      <div style={{ opacity: 0.75 }}>
        {weaponType} skill → specific {competence.weaponSpecific.toFixed(2)} · family{' '}
        {competence.weaponFamily.toFixed(2)} · general {competence.weaponGeneral.toFixed(2)}
      </div>
      <div style={{ opacity: 0.8, marginTop: 2 }}>
        rhythm QTE: collapse {bands.totalMs} ms · hit band ~{bands.hitMs} ms · crit band ~
        {bands.critMs} ms
        <span style={{ opacity: 0.55 }}> (if rhythm on)</span>
      </div>
      {!matchup.weaponOnPreferredLine && (
        <div style={{ opacity: 0.7 }}>
          {weaponType} prefers {formatStanceLabel(matchup.weaponPreferredStrike)} (affinity{' '}
          {matchup.weaponAffinity})
        </div>
      )}
      <div style={{ marginTop: 4, opacity: 0.75 }}>
        {aim} vs {formatStanceLabel(cover)}:{' '}
        {presented
          .map((p) => `${formatBodyPartLabel(p.part)} ${(p.ratio * 100).toFixed(0)}%`)
          .join(' · ')}
      </div>
    </div>
  );
}

function Battleground() {
  const navigate = useNavigate();
  const [leftId, setLeftId] = useState(DEFAULT_LEFT);
  const [rightId, setRightId] = useState(DEFAULT_RIGHT);
  const [left, setLeft] = useState<FighterState | null>(() => cloneFighter(DEFAULT_LEFT));
  const [right, setRight] = useState<FighterState | null>(() => cloneFighter(DEFAULT_RIGHT));
  const [aim, setAim] = useState<AttackTargetKey>('chest');
  const [attackMode, setAttackMode] = useState<AttackMode>('slash');
  /** Engagement band 1–5 (melee only at 1; bows use draw-limited max). */
  const [engagementBand, setEngagementBand] = useState(1);
  const [arrowTemplateId, setArrowTemplateId] = useState('arrow-hunting');
  /** Lab/gameplay: hold direct pressure on worst bleed (needs free hand). */
  const [leftPressureHold, setLeftPressureHold] = useState(false);
  const [rightPressureHold, setRightPressureHold] = useState(false);
  /** Which side is currently being aimed at (drives silhouette sex + attack buttons). */
  const [attackDir, setAttackDir] = useState<AttackDirection>('leftToRight');
  /** Lab toggle: off = instant 100% hit; on = LoD shrinking-square QTE. */
  const [useRhythm, setUseRhythm] = useState(false);
  /** Lab: axis-align QTE squares (no spin) for easier eclipse reading. */
  const [freezeQteSpin, setFreezeQteSpin] = useState(false);
  const [pendingRhythm, setPendingRhythm] = useState<PendingRhythmAttack | null>(
    null
  );
  const [pendingPlayerDefense, setPendingPlayerDefense] =
    useState<PendingPlayerDefense | null>(null);
  const [pendingPlayerBlock, setPendingPlayerBlock] =
    useState<PendingPlayerBlock | null>(null);
  const [log, setLog] = useState<string[]>([
    'Battleground ready. Left = Player (defense QTE → shield block QTE). Right = NPC (chance dodge/parry/block). Attack rhythm optional.',
  ]);

  useEffect(() => {
    setLeft(cloneFighter(leftId));
  }, [leftId]);

  useEffect(() => {
    setRight(cloneFighter(rightId));
  }, [rightId]);

  const fighterWeaponType = (f: FighterState | null): string => {
    if (!f) return 'punch';
    const mainId = f.unit.equipment.mainhand;
    const main = mainId ? f.itemsById[mainId] : null;
    if (!main || main.itemType !== 'weapon') return 'punch';
    return (
      main.weaponType ??
      getItemTemplate(main.templateId)?.weaponType ??
      'punch'
    );
  };

  const activeAttacker = attackDir === 'leftToRight' ? left : right;
  const activeWeaponType = fighterWeaponType(activeAttacker);
  const availableAttackModes = weaponAttackModes(activeWeaponType);
  const activeMainhand = activeAttacker
    ? (() => {
        const id = activeAttacker.unit.equipment.mainhand;
        return id ? activeAttacker.itemsById[id] ?? null : null;
      })()
    : null;
  const activeIsBow = isBowItem(activeMainhand);
  const activeDraw = useMemo(() => {
    if (!activeAttacker || !activeIsBow || !activeMainhand?.weaponType) return null;
    return assessDraw(
      activeAttacker.unit.combatStats.base.strength,
      activeMainhand.weaponType
    );
  }, [activeAttacker, activeIsBow, activeMainhand]);
  const activeArrows = useMemo(
    () => (activeAttacker ? listOwnedArrows(activeAttacker.itemsById) : []),
    [activeAttacker]
  );
  const activeWeaponSkill = useMemo(() => {
    if (!activeAttacker || !activeMainhand?.weaponType) return 1;
    return (
      (activeAttacker.unit.combatStats.weaponSkill as Record<string, number>)[
        activeMainhand.weaponType
      ] ?? 1
    );
  }, [activeAttacker, activeMainhand]);
  const activeAimPrecision = useMemo(() => {
    if (!activeIsBow) return 1;
    return calcRangedAimPrecisionMult({
      aim,
      weaponSkill: activeWeaponSkill,
      distanceBand: engagementBand,
    });
  }, [activeIsBow, aim, activeWeaponSkill, engagementBand]);
  const activeChestFringe = useMemo(() => {
    if (!activeIsBow || aim !== 'chest') return null;
    return calcChestFringeShare({
      weaponSkill: activeWeaponSkill,
      distanceBand: engagementBand,
    });
  }, [activeIsBow, aim, activeWeaponSkill, engagementBand]);
  const activeAccuracyPreview = useMemo(() => {
    if (!activeAttacker || !activeDraw || !activeMainhand?.weaponType) return null;
    return calcRangedAccuracy({
      unit: activeAttacker.unit,
      weaponType: activeMainhand.weaponType,
      distanceBand: engagementBand,
      drawFrac: activeDraw.drawFrac,
      maxEngageBand: activeDraw.maxEngageBand,
      aim,
    });
  }, [activeAttacker, activeDraw, activeMainhand, engagementBand, aim]);

  useEffect(() => {
    setAttackMode((prev) => clampAttackMode(activeWeaponType, prev));
  }, [activeWeaponType, attackDir, leftId, rightId]);

  // Keep arrow selection valid for the active shooter's owned stock.
  useEffect(() => {
    if (activeArrows.length === 0) return;
    if (activeArrows.some((a) => a.templateId === arrowTemplateId)) return;
    setArrowTemplateId(activeArrows[0]!.templateId);
  }, [activeArrows, arrowTemplateId]);

  const leftSnap = useMemo(
    () => (left ? compileCombatant(left.unit, left.itemsById) : null),
    [left]
  );
  const rightSnap = useMemo(
    () => (right ? compileCombatant(right.unit, right.itemsById) : null),
    [right]
  );

  /** Defense % for each fighter vs the other as attacker (stance-aware). */
  const leftDefense = useMemo(
    () => (left && right ? calcDefenseChancesVsAttacker(left, right) : null),
    [left, right]
  );
  const rightDefense = useMemo(
    () => (right && left ? calcDefenseChancesVsAttacker(right, left) : null),
    [left, right]
  );

  const pushLog = (lines: string | string[]) => {
    const batch = Array.isArray(lines) ? lines : [lines];
    const stamped = batch.map((line) => `[${new Date().toLocaleTimeString()}] ${line}`);
    setLog((prev) => [...stamped.reverse(), ...prev].slice(0, 80));
  };

  const discardRuinedOnSide = (side: 'left' | 'right', slot: ItemSlot) => {
    const fighter = side === 'left' ? left : right;
    const setFighter = side === 'left' ? setLeft : setRight;
    if (!fighter) return;
    const next: FighterState = {
      unit: {
        ...fighter.unit,
        equipment: { ...fighter.unit.equipment },
      },
      itemsById: { ...fighter.itemsById },
    };
    const r = discardEquipped(
      { unit: next.unit, itemsById: next.itemsById },
      slot
    );
    if (!r.ok) {
      pushLog(r.message);
      return;
    }
    setFighter(next);
    pushLog(
      `${next.unit.name} discards ruined ${r.item.name} (${slot}) — removed from loadout.`
    );
  };

  const toggleBandageOnSide = (side: 'left' | 'right', part: BodyPartId) => {
    const fighter = side === 'left' ? left : right;
    const setFighter = side === 'left' ? setLeft : setRight;
    if (!fighter) return;
    const unit = structuredClone(fighter.unit) as DetailedUnit;
    const itemsById = { ...fighter.itemsById };
    const dressed = !!unit.combatStats.itemizedHealth[part]?.dressed;
    if (dressed) {
      const r = removeBandage(unit.combatStats.itemizedHealth, part);
      if (!r.ok) {
        pushLog(r.message);
        return;
      }
      setFighter({ unit, itemsById });
      pushLog(
        `${unit.name}: removed bandage from ${formatBodyPartLabel(part)}.`
      );
      return;
    }
    const had = !!findOwnedConsumable(itemsById, BANDAGE_TEMPLATE_ID);
    const r = useBandageOnPart(unit.combatStats.itemizedHealth, part, itemsById, {
      allowLabFree: true,
    });
    if (!r.ok) {
      pushLog(r.message);
      return;
    }
    setFighter({ unit, itemsById });
    pushLog(
      `${unit.name}: bandage → ${formatBodyPartLabel(part)}${
        r.labFree || !had ? ' · lab free' : ' · consumed'
      }.`
    );
  };

  const toggleVulneraryOnSide = (side: 'left' | 'right', part: BodyPartId) => {
    const fighter = side === 'left' ? left : right;
    const setFighter = side === 'left' ? setLeft : setRight;
    if (!fighter) return;
    const unit = structuredClone(fighter.unit) as DetailedUnit;
    const itemsById = { ...fighter.itemsById };
    const salved = !!unit.combatStats.itemizedHealth[part]?.vulnerary;
    if (salved) {
      const r = removeVulnerary(unit.combatStats.itemizedHealth, part);
      if (!r.ok) {
        pushLog(r.message);
        return;
      }
      setFighter({ unit, itemsById });
      pushLog(
        `${unit.name}: removed vulnerary from ${formatBodyPartLabel(part)}.`
      );
      return;
    }
    const had = !!findOwnedConsumable(itemsById, VULNERARY_TEMPLATE_ID);
    const r = useVulneraryOnPart(
      unit.combatStats.itemizedHealth,
      part,
      itemsById,
      { allowLabFree: true }
    );
    if (!r.ok) {
      pushLog(r.message);
      return;
    }
    setFighter({ unit, itemsById });
    pushLog(
      `${unit.name}: vulnerary → ${formatBodyPartLabel(part)}${
        r.labFree || !had ? ' · lab free' : ' · consumed'
      }.`
    );
    if (r.warning) pushLog(r.warning);
  };

  /** Movement while shafts are lodged — bumps internal bleed. */
  const applyLodgedActionAggravation = (
    fighter: FighterState,
    label = 'action'
  ): { fighter: FighterState; log: string[] } => {
    const lodged = listLodgedArrowParts(fighter.unit.combatStats.itemizedHealth);
    if (lodged.length === 0) return { fighter, log: [] };
    const next: FighterState = {
      unit: structuredClone(fighter.unit) as DetailedUnit,
      itemsById: fighter.itemsById,
    };
    const r = aggravateLodgedArrows(next.unit.combatStats.itemizedHealth, {
      actions: 1,
    });
    if (r.parts.length === 0) return { fighter, log: [] };
    return {
      fighter: next,
      log: [
        `${next.unit.name}: lodged shaft wriggle (${label}) on ${r.parts
          .map((p) => formatBodyPartLabel(p))
          .join(', ')}.`,
      ],
    };
  };

  const extractArrowOnSide = (side: 'left' | 'right', part: BodyPartId) => {
    const fighter = side === 'left' ? left : right;
    const setFighter = side === 'left' ? setLeft : setRight;
    if (!fighter) return;
    const unit = structuredClone(fighter.unit) as DetailedUnit;
    const r = extractLodgedArrow(unit.combatStats.itemizedHealth, part);
    if (!r.ok) {
      pushLog(r.message);
      return;
    }
    setFighter({ unit, itemsById: fighter.itemsById });
    pushLog(
      `${unit.name}: extracted ${r.removed.name} (${formatArrowComposition(r.removed)}) from ${formatBodyPartLabel(part)} — ext +${(r.externalSpike * 100).toFixed(0)}% · int +${(r.internalSpike * 100).toFixed(0)}%.`
    );
  };

  const defenderSnap = attackDir === 'leftToRight' ? rightSnap : leftSnap;
  const defenderLabel =
    attackDir === 'leftToRight'
      ? `Targeting ${rightSnap?.unit.name ?? 'NPC'} (NPC)`
      : `Targeting ${leftSnap?.unit.name ?? 'Player'} (Player)`;
  const defenderSex = defenderSnap?.unit.sex ?? 'M';
  const aimAccent = attackDir === 'leftToRight' ? '#fca5a5' : '#7dd3fc';

  const buildRhythmWindow = (
    attackerSnap: CombatantSnapshot | null,
    defenderSnapLocal: CombatantSnapshot | null
  ): RhythmWindow => {
    if (!attackerSnap || !defenderSnapLocal) {
      return scaleRhythmWindow({ windowFactor: 1, competence: 0.5 });
    }
    const weaponType = resolveAttackerWeaponType(attackerSnap);
    const strike = attackerSnap.unit.combatStats.currentStance.strike;
    const m = evaluateStanceMatchupFromSkills(
      strike,
      defenderSnapLocal.unit.combatStats.currentStance.cover,
      attackerSnap.unit.combatStats.stanceSkill,
      defenderSnapLocal.unit.combatStats.stanceSkill,
      weaponType
    );
    const competence = calcRhythmCompetence(
      attackerSnap.unit,
      weaponType,
      strike,
      { itemsById: attackerSnap.itemsById }
    );
    return scaleRhythmWindowFromCompetence(m.windowFactor, competence);
  };

  const applyConnectedAttack = (
    direction: AttackDirection,
    grade: RhythmGrade | 'bypass',
    opts?: { skipNpcDefense?: boolean }
  ) => {
    if (!left || !right) {
      pushLog('Cannot attack — pick two valid fighters.');
      return;
    }
    const attacker = direction === 'leftToRight' ? left : right;
    const defender = direction === 'leftToRight' ? right : left;
    const tag =
      grade === 'bypass'
        ? '[bypass:swing connects]'
        : `[rhythm:${grade}]`;
    const critMultiplier =
      grade === 'crit' ? COMBAT_TUNING.rhythm.critAttackMultiplier : 1;
    const mode = clampAttackMode(fighterWeaponType(attacker), attackMode);

    // Player is left: NPC→Player uses defense QTE (LMB dodge / RMB parry).
    if (direction === 'rightToLeft') {
      const dodgeBuilt = scaleDefenseRhythmWindow({
        verb: 'dodge',
        defender: defender.unit,
        itemsById: defender.itemsById,
        attacker: attacker.unit,
        attackerItemsById: attacker.itemsById,
      });
      const parryBuilt = scaleDefenseRhythmWindow({
        verb: 'parry',
        defender: defender.unit,
        itemsById: defender.itemsById,
        attacker: attacker.unit,
        attackerItemsById: attacker.itemsById,
      });
      setPendingPlayerDefense({
        direction,
        critMultiplier,
        aim,
        tag,
        dodgeWindow: dodgeBuilt.window,
        parryWindow: parryBuilt.window,
        canParry: canParryWith(defender.unit, defender.itemsById),
        attackMode: mode,
      });
      pushLog([
        tag,
        `Incoming on Player (${ATTACK_MODE_LABELS[mode]}) — LMB/Space dodge, RMB/P parry.`,
      ]);
      return;
    }

    // Player→NPC: RNG defense only when not already resolved via QTE band zones
    // (rhythm ON uses hit/crit edge zoning instead).
    let defenseDefender = defender;
    let defenseLog: string[] = [];
    if (!opts?.skipNpcDefense) {
      const defense = resolveNpcDefense(attacker, defender);
      if (defense.outcome !== 'none') {
        // Defender moved (dodge/parry); attacker also exerted.
        const defAgg = applyLodgedActionAggravation(
          defense.defender,
          defense.outcome
        );
        const atkAgg = applyLodgedActionAggravation(attacker, 'attack');
        setRight(defAgg.fighter);
        setLeft(atkAgg.fighter);
        pushLog([tag, ...defense.log, ...defAgg.log, ...atkAgg.log]);
        return;
      }
      defenseDefender = defense.defender;
      defenseLog = defense.log;
    }

    const result = resolveBasicAttack(attacker, defenseDefender, aim, {
      critMultiplier,
      attackMode: mode,
    });
    const atkAgg = applyLodgedActionAggravation(result.attacker, 'attack');
    setLeft(atkAgg.fighter);
    setRight(result.defender);
    pushLog([tag, ...defenseLog, ...result.log, ...atkAgg.log]);
  };

  const clearPlayerDefense = () => {
    setPendingPlayerDefense(null);
  };

  const applyPlayerDefenseSuccess = (
    verb: 'dodge' | 'parry',
    grade: RhythmGrade
  ) => {
    if (!pendingPlayerDefense || !left || !right) return;
    const defender = {
      unit: structuredClone(left.unit) as DetailedUnit,
      itemsById: structuredClone(left.itemsById),
    };
    const attacker = right;
    let cost = 0;
    let qualityNote = '';
    const traumaStam = calcTraumaPenalties(
      defender.unit.combatStats.itemizedHealth,
      defender.unit.combatStats.organs
    ).staminaDrainMult;
    if (verb === 'dodge') {
      const quality = grade === 'crit' ? 'precise' : 'sloppy';
      cost = calcDodgeStamina(quality, traumaStam);
      qualityNote = `${quality} dodge`;
    } else {
      const quality = grade === 'crit' ? 'clean' : 'edge';
      cost = calcParryStamina({
        quality,
        attackerCon: attacker.unit.combatStats.base.constitution,
        defenderCon: defender.unit.combatStats.base.constitution,
        staminaDrainMult: traumaStam,
      });
      qualityNote = `${quality} parry`;
    }
    const b = defender.unit.combatStats.base;
    b.staminaCurrent = Math.max(
      0,
      roundToThousandths(b.staminaCurrent - cost)
    );
    const defAgg = applyLodgedActionAggravation(defender, qualityNote);
    // Attacker also completed the swing attempt.
    const atkAgg = applyLodgedActionAggravation(attacker, 'attack');
    setLeft(defAgg.fighter);
    setRight(atkAgg.fighter);
    pushLog([
      pendingPlayerDefense.tag,
      `${defender.unit.name} ${qualityNote}. Stamina −${cost} → ${b.staminaCurrent}.`,
      ...defAgg.log,
      ...atkAgg.log,
    ]);
    clearPlayerDefense();
  };

  const clearPlayerBlock = () => {
    setPendingPlayerBlock(null);
  };

  const landPlayerHitAfterDefense = (
    blockOutcome: 'force' | 'skip',
    meta: {
      critMultiplier: number;
      tag: string;
      aim: AttackTargetKey;
      attackMode: AttackMode;
      preface?: string[];
      /** Crit-band → redirect; hit-band → flat. */
      blockStyle?: 'flat' | 'redirect';
    }
  ) => {
    if (!left || !right) return;
    const result = resolveBasicAttack(right, left, meta.aim, {
      critMultiplier: meta.critMultiplier,
      attackMode: meta.attackMode,
      blockOutcome,
      blockStyle: meta.blockStyle,
    });
    setRight(result.attacker);
    setLeft(result.defender);
    pushLog([meta.tag, ...(meta.preface ?? []), ...result.log]);
  };

  /**
   * Dodge/parry mistimed or cancelled. If the player has a shield, open the
   * block QTE; otherwise resolve the connecting hit (after attacker miss roll).
   */
  const applyPlayerDefenseFail = (
    priorAttempt: BlockPriorAttempt = 'none',
    source: 'fail' | 'cancel' = 'fail'
  ) => {
    if (!pendingPlayerDefense || !left || !right) return;
    const { critMultiplier, tag, aim: defAim, attackMode: mode } =
      pendingPlayerDefense;
    const failVerb =
      source === 'cancel' ? 'cancels dodge/parry' : 'mistimes defense';

    // After failed dodge/parry: attacker-only miss roll (competence → 4–33%).
    const weaponType = fighterWeaponType(right);
    const miss = rollAttackerMiss(right.unit, weaponType, Math.random, right.itemsById);
    if (miss.missed) {
      const detail = `${left.unit.name} ${failVerb}, but ${right.unit.name} misses (p=${miss.chance.toFixed(2)}, roll=${miss.roll.toFixed(2)}, competence ${miss.competence.toFixed(2)}).`;
      clearPlayerDefense();
      applyMissedAttack('rightToLeft', { tag, detail });
      return;
    }

    if (canBlockWith(left.unit, left.itemsById)) {
      const built = scaleBlockRhythmWindow({
        defender: left.unit,
        itemsById: left.itemsById,
        attacker: right.unit,
        attackerItemsById: right.itemsById,
        priorAttempt,
        aim: defAim,
      });
      clearPlayerDefense();
      setPendingPlayerBlock({
        direction: 'rightToLeft',
        critMultiplier,
        aim: defAim,
        tag,
        attackMode: mode,
        blockWindow: built.window,
        adjustedChance: built.adjustedChance,
        baseChance: built.baseChance,
        blockValue: built.blockValue,
        priorAttempt,
      });
      const attemptNote =
        source === 'cancel'
          ? 'after cancel'
          : priorAttempt === 'none'
            ? 'no dodge/parry press'
            : priorAttempt === 'dodge'
              ? 'after mistimed dodge'
              : built.shieldTypeId === 'buckler'
                ? 'after mistimed parry (buckler: no attempt tax)'
                : 'after mistimed parry';
      const legsNote =
        defAim === 'legLeft' || defAim === 'legRight' ? ' · legs aim tax' : '';
      const stanceNote = ` · ${built.matchup.strike} vs ${built.matchup.cover} (block stance ×${built.stanceBandMult.toFixed(2)})`;
      pushLog([
        tag,
        `${left.unit.name} ${failVerb} — raise shield (${attemptNote}${legsNote}${stanceNote}). Block window from p=${built.adjustedChance.toFixed(2)} (base ${built.baseChance.toFixed(2)}, absorb ${built.blockValue.toFixed(2)}, ${built.window.durationMs} ms).`,
      ]);
      return;
    }

    landPlayerHitAfterDefense('skip', {
      critMultiplier,
      tag,
      aim: defAim,
      attackMode: mode,
      preface: [
        `${left.unit.name} ${failVerb} — hit lands (attacker miss p=${miss.chance.toFixed(2)}, roll=${miss.roll.toFixed(2)}).`,
      ],
    });
    clearPlayerDefense();
  };

  const applyPlayerBlockSuccess = (grade: RhythmGrade) => {
    if (!pendingPlayerBlock || !left || !right) return;
    const { critMultiplier, tag, aim: defAim, attackMode: mode, adjustedChance } =
      pendingPlayerBlock;
    const blockStyle = grade === 'crit' ? 'redirect' : 'flat';
    const quality = blockStyle === 'redirect' ? 'redirecting' : 'flat';
    clearPlayerBlock();
    landPlayerHitAfterDefense('force', {
      critMultiplier,
      tag,
      aim: defAim,
      attackMode: mode,
      blockStyle,
      preface: [
        `${left.unit.name} ${quality} blocks (QTE · window p=${adjustedChance.toFixed(2)}).`,
      ],
    });
  };

  const applyPlayerBlockFail = () => {
    if (!pendingPlayerBlock || !left || !right) return;
    const { critMultiplier, tag, aim: defAim, attackMode: mode, adjustedChance } =
      pendingPlayerBlock;
    clearPlayerBlock();
    landPlayerHitAfterDefense('skip', {
      critMultiplier,
      tag,
      aim: defAim,
      attackMode: mode,
      preface: [
        `${left.unit.name} mistimes the shield (window p=${adjustedChance.toFixed(2)}) — blow gets through.`,
      ],
    });
  };

  const onDefenseRhythmResult = (
    grade: RhythmGrade,
    detail: { verb?: DefenseVerb }
  ) => {
    if (grade === 'miss' || !detail.verb || detail.verb === 'block') {
      const prior: BlockPriorAttempt =
        detail.verb === 'dodge' || detail.verb === 'parry'
          ? detail.verb
          : 'none';
      applyPlayerDefenseFail(prior);
      return;
    }
    applyPlayerDefenseSuccess(detail.verb, grade);
  };

  const onBlockRhythmResult = (grade: RhythmGrade) => {
    if (grade === 'miss') {
      applyPlayerBlockFail();
      return;
    }
    applyPlayerBlockSuccess(grade);
  };

  const applyMissedAttack = (
    direction: AttackDirection,
    opts?: { tag?: string; detail?: string }
  ) => {
    if (!left || !right) return;
    const attackerIn = direction === 'leftToRight' ? left : right;
    const attacker = {
      unit: structuredClone(attackerIn.unit),
      itemsById: structuredClone(attackerIn.itemsById),
    };
    const mainId = attacker.unit.equipment.mainhand;
    const offId = attacker.unit.equipment.offhand;
    const mainhand = mainId ? attacker.itemsById[mainId] ?? null : null;
    const offhand = offId ? attacker.itemsById[offId] ?? null : null;
    const offhandIsShield = offhand?.itemType === 'shield';
    const offTemplate = offhand ? getItemTemplate(offhand.templateId) : null;
    const offhandWeight =
      offhand && offTemplate ? calcItemWeight(offTemplate) : 0;
    const twoHanding =
      !!(
        mainhand &&
        getItemTemplate(mainhand.templateId)?.flags?.twoHandOptional
      ) &&
      !offhandIsShield &&
      offhandWeight <= 0;
    const fullSwing = calcAttackerSwingStamina({
      attacker: attacker.unit,
      mainhand,
      offhandWeight,
      twoHanding,
    });
    const loss = roundToThousandths(
      fullSwing * COMBAT_TUNING.rhythm.missStaminaFraction
    );
    attacker.unit.combatStats.base.staminaCurrent = Math.max(
      0,
      roundToThousandths(attacker.unit.combatStats.base.staminaCurrent - loss)
    );
    const atkAgg = applyLodgedActionAggravation(attacker, 'missed swing');
    if (direction === 'leftToRight') setLeft(atkAgg.fighter);
    else setRight(atkAgg.fighter);
    pushLog([
      opts?.tag ?? '[rhythm:miss]',
      opts?.detail ??
        `${attacker.unit.name} mistimes the strike (${aim} aim) — miss. Swing stamina −${loss} → ${attacker.unit.combatStats.base.staminaCurrent}.`,
      ...(opts?.detail
        ? [
            `${attacker.unit.name} swing stamina −${loss} → ${attacker.unit.combatStats.base.staminaCurrent}.`,
          ]
        : []),
      ...atkAgg.log,
    ]);
  };

  const fireRangedShot = (direction: AttackDirection) => {
    if (!left || !right) return;
    const attacker = direction === 'leftToRight' ? left : right;
    const defender = direction === 'leftToRight' ? right : left;
    const result = resolveRangedAttack(attacker, defender, {
      distanceBand: engagementBand,
      arrowTemplateId,
      aim,
    });
    const atkAgg = applyLodgedActionAggravation(result.attacker, 'loose');
    if (direction === 'leftToRight') {
      setLeft(atkAgg.fighter);
      if (result.kind === 'hit') setRight(result.defender);
    } else {
      setRight(atkAgg.fighter);
      if (result.kind === 'hit') setLeft(result.defender);
    }
    pushLog([`[ranged:${result.kind}]`, ...result.log, ...atkAgg.log]);
  };

  const runAttack = (direction: AttackDirection) => {
    if (!left || !right) {
      pushLog('Cannot attack — pick two valid fighters.');
      return;
    }
    if (pendingRhythm || pendingPlayerDefense || pendingPlayerBlock) return;
    setAttackDir(direction);
    const attacker = direction === 'leftToRight' ? left : right;
    if (attacker.unit.combatStats.incapacitated) {
      pushLog(
        `${attacker.unit.name} is incapacitated and cannot attack.`
      );
      return;
    }
    const mainId = attacker.unit.equipment.mainhand;
    const mainhand = mainId ? attacker.itemsById[mainId] : null;
    const rangedBow = isBowItem(mainhand);

    if (engagementBand > 1 && !rangedBow) {
      pushLog(
        `Out of melee reach at band ${engagementBand} — close to band 1 or use a bow.`
      );
      return;
    }

    if (rangedBow) {
      // First cut: accuracy RNG (no attack QTE for bows yet).
      fireRangedShot(direction);
      return;
    }

    if (!useRhythm) {
      applyConnectedAttack(direction, 'bypass');
      return;
    }
    const atkSnap = direction === 'leftToRight' ? leftSnap : rightSnap;
    const defSnap = direction === 'leftToRight' ? rightSnap : leftSnap;
    setPendingRhythm({
      direction,
      rhythmWindow: buildRhythmWindow(atkSnap, defSnap),
    });
  };

  const onRhythmResult = (
    grade: RhythmGrade,
    detail?: { scale?: number; zone?: AttackTimingZone }
  ) => {
    if (!pendingRhythm || !left || !right) return;
    const { direction } = pendingRhythm;
    setPendingRhythm(null);

    // Player→NPC: QTE already zoned (flash shows NPC DODGE / PARRY / HIT / CRIT).
    if (direction === 'leftToRight' && detail?.zone) {
      const chances = calcDefenseChancesVsAttacker(right, left);
      const zone = detail.zone;
      if (zone === 'miss') {
        applyMissedAttack(direction);
        return;
      }
      if (zone === 'dodge' || zone === 'parry') {
        const defense = applyNpcDefenseOutcome(
          left,
          right,
          zone,
          chances
        );
        const defAgg = applyLodgedActionAggravation(defense.defender, zone);
        const atkAgg = applyLodgedActionAggravation(left, 'attack');
        setRight(defAgg.fighter);
        setLeft(atkAgg.fighter);
        pushLog([`[rhythm:${zone}]`, ...defense.log, ...defAgg.log, ...atkAgg.log]);
        return;
      }
      applyConnectedAttack(direction, zone, { skipNpcDefense: true });
      return;
    }

    if (grade === 'miss') {
      applyMissedAttack(direction);
      return;
    }
    applyConnectedAttack(direction, grade);
  };

  const swapSides = () => {
    setLeftId(rightId);
    setRightId(leftId);
    pushLog('Swapped fighter sides (fresh clones).');
  };

  const resetPair = () => {
    setLeftId(DEFAULT_LEFT);
    setRightId(DEFAULT_RIGHT);
    setLeft(cloneFighter(DEFAULT_LEFT));
    setRight(cloneFighter(DEFAULT_RIGHT));
    setLeftPressureHold(false);
    setRightPressureHold(false);
    pushLog('Reset to Amberyl vs Sain (fresh gear, health, preferred stances).');
  };

  const patchStance = (side: 'left' | 'right', patch: Partial<CombatStance>) => {
    const setter = side === 'left' ? setLeft : setRight;
    setter((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unit: {
          ...prev.unit,
          combatStats: {
            ...prev.unit.combatStats,
            currentStance: { ...prev.unit.combatStats.currentStance, ...patch },
          },
        },
      };
    });
  };

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate('/')} style={navBtn}>
          ← Title
        </button>
        <button type="button" onClick={() => navigate('/characters')} style={navBtn}>
          Character List
        </button>
        <button
          type="button"
          onClick={() => navigate('/characters/detailed/unit_amberyl')}
          style={navBtn}
        >
          Character Detail
        </button>
      </div>

      <header style={{ marginBottom: 24, textAlign: 'center' }}>
        <p style={{ margin: '0 0 6px', opacity: 0.55, fontSize: 12, letterSpacing: 1 }}>
          COMBAT LAB
        </p>
        <h1 style={{ margin: '0 0 8px', fontSize: '2rem' }}>
          <button
            type="button"
            onClick={() => navigate('/playground')}
            title="…"
            style={{
              all: 'unset',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              letterSpacing: 'inherit',
              color: 'inherit',
            }}
          >
            Battleground
          </button>
        </h1>
        <p
          style={{
            margin: 0,
            opacity: 0.75,
            maxWidth: 640,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Click the defender silhouette to pick an aim zone (8 regions). Optional attack-rhythm
          QTE (Legend of Dragoon–style square) gates the hit; toggle it off for instant 100% hits.
          Player→NPC: NPC dodge/parry carve attack QTE band edges. NPC→Player: dodge/parry QTE, then shield-block QTE if equipped.
        </p>
      </header>

      {pendingRhythm ? (
        <AttackRhythmQte
          rhythmWindow={pendingRhythm.rhythmWindow}
          accent={pendingRhythm.direction === 'leftToRight' ? '#fca5a5' : '#7dd3fc'}
          freezeRotation={freezeQteSpin}
          splash={{
            sex:
              (pendingRhythm.direction === 'leftToRight'
                ? rightSnap?.unit.sex
                : leftSnap?.unit.sex) ?? 'M',
            aim,
          }}
          hint={
            pendingRhythm.direction === 'leftToRight'
              ? 'Time the strike — hit-band edges can be NPC dodge/parry'
              : 'Time the strike on the aimed zone'
          }
          npcDefenseZones={
            pendingRhythm.direction === 'leftToRight' && right && left
              ? (() => {
                  const c = calcDefenseChancesVsAttacker(right, left);
                  return { dodge: c.dodge, parry: c.parry };
                })()
              : undefined
          }
          onResult={(grade, detail) => onRhythmResult(grade, detail)}
          onCancel={() => {
            pushLog('[rhythm:cancel] Attack timing cancelled.');
            setPendingRhythm(null);
          }}
        />
      ) : null}

      {pendingPlayerDefense && left ? (
        <AttackRhythmQte
          rhythmWindow={pendingPlayerDefense.dodgeWindow}
          accent="#86efac"
          ariaLabel="Defense timing"
          hint="LMB / Space = dodge · RMB / P = parry — time the overlap"
          resultHoldMs={1100}
          freezeRotation={freezeQteSpin}
          splash={{
            sex: left.unit.sex,
            aim: pendingPlayerDefense.aim,
          }}
          defenseInput={{
            canParry: pendingPlayerDefense.canParry,
            dodgeWindow: pendingPlayerDefense.dodgeWindow,
            parryWindow: pendingPlayerDefense.parryWindow,
          }}
          onResult={(grade, detail) => onDefenseRhythmResult(grade, detail)}
          onCancel={() => {
            // Cancel skips dodge/parry with no attempt tax; shielded PCs still get block QTE.
            applyPlayerDefenseFail('none', 'cancel');
          }}
        />
      ) : null}

      {pendingPlayerBlock && left ? (
        <AttackRhythmQte
          rhythmWindow={pendingPlayerBlock.blockWindow}
          accent="#fbbf24"
          ariaLabel="Shield block timing"
          hint={`Raise the shield — window p=${(pendingPlayerBlock.adjustedChance * 100).toFixed(0)}% · absorb ${pendingPlayerBlock.blockValue.toFixed(1)}`}
          resultHoldMs={1100}
          blockMode
          freezeRotation={freezeQteSpin}
          splash={{
            sex: left.unit.sex,
            aim: pendingPlayerBlock.aim,
          }}
          onResult={(grade) => onBlockRhythmResult(grade)}
          onCancel={() => {
            pushLog('Block cancelled — blow gets through.');
            applyPlayerBlockFail();
          }}
        />
      ) : null}

      <div
        className="bg-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 20,
          alignItems: 'start',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <FighterCard
          snapshot={leftSnap}
          side="left"
          selectedId={leftId}
          onSelect={setLeftId}
          onStanceChange={(patch) => patchStance('left', patch)}
          onDiscardRuined={(slot) => discardRuinedOnSide('left', slot)}
          defenseChances={leftDefense}
          onToggleBandage={(part) => toggleBandageOnSide('left', part)}
          onToggleVulnerary={(part) => toggleVulneraryOnSide('left', part)}
          onExtractArrow={(part) => extractArrowOnSide('left', part)}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            paddingTop: 12,
            minWidth: 280,
            maxWidth: 340,
          }}
        >
          {(() => {
            const atkSnap = attackDir === 'leftToRight' ? leftSnap : rightSnap;
            const defSnapLocal = attackDir === 'leftToRight' ? rightSnap : leftSnap;
            if (!atkSnap || !defSnapLocal) return null;
            const atkWeapon = resolveAttackerWeaponType(atkSnap);
            const defWeapon = resolveAttackerWeaponType(defSnapLocal);
            return (
              <CombatPosePair
                attacker={{
                  name: atkSnap.unit.name,
                  sex: atkSnap.unit.sex,
                  weaponType: atkWeapon,
                  strike: atkSnap.unit.combatStats.currentStance.strike,
                  cover: atkSnap.unit.combatStats.currentStance.cover,
                }}
                defender={{
                  name: defSnapLocal.unit.name,
                  sex: defSnapLocal.unit.sex,
                  weaponType: defWeapon,
                  strike: defSnapLocal.unit.combatStats.currentStance.strike,
                  cover: defSnapLocal.unit.combatStats.currentStance.cover,
                }}
                attackerAccent={
                  attackDir === 'leftToRight' ? '#7dd3fc' : '#fca5a5'
                }
                defenderAccent={
                  attackDir === 'leftToRight' ? '#fca5a5' : '#7dd3fc'
                }
              />
            );
          })()}

          <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: 2, opacity: 0.85 }}>
            VS
          </div>

          <div
            style={{
              display: 'flex',
              gap: 6,
              width: '100%',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setAttackDir('leftToRight')}
              style={{
                ...simBtn,
                flex: 1,
                opacity: attackDir === 'leftToRight' ? 1 : 0.55,
                borderColor: attackDir === 'leftToRight' ? '#fca5a588' : undefined,
                boxShadow:
                  attackDir === 'leftToRight' ? '0 0 0 1px #fca5a544' : undefined,
              }}
            >
              Aim B
            </button>
            <button
              type="button"
              onClick={() => setAttackDir('rightToLeft')}
              style={{
                ...simBtn,
                flex: 1,
                opacity: attackDir === 'rightToLeft' ? 1 : 0.55,
                borderColor: attackDir === 'rightToLeft' ? '#7dd3fc88' : undefined,
                boxShadow:
                  attackDir === 'rightToLeft' ? '0 0 0 1px #7dd3fc44' : undefined,
              }}
            >
              Aim A
            </button>
          </div>

          <AimTargetPanel
            sex={defenderSex}
            aim={aim}
            onAimChange={setAim}
            title={defenderLabel}
            accent={aimAccent}
          />

          <div style={{ fontSize: 11, opacity: 0.55, textAlign: 'center' }}>
            Selected zone: {AIM_ZONE_LABELS[aim]}
          </div>

          <MatchupPreview
            attacker={attackDir === 'leftToRight' ? leftSnap : rightSnap}
            defender={defenderSnap}
            aim={aim}
            label={attackDir === 'leftToRight' ? 'Player → NPC' : 'NPC → Player'}
          />

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              opacity: 0.9,
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: useRhythm
                ? '1px solid rgba(251, 191, 36, 0.45)'
                : '1px solid rgba(255,255,255,0.12)',
              background: useRhythm ? 'rgba(251, 191, 36, 0.08)' : 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <input
              type="checkbox"
              checked={useRhythm}
              onChange={(e) => setUseRhythm(e.target.checked)}
              style={{ margin: 0, cursor: 'pointer' }}
            />
            <span>
              Use attack rhythm
              <span style={{ display: 'block', opacity: 0.6, fontSize: 10, marginTop: 2 }}>
                {useRhythm
                  ? 'ON — shrinking square QTE (miss / hit / crit)'
                  : 'OFF — bypass with 100% hit (lab default)'}
              </span>
            </span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              opacity: 0.9,
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: freezeQteSpin
                ? '1px solid rgba(125, 211, 252, 0.45)'
                : '1px solid rgba(255,255,255,0.12)',
              background: freezeQteSpin
                ? 'rgba(125, 211, 252, 0.08)'
                : 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <input
              type="checkbox"
              checked={freezeQteSpin}
              onChange={(e) => setFreezeQteSpin(e.target.checked)}
              style={{ margin: 0, cursor: 'pointer' }}
            />
            <span>
              Freeze QTE spin
              <span style={{ display: 'block', opacity: 0.6, fontSize: 10, marginTop: 2 }}>
                {freezeQteSpin
                  ? 'ON — outer square stays axis-aligned (easier eclipse read)'
                  : 'OFF — outer square rotates while collapsing'}
              </span>
            </span>
          </label>

          <div
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: activeIsBow
                ? '1px solid rgba(52, 211, 153, 0.45)'
                : '1px solid rgba(255,255,255,0.12)',
              background: activeIsBow
                ? 'rgba(16, 185, 129, 0.08)'
                : 'rgba(255,255,255,0.03)',
              boxSizing: 'border-box',
              fontSize: 12,
            }}
          >
            <div style={{ opacity: 0.7, marginBottom: 6 }}>
              Engagement band {engagementBand}
              <span style={{ opacity: 0.55 }}>
                {' '}
                · ~{bandToMeters(engagementBand)} m
                {engagementBand === 1 ? ' · melee ok' : ' · bow only'}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={engagementBand}
              onChange={(e) => setEngagementBand(Number(e.target.value))}
              style={{ width: '100%', margin: '0 0 6px' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                opacity: 0.55,
                marginBottom: activeIsBow ? 8 : 0,
              }}
            >
              {[1, 2, 3, 4, 5].map((b) => (
                <span
                  key={b}
                  style={{
                    color:
                      engagementBand === b ? '#6ee7b7' : undefined,
                    fontWeight: engagementBand === b ? 600 : undefined,
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
            {activeIsBow && activeDraw ? (
              <div style={{ fontSize: 11, lineHeight: 1.45 }}>
                <div>
                  Draw {(activeDraw.drawFrac * 100).toFixed(0)}% · STR{' '}
                  {activeAttacker?.unit.combatStats.base.strength} / opt{' '}
                  {activeDraw.optimalDrawStr} · rated {activeDraw.drawWeightRated}
                </div>
                <div style={{ opacity: 0.8 }}>
                  Max reach band {activeDraw.maxEngageBand} / bow{' '}
                  {activeDraw.bowMaxBand}
                  {engagementBand > activeDraw.maxEngageBand ? (
                    <span style={{ color: '#fca5a5' }}> — out of draw reach</span>
                  ) : null}
                </div>
                {activeAccuracyPreview != null ? (
                  <div style={{ opacity: 0.75 }}>
                    Acc preview {(activeAccuracyPreview * 100).toFixed(0)}% ·{' '}
                    {AIM_ZONE_LABELS[aim]} @ band {engagementBand}
                    {activeAimPrecision < 1 ? (
                      <span style={{ color: '#fcd34d' }}>
                        {' '}
                        · aim tax ×{activeAimPrecision.toFixed(2)}
                      </span>
                    ) : null}
                    {activeChestFringe != null ? (
                      <span style={{ opacity: 0.7 }}>
                        {' '}
                        · splash {(activeChestFringe * 100).toFixed(0)}%
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div style={{ marginTop: 8, opacity: 0.65, marginBottom: 4 }}>
                  Arrow
                </div>
                {activeArrows.length === 0 ? (
                  <div style={{ color: '#fca5a5' }}>No arrows in owned bank</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {activeArrows.map((a) => (
                      <button
                        key={a.templateId}
                        type="button"
                        onClick={() => setArrowTemplateId(a.templateId)}
                        style={{
                          ...simBtn,
                          padding: '4px 10px',
                          fontSize: 11,
                          background:
                            arrowTemplateId === a.templateId
                              ? 'rgba(52, 211, 153, 0.3)'
                              : 'rgba(255,255,255,0.06)',
                          borderColor:
                            arrowTemplateId === a.templateId
                              ? 'rgba(110, 231, 183, 0.7)'
                              : 'rgba(255,255,255,0.15)',
                        }}
                        title={formatArrowComposition({
                          shaftGrade: a.sample.shaftGrade,
                          arrowHeadStyle: a.sample.arrowHeadStyle,
                          material: a.sample.material,
                        })}
                      >
                        {a.name} ×{a.count}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : engagementBand > 1 ? (
              <div style={{ fontSize: 11, color: '#fcd34d', marginTop: 4 }}>
                Melee cannot reach past band 1 — equip a bow or close distance.
              </div>
            ) : null}
          </div>

          <div
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.03)',
              boxSizing: 'border-box',
              fontSize: 12,
            }}
          >
            <div style={{ opacity: 0.65, marginBottom: 6 }}>
              Attack mode · {activeWeaponType}
            </div>
            {availableAttackModes.length > 1 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {availableAttackModes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAttackMode(m)}
                    style={{
                      ...simBtn,
                      padding: '4px 10px',
                      fontSize: 12,
                      background:
                        attackMode === m
                          ? 'rgba(167,139,250,0.35)'
                          : 'rgba(255,255,255,0.06)',
                      borderColor:
                        attackMode === m
                          ? 'rgba(196,181,253,0.7)'
                          : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    {ATTACK_MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ color: '#c4b5fd' }}>
                {ATTACK_MODE_LABELS[availableAttackModes[0] ?? attackMode]}
                <span style={{ opacity: 0.55 }}> (only)</span>
              </div>
            )}
          </div>

          <button
            type="button"
            style={{
              ...simBtn,
              width: '100%',
              background:
                attackDir === 'leftToRight'
                  ? 'linear-gradient(180deg, #3f1d24 0%, #2a1218 100%)'
                  : 'linear-gradient(180deg, #1d2a3f 0%, #121a2a 100%)',
            }}
            onClick={() => runAttack(attackDir)}
            disabled={
              !!pendingRhythm || !!pendingPlayerDefense || !!pendingPlayerBlock
            }
          >
            {attackDir === 'leftToRight'
              ? 'Player → NPC Attack'
              : 'NPC → Player Attack'}
            {activeIsBow
              ? ` · LOOSE band ${engagementBand}`
              : `${useRhythm ? ' (QTE)' : ''} · ${ATTACK_MODE_LABELS[attackMode]}`}
          </button>
          <button
            type="button"
            style={{ ...simBtn, width: '100%', opacity: 0.75 }}
            onClick={() =>
              runAttack(attackDir === 'leftToRight' ? 'rightToLeft' : 'leftToRight')
            }
            disabled={
              !!pendingRhythm || !!pendingPlayerDefense || !!pendingPlayerBlock
            }
          >
            {attackDir === 'leftToRight'
              ? 'NPC → Player Attack'
              : 'Player → NPC Attack'}
            {useRhythm && !activeIsBow ? ' (QTE)' : ''}
          </button>
          <button
            type="button"
            style={{
              ...simBtn,
              background: leftPressureHold
                ? 'rgba(248,113,113,0.25)'
                : undefined,
              borderColor: leftPressureHold
                ? 'rgba(252,165,165,0.6)'
                : undefined,
            }}
            disabled={
              !left ||
              (!leftPressureHold &&
                !hasFreeHandForPressure(left.unit, left.itemsById))
            }
            title={
              left && !hasFreeHandForPressure(left.unit, left.itemsById)
                ? 'Needs a free hand (empty offhand, not two-handing)'
                : 'Hold pressure on worst active bleed'
            }
            onClick={() => {
              if (!left) return;
              const nextHold = !leftPressureHold;
              const unit = structuredClone(left.unit) as DetailedUnit;
              const sync = syncDirectPressureHold(
                unit,
                left.itemsById,
                nextHold
              );
              if (!sync.ok && nextHold) {
                pushLog(sync.message);
                setLeftPressureHold(false);
                return;
              }
              setLeftPressureHold(nextHold);
              setLeft({ unit, itemsById: left.itemsById });
              pushLog(
                sync.part
                  ? `${unit.name} presses on ${formatBodyPartLabel(sync.part)}.`
                  : sync.message
              );
            }}
          >
            {leftPressureHold
              ? 'Player: release pressure'
              : 'Player: direct pressure'}
          </button>
          <button
            type="button"
            style={{
              ...simBtn,
              background: rightPressureHold
                ? 'rgba(248,113,113,0.25)'
                : undefined,
              borderColor: rightPressureHold
                ? 'rgba(252,165,165,0.6)'
                : undefined,
            }}
            disabled={
              !right ||
              (!rightPressureHold &&
                !hasFreeHandForPressure(right.unit, right.itemsById))
            }
            title={
              right && !hasFreeHandForPressure(right.unit, right.itemsById)
                ? 'Needs a free hand (empty offhand, not two-handing)'
                : 'Hold pressure on worst active bleed'
            }
            onClick={() => {
              if (!right) return;
              const nextHold = !rightPressureHold;
              const unit = structuredClone(right.unit) as DetailedUnit;
              const sync = syncDirectPressureHold(
                unit,
                right.itemsById,
                nextHold
              );
              if (!sync.ok && nextHold) {
                pushLog(sync.message);
                setRightPressureHold(false);
                return;
              }
              setRightPressureHold(nextHold);
              setRight({ unit, itemsById: right.itemsById });
              pushLog(
                sync.part
                  ? `${unit.name} presses on ${formatBodyPartLabel(sync.part)}.`
                  : sync.message
              );
            }}
          >
            {rightPressureHold
              ? 'NPC: release pressure'
              : 'NPC: direct pressure'}
          </button>
          <button
            type="button"
            style={simBtn}
            onClick={() => {
              if (!left || !right) return;
              let leftF = left;
              let rightF = right;
              if (leftPressureHold) {
                const unit = structuredClone(left.unit) as DetailedUnit;
                syncDirectPressureHold(unit, left.itemsById, true);
                leftF = { unit, itemsById: left.itemsById };
              }
              if (rightPressureHold) {
                const unit = structuredClone(right.unit) as DetailedUnit;
                syncDirectPressureHold(unit, right.itemsById, true);
                rightF = { unit, itemsById: right.itemsById };
              }
              const a = tickBleed(leftF, 1);
              const b = tickBleed(rightF, 1);
              setLeft(a.fighter);
              setRight(b.fighter);
              pushLog([...a.log, ...b.log]);
            }}
          >
            Pass 1 min (bleed/heal)
          </button>
          <button
            type="button"
            style={simBtn}
            onClick={() => {
              if (!left || !right) return;
              let leftF = left;
              let rightF = right;
              if (leftPressureHold) {
                const unit = structuredClone(left.unit) as DetailedUnit;
                syncDirectPressureHold(unit, left.itemsById, true);
                leftF = { unit, itemsById: left.itemsById };
              }
              if (rightPressureHold) {
                const unit = structuredClone(right.unit) as DetailedUnit;
                syncDirectPressureHold(unit, right.itemsById, true);
                rightF = { unit, itemsById: right.itemsById };
              }
              const a = tickBleed(leftF, 5);
              const b = tickBleed(rightF, 5);
              setLeft(a.fighter);
              setRight(b.fighter);
              pushLog([...a.log, ...b.log]);
            }}
          >
            Pass 5 min (bleed/heal)
          </button>
          <button type="button" style={simBtn} onClick={swapSides}>
            Swap sides
          </button>
          <button type="button" style={simBtn} onClick={resetPair}>
            Reset Lyn / Kent
          </button>
          <button
            type="button"
            style={simBtn}
            onClick={() => {
              if (!left) return;
              const itemsById = { ...left.itemsById };
              let n = 0;
              for (const [id, item] of Object.entries(itemsById)) {
                if (item.itemType !== 'armor') continue;
                itemsById[id] = { ...item, durability: 0 };
                n += 1;
              }
              setLeft({ unit: left.unit, itemsById });
              pushLog(
                `Lab: zeroed durability on ${n} armor piece(s) for ${left.unit.name}.`
              );
            }}
          >
            Lab: ruin armor (Player)
          </button>
        </div>

        <FighterCard
          snapshot={rightSnap}
          side="right"
          selectedId={rightId}
          onSelect={setRightId}
          onStanceChange={(patch) => patchStance('right', patch)}
          onDiscardRuined={(slot) => discardRuinedOnSide('right', slot)}
          defenseChances={rightDefense}
          onToggleBandage={(part) => toggleBandageOnSide('right', part)}
          onToggleVulnerary={(part) => toggleVulneraryOnSide('right', part)}
          onExtractArrow={(part) => extractArrowOnSide('right', part)}
        />
      </div>

      <style>{`
        @media (max-width: 900px) {
          .bg-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <section
        style={{
          maxWidth: 1200,
          margin: '28px auto 0',
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid #333',
          borderRadius: 10,
          padding: 14,
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Combat log</h3>
        <div
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            maxHeight: 240,
            overflowY: 'auto',
            opacity: 0.9,
            lineHeight: 1.55,
          }}
        >
          {log.map((line, i) => (
            <div key={`${i}-${line.slice(0, 28)}`}>{line}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

const navBtn: CSSProperties = {
  padding: '8px 14px',
  background: '#2a1a4a',
  color: '#fff',
  border: '1px solid #5b3d9a',
  borderRadius: 6,
  cursor: 'pointer',
};

const simBtn: CSSProperties = {
  padding: '10px 14px',
  width: '100%',
  background: '#3b1d6d',
  color: '#fff',
  border: '1px solid #7c3aed',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
};

export default Battleground;
