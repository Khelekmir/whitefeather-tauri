import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDetailedCharacter,
  listDetailedCharacters,
} from './data/detailedPlaceholderCharacters';
import { getCombatCastInventory } from './data/starters/combatCastInventory';
import { filterLewdAdults } from './data/social/castAdult';
import { buildCastRelationshipGraph } from './data/social/castRelationshipSeeds';
import type { Item } from './types/items';
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
import { expandPreload } from './utils/lewd/expandPreload';
import {
  clothingBarrierForLewdTarget,
  resetGarmentDisplace,
  type ClothingAccessMode,
} from './utils/lewd/clothingAccess';
import {
  equipItem,
  listEquipped,
  listUnequippedOwned,
  unequipSlot,
  unequipSlots,
  UNDRESS_ORDER_BOTTOM,
  UNDRESS_ORDER_TORSO,
} from './utils/items/equipGear';
import {
  getLewdPreload,
  listLewdPreloads,
} from './data/lewd/lewdPreloads';
import type { Unit as DetailedUnit } from './types/characters';
import type { ItemSlot } from './types/items';

function cloneRecipientItems(unitId: string): Record<string, Item> {
  const kit = getCombatCastInventory(unitId);
  return kit ? structuredClone(kit.items) : {};
}

const MAX_LAB_CHANNELS = LEWD_TUNING.channels.labVisibleChannels;

function withTiming(
  ch: Omit<LewdChannel, 'durationSeconds' | 'remainingSeconds'> &
    Partial<Pick<LewdChannel, 'durationSeconds' | 'remainingSeconds'>>,
  defaultDuration: number = LEWD_TUNING.defaultHoldSeconds
): LewdChannel {
  const durationSeconds = Math.max(1, ch.durationSeconds ?? defaultDuration);
  const remainingSeconds =
    ch.remainingSeconds != null
      ? Math.max(0, ch.remainingSeconds)
      : durationSeconds;
  return { ...ch, durationSeconds, remainingSeconds };
}

function defaultChannel(
  defaultDuration: number = LEWD_TUNING.defaultHoldSeconds
): LewdChannel {
  return withTiming(
    {
      actorPart: 'handFinger',
      actionId: 'fingerStroke',
      targetPart: 'lips',
      intensity: 5,
      clothingAccess: 'over',
    },
    defaultDuration
  );
}

