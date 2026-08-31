import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDetailedCharacter,
  listDetailedCharacters,
} from './data/detailedPlaceholderCharacters';
import { buildCastRelationshipGraph } from './data/social/castRelationshipSeeds';
import { SOCIAL_TASK_TEMPLATES } from './data/social/socialLabScaffold';
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
  batheClearSkinSoil,
  deriveSoilCues,
  launderUnderwear,
} from './utils/lewd/fluidSoil';
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

function cloneUnit(id: string): DetailedUnit | null {
  const base = getDetailedCharacter(id);
  if (!base) return null;
  const cloned = hydrateDurablePressures(structuredClone(base) as DetailedUnit);
  // Lab: seed lust at standing target (libido × cycle × temperament expression).
  if (!cloned.lewdStats.dynamic.lust) {
    cloned.lewdStats.dynamic.lust = standingLustTarget(cloned);
  }
  return cloned;
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

function DurablePressuresPanel({
  unit,
  onNudge,
  onPassHours,
}: {
  unit: DetailedUnit;
  onNudge: (id: PersonalizedPressureId, delta: number) => void;
  onPassHours: (hours: number) => void;
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
        Working title. Shared activities that can shift relationships without being erotic —
        camp labor, watches, scouting, etc. Outcomes are stubbed.
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
            </span>
          </div>
          <div style={{ marginBottom: 12 }}>
            {task.stubEffects.map((e) => (
              <Pill key={e}>{e}</Pill>
            ))}
          </div>
          <button type="button" style={smallBtn} onClick={onRunTask}>
            Run stub event
          </button>
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
  const [primaryId, setPrimaryId] = useState(DEFAULT_PRIMARY);
  const [partnerId, setPartnerId] = useState(DEFAULT_PARTNER);
  const [primary, setPrimary] = useState<DetailedUnit | null>(() => cloneUnit(DEFAULT_PRIMARY));
  const [partner, setPartner] = useState<DetailedUnit | null>(() => cloneUnit(DEFAULT_PARTNER));
  const [taskId, setTaskId] = useState(SOCIAL_TASK_TEMPLATES[0]?.id ?? 'gather_firewood');
  const [taskLog, setTaskLog] = useState<string[]>([]);
  const [relGraph, setRelGraph] = useState<RelationshipGraph>(() =>
    buildCastRelationshipGraph(listDetailedCharacters())
  );
  const [compareBlend, setCompareBlend] = useState(true);
  const [flipSexPreview, setFlipSexPreview] = useState(false);

  useEffect(() => {
    setPrimary(cloneUnit(primaryId));
  }, [primaryId]);

  useEffect(() => {
    setPartner(partnerId === primaryId ? null : cloneUnit(partnerId));
  }, [partnerId, primaryId]);

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

  const onPassHours = (hours: number) => {
    if (!primary) return;
    const cycleBefore = hormonesForUnit(primary);
    const prevCycleHour = primary.lewdStats.dynamic.ovulationCycleCurrent ?? 0;
    const result = driftDurablePressures(primary, hours);
    const physio = advanceFemalePhysiology(result.unit, hours);
    const lusted = advanceStandingLust(physio.unit, hours);
    const repro = advanceReproduction(lusted.unit, hours, {
      prevCycleHour,
    });
    const afterSoil = advanceFluidSoil(repro.unit, hours);
    setPrimary(afterSoil);

    let nextPartner = partner;
    let partnerShiftSummary = '';
    if (partner) {
      const partnerBefore = hormonesForUnit(partner);
      const partnerPrevHour = partner.lewdStats.dynamic.ovulationCycleCurrent ?? 0;
      const partnerDrift = driftDurablePressures(partner, hours);
      const partnerPhysio = advanceFemalePhysiology(partnerDrift.unit, hours);
      const partnerLust = advanceStandingLust(partnerPhysio.unit, hours);
      const partnerRepro = advanceReproduction(partnerLust.unit, hours, {
        prevCycleHour: partnerPrevHour,
      });
      nextPartner = advanceFluidSoil(partnerRepro.unit, hours);
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
      if (pShift.changed || pSoil.wantsBath || pSoil.soiledPanty) {
        partnerShiftSummary = ` || ${partner.name}: ${[pShift.changed ? pShift.summary : '', pSoil.summary !== 'clean' ? pSoil.summary : ''].filter(Boolean).join(' · ')}`;
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
      mins < 1
        ? `${Math.round(mins * 60)} s`
        : mins < 60
          ? `${Math.round(mins)} min`
          : `${hours} h`;

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
    const task =
      SOCIAL_TASK_TEMPLATES.find((t) => t.id === taskId) ?? SOCIAL_TASK_TEMPLATES[0];
    const names = partner
      ? `${primary.name} + ${partner.name}`
      : primary.name;

    if (task.id === 'do_laundry') {
      const before = deriveSoilCues(primary);
      const cleaned = launderUnderwear(primary);
      setPrimary(cleaned);
      const after = deriveSoilCues(cleaned);
      pushTaskLog(
        `${primary.name} laundry: ${before.summary} → ${after.summary}`
      );
      if (partner) {
        setRelGraph((prev) => {
          let g = ensureBidirectional(prev, partner, primary);
          g = nudgeShortTerm(g, primary, partner, 'gratitude', 14);
          g = nudgeShortTerm(g, partner, primary, 'warmth', 8);
          return g;
        });
        pushTaskLog(`${primary.name}→${partner.name}: gratitude/warmth from shared wash.`);
      }
      return;
    }

    if (task.id === 'bathe' || task.id === 'bathe_together') {
      let nextPrimary = batheClearSkinSoil(primary);
      // Soft shame relief when washing off blood/semen urgency
      const shame = Math.max(0, (nextPrimary.socialStats.dynamic.shame ?? 0) - 4);
      nextPrimary = {
        ...nextPrimary,
        socialStats: {
          ...nextPrimary.socialStats,
          dynamic: { ...nextPrimary.socialStats.dynamic, shame },
        },
      };
      setPrimary(nextPrimary);
      pushTaskLog(
        `${primary.name} bathes — skin soil cleared · ${deriveSoilCues(nextPrimary).summary}`
      );
      if (task.id === 'bathe_together' && partner) {
        const nextPartner = batheClearSkinSoil(partner);
        setPartner(nextPartner);
        setRelGraph((prev) => {
          let g = ensureBidirectional(prev, primary, partner);
          g = nudgeShortTerm(g, primary, partner, 'warmth', 16);
          g = nudgeShortTerm(g, partner, primary, 'warmth', 16);
          if (sexualDesireAllowed(primary, partner)) {
            g = nudgeShortTerm(g, primary, partner, 'desireHeat', 10);
          }
          if (sexualDesireAllowed(partner, primary)) {
            g = nudgeShortTerm(g, partner, primary, 'desireHeat', 10);
          }
          return g;
        });
        pushTaskLog(`Bathe together: ${names} warmth up; desireHeat if attraction allows.`);
      }
      return;
    }

    pushTaskLog(
      `Stub: “${task.label}” with ${names}. Effects TBD (${task.stubEffects.join(', ')}).`
    );
    // Tiny lab feedback: shared work nudges mutual short-term warmth + tiny familiarity
    if (partner) {
      setRelGraph((prev) => {
        let g = ensureBidirectional(prev, primary, partner);
        g = nudgeShortTerm(g, primary, partner, 'warmth', 12);
        g = nudgeShortTerm(g, partner, primary, 'warmth', 12);
        g = nudgeLongTerm(g, primary, partner, 'familiarity', 2);
        g = nudgeLongTerm(g, partner, primary, 'familiarity', 2);
        return g;
      });
      pushTaskLog(
        `Dev nudge: ${primary.name}↔${partner.name} warmth +12 (both ways), familiarity +2.`
      );
    }
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
              <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
                {primary.class} · {primary.sex} · age {primary.age}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.8, lineHeight: 1.45 }}>
                {primary.description}
              </p>
            </div>
            <PersonalityPanel unit={primary} />
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
