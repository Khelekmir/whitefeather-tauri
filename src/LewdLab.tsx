import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDetailedCharacter,
  listDetailedCharacters,
} from './data/detailedPlaceholderCharacters';
import { filterLewdAdults } from './data/social/castAdult';
import { buildCastRelationshipGraph } from './data/social/castRelationshipSeeds';
import type {
  LongTermRelationshipId,
  ShortTermRelationshipId,
} from './data/social/relationships';
import { intimacyBudgetFromBond, bondFromEdge } from './utils/lewd/intimacyBond';
import {
  ensureBidirectional,
  getEdge,
  intimateEncounterAllowed,
  orientationResistance01,
  setLongTerm,
  setShortTerm,
  sexualDesireAllowed,
  sexualDesireSoftCap,
  sexualPairingHardBlocked,
  type RelationshipGraph,
} from './utils/social/relationshipState';
import { hydrateItemizedLewd } from './utils/lewd/hydrateItemizedLewd';
import { requiredArousalForAct } from './utils/lewd/arousalGate';
import {
  createEncounterArousalState,
  idleEncounterArousal,
  type EncounterArousalState,
} from './utils/lewd/encounterArousal';
import { arousalSoftCapForErogenous, erogenousRank } from './utils/lewd/erogenous';
import {
  attentionLimbForActorPart,
  totalAttentionCost,
  type LewdChannel,
} from './utils/lewd/lewdChannels';
import {
  actionsForActorPart,
  getLewdAction,
  getLewdBit,
  listActorParts,
  validTargetsForAction,
} from './utils/lewd/lewdCatalogAccess';
import { LEWD_TUNING } from './utils/lewd/lewdTuning';
import { bodilyStateFromHormones } from './utils/lewd/cycleBodilyState';
import {
  advanceReproduction,
  describeReproduction,
} from './utils/lewd/conception';
import {
  advanceFluidSoil,
  deriveSoilCues,
  launderUnderwear,
} from './utils/lewd/fluidSoil';
import { advanceStandingLust } from './utils/lewd/lustDrive';
import {
  advanceFemalePhysiology,
  calcHormones,
  cycleLustTarget,
  formatCycleLabel,
  hormonesForUnit,
  isInFertileWindow,
  wrapCycleHour,
} from './utils/lewd/ovulationCycle';
import { resolveLewdChannels } from './utils/lewd/resolveLewdMove';
import type { Unit as DetailedUnit } from './types/characters';

const MAX_LAB_CHANNELS = LEWD_TUNING.channels.labVisibleChannels;

function defaultChannel(): LewdChannel {
  return {
    actorPart: 'handFinger',
    actionId: 'fingerStroke',
    targetPart: 'lips',
    intensity: 5,
  };
}

const DEFAULT_PROACTIVE = 'unit_sain';
const DEFAULT_RECIPIENT = 'unit_amberyl';

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '28px 32px 48px',
  fontFamily: 'system-ui, sans-serif',
  background: 'linear-gradient(180deg, #1a0814 0%, #120810 45%, #0a060c 100%)',
  color: '#f8eef4',
  boxSizing: 'border-box',
};

const navBtn: CSSProperties = {
  padding: '8px 14px',
  background: '#3a1a2e',
  color: '#fff',
  border: '1px solid #7a3d5c',
  borderRadius: 6,
  cursor: 'pointer',
};

const cardStyle: CSSProperties = {
  border: '1px solid rgba(244, 114, 182, 0.3)',
  borderRadius: 14,
  padding: 18,
  background:
    'linear-gradient(180deg, rgba(42, 16, 32, 0.95) 0%, rgba(18, 10, 16, 0.98) 100%)',
  boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
};

const selectStyle: CSSProperties = {
  background: '#1a1218',
  color: '#f8eef4',
  border: '1px solid rgba(244, 114, 182, 0.4)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 14,
  width: '100%',
};

const smallBtn: CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid rgba(244, 114, 182, 0.35)',
  background: 'rgba(244, 114, 182, 0.12)',
  color: '#f8eef4',
  cursor: 'pointer',
};

const performBtnBase: CSSProperties = {
  ...smallBtn,
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 650,
  background: 'rgba(244, 114, 182, 0.25)',
  borderColor: 'rgba(244, 114, 182, 0.55)',
};

function cloneHydrated(id: string): DetailedUnit | null {
  const base = getDetailedCharacter(id);
  if (!base) return null;
  return hydrateItemizedLewd(structuredClone(base) as DetailedUnit);
}