function channelLabel(ch: LewdChannel): string {
  return `${ch.actionId}→${ch.targetPart}`;
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

  const [defaultDuration, setDefaultDuration] = useState<number>(
    LEWD_TUNING.defaultHoldSeconds
  );
  const [channels, setChannels] = useState<LewdChannel[]>(() => [defaultChannel()]);
  const [stepPauseNote, setStepPauseNote] = useState<string | null>(null);
  const [isStepping, setIsStepping] = useState(false);
  /** Wall-clock ms per game-second while stepping (real-time playback). */
  const [stepPaceMs, setStepPaceMs] = useState(1000);
  const stepRunIdRef = useRef(0);
  const preloadList = listLewdPreloads();
  const [preloadId, setPreloadId] = useState(preloadList[0]?.id ?? 'give_shoulder_rub');
  const [preloadVariantId, setPreloadVariantId] = useState(
    preloadList[0]?.defaultVariant ?? 'firm'
  );
  const [itemsById, setItemsById] = useState<Record<string, Item>>(() =>
    cloneRecipientItems(DEFAULT_RECIPIENT)
  );

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
    setItemsById(cloneRecipientItems(recipientId));
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

  const syncRecipientGear = () => {
    if (!recipient) return;
    setRecipient({
      ...recipient,
      equipment: { ...recipient.equipment },
    });
    setItemsById({ ...itemsById });
  };

  const onUnequipSlot = (slot: ItemSlot) => {
    if (!recipient) return;
    const r = unequipSlot({ unit: recipient, itemsById }, slot);
    if (!r.ok) {
      pushLog(r.message);
      return;
    }
    syncRecipientGear();
    pushLog(`Unequipped ${r.item.name} (${slot}).`);
  };

  const onEquipOwned = (itemId: string) => {
    if (!recipient) return;
    const r = equipItem({ unit: recipient, itemsById }, itemId);
    if (!r.ok) {
      pushLog(r.message);
      return;
    }
    syncRecipientGear();
    const prev = r.previous ? ` (replaced ${r.previous.name})` : '';
    pushLog(`Equipped ${r.item.name} → ${r.item.equippedSlot}${prev}.`);
  };

  const onPeelOrder = (slots: ItemSlot[], label: string) => {
    if (!recipient) return;
    const { unequipped } = unequipSlots(
      { unit: recipient, itemsById },
      slots
    );
    syncRecipientGear();
    if (unequipped.length === 0) {
      pushLog(`Peel ${label}: nothing worn in those slots.`);
      return;
    }
    pushLog(
      `Peeled ${label}: ${unequipped.map((i) => i.name).join(', ')}.`
    );
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
      withTiming(
        {
          actorPart: 'lips',
          actionId: 'kissLips',
          targetPart: 'neckSide',
          intensity: 4,
        },
        defaultDuration
      ),
    ]);
    setStepPauseNote(null);
  };

  const removeChannel = (index: number) => {
    if (channels.length <= 1) return;
    setChannels((prev) => prev.filter((_, i) => i !== index));
    setStepPauseNote(null);
  };

  const stopStepping = () => {
    stepRunIdRef.current += 1;
    setIsStepping(false);
    setStepPauseNote('Playback stopped.');
    pushLog('Playback stopped by player.');
  };

  /**
   * Real-time playback: Play re-arms every channel to its duration, then each
   * game-second is resolved live. Channels that finish drop out; others keep
   * going. Click Play again to re-initiate the programmed acts.
   */
  const onPerform = () => {
    if (!proactive || !recipient) return;
    if (isStepping) return;
    if (!encounterOk) {
      pushLog('Blocked — M→M erotic content is design-gated.');
      return;
    }
    if (channels.length < 1) return;

    // Re-initiate: remaining = duration for every programmed channel.
    let localChannels = channels.map((ch) => {
      const durationSeconds = Math.max(1, ch.durationSeconds ?? defaultDuration);
      return { ...ch, durationSeconds, remainingSeconds: durationSeconds };
    });
    setChannels(localChannels);

    const runId = ++stepRunIdRef.current;
    setIsStepping(true);
    setStepPauseNote(`Playing out… (${localChannels.length} channel${localChannels.length === 1 ? '' : 's'})`);
    pushLog(
      `Begin playback (${stepPaceMs}ms / game-second) — ${localChannels
        .map((c) => `${channelLabel(c)} ${c.durationSeconds}s`)
        .join(', ')}`
    );

    let localEncounter = encounter;
    let localProEncounter = proactiveEncounter;
    let localRecipient = recipient;
    let localItems = itemsById;
    let steps = 0;
    const maxSteps = 120;

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    void (async () => {
      try {
        while (steps < maxSteps) {
          if (stepRunIdRef.current !== runId) return;

          const active = localChannels.filter((c) => (c.remainingSeconds ?? 0) > 0);
          if (active.length < 1) {
            const note = `Finished after ${steps}s — click Play to re-initiate.`;
            setStepPauseNote(note);
            pushLog(note);
            break;
          }

          const result = resolveLewdChannels({
            proactive,
            recipient: localRecipient,
            channels: active,
            holdSeconds: 1,
            encounter: localEncounter,
            proactiveEncounter: localProEncounter,
            relationships: relGraph,
            itemsById: localItems,
          });
          localEncounter = result.encounter;
          localProEncounter = result.proactiveEncounter;
          localRecipient = result.recipientAfterSoil;
          steps += 1;
          setItemsById({ ...localItems });

          const beforeRem = localChannels.map((c) => c.remainingSeconds ?? 0);
          localChannels = localChannels.map((c) => {
            const rem = c.remainingSeconds ?? 0;
            if (rem <= 0) return c;
            return { ...c, remainingSeconds: rem - 1 };
          });
          const expiredLabels = localChannels
            .map((c, i) =>
              beforeRem[i]! > 0 && (c.remainingSeconds ?? 0) <= 0
                ? channelLabel(c)
                : null
            )
            .filter((x): x is string => !!x);

          // Paint this game-second so meters / remaining tick live.
          setChannels(localChannels);
          setEncounter(localEncounter);
          setProactiveEncounter(localProEncounter);
          setRecipient(localRecipient);
          setStepPauseNote(
            `Playing t+${steps}s… ${active.map((c) => channelLabel(c)).join(' + ')}`
          );
          pushLog(
            `t+${steps}s: ${result.band.toUpperCase()} · A ${result.encounter.arousal.toFixed(0)} E ${result.encounter.edge.toFixed(0)} · rem ${localChannels
              .map((c) => `${c.actionId}:${c.remainingSeconds ?? 0}`)
              .join(' ')}`
          );
          if (expiredLabels.length > 0) {
            const still = localChannels.filter((c) => (c.remainingSeconds ?? 0) > 0);
            pushLog(
              `Ended: ${expiredLabels.join(', ')}${
                still.length
                  ? ` · continuing: ${still.map((c) => channelLabel(c)).join(', ')}`
                  : ''
              }`
            );
          }

          await delay(stepPaceMs);
          if (stepRunIdRef.current !== runId) return;
        }
      } catch (e) {
        pushLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
        setStepPauseNote('Playback aborted (error).');
      } finally {
        if (stepRunIdRef.current === runId) {
          setIsStepping(false);
        }
      }
    })();
  };

  /**
   * Play an authored preload: sequential phases rewrite channels when each
   * phase's duration elapses. Exclusive for the run (replaces lab channels).
   */
  const onPerformPreload = () => {
    if (!proactive || !recipient) return;
    if (isStepping) return;
    if (!encounterOk) {
      pushLog('Blocked — M→M erotic content is design-gated.');
      return;
    }

    const expanded = expandPreload(preloadId, preloadVariantId);
    if (!expanded || expanded.phases.length < 1) {
      pushLog(`Unknown preload: ${preloadId}`);
      return;
    }

    const savedChannels = channels.map((c) => ({ ...c }));
    let phaseIndex = 0;
    let localChannels = expanded.phases[0]!.channels.map((c) => ({ ...c }));
    setChannels(localChannels);

    const runId = ++stepRunIdRef.current;
    setIsStepping(true);
    const header = `Preload ${expanded.preloadId}/${expanded.variantId} (${expanded.totalSeconds}s, ${expanded.phases.length} phases)`;
    setStepPauseNote(`Playing preload… ${expanded.variantLabel}`);
    pushLog(`Begin ${header} — ${stepPaceMs}ms / game-second.`);
    pushLog(
      `Preload phase 1/${expanded.phases.length}: ${expanded.phases[0]!.label}`
    );

    let localEncounter = encounter;
    let localProEncounter = proactiveEncounter;
    let localRecipient = recipient;
    let localItems = itemsById;
    let steps = 0;
    const maxSteps = 180;

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    void (async () => {
      try {
        while (steps < maxSteps && phaseIndex < expanded.phases.length) {
          if (stepRunIdRef.current !== runId) return;

          const phase = expanded.phases[phaseIndex]!;
          const active = localChannels.filter((c) => (c.remainingSeconds ?? 0) > 0);
          if (active.length < 1) {
            phaseIndex += 1;
            if (phaseIndex >= expanded.phases.length) break;
            const nextPhase = expanded.phases[phaseIndex]!;
            localChannels = nextPhase.channels.map((c) => ({ ...c }));
            setChannels(localChannels);
            pushLog(
              `Preload phase ${phaseIndex + 1}/${expanded.phases.length}: ${nextPhase.label}`
            );
            continue;
          }

          const result = resolveLewdChannels({
            proactive,
            recipient: localRecipient,
            channels: active,
            holdSeconds: 1,
            encounter: localEncounter,
            proactiveEncounter: localProEncounter,
            relationships: relGraph,
            itemsById: localItems,
          });
          localEncounter = result.encounter;
          localProEncounter = result.proactiveEncounter;
          localRecipient = result.recipientAfterSoil;
          steps += 1;
          setItemsById({ ...localItems });

          localChannels = localChannels.map((c) => {
            const rem = c.remainingSeconds ?? 0;
            if (rem <= 0) return c;
            return { ...c, remainingSeconds: rem - 1 };
          });

          setChannels(localChannels);
          setEncounter(localEncounter);
          setProactiveEncounter(localProEncounter);
          setRecipient(localRecipient);
          setStepPauseNote(
            `Preload t+${steps}s · ${phase.label} (${phaseIndex + 1}/${expanded.phases.length}) · A ${result.encounter.arousal.toFixed(0)} E ${result.encounter.edge.toFixed(0)}`
          );
          if (steps === 1 || steps % 5 === 0 || result.climaxed || result.ruined) {
            pushLog(
              `t+${steps}s [${phase.label}]: ${result.band.toUpperCase()} · A ${result.encounter.arousal.toFixed(0)} E ${result.encounter.edge.toFixed(0)} · mind ${(result.encounter.discomfortPsych ?? 0).toFixed(0)}`
            );
          }

          const phaseDone = localChannels.every((c) => (c.remainingSeconds ?? 0) <= 0);
          if (phaseDone) {
            phaseIndex += 1;
            if (phaseIndex < expanded.phases.length) {
              const nextPhase = expanded.phases[phaseIndex]!;
              localChannels = nextPhase.channels.map((c) => ({ ...c }));
              setChannels(localChannels);
              pushLog(
                `Preload phase ${phaseIndex + 1}/${expanded.phases.length}: ${nextPhase.label}`
              );
            }
          }

          await delay(stepPaceMs);
          if (stepRunIdRef.current !== runId) return;
        }

        if (stepRunIdRef.current === runId) {
          const note = `Preload finished after ${steps}s — restored prior channels.`;
          setStepPauseNote(note);
          pushLog(note);
        }
      } catch (e) {
        pushLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
        setStepPauseNote('Preload aborted (error).');
      } finally {
        setChannels(savedChannels);
        if (stepRunIdRef.current === runId) {
          setIsStepping(false);
        } else {
          setStepPauseNote('Preload stopped — channels restored.');
          pushLog('Preload stopped — channels restored.');
        }
      }
    })();
  };

  const onIdle = (seconds: number) => {
    const nextRecv = idleEncounterArousal(encounter, seconds, recipient?.sex);
    const nextPro = idleEncounterArousal(
      proactiveEncounter,
      seconds,
      proactive?.sex
    );
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

  const performButton = (opts?: { compact?: boolean }) =>
    isStepping ? (
      <button
        type="button"
        onClick={stopStepping}
        style={{
          ...performBtnBase,
          width: opts?.compact ? undefined : '100%',
          background: 'rgba(251, 191, 36, 0.25)',
          borderColor: 'rgba(251, 191, 36, 0.55)',
        }}
      >
        Stop playback
      </button>
    ) : (
      <button
        type="button"
        onClick={onPerform}
        disabled={!encounterOk || channels.length < 1}
        style={{
          ...performBtnBase,
          opacity: !encounterOk || channels.length < 1 ? 0.45 : 1,
          width: opts?.compact ? undefined : '100%',
        }}
      >
        {`Play in real time (${channels.length} channel${channels.length === 1 ? '' : 's'})`}
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
                label="Body (phys)"
                value={encounter.discomfortPhys ?? encounter.discomfort}
                max={100}
                color="#fb923c"
              />
              <Meter
                label="Mind (psych)"
                value={encounter.discomfortPsych ?? encounter.discomfort}
                max={100}
                color="#fbbf24"
              />
              <div style={{ fontSize: 11, opacity: 0.65 }}>
                Climaxes {encounter.climaxCount} · recv ×{encounter.receptivity.toFixed(2)}
                {' · '}
                soft-block mind ≥{LEWD_TUNING.encounter.discomfortPsychSoftCap}
                {recipient?.sex === 'M' &&
                (encounter.refractorySecondsRemaining ?? 0) > 0
                  ? ` · refractory ${encounter.refractorySecondsRemaining.toFixed(0)}s`
                  : ''}
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
                label="Body (phys)"
                value={
                  proactiveEncounter.discomfortPhys ?? proactiveEncounter.discomfort
                }
                max={100}
                color="#fb923c"
              />
              <Meter
                label="Mind (psych)"
                value={
                  proactiveEncounter.discomfortPsych ?? proactiveEncounter.discomfort
                }
                max={100}
                color="#fbbf24"
              />
              <div style={{ fontSize: 11, opacity: 0.65 }}>
                Climaxes {proactiveEncounter.climaxCount} · recv ×
                {proactiveEncounter.receptivity.toFixed(2)}
                {proactive?.sex === 'M' &&
                (proactiveEncounter.refractorySecondsRemaining ?? 0) > 0
                  ? ` · refractory ${proactiveEncounter.refractorySecondsRemaining.toFixed(0)}s`
                  : ''}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 10 }}>
            Proactive orgasm / semen discharge stubs feed impregnation later. Male climax
            starts a refractory window (no new edge/orgasm). Cold push soft-gates deep acts.
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

      {recipient ? (
        <section
          style={{ ...cardStyle, maxWidth: 1100, margin: '0 auto 16px' }}
        >
          <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#f9a8d4' }}>
            Recipient gear · {recipient.name}
          </h2>
          <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.65, lineHeight: 1.4 }}>
            Shared equip/unequip API — peel layers so clothing barriers drop for
            skin/orifice acts. Unequipped pieces stay owned (re-equip anytime).
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              style={smallBtn}
              disabled={isStepping}
              onClick={() => onPeelOrder(UNDRESS_ORDER_TORSO, 'torso')}
            >
              Peel torso
            </button>
            <button
              type="button"
              style={smallBtn}
              disabled={isStepping}
              onClick={() => onPeelOrder(UNDRESS_ORDER_BOTTOM, 'bottom')}
            >
              Peel bottom
            </button>
            <button
              type="button"
              style={smallBtn}
              disabled={isStepping}
              onClick={() => {
                const bag = listUnequippedOwned({
                  unit: recipient,
                  itemsById,
                });
                if (bag.length === 0) {
                  pushLog('Nothing unequipped to re-equip.');
                  return;
                }
                let n = 0;
                for (const it of bag) {
                  const r = equipItem(
                    { unit: recipient, itemsById },
                    it.id
                  );
                  if (r.ok) n += 1;
                }
                syncRecipientGear();
                pushLog(`Re-equipped ${n} piece(s).`);
              }}
            >
              Re-equip all owned
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <div>
              <h3
                style={{
                  margin: '0 0 8px',
                  fontSize: 12,
                  opacity: 0.7,
                  letterSpacing: 0.4,
                }}
              >
                EQUIPPED
              </h3>
              {listEquipped({ unit: recipient, itemsById }).length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>Bare.</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {listEquipped({ unit: recipient, itemsById }).map(
                    ({ slot, item }) => (
                      <li
                        key={slot}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 6,
                          fontSize: 12,
                        }}
                      >
                        <span>
                          <span style={{ opacity: 0.55 }}>{slot}</span> ·{' '}
                          {item.name}
                          {item.garmentState &&
                          Object.values(item.garmentState.displace ?? {}).some(
                            Boolean
                          )
                            ? ' · displaced'
                            : ''}
                        </span>
                        <button
                          type="button"
                          style={{ ...smallBtn, padding: '3px 8px', fontSize: 11 }}
                          disabled={isStepping}
                          onClick={() => onUnequipSlot(slot)}
                        >
                          Unequip
                        </button>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
            <div>
              <h3
                style={{
                  margin: '0 0 8px',
                  fontSize: 12,
                  opacity: 0.7,
                  letterSpacing: 0.4,
                }}
              >
                OWNED · UNEQUIPPED
              </h3>
              {listUnequippedOwned({ unit: recipient, itemsById }).length ===
              0 ? (
                <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>
                  None (everything worn or discarded).
                </p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {listUnequippedOwned({ unit: recipient, itemsById }).map(
                    (item) => (
                      <li
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 6,
                          fontSize: 12,
                        }}
                      >
                        <span>
                          <span style={{ opacity: 0.55 }}>{item.slot}</span> ·{' '}
                          {item.name}
                        </span>
                        <button
                          type="button"
                          style={{ ...smallBtn, padding: '3px 8px', fontSize: 11 }}
                          disabled={isStepping}
                          onClick={() => onEquipOwned(item.id)}
                        >
                          Equip
                        </button>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

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
                ? requiredArousalForAct(
                    actionDef.intimacy,
                    bit.intimacy,
                    bit.sensitivity
                  )
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
                    {(ch.remainingSeconds ?? 0) <= 0 ? (
                      <span style={{ opacity: 0.55, fontWeight: 400 }}> · idle</span>
                    ) : (
                      <span style={{ opacity: 0.65, fontWeight: 400 }}>
                        {' '}
                        · {ch.remainingSeconds}s left
                      </span>
                    )}
                  </strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      style={smallBtn}
                      disabled={channels.length <= 1}
                      onClick={() => removeChannel(index)}
                    >
                      Remove
                    </button>
                  </div>
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
                <label style={{ fontSize: 11, opacity: 0.75, display: 'block', marginBottom: 8 }}>
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
                <label style={{ fontSize: 11, opacity: 0.75, display: 'block', marginBottom: 8 }}>
                  Clothing access
                  <select
                    value={ch.clothingAccess ?? 'over'}
                    onChange={(e) =>
                      updateChannel(index, {
                        clothingAccess: e.target.value as ClothingAccessMode,
                      })
                    }
                    style={{ ...selectStyle, marginTop: 3 }}
                  >
                    <option value="over">Over clothes</option>
                    <option value="under">Under outer layer</option>
                    <option value="displace">Displace / push aside</option>
                  </select>
                </label>
                {recipient ? (
                  <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 8, lineHeight: 1.4 }}>
                    {(() => {
                      const barrier = clothingBarrierForLewdTarget(
                        recipient,
                        itemsById,
                        ch.targetPart,
                        ch.clothingAccess ?? 'over',
                        { applyDisplace: false }
                      );
                      const act = getLewdAction(ch.actionId);
                      const tier = act?.access ?? 'clothOk';
                      const layers =
                        barrier.layers.length > 0
                          ? barrier.layers
                              .map(
                                (l) =>
                                  `${l.slot} ${(l.effectiveCov * 100).toFixed(0)}%`
                              )
                              .join(' + ')
                          : 'bare';
                      return `Access ${tier} · barrier soft ${(barrier.softBarrier01 * 100).toFixed(0)}%${
                        barrier.hardBlocked ? ' · HARD BLOCK' : ''
                      }${barrier.skinClear ? ' · skin clear' : ''} · ${layers}`;
                    })()}
                  </div>
                ) : null}
                <label style={{ fontSize: 11, opacity: 0.75, display: 'block' }}>
                  Duration {ch.durationSeconds ?? defaultDuration}s
                  <span style={{ opacity: 0.55 }}>
                    {' '}
                    · remaining {ch.remainingSeconds ?? 0}s
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={ch.durationSeconds ?? defaultDuration}
                    onChange={(e) => {
                      const durationSeconds = Number(e.target.value);
                      updateChannel(index, {
                        durationSeconds,
                        remainingSeconds: durationSeconds,
                      });
                      setStepPauseNote(null);
                    }}
                    style={{ width: '100%', display: 'block', marginTop: 3 }}
                  />
                </label>
              </div>
            );
          })}

          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(167,139,250,0.35)',
              background: 'rgba(76,29,149,0.18)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#ddd6fe' }}>
              Preload sequence
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>
              Scripted multi-locus playlist. Play replaces channels for the run, then restores
              your manual setup.
            </p>
            <label style={{ fontSize: 11, opacity: 0.75, display: 'block', marginBottom: 8 }}>
              Preload
              <select
                value={preloadId}
                disabled={isStepping}
                onChange={(e) => {
                  const id = e.target.value;
                  setPreloadId(id);
                  const def = getLewdPreload(id);
                  setPreloadVariantId(def?.defaultVariant ?? 'firm');
                }}
                style={{ ...selectStyle, marginTop: 3 }}
              >
                {preloadList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {(() => {
              const def = getLewdPreload(preloadId);
              if (!def) return null;
              const expanded = expandPreload(preloadId, preloadVariantId);
              return (
                <>
                  <p style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
                    {def.blurb}
                    {expanded
                      ? ` · ${expanded.phases.length} phases · ~${expanded.totalSeconds}s`
                      : ''}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {Object.entries(def.variants).map(([vid, v]) => {
                      const active = vid === preloadVariantId;
                      return (
                        <button
                          key={vid}
                          type="button"
                          disabled={isStepping}
                          onClick={() => setPreloadVariantId(vid)}
                          style={{
                            ...smallBtn,
                            borderColor: active
                              ? 'rgba(167,139,250,0.9)'
                              : 'rgba(167,139,250,0.25)',
                            background: active
                              ? 'rgba(167,139,250,0.25)'
                              : 'rgba(255,255,255,0.04)',
                          }}
                        >
                          {v.label} · int {v.intensity}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    style={{
                      ...smallBtn,
                      opacity: !encounterOk || isStepping ? 0.45 : 1,
                    }}
                    disabled={!encounterOk || isStepping}
                    onClick={onPerformPreload}
                  >
                    Play preload ({preloadVariantId})
                  </button>
                </>
              );
            })()}
          </div>

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
              onClick={() => {
                if (!recipient) return;
                const n = resetGarmentDisplace(recipient, itemsById);
                setItemsById({ ...itemsById });
                pushLog(
                  n > 0
                    ? `Reset garment displace on ${n} piece(s).`
                    : 'No garment displace to reset.'
                );
              }}
            >
              Reset clothing displace
            </button>
            <button
              type="button"
              style={smallBtn}
              onClick={() => {
                setChannels([
                  withTiming(
                    {
                      actorPart: 'lips',
                      actionId: 'kissLips',
                      targetPart: 'neckSide',
                      intensity: 4,
                      durationSeconds: 4,
                    },
                    4
                  ),
                  withTiming(
                    {
                      actorPart: 'handPalm',
                      actionId: 'palmRub',
                      targetPart: 'hip',
                      intensity: 3,
                      durationSeconds: 8,
                    },
                    8
                  ),
                ]);
                setStepPauseNote(null);
              }}
            >
              Preset: kiss 4s + hip 8s
            </button>
          </div>

          <label style={{ fontSize: 12, opacity: 0.75, display: 'block', marginBottom: 8 }}>
            Default duration for new channels {defaultDuration}s
            <input
              type="range"
              min={1}
              max={20}
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(Number(e.target.value))}
              style={{ width: '100%', display: 'block', marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12, opacity: 0.75, display: 'block', marginBottom: 12 }}>
            Playback pace {stepPaceMs}ms / game-second
            <input
              type="range"
              min={200}
              max={1500}
              step={100}
              value={stepPaceMs}
              disabled={isStepping}
              onChange={(e) => setStepPaceMs(Number(e.target.value))}
              style={{ width: '100%', display: 'block', marginTop: 4 }}
            />
          </label>

          {stepPauseNote ? (
            <p
              style={{
                margin: '0 0 10px',
                fontSize: 12,
                color: '#fcd34d',
                lineHeight: 1.4,
              }}
            >
              {stepPauseNote}
            </p>
          ) : null}

          {performButton({ compact: true })}
          <p style={{ margin: '10px 0 0', fontSize: 11, opacity: 0.5 }}>
            Play re-arms each channel to its duration and resolves one game-second at a time
            (live meters). Finished channels drop out; click Play again to re-initiate. Use
            Preload sequence for authored multi-locus scripts (e.g. shoulder rub).
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
