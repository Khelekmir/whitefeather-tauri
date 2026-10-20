import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDetailedCharacter,
  listDetailedCharacters,
} from './data/detailedPlaceholderCharacters';
import { getCombatCastInventory } from './data/starters/combatCastInventory';
import { buildCastRelationshipGraph } from './data/social/castRelationshipSeeds';
import { SOCIAL_TASK_TEMPLATES } from './data/social/socialLabScaffold';
import { useGameStore } from './store/gameStore';
import {
  WEATHER_SKIES,
  formatClockHour,
  formatWeatherSkyLabel,
  type WeatherSky,
} from './types/world';
import {
  advanceWeather,
  forceWeatherSky,
} from './utils/world/advanceWeather';
import {
  advanceBodyTemperature,
  describeBodyTempComfort,
  feltAmbientF,
  readBodyTemp,
} from './utils/world/advanceBodyTemperature';
import {
  advanceGarmentWetness,
  assessWornGarmentWetness,
  describeEnvWet,
  dryGarmentsByFire,
  evaporativeChillFromWorn,
  readEnvWet01,
} from './utils/world/advanceGarmentWetness';
import {
  advanceColdIllness,
  applyWarmCare,
  describeColdIllness,
  illnessCombatMult,
  readColdIllness,
} from './utils/world/advanceColdIllness';
import { assessWeatherExposure } from './utils/world/weatherExposure';
import {
  equipItem,
  unequipSlot,
  unequipSlots,
  UNDRESS_ORDER_BOTTOM,
  UNDRESS_ORDER_TORSO,
} from './utils/items/equipGear';
import {
  EQUIPMENT_SLOTS,
  formatEquipmentSlotLabel,
  type Item,
  type ItemSlot,
} from './types/items';
import { GARMENT_WET_SLOTS } from './data/world/garmentWetTuning';
import {
  LONG_TERM_RELATIONSHIP_AXES,
  SHORT_TERM_RELATIONSHIP_AXES,
  type LongTermRelationshipId,
  type ShortTermRelationshipId,
} from './data/social/relationships';
import {
  driftDurablePressures,
  hydrateDurablePressures,
  snapshotDurablePressures,
} from './utils/social/durablePressureState';
import { PRESSURE_DRIFT_TUNING } from './utils/social/pressureDriftTuning';
import { RELATIONSHIP_DRIFT_TUNING } from './utils/social/relationshipDriftTuning';
import {
  driftShortTermRelationships,
  ensureBidirectional,
  getEdge,
  nudgeLongTerm,
  nudgeShortTerm,
  sexualDesireAllowed,
  sexualDesireSoftCap,
  sexualPairingHardBlocked,
  setLongTerm,
  setShortTerm,
  type RelationshipGraph,
} from './utils/social/relationshipState';
import { resolveMood, resolveMoodAsBlend } from './utils/social/resolveMood';
import { describeCycleShift } from './utils/lewd/cycleShift';
import {
  advanceReproduction,
  describeReproduction,
} from './utils/lewd/conception';
import {
  advanceFluidSoil,
  deriveSoilCues,
} from './utils/lewd/fluidSoil';
import {
  equipStubPeriodCloth,
  periodClothBleedThroughReport,
  unequipPeriodCloth,
} from './utils/lewd/overworldDischarge';
import { resolveSocialTask } from './utils/social/resolveSocialTask';
import { advanceStandingLust, standingLustTarget } from './utils/lewd/lustDrive';
import {
  advanceFemalePhysiology,
  formatCycleLabel,
  hormonesForUnit,
  isInFertileWindow,
} from './utils/lewd/ovulationCycle';
import type { Unit as DetailedUnit } from './types/characters';
import {
  PERSONALIZED_PRESSURES,
  type PersonalizedPressureId,
} from './data/social/durablePressures';

const DEFAULT_PRIMARY = 'unit_amberyl';
const DEFAULT_PARTNER = 'unit_sain';

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '28px 32px 48px',
  fontFamily: 'system-ui, sans-serif',
  background: 'linear-gradient(180deg, #0a1218 0%, #0a1014 40%, #080c10 100%)',
  color: '#e8eef5',
  boxSizing: 'border-box',
};

const navBtn: CSSProperties = {
  padding: '8px 14px',
  background: '#1a2a3a',
  color: '#fff',
  border: '1px solid #3d5a73',
  borderRadius: 6,
  cursor: 'pointer',
};

const cardStyle: CSSProperties = {
  border: '1px solid rgba(125, 211, 252, 0.28)',
  borderRadius: 14,
  padding: 18,
  background: 'linear-gradient(180deg, rgba(20, 32, 44, 0.95) 0%, rgba(12, 18, 26, 0.98) 100%)',
  boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
};

const selectStyle: CSSProperties = {
  background: '#121820',
  color: '#e8eef5',
  border: '1px solid rgba(125, 211, 252, 0.4)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 14,
};

const smallBtn: CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid rgba(125, 211, 252, 0.35)',
  background: 'rgba(125, 211, 252, 0.1)',
  color: '#e8eef5',
  cursor: 'pointer',
};

function cloneWardrobe(id: string): {
  unit: DetailedUnit;
  itemsById: Record<string, Item>;
} | null {
  const base = getDetailedCharacter(id);
  if (!base) return null;
  const kit = getCombatCastInventory(id);
  const cloned = hydrateDurablePressures(structuredClone(base) as DetailedUnit);
  if (!cloned.lewdStats.dynamic.lust) {
    cloned.lewdStats.dynamic.lust = standingLustTarget(cloned);
  }
  const itemsById = structuredClone(kit?.items ?? {}) as Record<string, Item>;
  for (const item of Object.values(itemsById)) {
    item.equippedSlot = null;
  }
  for (const slot of EQUIPMENT_SLOTS) {
    const itemId = cloned.equipment[slot];
    if (itemId && itemsById[itemId]) itemsById[itemId].equippedSlot = slot;
  }
  return { unit: cloned, itemsById };
}

function StatBar({
  label,
  value,
  max = 100,
  color,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
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
          {value}/{max}
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

function Pill({ children }: { children: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.18)',
        background: 'rgba(255,255,255,0.04)',
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      {children}
    </span>
  );
}

function PersonalityPanel({ unit }: { unit: DetailedUnit }) {
  const s = unit.socialStats.static;
  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 10px', fontSize: '1.1rem', color: '#7dd3fc' }}>Personality</h2>
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>
        <div>
          <span style={{ opacity: 0.55 }}>Personality · </span>
          {s.personality}
        </div>
        <div>
          <span style={{ opacity: 0.55 }}>Temperament · </span>
          {s.temperament}
        </div>
        {s.note ? (
          <p style={{ margin: '10px 0 0', opacity: 0.8, fontSize: 12 }}>{s.note}</p>
        ) : (
          <p style={{ margin: '10px 0 0', opacity: 0.45, fontSize: 12 }}>
            No personality note on file.
          </p>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, opacity: 0.55 }}>
        Temperament sets default pressure baselines/rates; character pressureMods specialize them.
      </div>
    </section>
  );
}