function Meter({
  label,
  value,
  max = 10,
  color,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          marginBottom: 3,
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value.toFixed(2)} / {max}
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
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  );
}

function LewdLab() {
  const navigate = useNavigate();
  const cast = filterLewdAdults(listDetailedCharacters());

  const [proactiveId, setProactiveId] = useState(DEFAULT_PROACTIVE);
  const [recipientId, setRecipientId] = useState(DEFAULT_RECIPIENT);
  const [proactive, setProactive] = useState<DetailedUnit | null>(() =>
    cloneHydrated(DEFAULT_PROACTIVE)
  );
  const [recipient, setRecipient] = useState<DetailedUnit | null>(() =>
    cloneHydrated(DEFAULT_RECIPIENT)
  );

  const [channels, setChannels] = useState<LewdChannel[]>(() => [defaultChannel()]);
  const [holdSeconds, setHoldSeconds] = useState<number>(LEWD_TUNING.defaultHoldSeconds);

  const [encounter, setEncounter] = useState<EncounterArousalState>(() =>
    createEncounterArousalState()
  );
  const [proactiveEncounter, setProactiveEncounter] =
    useState<EncounterArousalState>(() => createEncounterArousalState());
  const [relGraph, setRelGraph] = useState<RelationshipGraph>(() =>
    buildCastRelationshipGraph(listDetailedCharacters())
  );
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    setProactive(cloneHydrated(proactiveId));
    setProactiveEncounter(createEncounterArousalState());
  }, [proactiveId]);

  useEffect(() => {
    const next = cloneHydrated(recipientId);
    setRecipient(next);
    setEncounter(createEncounterArousalState());
  }, [recipientId]);

  useEffect(() => {
    if (!proactive || !recipient || proactive.id === recipient.id) return;
    setRelGraph((prev) => ensureBidirectional(prev, proactive, recipient));
  }, [proactive, recipient]);

  // Keep each channel's action/target valid when parts or sex change.
  useEffect(() => {
    if (!proactive || !recipient) return;
    setChannels((prev) =>
      prev.map((ch) => {
        const acts = actionsForActorPart(proactive.sex, ch.actorPart);
        const actionId = acts.includes(ch.actionId) ? ch.actionId : acts[0] ?? ch.actionId;
        const targs = validTargetsForAction(actionId, recipient.sex);
        const targetPart = targs.includes(ch.targetPart)
          ? ch.targetPart
          : targs[0] ?? ch.targetPart;
        return { ...ch, actionId, targetPart };
      })
    );
  }, [proactive, recipient]);

  const pairingBlocked =
    proactive && recipient
      ? sexualPairingHardBlocked(proactive, recipient)
      : true;
  const encounterOk =
    proactive && recipient
      ? intimateEncounterAllowed(proactive, recipient)
      : false;
  const nativeDesireOk =
    proactive && recipient ? sexualDesireAllowed(proactive, recipient) : false;

  const attentionCost = totalAttentionCost(channels);
  const actorParts = proactive ? listActorParts(proactive.sex) : [];

  /** How the recipient feels about the proactive partner (gates intimacy). */
  const recipientToProactive =
    proactive && recipient
      ? getEdge(relGraph, recipient.id, proactive.id)
      : null;
  const bond = bondFromEdge(recipientToProactive);
  const recipientOrientResist =
    proactive && recipient
      ? orientationResistance01(recipient, proactive, recipientToProactive)
      : 0;
  const desireSoftCap =
    proactive && recipient
      ? sexualDesireSoftCap(recipient, proactive, recipientToProactive)
      : 0;
  const bondBudget = intimacyBudgetFromBond(bond, recipientOrientResist);

  const pushLog = (line: string) => {
    const stamped = `[${new Date().toLocaleTimeString()}] ${line}`;
    setLog((prev) => [stamped, ...prev].slice(0, 50));
  };

  const applyBondPreset = (kind: 'cold' | 'warm' | 'lovers') => {
    if (!proactive || !recipient) return;
    setRelGraph((prev) => {
      let g = ensureBidirectional(prev, proactive, recipient);
      const presets = {
        cold: {
          trust: 25,
          affection: 20,
          desire: 5,
          familiarity: 10,
          respect: 40,
          warmth: 0,
          desireHeat: 0,
          hurt: 0,
          suspicion: 15,
        },
        warm: {
          trust: 70,
          affection: 72,
          desire: 35,
          familiarity: 55,
          respect: 65,
          warmth: 40,
          desireHeat: 20,
          hurt: 0,
          suspicion: 0,
        },
        lovers: {
          trust: 88,
          affection: 90,
          desire: 75,
          familiarity: 80,
          respect: 78,
          warmth: 55,
          desireHeat: 45,
          hurt: 0,
          suspicion: 0,
        },
      } as const;
      const p = presets[kind];
      const ltVals: [LongTermRelationshipId, number][] = [
        ['trust', p.trust],
        ['affection', p.affection],
        ['desire', p.desire],
        ['familiarity', p.familiarity],
        ['respect', p.respect],
      ];
      for (const [id, val] of ltVals) {
        g = setLongTerm(g, recipient, proactive, id, val);
        const mirror = Math.round(val * 0.9);
        // soft-cap applies inside setLongTerm for desire
        g = setLongTerm(g, proactive, recipient, id, mirror);
      }
      const stVals: [ShortTermRelationshipId, number][] = [
        ['warmth', p.warmth],
        ['desireHeat', p.desireHeat],
        ['hurt', p.hurt],
        ['suspicion', p.suspicion],
      ];
      for (const [id, val] of stVals) {
        g = setShortTerm(g, recipient, proactive, id, val);
        g = setShortTerm(g, proactive, recipient, id, Math.round(val * 0.85));
      }
      return g;
    });
    pushLog(`Bond preset “${kind}” applied (${recipient.name}→${proactive.name}).`);
  };

  const updateChannel = (index: number, patch: Partial<LewdChannel>) => {
    setChannels((prev) =>
      prev.map((ch, i) => {
        if (i !== index) return ch;
        const next = { ...ch, ...patch };
        if (!proactive || !recipient) return next;
        if (patch.actorPart) {
          const acts = actionsForActorPart(proactive.sex, next.actorPart);
          next.actionId = acts.includes(next.actionId) ? next.actionId : acts[0] ?? next.actionId;
        }
        if (patch.actorPart || patch.actionId) {
          const targs = validTargetsForAction(next.actionId, recipient.sex);
          next.targetPart = targs.includes(next.targetPart)
            ? next.targetPart
            : targs[0] ?? next.targetPart;
        }
        return next;
      })
    );
  };

  const addChannel = () => {
    if (channels.length >= MAX_LAB_CHANNELS) return;
    setChannels((prev) => [
      ...prev,
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'neckSide',
        intensity: 4,
      },
    ]);
  };

  const removeChannel = (index: number) => {
    if (channels.length <= 1) return;
    setChannels((prev) => prev.filter((_, i) => i !== index));
  };

  const onPerform = () => {
    if (!proactive || !recipient) return;
    if (!encounterOk) {
      pushLog('Blocked — M→M erotic content is design-gated.');
      return;
    }
    try {
      const result = resolveLewdChannels({
        proactive,
        recipient,
        channels,
        holdSeconds,
        encounter,
        proactiveEncounter,
        relationships: relGraph,
      });
      setEncounter(result.encounter);
      setProactiveEncounter(result.proactiveEncounter);
      setRecipient(result.recipientAfterSoil);
      const resistNote =
        recipientOrientResist > 0.05
          ? ` · orientResist ${recipientOrientResist.toFixed(2)} (soft F→F)`
          : '';
      const pushNote =
        result.pushReadiness !== 'ok'
          ? ` · push ${result.pushReadiness} (needA ${result.pushRequiredArousal.toFixed(0)} will ${result.pushWillingness.toFixed(2)})`
          : '';
      const climaxNote = [
        result.climaxed ? `recv climax #${result.encounter.climaxCount}` : '',
        result.proactiveClimaxed
          ? `pro climax #${result.proactiveEncounter.climaxCount}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const fluidNote = result.discharges
        .map((d) => `${d.kind}@${d.volume.toFixed(2)}${d.site ? `@${d.site}` : ''}`)
        .join(', ');
      const bodyNote = result.ambientLubrication
        ? ` · wet ${result.fertileCrest01.toFixed(2)} crest${result.bodilyBlurb ? ` — ${result.bodilyBlurb}` : ''}`
        : result.fertileCrest01 > 0.2
          ? ` · crest ${result.fertileCrest01.toFixed(2)}`
          : '';
      const conceptionNote = result.conceptionNote
        ? ` · ${result.conceptionNote}`
        : ` · repro ${describeReproduction(result.recipientAfterSoil)}`;
      pushLog(
        `${result.band.toUpperCase()}: ${result.summary} · n=${channels.length} attn ${result.attentionCost.toFixed(1)}${result.synergy ? ' synergy' : ''} · bondBudget ${bondBudget.toFixed(0)} needA ${result.arousalRequired.toFixed(0)} (eff ${result.arousalEffectiveForGate.toFixed(0)}${result.afterglowGateCredit > 0.5 ? ` incl +${result.afterglowGateCredit.toFixed(0)} afterglow` : ''}) needInt ${result.intimacyRequired.toFixed(0)} · psych ${result.psychQuality.toFixed(2)} physio ${result.physioQuality.toFixed(2)} · recv A ${result.encounter.arousal.toFixed(0)} E ${result.encounter.edge.toFixed(0)} · pro A ${result.proactiveEncounter.arousal.toFixed(0)} E ${result.proactiveEncounter.edge.toFixed(0)} · ${result.bandLabel}${resistNote}${pushNote}${climaxNote ? ` · ${climaxNote}` : ''}${fluidNote ? ` · fluid ${fluidNote}` : ''}${bodyNote}${conceptionNote}`
      );
    } catch (e) {
      pushLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onIdle = (seconds: number) => {
    const nextRecv = idleEncounterArousal(encounter, seconds);
    const nextPro = idleEncounterArousal(proactiveEncounter, seconds);
    setEncounter(nextRecv);
    setProactiveEncounter(nextPro);
    // High encounter arousal can leave a panty wet spot without foreplay.
    if (recipient?.sex === 'F') {
      const hours = seconds / 3600;
      // Scale lab seconds into a readable drip (idle 15s ≈ a few in-world minutes).
      const dripHours = Math.max(hours, seconds / 60);
      const dripped = advanceFluidSoil(recipient, dripHours, {
        encounterArousal: nextRecv.arousal,
      });
      setRecipient(dripped);
      const cues = deriveSoilCues(dripped);
      pushLog(
        `Idle ${seconds}s — recv A ${encounter.arousal.toFixed(0)}→${nextRecv.arousal.toFixed(0)} E ${encounter.edge.toFixed(0)}→${nextRecv.edge.toFixed(0)} · pro A ${proactiveEncounter.arousal.toFixed(0)}→${nextPro.arousal.toFixed(0)} E ${proactiveEncounter.edge.toFixed(0)}→${nextPro.edge.toFixed(0)} · soil ${cues.summary}`
      );
    } else {
      pushLog(
        `Idle ${seconds}s — recv A ${encounter.arousal.toFixed(0)}→${nextRecv.arousal.toFixed(0)} E ${encounter.edge.toFixed(0)}→${nextRecv.edge.toFixed(0)} · pro A ${proactiveEncounter.arousal.toFixed(0)}→${nextPro.arousal.toFixed(0)} E ${proactiveEncounter.edge.toFixed(0)}→${nextPro.edge.toFixed(0)}`
      );
    }
  };

  const onResetArousal = () => {
    setEncounter(createEncounterArousalState());
    setProactiveEncounter(createEncounterArousalState());
    pushLog('Encounter meters reset (recipient + proactive).');
  };

  const performDisabled = !encounterOk || channels.length < 1;
  const performButton = (opts?: { compact?: boolean }) => (
    <button
      type="button"
      onClick={onPerform}
      disabled={performDisabled}
      style={{
        ...performBtnBase,
        opacity: performDisabled ? 0.45 : 1,
        width: opts?.compact ? undefined : '100%',
      }}
    >
      Perform ({channels.length} channel{channels.length === 1 ? '' : 's'})
    </button>
  );

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate('/')} style={navBtn}>
          ← Title
        </button>
        <button type="button" onClick={() => navigate('/social')} style={navBtn}>
          Social Hall
        </button>
        <button type="button" onClick={() => navigate('/playground')} style={navBtn}>
          Playground
        </button>
      </div>

      <header style={{ marginBottom: 22, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: 1 }}>Lewd Lab</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.7, fontSize: 14 }}>
          Encounter sandbox — player drives the proactive partner. Wrong intensity / region /
          intimacy should be able to spoil the beat.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          maxWidth: 1100,
          margin: '0 auto 16px',
        }}
        className="lewd-lab-layout"
      >
        <section style={cardStyle}>
          <h2 style={{ margin: '0 0 10px', fontSize: '1.1rem', color: '#f9a8d4' }}>
            Pairing
          </h2>
          <label style={{ fontSize: 12, opacity: 0.75, display: 'block', marginBottom: 10 }}>
            Proactive (player-driven)
            <select
              value={proactiveId}
              onChange={(e) => setProactiveId(e.target.value)}
              style={{ ...selectStyle, marginTop: 4 }}
            >
              {cast.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.sex})
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, opacity: 0.75, display: 'block', marginBottom: 10 }}>
            Recipient
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              style={{ ...selectStyle, marginTop: 4 }}
            >
              {cast.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.sex})
                </option>
              ))}
            </select>
          </label>
          {pairingBlocked ? (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#fda4af' }}>
              M→M erotic content is design-gated (hard block).
            </p>
          ) : !nativeDesireOk ? (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#fcd34d' }}>
              Soft F→F path — not native attraction yet. Desire capped at{' '}
              {desireSoftCap}
              {recipientOrientResist > 0.05
                ? ` · psych resist ${recipientOrientResist.toFixed(2)}`
                : ' · closeness already eased psych resistance'}
              . Skinship can keep chipping; Whitefeather / attractedToGirls opens fully.
            </p>
          ) : (
            <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.6 }}>
              Desire open · recipient lust{' '}
              {Math.round(recipient?.lewdStats.dynamic.lust ?? 0)} · libido{' '}
              {recipient?.lewdStats.static.libido}
              {recipient?.lewdStats.static.whitewing ? ' · Whitewing' : ''}
              {recipient?.lewdStats.static.whitefeather ? ' · Whitefeather' : ''}
            </p>
          )}

          <h3 style={{ margin: '0 0 6px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
            RECIPIENT → PROACTIVE BOND
          </h3>
          <p style={{ margin: '0 0 8px', fontSize: 11, opacity: 0.55 }}>
            {recipient?.name}→{proactive?.name}: trust {bond.trust} · affection {bond.affection} ·
            desire {bond.desire} · warmth {bond.warmth} · heat {bond.desireHeat} · budget{' '}
            <strong>{bondBudget.toFixed(0)}</strong>
            {recipientOrientResist > 0.05
              ? ` · resist ${recipientOrientResist.toFixed(2)}`
              : ''}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            <button type="button" style={smallBtn} onClick={() => applyBondPreset('cold')}>
              Cold
            </button>
            <button type="button" style={smallBtn} onClick={() => applyBondPreset('warm')}>
              Warm
            </button>
            <button type="button" style={smallBtn} onClick={() => applyBondPreset('lovers')}>
              Lovers
            </button>
          </div>
          {recipientToProactive && recipient && proactive ? (
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              {(
                [
                  ['trust', 'Trust'],
                  ['affection', 'Affection'],
                  ['desire', 'Desire'],
                ] as const
              ).map(([id, label]) => (
                <label
                  key={id}
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  {label} {Math.round(recipientToProactive.longTerm[id])}
                  <input
                    type="range"
                    min={0}
                    max={id === 'desire' ? Math.max(1, desireSoftCap) : 100}
                    value={recipientToProactive.longTerm[id]}
                    disabled={id === 'desire' && desireSoftCap <= 0}
                    onChange={(e) =>
                      setRelGraph((prev) =>
                        setLongTerm(
                          prev,
                          recipient,
                          proactive,
                          id,
                          Number(e.target.value)
                        )
                      )
                    }
                    style={{ width: '100%', display: 'block' }}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: '0 0 10px', fontSize: '1.1rem', color: '#f9a8d4' }}>
            Encounter meters
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              marginBottom: 12,
            }}
            className="lewd-meters-split"
          >
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.7, letterSpacing: 0.4 }}>
                RECIPIENT · {recipient?.name ?? '—'}
              </h3>
              <Meter label="Arousal" value={encounter.arousal} max={100} color="#f472b6" />
              <Meter label="Edge" value={encounter.edge} max={100} color="#fb7185" />
              <Meter
                label="Discomfort"
                value={encounter.discomfort}
                max={100}
                color="#fbbf24"
              />
              <div style={{ fontSize: 11, opacity: 0.65 }}>
                Climaxes {encounter.climaxCount} · recv ×{encounter.receptivity.toFixed(2)}
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.7, letterSpacing: 0.4 }}>
                PROACTIVE · {proactive?.name ?? '—'}
              </h3>
              <Meter
                label="Arousal"
                value={proactiveEncounter.arousal}
                max={100}
                color="#c084fc"
              />
              <Meter
                label="Edge"
                value={proactiveEncounter.edge}
                max={100}
                color="#a78bfa"
              />
              <Meter
                label="Discomfort"
                value={proactiveEncounter.discomfort}
                max={100}
                color="#fbbf24"
              />
              <div style={{ fontSize: 11, opacity: 0.65 }}>
                Climaxes {proactiveEncounter.climaxCount} · recv ×
                {proactiveEncounter.receptivity.toFixed(2)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 10 }}>
            Proactive orgasm / semen discharge stubs feed impregnation later. Cold push (low
            desire/arousal) soft-gates deep acts for both sides.
          </div>
          <div style={{ marginBottom: 10 }}>{performButton()}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" style={smallBtn} onClick={() => onIdle(5)}>
              Idle 5s
            </button>
            <button type="button" style={smallBtn} onClick={() => onIdle(15)}>
              Idle 15s
            </button>
            <button type="button" style={smallBtn} onClick={onResetArousal}>
              Reset both
            </button>
          </div>

          {recipient?.sex === 'F' ? (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(244,114,182,0.2)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.7, letterSpacing: 0.4 }}>
                RECIPIENT CYCLE
              </h3>
              {(() => {
                const h = hormonesForUnit(recipient);
                if (!h) return null;
                const len = recipient.lewdStats.static.ovulationCycleLength;
                const fertile = isInFertileWindow(h, len);
                const lustT = cycleLustTarget(recipient.lewdStats.static.libido, h);
                const body = bodilyStateFromHormones(h, len);
                return (
                  <>
                    <p style={{ margin: '0 0 6px', fontSize: 12, opacity: 0.75 }}>
                      {formatCycleLabel(h, len)}
                      {fertile ? ' · fertile' : ''} · crest{' '}
                      {(body.fertileCrest01 * 100).toFixed(0)}% · lust→{lustT.toFixed(0)}
                    </p>
                    <p style={{ margin: '0 0 8px', fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>
                      Mucus <strong>{body.mucusKind}</strong> · wetness{' '}
                      {(body.wetness01 * 100).toFixed(0)}% · genital sens ×
                      {body.genitalSensMult.toFixed(2)}
                      <br />
                      <span style={{ opacity: 0.85 }}>{body.blurb}</span>
                    </p>
                    <Meter
                      label="Wetness"
                      value={body.wetness01 * 100}
                      max={100}
                      color="#67e8f9"
                    />
                    <p style={{ margin: '0 0 8px', fontSize: 11, opacity: 0.55 }}>
                      E {h.estrogen.toFixed(1)} · T {h.testosterone.toFixed(2)} · P{' '}
                      {h.progesterone.toFixed(1)}
                    </p>
                    {(() => {
                      const cues = deriveSoilCues(recipient);
                      const w = cues.wetness;
                      return (
                        <div style={{ margin: '0 0 8px', fontSize: 11, color: '#fcd34d' }}>
                          <div>
                            Cloth · {cues.summary}
                            {cues.wantsBath ? ' · bathe?' : ''}
                          </div>
                          {w.size !== 'none' ? (
                            <div style={{ marginTop: 4, opacity: 0.9, lineHeight: 1.4, color: '#f9a8d4' }}>
                              <strong>
                                {w.size}
                              </strong>
                              {' · '}
                              {w.contents === 'arousalOnly'
                                ? 'feminine arousal only'
                                : w.contents === 'mixed'
                                  ? 'semen + feminine arousal'
                                  : w.contents === 'semenDominant'
                                    ? 'semen-dominant'
                                    : w.contents}
                              {' · '}
                              {w.freshness}
                              <br />
                              <span style={{ opacity: 0.85 }}>{w.flavor}</span>
                            </div>
                          ) : null}
                          <div style={{ marginTop: 6, fontSize: 11, color: '#c4b5fd' }}>
                            Repro · {describeReproduction(recipient)}
                          </div>
                        </div>
                      );
                    })()}
                    <label style={{ fontSize: 11, opacity: 0.65, display: 'block', marginBottom: 8 }}>
                      Cycle day {Math.floor(h.day) + 1}
                      <input
                        type="range"
                        min={0}
                        max={Math.max(1, len * 24 - 1)}
                        value={Math.round(h.hour)}
                        onChange={(e) => {
                          const hour = Number(e.target.value);
                          const prevHour =
                            recipient.lewdStats.dynamic.ovulationCycleCurrent ?? 0;
                          const wrapped = wrapCycleHour(hour, len);
                          const nextH = calcHormones(wrapped, len);
                          let nextUnit = {
                            ...recipient,
                            lewdStats: {
                              ...recipient.lewdStats,
                              dynamic: {
                                ...recipient.lewdStats.dynamic,
                                ovulationCycleCurrent: wrapped,
                                lust: cycleLustTarget(
                                  recipient.lewdStats.static.libido,
                                  nextH
                                ),
                              },
                            },
                          };
                          // Scrubbing across ovulation release still spawns an ovum.
                          const deltaHrs = Math.max(
                            0.01,
                            Math.abs(wrapped - prevHour)
                          );
                          nextUnit = advanceReproduction(nextUnit, deltaHrs, {
                            prevCycleHour: prevHour,
                          }).unit;
                          setRecipient(nextUnit);
                        }}
                        style={{ width: '100%', display: 'block', marginTop: 4 }}
                      />
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[1, 6, 24, 72].map((hrs) => (
                        <button
                          key={hrs}
                          type="button"
                          style={smallBtn}
                          onClick={() => {
                            const prevHour =
                              recipient.lewdStats.dynamic.ovulationCycleCurrent ?? 0;
                            const r = advanceFemalePhysiology(recipient, hrs);
                            const lusted = advanceStandingLust(r.unit, hrs);
                            const repro = advanceReproduction(lusted.unit, hrs, {
                              prevCycleHour: prevHour,
                            });
                            const soiled = advanceFluidSoil(repro.unit, hrs);
                            setRecipient(soiled);
                            const cues = deriveSoilCues(soiled);
                            const reproNote = [
                              repro.ovumSpawned ? 'ovum released' : '',
                              repro.conceived ? repro.conceptionNote : '',
                              describeReproduction(soiled),
                            ]
                              .filter(Boolean)
                              .join(' · ');
                            pushLog(
                              `Recipient +${hrs}h → ${r.hormones ? formatCycleLabel(r.hormones, len) : '?'} · lust ${lusted.lustFrom.toFixed(0)}→${lusted.lustTo.toFixed(0)} (→${lusted.lustTarget.toFixed(0)}) · soil ${cues.summary} · ${reproNote}`
                            );
                          }}
                        >
                          +{hrs}h cycle
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      <button
                        type="button"
                        style={smallBtn}
                        onClick={() => {
                          const cleaned = launderUnderwear(recipient);
                          setRecipient(cleaned);
                          const cues = deriveSoilCues(cleaned);
                          pushLog(
                            `${recipient.name} panties reset (laundry) → ${cues.summary}`
                          );
                        }}
                      >
                        Reset panties
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
        </section>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: 16,
          maxWidth: 1100,
          margin: '0 auto',
        }}
        className="lewd-lab-layout"
      >
        <section style={cardStyle}>
          <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#f9a8d4' }}>
            Channels (simultaneous)
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.6 }}>
            Up to {MAX_LAB_CHANNELS} concurrent loci (engine max {LEWD_TUNING.channels.maxChannels}).
            Attention {attentionCost.toFixed(1)} / {LEWD_TUNING.channels.attentionBudget}
            {attentionCost > LEWD_TUNING.channels.attentionBudget ? ' — over budget (taxed)' : ''}.
          </p>

          {channels.map((ch, index) => {
            const acts = proactive
              ? actionsForActorPart(proactive.sex, ch.actorPart)
              : [];
            const targs = recipient
              ? validTargetsForAction(ch.actionId, recipient.sex)
              : [];
            const bit = recipient ? getLewdBit(recipient.sex, ch.targetPart) : null;
            const prefs = recipient?.lewdStats.itemizedLewd[ch.targetPart];
            const ero = bit ? erogenousRank(bit.sensitivity) : 0;
            const limb = attentionLimbForActorPart(ch.actorPart);
            const actionDef = getLewdAction(ch.actionId);
            const needA =
              actionDef && bit
                ? requiredArousalForAct(actionDef.intimacy, bit.intimacy)
                : 0;
            return (
              <div
                key={`ch-${index}`}
                style={{
                  marginBottom: 14,
                  padding: '12px 12px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(244,114,182,0.22)',
                  background: 'rgba(0,0,0,0.22)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                    fontSize: 12,
                  }}
                >
                  <strong>
                    Channel {index + 1}{' '}
                    <span style={{ opacity: 0.55, fontWeight: 400 }}>({limb})</span>
                  </strong>
                  <button
                    type="button"
                    style={smallBtn}
                    disabled={channels.length <= 1}
                    onClick={() => removeChannel(index)}
                  >
                    Remove
                  </button>
                </div>
                <label style={{ fontSize: 11, opacity: 0.75, display: 'block', marginBottom: 8 }}>
                  Actor part
                  <select
                    value={ch.actorPart}
                    onChange={(e) => updateChannel(index, { actorPart: e.target.value })}
                    style={{ ...selectStyle, marginTop: 3 }}
                  >
                    {actorParts.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 11, opacity: 0.75, display: 'block', marginBottom: 8 }}>
                  Action
                  <select
                    value={ch.actionId}
                    onChange={(e) => updateChannel(index, { actionId: e.target.value })}
                    style={{ ...selectStyle, marginTop: 3 }}
                  >
                    {acts.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 11, opacity: 0.75, display: 'block', marginBottom: 8 }}>
                  Target
                  <select
                    value={ch.targetPart}
                    onChange={(e) => updateChannel(index, { targetPart: e.target.value })}
                    style={{ ...selectStyle, marginTop: 3 }}
                  >
                    {targs.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                {bit && prefs ? (
                  <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 8, lineHeight: 1.4 }}>
                    {bit.name} · prefInt {prefs.prefIntensity} · max {prefs.maxIntensity} · ero{' '}
                    {ero.toFixed(2)} · soft cap ~{arousalSoftCapForErogenous(ero).toFixed(0)} ·
                    needs arousal ≥{needA.toFixed(0)}
                    {encounter.arousal < needA ? (
                      <span style={{ color: '#fda4af' }}>
                        {' '}
                        (now {encounter.arousal.toFixed(0)} — unready)
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <label style={{ fontSize: 11, opacity: 0.75, display: 'block' }}>
                  Intensity {ch.intensity}
                  <input
                    type="range"
                    min={LEWD_TUNING.intensityMin}
                    max={LEWD_TUNING.intensityMax}
                    value={ch.intensity}
                    onChange={(e) =>
                      updateChannel(index, { intensity: Number(e.target.value) })
                    }
                    style={{ width: '100%', display: 'block', marginTop: 3 }}
                  />
                </label>
              </div>
            );
          })}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              style={smallBtn}
              disabled={channels.length >= MAX_LAB_CHANNELS}
              onClick={addChannel}
            >
              + Add channel
            </button>
            <button
              type="button"
              style={smallBtn}
              onClick={() =>
                setChannels([
                  {
                    actorPart: 'lips',
                    actionId: 'kissLips',
                    targetPart: 'neckSide',
                    intensity: 4,
                  },
                  {
                    actorPart: 'handPalm',
                    actionId: 'palmRub',
                    targetPart: 'hip',
                    intensity: 3,
                  },
                ])
              }
            >
              Preset: kiss + hip rub
            </button>
          </div>

          <label style={{ fontSize: 12, opacity: 0.75, display: 'block', marginBottom: 12 }}>
            Hold seconds {holdSeconds}
            <input
              type="range"
              min={1}
              max={20}
              value={holdSeconds}
              onChange={(e) => setHoldSeconds(Number(e.target.value))}
              style={{ width: '100%', display: 'block', marginTop: 4 }}
            />
          </label>

          {performButton({ compact: true })}
          <p style={{ margin: '10px 0 0', fontSize: 11, opacity: 0.5 }}>
            Psych soft-ORs across channels; Edge follows the strongest erogenous physio. Same Perform
            control also sits beside the meters above so you can watch A/E/D while clicking.
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: '0 0 10px', fontSize: '1.1rem', color: '#f9a8d4' }}>
            Encounter log
          </h2>
          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
              maxHeight: 520,
              overflowY: 'auto',
              lineHeight: 1.45,
              opacity: 0.9,
            }}
          >
            {log.length === 0 ? (
              <span style={{ opacity: 0.5 }}>No moves yet.</span>
            ) : (
              log.map((line, i) => (
                <div key={`${i}-${line.slice(0, 24)}`} style={{ marginBottom: 8 }}>
                  {line}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .lewd-lab-layout { grid-template-columns: 1fr !important; }
          .lewd-meters-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

export default LewdLab;
