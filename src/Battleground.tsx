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
import {
  resolveBasicAttack,
  type FighterState,
} from './utils/combat/resolveBasicAttack';
import { tickBleed } from './utils/combat/tickBleed';
import { AimTargetPanel, AIM_ZONE_LABELS } from './components/AimTargetPanel';

const DEFAULT_LEFT = 'unit_lyn';
const DEFAULT_RIGHT = 'unit_kent';

type AttackDirection = 'leftToRight' | 'rightToLeft';

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
}: {
  snapshot: CombatantSnapshot | null;
  side: 'left' | 'right';
  selectedId: string;
  onSelect: (id: string) => void;
  onStanceChange: (patch: Partial<CombatStance>) => void;
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
  const blood = getBloodStatus(unit);
  const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
  const mobilityEffective = performance.mobility * bloodPen.mobility;
  const dodgeEffective = performance.dodge * bloodPen.dodge;

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
            Mobility {(mobilityEffective * 100).toFixed(0)}% · Dodge{' '}
            {(dodgeEffective * 100).toFixed(0)}%
            <span style={{ opacity: 0.55 }}> (parts × blood)</span>
          </div>
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
                    intensity {(p.bleedIntensity * 100).toFixed(0)}% · {p.criticality} · rate{' '}
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
            .map((e) => e.resolved.instance.name)
            .map((name) => (
              <div key={name} style={{ color: '#f9a8d4' }}>
                Ruined: {name}
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
  const weaponType =
    attacker.mainhand?.instance.weaponType ??
    (attacker.mainhand?.instance.itemType === 'weapon' ? 'dagger' : 'punch');
  const matchup = evaluateStanceMatchupFromSkills(
    strike,
    cover,
    attacker.unit.combatStats.stanceSkill,
    defender.unit.combatStats.stanceSkill,
    weaponType
  );
  const presented = summarizeRemappedAim(aim, cover, 4);
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
  /** Which side is currently being aimed at (drives silhouette sex + attack buttons). */
  const [attackDir, setAttackDir] = useState<AttackDirection>('leftToRight');
  const [log, setLog] = useState<string[]>([
    'Battleground ready. Click the defender silhouette to pick an aim zone. 100% hit still assumed; rhythm/parry deferred.',
  ]);

  useEffect(() => {
    setLeft(cloneFighter(leftId));
  }, [leftId]);

  useEffect(() => {
    setRight(cloneFighter(rightId));
  }, [rightId]);

  const leftSnap = useMemo(
    () => (left ? compileCombatant(left.unit, left.itemsById) : null),
    [left]
  );
  const rightSnap = useMemo(
    () => (right ? compileCombatant(right.unit, right.itemsById) : null),
    [right]
  );

  const pushLog = (lines: string | string[]) => {
    const batch = Array.isArray(lines) ? lines : [lines];
    const stamped = batch.map((line) => `[${new Date().toLocaleTimeString()}] ${line}`);
    setLog((prev) => [...stamped.reverse(), ...prev].slice(0, 80));
  };

  const defenderSnap = attackDir === 'leftToRight' ? rightSnap : leftSnap;
  const defenderLabel =
    attackDir === 'leftToRight'
      ? `Targeting ${rightSnap?.unit.name ?? 'Fighter B'} (B)`
      : `Targeting ${leftSnap?.unit.name ?? 'Fighter A'} (A)`;
  const defenderSex = defenderSnap?.unit.sex ?? 'M';
  const aimAccent = attackDir === 'leftToRight' ? '#fca5a5' : '#7dd3fc';

  const runAttack = (direction: AttackDirection) => {
    if (!left || !right) {
      pushLog('Cannot attack — pick two valid fighters.');
      return;
    }
    setAttackDir(direction);
    const attacker = direction === 'leftToRight' ? left : right;
    const defender = direction === 'leftToRight' ? right : left;
    const result = resolveBasicAttack(attacker, defender, aim);
    if (direction === 'leftToRight') {
      setLeft(result.attacker);
      setRight(result.defender);
    } else {
      setRight(result.attacker);
      setLeft(result.defender);
    }
    pushLog(result.log);
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
    pushLog('Reset to Lyn vs Kent (fresh gear, health, preferred stances).');
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
          onClick={() => navigate('/characters/detailed/unit_lyn')}
          style={navBtn}
        >
          Character Detail
        </button>
      </div>

      <header style={{ marginBottom: 24, textAlign: 'center' }}>
        <p style={{ margin: '0 0 6px', opacity: 0.55, fontSize: 12, letterSpacing: 1 }}>
          COMBAT LAB
        </p>
        <h1 style={{ margin: '0 0 8px', fontSize: '2rem' }}>Battleground</h1>
        <p
          style={{
            margin: 0,
            opacity: 0.75,
            maxWidth: 640,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Click the defender silhouette to pick an aim zone (8 regions). Aim A / Aim B switches
          whose body you target. Cover remaps presented parts; strike vs cover is previewed.
          Rhythm / parry / dodge still deferred.
        </p>
      </header>

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
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            paddingTop: 12,
            minWidth: 260,
          }}
        >
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
          >
            {attackDir === 'leftToRight' ? 'A → B Attack' : 'B → A Attack'}
          </button>
          <button
            type="button"
            style={{ ...simBtn, width: '100%', opacity: 0.75 }}
            onClick={() =>
              runAttack(attackDir === 'leftToRight' ? 'rightToLeft' : 'leftToRight')
            }
          >
            {attackDir === 'leftToRight' ? 'B → A Attack' : 'A → B Attack'}
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
            Pass 1 min (bleed)
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
            Pass 5 min (bleed)
          </button>
          <button type="button" style={simBtn} onClick={swapSides}>
            Swap sides
          </button>
          <button type="button" style={simBtn} onClick={resetPair}>
            Reset Lyn / Kent
          </button>
        </div>

        <FighterCard
          snapshot={rightSnap}
          side="right"
          selectedId={rightId}
          onSelect={setRightId}
          onStanceChange={(patch) => patchStance('right', patch)}
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