function WeatherPanel({
  unit,
  itemsById,
  sheltered,
  onShelteredChange,
  onForceSky,
  onScrubHour,
  onWarmCare,
}: {
  unit: DetailedUnit;
  itemsById: Record<string, Item>;
  sheltered: boolean;
  onShelteredChange: (v: boolean) => void;
  onForceSky: (sky: WeatherSky) => void;
  onScrubHour: (hour: number) => void;
  onWarmCare: () => void;
}) {
  const weather = useGameStore((s) => s.gameState.worldWeather);
  const exposure = useMemo(
    () => assessWeatherExposure(unit, weather, { sheltered, itemsById }),
    [unit, weather, sheltered, itemsById]
  );
  const bodyTemp = useMemo(() => readBodyTemp(unit), [unit]);
  const comfort = useMemo(
    () => describeBodyTempComfort(bodyTemp),
    [bodyTemp]
  );
  const garment = useMemo(
    () => assessWornGarmentWetness(unit, exposure, itemsById),
    [unit, exposure, itemsById]
  );
  const evapChill = evaporativeChillFromWorn(garment.wornEnvWet01, {
    sheltered,
    wind01: weather.wind01,
  });
  const feltF = feltAmbientF(exposure) - evapChill;
  const coldIll = useMemo(() => readColdIllness(unit), [unit]);
  const coldDesc = useMemo(() => describeColdIllness(unit), [unit]);
  const combatIll = useMemo(() => illnessCombatMult(unit), [unit]);

  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#7dd3fc' }}>
        Weather & body temp
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.65, lineHeight: 1.45 }}>
        Climate (°F) soaks worn cloth and drifts core / skin on Pass Time. Cloak size
        sets rain wrap coverage; once the cloak is half-soaked, 15% bleeds through.
        Wet clothes evaporate (chill in cold, relief in heat).
      </p>
      <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 12 }}>
        Day <strong>{weather.dayIndex}</strong> · {formatClockHour(weather.hour)} (
        {weather.hour.toFixed(2)}h)
        <br />
        Sky <strong>{formatWeatherSkyLabel(weather.sky)}</strong> · ambient{' '}
        <strong>{weather.ambientF.toFixed(1)}°F</strong> · wind{' '}
        {(weather.wind01 * 100).toFixed(0)}% · precip {(weather.precip01 * 100).toFixed(0)}%
        <br />
        Surface wet <strong>{(weather.surfaceWet01 * 100).toFixed(0)}%</strong>
        <br />
        {unit.name} exposure: effective{' '}
        <strong>{exposure.effectiveAmbientF.toFixed(1)}°F</strong> · felt{' '}
        <strong>{feltF.toFixed(1)}°F</strong>
        {evapChill >= 0.3 ? ` (evap −${evapChill.toFixed(1)}°F)` : ''} · rain hit{' '}
        {(exposure.rainExposure01 * 100).toFixed(0)}% · wet pressure{' '}
        {(exposure.wetPressure01 * 100).toFixed(0)}%
        {exposure.hasCloak
          ? ` · ${exposure.cloakName} · mean cover ${(exposure.cloakMitigation * 100).toFixed(0)}%`
          : ' · no cloak'}
        {sheltered ? ' · sheltered' : ' · outdoors'}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          marginBottom: 12,
          padding: '8px 10px',
          borderRadius: 8,
          background: 'rgba(125, 211, 252, 0.06)',
          border: '1px solid rgba(125, 211, 252, 0.18)',
        }}
      >
        Body · core <strong>{bodyTemp.coreTempF.toFixed(1)}°F</strong> · hands{' '}
        <strong>{bodyTemp.skinHandsF.toFixed(1)}°F</strong> · face{' '}
        <strong>{bodyTemp.skinFaceF.toFixed(1)}°F</strong>
        <br />
        Comfort <strong>{comfort}</strong> · heat-stress{' '}
        <strong>{(bodyTemp.heatStress01 * 100).toFixed(0)}%</strong>
        <br />
        Clothes wet <strong>{(garment.wornEnvWet01 * 100).toFixed(0)}%</strong>
        {garment.wornDamp.length
          ? ` · ${garment.wornDamp
              .slice(0, 3)
              .map((d) => `${d.name} ${describeEnvWet(d.envWet01)}`)
              .join(', ')}`
          : ' · dry'}
        <br />
        Illness <strong>{coldDesc}</strong>
        {coldIll.respiratoryIllness !== 'none'
          ? ` · combat stam×${combatIll.stamina.toFixed(2)} / spd×${combatIll.speed.toFixed(2)}`
          : ''}
        <br />
        <span style={{ fontSize: 11, opacity: 0.6 }}>
          Rates × CON {unit.combatStats.base.constitution} · {unit.height}&quot; ·{' '}
          {unit.weight} lb · {unit.sex}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          style={{ ...smallBtn, borderColor: 'rgba(251, 191, 36, 0.55)' }}
          onClick={onWarmCare}
          title="Rest warm / dry care — cuts cold debt and speeds recovery"
        >
          Rest warm / care
        </button>
      </div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          marginBottom: 10,
          opacity: 0.85,
        }}
      >
        <input
          type="checkbox"
          checked={sheltered}
          onChange={(e) => onShelteredChange(e.target.checked)}
        />
        Sheltered (indoors / tent)
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {WEATHER_SKIES.map((sky) => (
          <button
            key={sky}
            type="button"
            style={{
              ...smallBtn,
              borderColor:
                weather.sky === sky
                  ? 'rgba(125, 211, 252, 0.7)'
                  : (smallBtn.border as string),
            }}
            onClick={() => onForceSky(sky)}
          >
            Force {formatWeatherSkyLabel(sky)}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(
          [
            [5, '5 AM'],
            [12, 'Noon'],
            [15, '3 PM'],
            [21, '9 PM'],
            [0, 'Midnight'],
          ] as const
        ).map(([hour, label]) => (
          <button
            key={label}
            type="button"
            style={smallBtn}
            onClick={() => onScrubHour(hour)}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function GearWetPanel({
  unit,
  itemsById,
  onUnequip,
  onEquip,
  onPeel,
  onFireDry,
}: {
  unit: DetailedUnit;
  itemsById: Record<string, Item>;
  onUnequip: (slot: ItemSlot) => void;
  onEquip: (itemId: string) => void;
  onPeel: (slots: ItemSlot[], label: string) => void;
  onFireDry: (itemIds?: string[]) => void;
}) {
  const wornRows = useMemo(() => {
    const rows: Array<{
      slot: ItemSlot;
      item: Item;
      wet: number;
    }> = [];
    for (const slot of GARMENT_WET_SLOTS) {
      const id = unit.equipment[slot];
      if (!id) continue;
      const item = itemsById[id];
      if (!item) continue;
      rows.push({ slot, item, wet: readEnvWet01(item) });
    }
    return rows;
  }, [unit, itemsById]);

  const packDamp = useMemo(() => {
    const worn = new Set(
      Object.values(unit.equipment).filter((id): id is string => !!id)
    );
    return Object.values(itemsById)
      .filter(
        (item) =>
          !worn.has(item.id) &&
          (GARMENT_WET_SLOTS as readonly string[]).includes(item.slot) &&
          readEnvWet01(item) >= 0.04
      )
      .sort((a, b) => readEnvWet01(b) - readEnvWet01(a));
  }, [unit, itemsById]);

  const packDryWearable = useMemo(() => {
    const worn = new Set(
      Object.values(unit.equipment).filter((id): id is string => !!id)
    );
    return Object.values(itemsById).filter(
      (item) =>
        !worn.has(item.id) &&
        (GARMENT_WET_SLOTS as readonly string[]).includes(item.slot) &&
        !unit.equipment[item.slot]
    );
  }, [unit, itemsById]);

  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#7dd3fc' }}>
        Clothes & damp
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.65, lineHeight: 1.45 }}>
        Rain hits uncovered fraction of each slot (cloak size wrap). After the cloak is
        50% wet, covered cloth takes 15% through. Undershirt/underwear stay rain-dry until
        shirt or legs are over 50% damp (sweat still damps from inside). Fire-dry doffed cloth.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          style={smallBtn}
          onClick={() => onPeel(UNDRESS_ORDER_TORSO, 'torso')}
        >
          Peel torso
        </button>
        <button
          type="button"
          style={smallBtn}
          onClick={() => onPeel(UNDRESS_ORDER_BOTTOM, 'bottom')}
        >
          Peel bottom
        </button>
        <button
          type="button"
          style={{ ...smallBtn, borderColor: 'rgba(251, 191, 36, 0.55)' }}
          onClick={() => onFireDry()}
          title="Dry all unequipped damp garments by the fire"
        >
          Dry doffed by fire
        </button>
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
        WORN (CLOTH)
      </h3>
      {wornRows.length === 0 ? (
        <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.55 }}>
          No cloth garments worn.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {wornRows.map(({ slot, item, wet }) => (
            <div
              key={slot}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
              }}
            >
              <span style={{ minWidth: 88, opacity: 0.6 }}>
                {formatEquipmentSlotLabel(slot)}
              </span>
              <span style={{ flex: 1 }}>
                {item.name}{' '}
                <strong style={{ opacity: wet >= 0.04 ? 1 : 0.45 }}>
                  {describeEnvWet(wet)} {(wet * 100).toFixed(0)}%
                </strong>
              </span>
              <button type="button" style={smallBtn} onClick={() => onUnequip(slot)}>
                Unequip
              </button>
            </div>
          ))}
        </div>
      )}
      <h3 style={{ margin: '0 0 6px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
        DOFFED · DAMP
      </h3>
      {packDamp.length === 0 ? (
        <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.55 }}>
          No damp clothes in the pack.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {packDamp.map((item) => {
            const wet = readEnvWet01(item);
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <span style={{ flex: 1 }}>
                  {item.name} · {describeEnvWet(wet)} {(wet * 100).toFixed(0)}%
                </span>
                <button
                  type="button"
                  style={smallBtn}
                  onClick={() => onFireDry([item.id])}
                >
                  Fire-dry
                </button>
                {!unit.equipment[item.slot] ? (
                  <button
                    type="button"
                    style={smallBtn}
                    onClick={() => onEquip(item.id)}
                  >
                    Equip
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {packDryWearable.length > 0 ? (
        <>
          <h3 style={{ margin: '0 0 6px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
            PACK · EMPTY SLOTS
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {packDryWearable.slice(0, 8).map((item) => (
              <button
                key={item.id}
                type="button"
                style={smallBtn}
                onClick={() => onEquip(item.id)}
              >
                Equip {item.name}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function DurablePressuresPanel({
  unit,
  onNudge,
  onPassHours,
}: {
  unit: DetailedUnit;
  onNudge: (id: PersonalizedPressureId, delta: number) => void;
  onPassHours: (hours: number, opts?: { sleeping?: boolean }) => void;
}) {
  const snap = snapshotDurablePressures(unit);
  const labels: Record<PersonalizedPressureId | 'painLoad', string> = {
    stress: 'Stress',
    energy: 'Energy',
    belonging: 'Belonging',
    agency: 'Agency',
    lust: 'Lust',
    pride: 'Pride',
    shame: 'Shame',
    painLoad: 'Pain load (derived)',
  };
  const colors: Record<string, string> = {
    stress: '#fb923c',
    energy: '#38bdf8',
    belonging: '#86efac',
    agency: '#a78bfa',
    lust: '#e879f9',
    pride: '#fbbf24',
    shame: '#f87272',
    painLoad: '#94a3b8',
  };

  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#7dd3fc' }}>
        Durable pressures
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.65 }}>
        Meters drift toward a <strong>dynamic baseline</strong>; that baseline wanders up to ±
        {PRESSURE_DRIFT_TUNING.baselineWanderMax} from a fixed <strong>anchor</strong> (temperament ×
        mods) as lived highs/lows accumulate, then slowly settles back (follow ×
        {PRESSURE_DRIFT_TUNING.baselineFollowFraction}, anchor-return ×
        {PRESSURE_DRIFT_TUNING.baselineAnchorFraction}). λ=
        {PRESSURE_DRIFT_TUNING.idleLambdaPerHour}/h. Pain load is derived — no drift.
      </p>
      <h3 style={{ margin: '0 0 6px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
        PASS TIME
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {(
          [
            [1 / 60, '1 min'],
            [5 / 60, '5 min'],
            [0.25, '15 min'],
            [1, '1 h'],
            [3, '3 h'],
            [8, '8 h'],
          ] as const
        ).map(([hours, label]) => (
          <button key={label} type="button" style={smallBtn} onClick={() => onPassHours(hours)}>
            Pass {label}
          </button>
        ))}
        <button
          type="button"
          style={{ ...smallBtn, borderColor: 'rgba(125, 211, 252, 0.45)' }}
          onClick={() => onPassHours(8, { sleeping: true })}
          title="8h sleep — leukorrhea cloth gets sleep pool mult"
        >
          Sleep 8 h
        </button>
      </div>
      {PERSONALIZED_PRESSURES.map((id) => {
        const v = snap.values[id];
        const p = snap.profile[id];
        const anchor = snap.anchors[id];
        const baseline = snap.baselines[id];
        const wander = baseline - anchor;
        const wanderLabel =
          Math.abs(wander) < 0.5
            ? 'at anchor'
            : `${wander >= 0 ? '+' : ''}${wander.toFixed(0)} from anchor`;
        return (
          <div key={id} style={{ marginBottom: 12 }}>
            <StatBar label={labels[id]} value={Math.round(v)} color={colors[id]} />
            <div style={{ fontSize: 10, opacity: 0.55, marginTop: -6, marginBottom: 4 }}>
              baseline {baseline.toFixed(0)} · anchor {anchor.toFixed(0)} ({wanderLabel}) · growth ×
              {p.growth.toFixed(2)} · decay ×{p.decay.toFixed(2)} · band {snap.bands[id]}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={smallBtn} onClick={() => onNudge(id, 5)}>
                +5
              </button>
              <button type="button" style={smallBtn} onClick={() => onNudge(id, -5)}>
                −5
              </button>
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 8 }}>
        <StatBar
          label={labels.painLoad}
          value={Math.round(snap.painLoad)}
          color={colors.painLoad}
        />
        <div style={{ fontSize: 10, opacity: 0.55, marginTop: -6 }}>
          from itemized health · band {snap.bands.painLoad} · no character rate mods / no nudge
        </div>
      </div>
    </section>
  );
}

function MoodPanel({
  unit,
  compareBlend,
  onToggleCompare,
  flipSexPreview,
  onToggleFlipSex,
}: {
  unit: DetailedUnit;
  compareBlend: boolean;
  onToggleCompare: () => void;
  flipSexPreview: boolean;
  onToggleFlipSex: () => void;
}) {
  const voiceSex = flipSexPreview ? (unit.sex === 'F' ? 'M' : 'F') : unit.sex;
  const resolved = flipSexPreview
    ? resolveMoodAsBlend(unit, unit.socialStats.static.temperament, voiceSex)
    : resolveMood(unit);
  const alt = compareBlend
    ? resolveMoodAsBlend(unit, 'Melancholic-Phlegmatic', voiceSex)
    : null;

  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 10px', fontSize: '1.1rem', color: '#7dd3fc' }}>Mood</h2>

      <div
        style={{
          marginBottom: 14,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid rgba(134,239,172,0.35)',
          background: 'rgba(134,239,172,0.08)',
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>
          From durable pressures × temperament × sex ({voiceSex}
          {flipSexPreview ? ' preview' : ''})
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#bbf7d0' }}>
          {resolved.flavor}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{resolved.tell}</div>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <Pill>{`primary: ${resolved.moodClass} (${resolved.primaryScore.toFixed(2)})`}</Pill>
          {resolved.tintClass ? (
            <Pill>{`tint: ${resolved.tintClass} ×${resolved.tintStrength.toFixed(2)} (${resolved.secondaryScore.toFixed(2)})`}</Pill>
          ) : (
            <Pill>tint: none</Pill>
          )}
          <Pill>{`${resolved.temperament.primary}→${resolved.temperament.secondary}`}</Pill>
          <Pill>{`voice: ${voiceSex}`}</Pill>
          {resolved.cycleTell ? <Pill>cycle tell</Pill> : null}
        </div>
        {resolved.cycleTell ? (
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, color: '#f9a8d4' }}>
            Cycle — {resolved.cycleTell}
          </div>
        ) : null}
        {resolved.tintNote ? (
          <div style={{ marginTop: 6, fontSize: 10, opacity: 0.5 }}>{resolved.tintNote}</div>
        ) : null}
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
          Receptivity — chore ×{resolved.receptivity.chore.toFixed(2)} · talk ×
          {resolved.receptivity.talk.toFixed(2)} · friction ×
          {resolved.receptivity.friction.toFixed(2)} · bond ×
          {resolved.receptivity.bond.toFixed(2)}
        </div>
        {resolved.rationale.length > 0 ? (
          <div style={{ marginTop: 6, fontSize: 10, opacity: 0.5 }}>
            {resolved.rationale.join(' · ')}
          </div>
        ) : null}
      </div>

      {alt ? (
        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid rgba(167,139,250,0.4)',
            background: 'rgba(167,139,250,0.08)',
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4 }}>
            Same pressures as Melancholic–Phlegmatic voice ({voiceSex})
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 650, color: '#ddd6fe' }}>
            {alt.flavor}
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{alt.tell}</div>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <Pill>{`primary: ${alt.moodClass}`}</Pill>
            {alt.tintClass ? <Pill>{`tint: ${alt.tintClass}`}</Pill> : <Pill>tint: none</Pill>}
          </div>
        </div>
      ) : null}

      <label style={{ fontSize: 12, opacity: 0.8, display: 'flex', gap: 8, marginBottom: 8 }}>
        <input type="checkbox" checked={compareBlend} onChange={onToggleCompare} />
        Compare opposite blend voice (Melancholic–Phlegmatic)
      </label>
      <label style={{ fontSize: 12, opacity: 0.8, display: 'flex', gap: 8, marginBottom: 8 }}>
        <input type="checkbox" checked={flipSexPreview} onChange={onToggleFlipSex} />
        Preview opposite sex voice ({unit.sex === 'F' ? 'M' : 'F'})
      </label>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.5 }}>
        Posture is primary-only; tint shows only on the tell beneath it (and/yet by valence).
        Both posture and tell are sexed. Knobs in moodResolveTuning.ts.
      </p>
    </section>
  );
}

function TasksPanel({
  primary,
  partner,
  selectedTaskId,
  onSelectTask,
  onRunTask,
  log,
}: {
  primary: DetailedUnit;
  partner: DetailedUnit | null;
  selectedTaskId: string;
  onSelectTask: (id: string) => void;
  onRunTask: () => void;
  log: string[];
}) {
  const task =
    SOCIAL_TASK_TEMPLATES.find((t) => t.id === selectedTaskId) ?? SOCIAL_TASK_TEMPLATES[0];

  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#7dd3fc' }}>
        Tasks, actions &amp; events
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.65 }}>
        Shared activities that write short-term residue and pressures. Laundry, bathe,
        watch, cook, and tend wounds are live; other catalog rows still stub. Pass Time
        crystallizes ST → LT.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 240px) 1fr',
          gap: 12,
          marginBottom: 12,
        }}
        className="social-tasks-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SOCIAL_TASK_TEMPLATES.map((t) => {
            const active = t.id === task.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTask(t.id)}
                style={{
                  ...smallBtn,
                  textAlign: 'left',
                  borderColor: active ? 'rgba(125,211,252,0.9)' : 'rgba(125,211,252,0.25)',
                  background: active ? 'rgba(125,211,252,0.2)' : 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ fontWeight: 600 }}>{t.label}</div>
                <div style={{ fontSize: 10, opacity: 0.55 }}>{t.kind}</div>
              </button>
            );
          })}
        </div>

        <div>
          <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 6 }}>{task.label}</div>
          <p style={{ margin: '0 0 10px', fontSize: 13, opacity: 0.8, lineHeight: 1.45 }}>
            {task.blurb}
          </p>
          <div style={{ fontSize: 12, marginBottom: 10, opacity: 0.75 }}>
            Participants:{' '}
            <strong>{primary.name}</strong>
            {partner ? (
              <>
                {' '}
                + <strong>{partner.name}</strong>
              </>
            ) : (
              <span style={{ opacity: 0.55 }}> (solo / add a partner)</span>
            )}
            <span style={{ opacity: 0.5 }}>
              {' '}
              · catalog {task.minParticipants}–{task.maxParticipants}
              {task.timeCostMinutes != null
                ? ` · ~${task.timeCostMinutes} min`
                : ''}
              {task.requiresPartner ? ' · needs partner' : ''}
            </span>
          </div>
          <div style={{ marginBottom: 12 }}>
            {task.stubEffects.map((e) => (
              <Pill key={e}>{e}</Pill>
            ))}
          </div>
          <button
            type="button"
            style={{
              ...smallBtn,
              opacity: task.requiresPartner && !partner ? 0.45 : 1,
            }}
            disabled={!!task.requiresPartner && !partner}
            onClick={onRunTask}
          >
            Run task
          </button>
          {task.requiresPartner && !partner ? (
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#fcd34d' }}>
              Pick a partner to run this task.
            </p>
          ) : null}
        </div>
      </div>

      <div
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          maxHeight: 120,
          overflowY: 'auto',
          opacity: 0.85,
          lineHeight: 1.45,
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 8,
          padding: '8px 10px',
        }}
      >
        {log.length === 0 ? (
          <span style={{ opacity: 0.5 }}>No tasks run yet.</span>
        ) : (
          log.map((line, i) => <div key={`${i}-${line.slice(0, 18)}`}>{line}</div>)
        )}
      </div>
    </section>
  );
}

