import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDetailedCharacter,
  listDetailedCharacters,
} from './data/detailedPlaceholderCharacters';
import {
  RELATIONSHIP_AXES,
  SOCIAL_TASK_TEMPLATES,
  defaultRelationshipScores,
  relationshipPairKey,
  type RelationshipScores,
} from './data/social/socialLabScaffold';
import {
  driftDurablePressures,
  hydrateDurablePressures,
  snapshotDurablePressures,
} from './utils/social/durablePressureState';
import { PRESSURE_DRIFT_TUNING } from './utils/social/pressureDriftTuning';
import { resolveMood, resolveMoodAsBlend } from './utils/social/resolveMood';
import type { Unit as DetailedUnit } from './types/characters';
import {
  PERSONALIZED_PRESSURES,
  resolveCharacterPressureProfile,
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
  // Lab: seed lust at the character pressure baseline (createDetailedUnit defaults lust to 0).
  const profile = resolveCharacterPressureProfile(
    cloned.socialStats.static.temperament,
    cloned.socialStats.static.pressureMods
  );
  if (!cloned.lewdStats.dynamic.lust) {
    cloned.lewdStats.dynamic.lust = profile.lust.baseline;
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
        </div>
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

function RelationshipsPanel({
  primary,
  partner,
  scores,
  onAxisChange,
}: {
  primary: DetailedUnit;
  partner: DetailedUnit | null;
  scores: RelationshipScores | null;
  onAxisChange: (axis: keyof RelationshipScores, value: number) => void;
}) {
  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#7dd3fc' }}>
        Relationships (dev)
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.65 }}>
        Direct pairwise editing for lab work. Not persisted — real relationship tables come later.
      </p>

      {!partner || !scores ? (
        <p style={{ margin: 0, opacity: 0.55, fontSize: 13 }}>
          Select a partner distinct from the primary character.
        </p>
      ) : (
        <>
          <div style={{ fontSize: 14, marginBottom: 12 }}>
            <strong>{primary.name}</strong>
            <span style={{ opacity: 0.5 }}> ↔ </span>
            <strong>{partner.name}</strong>
          </div>
          {RELATIONSHIP_AXES.map((axis) => (
            <div key={axis.id} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span>
                  {axis.label}
                  <span style={{ opacity: 0.5 }}> — {axis.blurb}</span>
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{scores[axis.id]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={scores[axis.id]}
                onChange={(e) => onAxisChange(axis.id, Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          ))}
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
  const [relMap, setRelMap] = useState<Record<string, RelationshipScores>>({});
  const [compareBlend, setCompareBlend] = useState(true);
  const [flipSexPreview, setFlipSexPreview] = useState(false);

  useEffect(() => {
    setPrimary(cloneUnit(primaryId));
  }, [primaryId]);

  useEffect(() => {
    setPartner(partnerId === primaryId ? null : cloneUnit(partnerId));
  }, [partnerId, primaryId]);

  const pairKey = useMemo(() => {
    if (!partner || primaryId === partnerId) return null;
    return relationshipPairKey(primaryId, partnerId);
  }, [primaryId, partnerId, partner]);

  const pairScores = pairKey
    ? relMap[pairKey] ?? defaultRelationshipScores()
    : null;

  const ensurePair = () => {
    if (!pairKey) return;
    setRelMap((prev) =>
      prev[pairKey] ? prev : { ...prev, [pairKey]: defaultRelationshipScores() }
    );
  };

  useEffect(() => {
    if (pairKey) ensurePair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey]);

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
    const result = driftDurablePressures(primary, hours);
    setPrimary(result.unit);
    const mins = hours * 60;
    const label =
      mins < 1
        ? `${Math.round(mins * 60)} s`
        : mins < 60
          ? `${Math.round(mins)} min`
          : `${hours} h`;
    if (result.deltas.length === 0) {
      pushTaskLog(`${primary.name}: pass ${label} — meters & baselines settled.`);
      return;
    }
    const summary = result.deltas
      .map((d) => {
        const sign = d.delta >= 0 ? '+' : '';
        const bSign = d.baselineTo - d.baselineFrom >= 0 ? '+' : '';
        const bDelta = d.baselineTo - d.baselineFrom;
        return `${d.id} ${d.from.toFixed(0)}→${d.to.toFixed(0)} (${sign}${d.delta.toFixed(1)}; bl ${d.baselineFrom.toFixed(0)}→${d.baselineTo.toFixed(0)} ${bSign}${bDelta.toFixed(1)}, anc ${d.anchor.toFixed(0)})`;
      })
      .join(' · ');
    pushTaskLog(`${primary.name}: pass ${label} — ${summary}`);
  };

  const onRunTask = () => {
    if (!primary) return;
    const task =
      SOCIAL_TASK_TEMPLATES.find((t) => t.id === taskId) ?? SOCIAL_TASK_TEMPLATES[0];
    const names = partner
      ? `${primary.name} + ${partner.name}`
      : primary.name;
    pushTaskLog(
      `Stub: “${task.label}” with ${names}. Effects TBD (${task.stubEffects.join(', ')}).`
    );
    // Tiny lab feedback: shared work nudges affinity if a pair exists
    if (pairKey && partner) {
      setRelMap((prev) => {
        const cur = prev[pairKey] ?? defaultRelationshipScores();
        const affinity = Math.min(100, cur.affinity + 2);
        return { ...prev, [pairKey]: { ...cur, affinity } };
      });
      pushTaskLog(`Dev nudge: ${primary.name}↔${partner.name} affinity +2.`);
    }
  };

  const onAxisChange = (axis: keyof RelationshipScores, value: number) => {
    if (!pairKey) return;
    setRelMap((prev) => {
      const cur = prev[pairKey] ?? defaultRelationshipScores();
      return { ...prev, [pairKey]: { ...cur, [axis]: value } };
    });
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
              scores={pairScores}
              onAxisChange={onAxisChange}
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
