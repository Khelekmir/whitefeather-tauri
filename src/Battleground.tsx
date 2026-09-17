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
import { calcTraumaPenalties } from './utils/combat/traumaFlags';
import {
  resolveBasicAttack,
  type FighterState,
} from './utils/combat/resolveBasicAttack';
import { tickBleed } from './utils/combat/tickBleed';
import {
  calcDefenseChancesVsAttacker,
  type DefenseChances,
} from './utils/combat/calcDefenseChances';
import { resolveNpcDefense } from './utils/combat/resolveNpcDefense';
import { AimTargetPanel, AIM_ZONE_LABELS } from './components/AimTargetPanel';
import { AttackRhythmQte } from './components/AttackRhythmQte';
import {
  canParryWith,
  scaleDefenseRhythmWindow,
  type DefenseVerb,
} from './utils/combat/defenseRhythm';
import {
  ATTACK_MODE_LABELS,
  clampAttackMode,
  weaponAttackModes,
  type AttackMode,
} from './utils/combat/damageTypes';
import { CombatPosePair } from './components/CombatPosePair';
import {
  bandDurationsMs,
  scaleRhythmWindow,
  scaleRhythmWindowFromCompetence,
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
  listCarePriorityParts,
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

/** Player (Fighter A) defense QTE — LMB dodge / RMB parry. */
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

function FighterCard({
  snapshot,
  side,
  selectedId,
  onSelect,
  onStanceChange,
  onDiscardRuined,
  defenseChances,
}: {
  snapshot: CombatantSnapshot | null;
  side: 'left' | 'right';
  selectedId: string;
  onSelect: (id: string) => void;
  onStanceChange: (patch: Partial<CombatStance>) => void;
  onDiscardRuined?: (slot: ItemSlot) => void;
  /** Live NPC dodge/parry % vs current opponent (stance-aware). */
  defenseChances?: DefenseChances | null;
}) {
  const cast = listDetailedCharacters();
  const accent = side === 'left' ? '#7dd3fc' : '#fca5a5';
  const label = side === 'left' ? 'Fighter A' : 'Fighter B';

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
  const bleed = summarizeBleed(unit.combatStats.itemizedHealth);
  const performance = calcPerformanceFromItemized(unit.combatStats.itemizedHealth);
  const mobilityIssues = mobilityProblemParts(unit.combatStats.itemizedHealth);
  const trauma = calcTraumaPenalties(unit.combatStats.itemizedHealth);
  const blood = getBloodStatus(unit);
  const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
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
        </p>
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
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
          <div>
            Blood vol. {blood.volumeLiters.toFixed(2)} L · remaining{' '}
            {(blood.remainingFraction * 100).toFixed(0)}% ({blood.lostLiters.toFixed(2)} L lost ·{' '}
            {blood.lossClass})
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
            <ul style={{ margin: '4px 0 0', paddingLeft: 16, opacity: 0.9 }}>
              {bleed.partsBleeding
                .filter((p) => p.rate > 0)
                .slice(0, 4)
                .map((p) => (
                  <li key={p.part}>
                    {formatBodyPartLabel(p.part)} · health {(p.health * 100).toFixed(0)}% · bleed
                    ext {(p.bleedIntensity * 100).toFixed(0)}%
                    {p.internalBleedIntensity > 0
                      ? ` · int ${(p.internalBleedIntensity * 100).toFixed(0)}%`
                      : ''}{' '}
                    · {p.criticality} · rate{' '}
                    {p.rate.toFixed(2)}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

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
  const presented = summarizeRemappedAim(aim, cover, 4);
  const competence = calcRhythmCompetence(attacker.unit, weaponType, strike);
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
  /** Which side is currently being aimed at (drives silhouette sex + attack buttons). */
  const [attackDir, setAttackDir] = useState<AttackDirection>('leftToRight');
  /** Lab toggle: off = instant 100% hit; on = LoD shrinking-square QTE. */
  const [useRhythm, setUseRhythm] = useState(false);
  const [pendingRhythm, setPendingRhythm] = useState<PendingRhythmAttack | null>(
    null
  );
  const [pendingPlayerDefense, setPendingPlayerDefense] =
    useState<PendingPlayerDefense | null>(null);
  const [log, setLog] = useState<string[]>([
    'Battleground ready. Fighter A = player (LMB dodge / RMB parry on defense QTE). B = NPC (%). Attack rhythm optional.',
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

  useEffect(() => {
    setAttackMode((prev) => clampAttackMode(activeWeaponType, prev));
  }, [activeWeaponType, attackDir, leftId, rightId]);

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

  const defenderSnap = attackDir === 'leftToRight' ? rightSnap : leftSnap;
  const defenderLabel =
    attackDir === 'leftToRight'
      ? `Targeting ${rightSnap?.unit.name ?? 'Fighter B'} (B)`
      : `Targeting ${leftSnap?.unit.name ?? 'Fighter A'} (A)`;
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
    const competence = calcRhythmCompetence(attackerSnap.unit, weaponType, strike);
    return scaleRhythmWindowFromCompetence(m.windowFactor, competence);
  };

  const applyConnectedAttack = (
    direction: AttackDirection,
    grade: RhythmGrade | 'bypass'
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

    // Player is Fighter A: B→A uses defense QTE (LMB dodge / RMB parry).
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
        `Incoming on Fighter A (${ATTACK_MODE_LABELS[mode]}) — LMB/Space dodge, RMB/P parry.`,
      ]);
      return;
    }

    // A→B: NPC chance defense before damage.
    const defense = resolveNpcDefense(attacker, defender);
    if (defense.outcome !== 'none') {
      setRight(defense.defender);
      pushLog([tag, ...defense.log]);
      return;
    }

    const result = resolveBasicAttack(attacker, defense.defender, aim, {
      critMultiplier,
      attackMode: mode,
    });
    setLeft(result.attacker);
    setRight(result.defender);
    pushLog([tag, ...defense.log, ...result.log]);
  };

  const clearPlayerDefense = () => {
    setPendingPlayerDefense(null);
  };

  const applyPlayerDefenseSuccess = (verb: DefenseVerb, grade: RhythmGrade) => {
    if (!pendingPlayerDefense || !left || !right) return;
    const defender = {
      unit: structuredClone(left.unit) as DetailedUnit,
      itemsById: structuredClone(left.itemsById),
    };
    const attacker = right;
    let cost = 0;
    let qualityNote = '';
    const traumaStam = calcTraumaPenalties(
      defender.unit.combatStats.itemizedHealth
    ).staminaDrainMult;
    if (verb === 'dodge') {
      const quality = grade === 'crit' ? 'precise' : 'sloppy';
      cost = calcDodgeStamina(quality, traumaStam);
      qualityNote = quality;
    } else {
      const quality = grade === 'crit' ? 'clean' : 'edge';
      cost = calcParryStamina({
        quality,
        attackerCon: attacker.unit.combatStats.base.constitution,
        defenderCon: defender.unit.combatStats.base.constitution,
        staminaDrainMult: traumaStam,
      });
      qualityNote = quality;
    }
    const b = defender.unit.combatStats.base;
    b.staminaCurrent = Math.max(
      0,
      roundToThousandths(b.staminaCurrent - cost)
    );
    setLeft(defender);
    pushLog([
      pendingPlayerDefense.tag,
      `${defender.unit.name} ${verb === 'dodge' ? 'dodges' : 'parries'} (${qualityNote}, QTE ${grade}). Stamina −${cost} → ${b.staminaCurrent}.`,
    ]);
    clearPlayerDefense();
  };

  const applyPlayerDefenseFail = () => {
    if (!pendingPlayerDefense || !left || !right) return;
    const { critMultiplier, tag, aim: defAim, attackMode: mode } =
      pendingPlayerDefense;
    const result = resolveBasicAttack(right, left, defAim, {
      critMultiplier,
      attackMode: mode,
    });
    setRight(result.attacker);
    setLeft(result.defender);
    pushLog([
      tag,
      `${left.unit.name} mistimes defense — hit lands.`,
      ...result.log,
    ]);
    clearPlayerDefense();
  };

  const onDefenseRhythmResult = (
    grade: RhythmGrade,
    detail: { verb?: DefenseVerb }
  ) => {
    if (grade === 'miss' || !detail.verb) {
      applyPlayerDefenseFail();
      return;
    }
    applyPlayerDefenseSuccess(detail.verb, grade);
  };

  const applyMissedAttack = (direction: AttackDirection) => {
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
    if (direction === 'leftToRight') setLeft(attacker);
    else setRight(attacker);
    pushLog([
      '[rhythm:miss]',
      `${attacker.unit.name} mistimes the strike (${aim} aim) — miss. Swing stamina −${loss} → ${attacker.unit.combatStats.base.staminaCurrent}.`,
    ]);
  };

  const runAttack = (direction: AttackDirection) => {
    if (!left || !right) {
      pushLog('Cannot attack — pick two valid fighters.');
      return;
    }
    if (pendingRhythm || pendingPlayerDefense) return;
    setAttackDir(direction);
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

  const onRhythmResult = (grade: RhythmGrade) => {
    if (!pendingRhythm) return;
    const { direction } = pendingRhythm;
    setPendingRhythm(null);
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
          A→B: NPC dodge/parry %. B→A: player defense QTE — LMB dodge / RMB parry.
        </p>
      </header>

      {pendingRhythm ? (
        <AttackRhythmQte
          rhythmWindow={pendingRhythm.rhythmWindow}
          accent={pendingRhythm.direction === 'leftToRight' ? '#fca5a5' : '#7dd3fc'}
          splash={{
            sex:
              (pendingRhythm.direction === 'leftToRight'
                ? rightSnap?.unit.sex
                : leftSnap?.unit.sex) ?? 'M',
            aim,
          }}
          hint="Time the strike on the aimed zone"
          onResult={(grade) => onRhythmResult(grade)}
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
            pushLog('Defense cancelled — taking the hit.');
            applyPlayerDefenseFail();
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
            label={attackDir === 'leftToRight' ? 'A → B' : 'B → A'}
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
            disabled={!!pendingRhythm || !!pendingPlayerDefense}
          >
            {attackDir === 'leftToRight' ? 'A → B Attack' : 'B → A Attack'}
            {useRhythm ? ' (QTE)' : ''} · {ATTACK_MODE_LABELS[attackMode]}
          </button>
          <button
            type="button"
            style={{ ...simBtn, width: '100%', opacity: 0.75 }}
            onClick={() =>
              runAttack(attackDir === 'leftToRight' ? 'rightToLeft' : 'leftToRight')
            }
            disabled={!!pendingRhythm || !!pendingPlayerDefense}
          >
            {attackDir === 'leftToRight' ? 'B → A Attack' : 'A → B Attack'}
            {useRhythm ? ' (QTE)' : ''}
          </button>
          <button
            type="button"
            style={simBtn}
            onClick={() => {
              if (!left || !right) return;
              const a = tickBleed(left, 1);
              const b = tickBleed(right, 1);
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
              const a = tickBleed(left, 5);
              const b = tickBleed(right, 5);
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
            Lab: ruin armor (A)
          </button>
          <button
            type="button"
            style={simBtn}
            onClick={() => {
              if (!left) return;
              const part =
                listCarePriorityParts(left.unit.combatStats.itemizedHealth, 1)[0] ??
                ('chestLeft' as BodyPartId);
              const unit = structuredClone(left.unit) as DetailedUnit;
              const itemsById = { ...left.itemsById };
              const had = !!findOwnedConsumable(itemsById, BANDAGE_TEMPLATE_ID);
              const r = useBandageOnPart(
                unit.combatStats.itemizedHealth,
                part,
                itemsById,
                { allowLabFree: true }
              );
              if (!r.ok) {
                pushLog(r.message);
                return;
              }
              setLeft({ unit, itemsById });
              pushLog(
                `${unit.name}: bandage → ${formatBodyPartLabel(part)}${
                  r.already ? ' (already dressed)' : ''
                }${r.labFree || !had ? ' · lab free' : ' · consumed'}.`
              );
            }}
          >
            Bandage A (priority)
          </button>
          <button
            type="button"
            style={simBtn}
            onClick={() => {
              if (!left) return;
              const part =
                listCarePriorityParts(left.unit.combatStats.itemizedHealth, 1)[0] ??
                ('chestLeft' as BodyPartId);
              const unit = structuredClone(left.unit) as DetailedUnit;
              const itemsById = { ...left.itemsById };
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
              setLeft({ unit, itemsById });
              pushLog(
                `${unit.name}: vulnerary → ${formatBodyPartLabel(part)}${
                  r.already ? ' (already applied)' : ''
                }${r.labFree || !had ? ' · lab free' : ' · consumed'}.`
              );
            }}
          >
            Vulnerary A (priority)
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