function DirectedEdgeEditor({
  from,
  to,
  graph,
  onSetLongTerm,
  onSetShortTerm,
  onNudgeLongTerm,
  onNudgeShortTerm,
}: {
  from: DetailedUnit;
  to: DetailedUnit;
  graph: RelationshipGraph;
  onSetLongTerm: (id: LongTermRelationshipId, value: number) => void;
  onSetShortTerm: (id: ShortTermRelationshipId, value: number) => void;
  onNudgeLongTerm: (id: LongTermRelationshipId, delta: number) => void;
  onNudgeShortTerm: (id: ShortTermRelationshipId, delta: number) => void;
}) {
  const edge = getEdge(graph, from.id, to.id);
  if (!edge) return null;
  const nativeDesire = sexualDesireAllowed(from, to);
  const desireCap = sexualDesireSoftCap(from, to, edge);
  const mmBlocked = sexualPairingHardBlocked(from, to);
  const desireLocked = desireCap <= 0;

  return (
    <div
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid rgba(125,211,252,0.25)',
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ fontSize: 14, marginBottom: 10, fontWeight: 650 }}>
        {from.name} <span style={{ opacity: 0.45 }}>→</span> {to.name}
        {mmBlocked ? (
          <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.55, fontWeight: 400 }}>
            (Desire hard-locked — no M→M)
          </span>
        ) : !nativeDesire && desireCap > 0 ? (
          <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.55, fontWeight: 400 }}>
            (Desire soft-capped at {desireCap} — erodable F→F)
          </span>
        ) : desireLocked ? (
          <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.55, fontWeight: 400 }}>
            (Desire locked — no attraction path)
          </span>
        ) : null}
      </div>

      <h3 style={{ margin: '0 0 8px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
        LONG-TERM (0–100 · no idle decay)
      </h3>
      {LONG_TERM_RELATIONSHIP_AXES.map((axis) => {
        const locked = axis.id === 'desire' && desireLocked;
        const axisMax = axis.id === 'desire' ? Math.max(1, desireCap) : 100;
        const v = edge.longTerm[axis.id];
        return (
          <div key={axis.id} style={{ marginBottom: 10, opacity: locked ? 0.45 : 1 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                marginBottom: 3,
              }}
            >
              <span>
                {axis.label}
                <span style={{ opacity: 0.5 }}> — {axis.blurb}</span>
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(v)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={axisMax}
              value={v}
              disabled={locked}
              onChange={(e) => onSetLongTerm(axis.id, Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                style={smallBtn}
                disabled={locked}
                onClick={() => onNudgeLongTerm(axis.id, 5)}
              >
                +5
              </button>
              <button
                type="button"
                style={smallBtn}
                disabled={locked}
                onClick={() => onNudgeLongTerm(axis.id, -5)}
              >
                −5
              </button>
            </div>
          </div>
        );
      })}

      <h3 style={{ margin: '14px 0 8px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
        SHORT-TERM (0–100 intensity · decays → 0)
      </h3>
      {SHORT_TERM_RELATIONSHIP_AXES.map((axis) => {
        const locked = axis.id === 'desireHeat' && desireLocked;
        const axisMax = axis.id === 'desireHeat' ? Math.max(1, desireCap) : 100;
        const v = edge.shortTerm[axis.id];
        return (
          <div key={axis.id} style={{ marginBottom: 10, opacity: locked ? 0.45 : 1 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                marginBottom: 3,
              }}
            >
              <span>
                {axis.label}
                <span style={{ opacity: 0.5 }}> — {axis.blurb}</span>
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(v)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={axisMax}
              value={v}
              disabled={locked}
              onChange={(e) => onSetShortTerm(axis.id, Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                style={smallBtn}
                disabled={locked}
                onClick={() => onNudgeShortTerm(axis.id, 10)}
              >
                +10
              </button>
              <button
                type="button"
                style={smallBtn}
                disabled={locked}
                onClick={() => onNudgeShortTerm(axis.id, -10)}
              >
                −10
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RelationshipsPanel({
  primary,
  partner,
  graph,
  onSetLongTerm,
  onSetShortTerm,
  onNudgeLongTerm,
  onNudgeShortTerm,
}: {
  primary: DetailedUnit;
  partner: DetailedUnit | null;
  graph: RelationshipGraph;
  onSetLongTerm: (
    from: DetailedUnit,
    to: DetailedUnit,
    id: LongTermRelationshipId,
    value: number
  ) => void;
  onSetShortTerm: (
    from: DetailedUnit,
    to: DetailedUnit,
    id: ShortTermRelationshipId,
    value: number
  ) => void;
  onNudgeLongTerm: (
    from: DetailedUnit,
    to: DetailedUnit,
    id: LongTermRelationshipId,
    delta: number
  ) => void;
  onNudgeShortTerm: (
    from: DetailedUnit,
    to: DetailedUnit,
    id: ShortTermRelationshipId,
    delta: number
  ) => void;
}) {
  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#7dd3fc' }}>
        Relationships
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.65 }}>
        Directed edges (A→B ≠ B→A). Short-term weather decays to 0 on Pass Time (λ=
        {RELATIONSHIP_DRIFT_TUNING.shortTermLambdaPerHour}/h) and crystallizes a shaved fraction into
        long-term (gain ×{RELATIONSHIP_DRIFT_TUNING.crystallizeGain}). Desire respects attraction
        flags; M→M Desire is never allowed.
      </p>

      {!partner ? (
        <p style={{ margin: 0, opacity: 0.55, fontSize: 13 }}>
          Select a partner distinct from the primary character.
        </p>
      ) : (
        <>
          <DirectedEdgeEditor
            from={primary}
            to={partner}
            graph={graph}
            onSetLongTerm={(id, v) => onSetLongTerm(primary, partner, id, v)}
            onSetShortTerm={(id, v) => onSetShortTerm(primary, partner, id, v)}
            onNudgeLongTerm={(id, d) => onNudgeLongTerm(primary, partner, id, d)}
            onNudgeShortTerm={(id, d) => onNudgeShortTerm(primary, partner, id, d)}
          />
          <DirectedEdgeEditor
            from={partner}
            to={primary}
            graph={graph}
            onSetLongTerm={(id, v) => onSetLongTerm(partner, primary, id, v)}
            onSetShortTerm={(id, v) => onSetShortTerm(partner, primary, id, v)}
            onNudgeLongTerm={(id, d) => onNudgeLongTerm(partner, primary, id, d)}
            onNudgeShortTerm={(id, d) => onNudgeShortTerm(partner, primary, id, d)}
          />
        </>
      )}
    </section>
  );
}

function SocialLab() {
  const navigate = useNavigate();
  const cast = listDetailedCharacters();
  const gameState = useGameStore((s) => s.gameState);
  const setGameState = useGameStore((s) => s.setGameState);
  const [primaryId, setPrimaryId] = useState(DEFAULT_PRIMARY);
  const [partnerId, setPartnerId] = useState(DEFAULT_PARTNER);
  const [primary, setPrimary] = useState<DetailedUnit | null>(
    () => cloneWardrobe(DEFAULT_PRIMARY)?.unit ?? null
  );
  const [primaryItemsById, setPrimaryItemsById] = useState<Record<string, Item>>(
    () => cloneWardrobe(DEFAULT_PRIMARY)?.itemsById ?? {}
  );
  const [partner, setPartner] = useState<DetailedUnit | null>(
    () => cloneWardrobe(DEFAULT_PARTNER)?.unit ?? null
  );
  const [partnerItemsById, setPartnerItemsById] = useState<Record<string, Item>>(
    () => cloneWardrobe(DEFAULT_PARTNER)?.itemsById ?? {}
  );
  const [taskId, setTaskId] = useState(SOCIAL_TASK_TEMPLATES[0]?.id ?? 'gather_firewood');
  const [taskLog, setTaskLog] = useState<string[]>([]);
  const [relGraph, setRelGraph] = useState<RelationshipGraph>(() =>
    buildCastRelationshipGraph(listDetailedCharacters())
  );
  const [compareBlend, setCompareBlend] = useState(true);
  const [flipSexPreview, setFlipSexPreview] = useState(false);
  const [sheltered, setSheltered] = useState(false);

  useEffect(() => {
    const w = cloneWardrobe(primaryId);
    setPrimary(w?.unit ?? null);
    setPrimaryItemsById(w?.itemsById ?? {});
  }, [primaryId]);

  useEffect(() => {
    if (partnerId === primaryId) {
      setPartner(null);
      setPartnerItemsById({});
      return;
    }
    const w = cloneWardrobe(partnerId);
    setPartner(w?.unit ?? null);
    setPartnerItemsById(w?.itemsById ?? {});
  }, [partnerId, primaryId]);

  const syncPrimaryGear = (
    nextUnit: DetailedUnit,
    nextItems: Record<string, Item>
  ) => {
    setPrimary({ ...nextUnit, equipment: { ...nextUnit.equipment } });
    setPrimaryItemsById({ ...nextItems });
  };

  useEffect(() => {
    if (!primary || !partner || primary.id === partner.id) return;
    setRelGraph((prev) => ensureBidirectional(prev, primary, partner));
  }, [primary, partner]);

  const pushTaskLog = (line: string) => {
    const stamped = `[${new Date().toLocaleTimeString()}] ${line}`;
    setTaskLog((prev) => [stamped, ...prev].slice(0, 40));
  };

  const onNudgePressure = (id: PersonalizedPressureId, delta: number) => {
    if (!primary) return;
    if (id === 'lust') {
      const cur = primary.lewdStats.dynamic.lust ?? 0;
      const next = Math.max(0, Math.min(100, cur + delta));
      setPrimary({
        ...primary,
        lewdStats: {
          ...primary.lewdStats,
          dynamic: { ...primary.lewdStats.dynamic, lust: next },
        },
      });
      pushTaskLog(`${primary.name} lust ${delta >= 0 ? '+' : ''}${delta} → ${next}.`);
      return;
    }
    const key = id as Exclude<PersonalizedPressureId, 'lust'>;
    const cur = primary.socialStats.dynamic[key] ?? 0;
    const next = Math.max(0, Math.min(100, cur + delta));
    setPrimary({
      ...primary,
      socialStats: {
        ...primary.socialStats,
        dynamic: { ...primary.socialStats.dynamic, [key]: next },
      },
    });
    pushTaskLog(`${primary.name} ${id} ${delta >= 0 ? '+' : ''}${delta} → ${next}.`);
  };

  const onUnequipSlot = (slot: ItemSlot) => {
    if (!primary) return;
    const ctx = {
      unit: { ...primary, equipment: { ...primary.equipment } },
      itemsById: primaryItemsById,
    };
    const r = unequipSlot(ctx, slot);
    if (!r.ok) {
      pushTaskLog(r.message);
      return;
    }
    syncPrimaryGear(ctx.unit, ctx.itemsById);
    pushTaskLog(
      `Unequipped ${r.item.name} (${formatEquipmentSlotLabel(slot)}) · env wet ${(readEnvWet01(r.item) * 100).toFixed(0)}%.`
    );
  };

  const onEquipOwned = (itemId: string) => {
    if (!primary) return;
    const ctx = {
      unit: { ...primary, equipment: { ...primary.equipment } },
      itemsById: primaryItemsById,
    };
    const r = equipItem(ctx, itemId);
    if (!r.ok) {
      pushTaskLog(r.message);
      return;
    }
    syncPrimaryGear(ctx.unit, ctx.itemsById);
    pushTaskLog(
      `Equipped ${r.item.name} → ${formatEquipmentSlotLabel(r.item.equippedSlot as ItemSlot)}.`
    );
  };

  const onPeelSlots = (slots: ItemSlot[], label: string) => {
    if (!primary) return;
    const ctx = {
      unit: { ...primary, equipment: { ...primary.equipment } },
      itemsById: primaryItemsById,
    };
    const { unequipped } = unequipSlots(ctx, slots);
    syncPrimaryGear(ctx.unit, ctx.itemsById);
    if (unequipped.length === 0) {
      pushTaskLog(`Peel ${label}: nothing worn.`);
      return;
    }
    pushTaskLog(
      `Peeled ${label}: ${unequipped.map((i) => i.name).join(', ')}.`
    );
  };

  const onFireDry = (itemIds?: string[]) => {
    if (!primary) return;
    const r = dryGarmentsByFire(primary, primaryItemsById, { itemIds });
    setPrimaryItemsById({ ...r.itemsById });
    pushTaskLog(r.summary);
  };

  const onWarmCare = () => {
    if (!primary) return;
    const r = applyWarmCare(primary);
    setPrimary(r.unit);
    pushTaskLog(`${primary.name} · ${r.summary}`);
  };

  const onForceSky = (sky: WeatherSky) => {
    setGameState({
      ...gameState,
      worldWeather: forceWeatherSky(gameState.worldWeather, sky),
    });
    pushTaskLog(`Weather forced → ${formatWeatherSkyLabel(sky)}.`);
  };

  const onScrubHour = (hour: number) => {
    const w = gameState.worldWeather;
    setGameState({
      ...gameState,
      worldWeather: forceWeatherSky({ ...w, hour }, w.sky),
    });
    pushTaskLog(`Clock scrubbed → ${formatClockHour(hour)}.`);
  };

  const onPassHours = (hours: number, opts?: { sleeping?: boolean }) => {
    if (!primary) return;
    // Weather → garment wet → body temp → cold illness → other physio.
    const nextWeather = advanceWeather(gameState.worldWeather, hours, {
      sleeping: opts?.sleeping,
    });
    setGameState({ ...gameState, worldWeather: nextWeather });
    const exposureOpts = {
      sheltered: sheltered || !!opts?.sleeping,
      itemsById: primaryItemsById,
    };
    const exposure = assessWeatherExposure(primary, nextWeather, exposureOpts);
    pushTaskLog(
      `Weather → day ${nextWeather.dayIndex} ${formatClockHour(nextWeather.hour)} · ${formatWeatherSkyLabel(nextWeather.sky)} · ${nextWeather.ambientF.toFixed(0)}°F (effective ${exposure.effectiveAmbientF.toFixed(0)}°F · wet ${(exposure.wetPressure01 * 100).toFixed(0)}%).`
    );

    const heatBefore = readBodyTemp(primary).heatStress01;
    const garment = advanceGarmentWetness(primary, hours, exposure, {
      sheltered: exposureOpts.sheltered,
      heatStress01: heatBefore,
      itemsById: primaryItemsById,
      precip01: nextWeather.precip01,
      wind01: nextWeather.wind01,
    });
    setPrimaryItemsById({ ...garment.itemsById });
    if (garment.summary) {
      pushTaskLog(`${primary.name} cloth · ${garment.summary}`);
    }

    const bodyTempResult = advanceBodyTemperature(primary, hours, exposure, {
      sleeping: opts?.sleeping,
      evaporativeChillF: garment.evaporativeChillF,
    });
    if (bodyTempResult.summary) {
      pushTaskLog(`${primary.name} temp · ${bodyTempResult.summary}`);
    }

    const coldIll = advanceColdIllness(bodyTempResult.unit, hours, {
      sleeping: opts?.sleeping,
      sheltered: exposureOpts.sheltered,
      feltAmbientF: bodyTempResult.feltAmbientF,
      wornEnvWet01: garment.wornEnvWet01,
    });
    if (coldIll.summary) {
      pushTaskLog(`${primary.name} illness · ${coldIll.summary}`);
    }

    const cycleBefore = hormonesForUnit(coldIll.unit);
    const prevCycleHour =
      coldIll.unit.lewdStats.dynamic.ovulationCycleCurrent ?? 0;
    const result = driftDurablePressures(coldIll.unit, hours);
    const physio = advanceFemalePhysiology(result.unit, hours);
    const lusted = advanceStandingLust(physio.unit, hours);
    const repro = advanceReproduction(lusted.unit, hours, {
      prevCycleHour,
    });
    const afterSoil = advanceFluidSoil(repro.unit, hours, {
      sleeping: opts?.sleeping,
    });
    setPrimary(afterSoil);

    let nextPartner = partner;
    let partnerShiftSummary = '';
    if (partner) {
      const partnerExposure = assessWeatherExposure(partner, nextWeather, {
        sheltered: exposureOpts.sheltered,
        itemsById: partnerItemsById,
      });
      const partnerHeat = readBodyTemp(partner).heatStress01;
      const partnerGarment = advanceGarmentWetness(
        partner,
        hours,
        partnerExposure,
        {
          sheltered: exposureOpts.sheltered,
          heatStress01: partnerHeat,
          itemsById: partnerItemsById,
          precip01: nextWeather.precip01,
          wind01: nextWeather.wind01,
        }
      );
      setPartnerItemsById({ ...partnerGarment.itemsById });
      const partnerTemp = advanceBodyTemperature(
        partner,
        hours,
        partnerExposure,
        {
          sleeping: opts?.sleeping,
          evaporativeChillF: partnerGarment.evaporativeChillF,
        }
      );
      const partnerCold = advanceColdIllness(partnerTemp.unit, hours, {
        sleeping: opts?.sleeping,
        sheltered: exposureOpts.sheltered,
        feltAmbientF: partnerTemp.feltAmbientF,
        wornEnvWet01: partnerGarment.wornEnvWet01,
      });
      const partnerBefore = hormonesForUnit(partnerCold.unit);
      const partnerPrevHour =
        partnerCold.unit.lewdStats.dynamic.ovulationCycleCurrent ?? 0;
      const partnerDrift = driftDurablePressures(partnerCold.unit, hours);
      const partnerPhysio = advanceFemalePhysiology(partnerDrift.unit, hours);
      const partnerLust = advanceStandingLust(partnerPhysio.unit, hours);
      const partnerRepro = advanceReproduction(partnerLust.unit, hours, {
        prevCycleHour: partnerPrevHour,
      });
      nextPartner = advanceFluidSoil(partnerRepro.unit, hours, {
        sleeping: opts?.sleeping,
      });
      setPartner(nextPartner);
      const pLen = partner.lewdStats.static.ovulationCycleLength || 28;
      const pShift = describeCycleShift({
        before: partnerBefore,
        after: partnerPhysio.hormones,
        lengthDays: pLen,
        lustFrom: partnerLust.lustFrom,
        lustTo: partnerLust.lustTo,
      });
      const pSoil = deriveSoilCues(nextPartner);
      const pTempNote = partnerTemp.summary ? partnerTemp.summary : '';
      const pClothNote = partnerGarment.summary ? partnerGarment.summary : '';
      const pIllNote = partnerCold.summary ? partnerCold.summary : '';
      if (
        pShift.changed ||
        pSoil.wantsBath ||
        pSoil.soiledPanty ||
        pTempNote ||
        pClothNote ||
        pIllNote
      ) {
        partnerShiftSummary = ` || ${partner.name}: ${[pClothNote, pTempNote, pIllNote, pShift.changed ? pShift.summary : '', pSoil.summary !== 'clean' ? pSoil.summary : ''].filter(Boolean).join(' · ')}`;
      }
    }

    const unitsById: Record<string, DetailedUnit> = {
      [afterSoil.id]: afterSoil,
    };
    if (nextPartner) unitsById[nextPartner.id] = nextPartner;

    const relResult = driftShortTermRelationships(relGraph, hours, unitsById);
    setRelGraph(relResult.graph);

    const mins = hours * 60;
    const label =
      (opts?.sleeping ? 'sleep ' : '') +
      (mins < 1
        ? `${Math.round(mins * 60)} s`
        : mins < 60
          ? `${Math.round(mins)} min`
          : `${hours} h`);

    const pressureSummary =
      result.deltas.length === 0
        ? 'pressures settled'
        : result.deltas
            .map((d) => {
              const sign = d.delta >= 0 ? '+' : '';
              const bSign = d.baselineTo - d.baselineFrom >= 0 ? '+' : '';
              const bDelta = d.baselineTo - d.baselineFrom;
              return `${d.id} ${d.from.toFixed(0)}→${d.to.toFixed(0)} (${sign}${d.delta.toFixed(1)}; bl ${d.baselineFrom.toFixed(0)}→${d.baselineTo.toFixed(0)} ${bSign}${bDelta.toFixed(1)})`;
            })
            .join(' · ');

    const relSummary =
      relResult.deltas.length === 0
        ? 'rel ST settled'
        : relResult.deltas
            .slice(0, 6)
            .map((d) => `${d.id} ${d.from.toFixed(0)}→${d.to.toFixed(0)}`)
            .join(' · ');

    const crystalSummary =
      relResult.crystalDeltas.length === 0
        ? null
        : relResult.crystalDeltas
            .slice(0, 8)
            .map((d) => {
              const sign = d.delta >= 0 ? '+' : '';
              return `${d.fromSt}→${d.id} ${sign}${d.delta.toFixed(1)}`;
            })
            .join(' · ');

    const len = primary.lewdStats.static.ovulationCycleLength || 28;
    const shift = describeCycleShift({
      before: cycleBefore,
      after: physio.hormones,
      lengthDays: len,
      lustFrom: lusted.lustFrom,
      lustTo: lusted.lustTo,
    });
    const soilCues = deriveSoilCues(afterSoil);
    const cycleNote = shift.changed
      ? ` · she's different: ${shift.summary}`
      : physio.hormones
        ? ` · cycle ${formatCycleLabel(physio.hormones, len)}`
        : '';
    const soilNote =
      soilCues.summary !== 'clean' ? ` · soil ${soilCues.summary}` : '';
    const reproBits: string[] = [];
    if (repro.ovumSpawned) reproBits.push('ovum released');
    if (repro.ovumExpired) reproBits.push('ovum expired');
    if (repro.conceived) reproBits.push(repro.conceptionNote ?? 'conceived');
    else if (afterSoil.sex === 'F') {
      const d = describeReproduction(afterSoil);
      if (d !== 'no ovum / no cohorts') reproBits.push(d);
    }
    const reproNote = reproBits.length ? ` · repro ${reproBits.join(' · ')}` : '';

    pushTaskLog(
      `${primary.name}: pass ${label} — ${pressureSummary}${cycleNote}${soilNote}${reproNote} || ST ${relSummary}` +
        (crystalSummary ? ` || LT ${crystalSummary}` : '') +
        partnerShiftSummary
    );
  };

  const onRunTask = () => {
    if (!primary) return;
    const result = resolveSocialTask({
      taskId,
      primary,
      partner,
      relationships: relGraph,
    });
    setPrimary(result.primary);
    if (result.partner) setPartner(result.partner);
    setRelGraph(result.relationships);
    for (const line of result.log) pushTaskLog(line);
  };

  const onSetLongTermAxis = (
    from: DetailedUnit,
    to: DetailedUnit,
    id: LongTermRelationshipId,
    value: number
  ) => {
    setRelGraph((prev) => setLongTerm(prev, from, to, id, value));
  };

  const onSetShortTermAxis = (
    from: DetailedUnit,
    to: DetailedUnit,
    id: ShortTermRelationshipId,
    value: number
  ) => {
    setRelGraph((prev) => setShortTerm(prev, from, to, id, value));
  };

  const onNudgeLongTermAxis = (
    from: DetailedUnit,
    to: DetailedUnit,
    id: LongTermRelationshipId,
    delta: number
  ) => {
    setRelGraph((prev) => nudgeLongTerm(prev, from, to, id, delta));
  };

  const onNudgeShortTermAxis = (
    from: DetailedUnit,
    to: DetailedUnit,
    id: ShortTermRelationshipId,
    delta: number
  ) => {
    setRelGraph((prev) => nudgeShortTerm(prev, from, to, id, delta));
  };

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate('/')} style={navBtn}>
          ← Title
        </button>
        <button type="button" onClick={() => navigate('/battleground')} style={navBtn}>
          Battleground
        </button>
        <button
          type="button"
          onClick={() => navigate(`/characters/detailed/${primaryId}`)}
          style={navBtn}
        >
          Combat Detail
        </button>
      </div>

      <header style={{ marginBottom: 24, textAlign: 'center' }}>
        <p style={{ margin: '0 0 6px', opacity: 0.55, fontSize: 12, letterSpacing: 1 }}>
          SOCIAL LAB
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
              color: 'inherit',
            }}
          >
            Social Hall
          </button>
        </h1>
        <p
          style={{
            margin: 0,
            opacity: 0.75,
            maxWidth: 640,
            marginLeft: 'auto',
            marginRight: 'auto',
            fontSize: 14,
          }}
        >
          Personality, mood, shared tasks, and relationship editing. Mechanics are mostly
          scaffold — drinking and deeper sim hook in later.
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          maxWidth: 1100,
          margin: '0 auto 18px',
        }}
      >
        <label style={{ fontSize: 12, opacity: 0.7 }}>
          Primary
          <select
            value={primaryId}
            onChange={(e) => setPrimaryId(e.target.value)}
            style={{ ...selectStyle, display: 'block', marginTop: 4, minWidth: 200 }}
          >
            {cast.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.class})
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, opacity: 0.7 }}>
          Partner
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            style={{ ...selectStyle, display: 'block', marginTop: 4, minWidth: 200 }}
          >
            {cast.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.class})
              </option>
            ))}
          </select>
        </label>
      </div>

      {!primary ? (
        <p style={{ textAlign: 'center', opacity: 0.7 }}>Character not found.</p>
      ) : (
        <div
          className="social-lab-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            maxWidth: 1100,
            margin: '0 auto',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={cardStyle}>
              <h2 style={{ margin: '0 0 4px', fontSize: '1.35rem' }}>{primary.name}</h2>
              {(() => {
                const h = hormonesForUnit(primary);
                if (!h) return null;
                const len = primary.lewdStats.static.ovulationCycleLength;
                return (
                  <p style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.65 }}>
                    {formatCycleLabel(h, len)} · E {h.estrogen.toFixed(1)} · T{' '}
                    {h.testosterone.toFixed(2)} · P {h.progesterone.toFixed(1)}
                    {isInFertileWindow(h, len) ? ' · fertile window' : ''}
                  </p>
                );
              })()}
              {(() => {
                const soil = deriveSoilCues(primary);
                if (soil.summary === 'clean' && soil.wetness.size === 'none') {
                  return null;
                }
                return (
                  <div style={{ margin: '0 0 8px', fontSize: 12, color: '#fcd34d' }}>
                    <div>Soil · {soil.summary}</div>
                    {soil.wetness.size !== 'none' ? (
                      <div style={{ marginTop: 4, opacity: 0.9, lineHeight: 1.4 }}>
                        {soil.wetness.flavor}
                      </div>
                    ) : null}
                  </div>
                );
              })()}
              {primary.sex === 'F' ? (
                <div style={{ margin: '0 0 8px', fontSize: 11, opacity: 0.75 }}>
                  {(() => {
                    const pad = periodClothBleedThroughReport(primary);
                    if (!pad.equipped) {
                      return (
                        <button
                          type="button"
                          style={smallBtn}
                          onClick={() => setPrimary(equipStubPeriodCloth(primary))}
                        >
                          Equip stub period cloth
                        </button>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <span>
                          Period cloth · {pad.absorbed01.toFixed(0)}/{pad.capacity01} (
                          {Math.round(pad.fill01 * 100)}%)
                          {pad.visibleBleedThrough ? ' · bleedthrough stain' : ''}
                        </span>
                        <button
                          type="button"
                          style={smallBtn}
                          onClick={() => setPrimary(unequipPeriodCloth(primary))}
                        >
                          Remove cloth
                        </button>
                        <button
                          type="button"
                          style={smallBtn}
                          onClick={() =>
                            setPrimary(equipStubPeriodCloth(unequipPeriodCloth(primary)))
                          }
                        >
                          Change cloth
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
              <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
                {primary.class} · {primary.sex} · age {primary.age}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.8, lineHeight: 1.45 }}>
                {primary.description}
              </p>
            </div>
            <PersonalityPanel unit={primary} />
            <WeatherPanel
              unit={primary}
              itemsById={primaryItemsById}
              sheltered={sheltered}
              onShelteredChange={setSheltered}
              onForceSky={onForceSky}
              onScrubHour={onScrubHour}
              onWarmCare={onWarmCare}
            />
            <GearWetPanel
              unit={primary}
              itemsById={primaryItemsById}
              onUnequip={onUnequipSlot}
              onEquip={onEquipOwned}
              onPeel={onPeelSlots}
              onFireDry={onFireDry}
            />
            <DurablePressuresPanel
              unit={primary}
              onNudge={onNudgePressure}
              onPassHours={onPassHours}
            />
            <MoodPanel
              unit={primary}
              compareBlend={compareBlend}
              onToggleCompare={() => setCompareBlend((v) => !v)}
              flipSexPreview={flipSexPreview}
              onToggleFlipSex={() => setFlipSexPreview((v) => !v)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TasksPanel
              primary={primary}
              partner={partner}
              selectedTaskId={taskId}
              onSelectTask={setTaskId}
              onRunTask={onRunTask}
              log={taskLog}
            />
            <RelationshipsPanel
              primary={primary}
              partner={partner}
              graph={relGraph}
              onSetLongTerm={onSetLongTermAxis}
              onSetShortTerm={onSetShortTermAxis}
              onNudgeLongTerm={onNudgeLongTermAxis}
              onNudgeShortTerm={onNudgeShortTermAxis}
            />
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .social-lab-layout { grid-template-columns: 1fr !important; }
          .social-tasks-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

export default SocialLab;
