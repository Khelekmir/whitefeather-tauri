import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { MagicDirectionalQte } from './components/MagicDirectionalQte';
import { MagicDirectionalQteSequence } from './components/MagicDirectionalQteSequence';
import { DETAILED_PLACEHOLDER_CHARACTERS } from './data/detailedPlaceholderCharacters';
import { INK_GRADES, type InkGradeId } from './data/combat/magicInk';
import {
  MAGIC_SCHOOL_IDS,
  SPELL_DEFS,
  SPELL_IDS,
  formatMagicSchoolLabel,
  formatSpellLabel,
  qteBeatCount,
  spellEffectiveMt,
  spellsInSchool,
  tomeTemplateIdForSpell,
  type MagicSchoolId,
  type SpellId,
} from './data/combat/spellCatalog';
import {
  assertSpellQteFormulasValid,
  formatSpellQtePattern,
} from './data/combat/spellQteFormulas';
import { COMBAT_TUNING } from './utils/combat/combatTuning';
import {
  calcMagicCompetence,
  magicSequencePowerMultiplier,
  scaleMagicDirectionalWindow,
} from './utils/combat/magicCompetence';
import {
  MAGIC_QTE_DIRECTIONS,
  magicQteGradeLabel,
  magicQteMissLabel,
  perfectEclipseMs,
  pickRandomMagicDirection,
  type MagicQteDirection,
  type MagicQteGradeResult,
  type MagicQteSequenceResult,
  type MagicQteSequenceSpec,
} from './utils/combat/magicDirectionalQte';
import {
  buildDecipheredSpellSequence,
  describeSpellReveal,
  formatSpellKnowledgeLabel,
  getSpellKnowledge,
  seedSpellKnowledgeFromSkills,
  setSpellDecipher01,
  setSpellUnlocked,
  spellRevealProgress,
} from './utils/combat/spellDecipher';
import { createItemFromTemplate } from './utils/items/createItemFromTemplate';
import type { Unit as DetailedUnit } from './types/characters';
import type { Item } from './types/items';

const card: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: '14px 16px',
};

const btn: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid rgba(196,181,253,0.45)',
  background: 'rgba(76, 29, 149, 0.55)',
  color: '#f5f3ff',
  cursor: 'pointer',
  fontSize: 13,
};

const CASTER_IDS = [
  'unit_erk',
  'unit_lucy',
  'unit_blackfang_shaman_m',
  'unit_blackfang_shaman_f',
] as const;

const CASTER_DEFAULT_SPELL: Record<(typeof CASTER_IDS)[number], SpellId> = {
  unit_erk: 'fire',
  unit_lucy: 'shine',
  unit_blackfang_shaman_m: 'flux',
  unit_blackfang_shaman_f: 'flux',
};

/** Starter lab spellbooks each caster already owns (practice experience). */
const CASTER_STARTER_TOMES: Record<(typeof CASTER_IDS)[number], SpellId[]> = {
  unit_erk: ['fire', 'thunder'],
  unit_lucy: ['lightning', 'shine'],
  unit_blackfang_shaman_m: ['flux', 'nosferatu'],
  unit_blackfang_shaman_f: ['flux', 'nosferatu'],
};

type LabInventory = {
  /** Owned tome instances (pages = durability). */
  tomes: Item[];
  equippedSpellId: SpellId | null;
  inkGradeId: InkGradeId;
};

function makeTome(spellId: SpellId, ownerId: string): Item {
  const pages = SPELL_DEFS[spellId].pages || 1;
  return createItemFromTemplate(tomeTemplateIdForSpell(spellId), {
    id: `lab_${ownerId}_${spellId}`,
    ownerId,
    equippedSlot: null,
    durability: pages,
  });
}

function buildStarterInventory(casterId: (typeof CASTER_IDS)[number]): LabInventory {
  const starter = CASTER_STARTER_TOMES[casterId];
  const equipped = CASTER_DEFAULT_SPELL[casterId];
  const tomes = starter.map((sid) => {
    const item = makeTome(sid, casterId);
    if (sid === equipped) item.equippedSlot = 'mainhand';
    return item;
  });
  return {
    tomes,
    equippedSpellId: equipped,
    inkGradeId: 'common',
  };
}

const FORMULA_ERRORS = assertSpellQteFormulasValid();

function buildLabCaster(id: (typeof CASTER_IDS)[number]): DetailedUnit {
  const base = DETAILED_PLACEHOLDER_CHARACTERS.find((c) => c.id === id)!;
  const cloned = structuredClone(base) as DetailedUnit;
  return seedSpellKnowledgeFromSkills(cloned, CASTER_STARTER_TOMES[id]);
}

function hashRough(a: string, b: string): number {
  let h = 0;
  const s = `${a}:${b}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * Lab harness for magical directional QTE practice / experience.
 * Spells are Locked until unlocked (tome / lab). Decipher 0–1 reveals
 * timing first (spin→eclipse), then true directions; unknown dirs are
 * random per cast but skill-readable via eclipse alignment.
 */
export default function MagicQteLab() {
  const T = COMBAT_TUNING.magicDirectionalQte;
  const MC = COMBAT_TUNING.magicCompetence;

  const [castersById, setCastersById] = useState<Record<string, DetailedUnit>>(
    () => {
      const init: Record<string, DetailedUnit> = {};
      for (const id of CASTER_IDS) init[id] = buildLabCaster(id);
      return init;
    }
  );

  const [casterId, setCasterId] = useState<string>(CASTER_IDS[2]);
  const [inventories, setInventories] = useState<Record<string, LabInventory>>(
    () => {
      const init: Record<string, LabInventory> = {};
      for (const id of CASTER_IDS) init[id] = buildStarterInventory(id);
      return init;
    }
  );
  const [practiceSpellId, setPracticeSpellId] = useState<SpellId>('flux');
  const [directionMode, setDirectionMode] = useState<'random' | MagicQteDirection>(
    'random'
  );
  const [activeSingle, setActiveSingle] = useState(false);
  const [activeSequence, setActiveSequence] = useState(false);
  const [liveSequenceSpec, setLiveSequenceSpec] =
    useState<MagicQteSequenceSpec | null>(null);
  const [required, setRequired] = useState<MagicQteDirection>('up');
  const [autoChain, setAutoChain] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState({ hit: 0, crit: 0, miss: 0 });

  const caster = castersById[casterId] ?? buildLabCaster(CASTER_IDS[2]);
  const inventory = inventories[casterId] ?? buildStarterInventory(CASTER_IDS[2]);
  const ink = INK_GRADES[inventory.inkGradeId];
  const equippedTome = inventory.tomes.find(
    (t) => t.spellId === inventory.equippedSpellId
  );
  const knowledge = getSpellKnowledge(caster, practiceSpellId);
  const reveal = spellRevealProgress(knowledge.decipher01, qteBeatCount(practiceSpellId));

  const competence = useMemo(
    () => calcMagicCompetence(caster, practiceSpellId),
    [caster, practiceSpellId]
  );
  const qteWindow = useMemo(
    () => scaleMagicDirectionalWindow(competence),
    [competence]
  );
  const spellDef = SPELL_DEFS[practiceSpellId];
  const beatCount = qteBeatCount(practiceSpellId);
  const perfectMs = perfectEclipseMs(qteWindow);
  const hitHalf = qteWindow.successWindowMs * 0.5;
  const critHalf = hitHalf * qteWindow.critFraction;
  /** Full timed + all crits example power (before considering mistimes). */
  const examplePower =
    magicSequencePowerMultiplier(beatCount, beatCount, beatCount) *
    ink.powerMult;

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 60));
  }, []);

  const selectCaster = useCallback((id: string) => {
    setCasterId(id);
    const def = CASTER_DEFAULT_SPELL[id as (typeof CASTER_IDS)[number]];
    if (def) setPracticeSpellId(def);
  }, []);

  const patchCaster = useCallback(
    (next: DetailedUnit) => {
      setCastersById((prev) => ({ ...prev, [next.id]: next }));
    },
    []
  );

  const toggleUnlockPracticeSpell = useCallback(() => {
    const next = setSpellUnlocked(caster, practiceSpellId, !knowledge.unlocked);
    patchCaster(next);
    pushLog(
      `${formatSpellLabel(practiceSpellId)} → ${
        !knowledge.unlocked ? 'Unlocked' : 'Locked'
      }`
    );
  }, [caster, knowledge.unlocked, patchCaster, practiceSpellId, pushLog]);

  const scrubDecipher = useCallback(
    (value01: number) => {
      let next = setSpellUnlocked(caster, practiceSpellId, true);
      next = setSpellDecipher01(next, practiceSpellId, value01);
      patchCaster(next);
    },
    [caster, patchCaster, practiceSpellId]
  );

  const equipSpellbook = useCallback(
    (spellId: SpellId) => {
      setInventories((prev) => {
        const cur = prev[casterId] ?? buildStarterInventory(CASTER_IDS[2]);
        let tomes: Item[] = cur.tomes.map((t) => ({
          ...t,
          equippedSlot: t.spellId === spellId ? 'mainhand' : null,
        }));
        if (!tomes.some((t) => t.spellId === spellId)) {
          const added = makeTome(spellId, casterId);
          added.equippedSlot = 'mainhand';
          tomes = [...tomes, added];
        }
        return {
          ...prev,
          [casterId]: {
            ...cur,
            tomes,
            equippedSpellId: spellId,
          },
        };
      });
      setPracticeSpellId(spellId);
      pushLog(`Equipped ${formatSpellLabel(spellId)} tome (${ink.label})`);
    },
    [casterId, ink.label, pushLog]
  );

  const addSpellbookToInventory = useCallback(
    (spellId: SpellId) => {
      setInventories((prev) => {
        const cur = prev[casterId] ?? buildStarterInventory(CASTER_IDS[2]);
        if (cur.tomes.some((t) => t.spellId === spellId)) return prev;
        return {
          ...prev,
          [casterId]: {
            ...cur,
            tomes: [...cur.tomes, makeTome(spellId, casterId)],
          },
        };
      });
      // Tome acquisition unlocks the spell (decipher may still be 0).
      const curCaster = castersById[casterId] ?? buildLabCaster(CASTER_IDS[2]);
      patchCaster(setSpellUnlocked(curCaster, spellId, true));
      pushLog(
        `Added ${formatSpellLabel(spellId)} — spell Unlocked (study to decipher)`
      );
    },
    [casterId, castersById, patchCaster, pushLog]
  );

  const beginTrial = useCallback(() => {
    if (activeSequence) return;
    const next =
      directionMode === 'random' ? pickRandomMagicDirection() : directionMode;
    setRequired(next);
    setActiveSingle(true);
  }, [directionMode, activeSequence]);

  const beginSequence = useCallback(() => {
    if (activeSingle) return;
    if (!knowledge.unlocked) {
      pushLog(
        `${formatSpellLabel(practiceSpellId)} is Locked — unlock (tome / lab) before casting`
      );
      return;
    }
    const spec = buildDecipheredSpellSequence(practiceSpellId, {
      decipher01: knowledge.decipher01,
      seed: Date.now() ^ hashRough(caster.id, practiceSpellId),
    });
    setLiveSequenceSpec(spec);
    setActiveSequence(true);
    pushLog(
      `Cast ${formatSpellLabel(practiceSpellId)} · ${formatSpellKnowledgeLabel(knowledge)} · ${describeSpellReveal(reveal)}`
    );
  }, [
    activeSingle,
    caster.id,
    knowledge,
    practiceSpellId,
    pushLog,
    reveal,
  ]);

  const onResult = useCallback(
    (result: MagicQteGradeResult) => {
      setActiveSingle(false);
      setStats((s) => {
        if (result.grade === 'crit')
          return { ...s, crit: s.crit + 1, hit: s.hit + 1 };
        if (result.grade === 'hit') return { ...s, hit: s.hit + 1 };
        return { ...s, miss: s.miss + 1 };
      });
      const miss = magicQteMissLabel(result.missKind);
      const err =
        result.missKind === 'early' ||
        result.missKind === 'late' ||
        result.grade !== 'miss'
          ? ` · Δ ${result.timingErrorMs >= 0 ? '+' : ''}${Math.round(result.timingErrorMs)} ms`
          : '';
      const pressed = result.pressed ? ` pressed ${result.pressed}` : '';
      pushLog(
        `${magicQteGradeLabel(result.grade)} · need ${result.required}${pressed}` +
          (miss ? ` · ${miss}` : '') +
          err
      );
      if (autoChain) {
        globalThis.setTimeout(() => {
          const next =
            directionMode === 'random'
              ? pickRandomMagicDirection()
              : directionMode;
          setRequired(next);
          setActiveSingle(true);
        }, 120);
      }
    },
    [autoChain, directionMode, pushLog]
  );

  const consumePageForSpell = useCallback(
    (spellId: SpellId) => {
      setInventories((prev) => {
        const cur = prev[casterId];
        if (!cur) return prev;
        const idx = cur.tomes.findIndex((t) => t.spellId === spellId);
        if (idx < 0) return prev;
        const tome = cur.tomes[idx]!;
        if (tome.durability <= 0) return prev;
        const nextTomes = cur.tomes.slice();
        nextTomes[idx] = {
          ...tome,
          durability: Math.max(0, tome.durability - 1),
        };
        return {
          ...prev,
          [casterId]: { ...cur, tomes: nextTomes },
        };
      });
    },
    [casterId]
  );

  const restoreInventory = useCallback(() => {
    setInventories((prev) => {
      const next: Record<string, LabInventory> = {};
      for (const id of Object.keys(prev)) {
        const cur = prev[id]!;
        next[id] = {
          ...cur,
          tomes: cur.tomes.map((t) => ({
            ...t,
            durability: t.maxDurability,
          })),
        };
      }
      return next;
    });
    pushLog('Restored all spellbook pages (lab)');
  }, [pushLog]);

  const onSequenceComplete = useCallback(
    (result: MagicQteSequenceResult) => {
      setActiveSequence(false);
      setLiveSequenceSpec(null);
      setStats((s) => ({
        hit: s.hit + result.hitCount,
        crit: s.crit + result.critCount,
        miss: s.miss + result.missCount,
      }));
      const connected = result.grade === 'hit';
      const withInk = connected
        ? result.powerMultiplier * ink.powerMult
        : 0;
      const basePct = Math.round(result.basePower01 * 100);
      const powerNote = connected
        ? ` · power ×${withInk.toFixed(2)} (base ${basePct}% · ${result.critCount} crit ×${MC.critPowerMult} · ${ink.label} ×${ink.powerMult})`
        : '';
      let pageNote = '';
      if (connected) {
        const tome = inventory.tomes.find((t) => t.spellId === practiceSpellId);
        if (tome && tome.durability > 0) {
          consumePageForSpell(practiceSpellId);
          pageNote = ` · page −1 (${tome.durability - 1}/${tome.maxDurability} left)`;
        } else if (tome && tome.durability <= 0) {
          pageNote = ' · no pages left (blank tome)';
        } else {
          pageNote = ' · no tome in inventory (practice only, no page)';
        }
      }
      pushLog(
        `CAST ${connected ? 'CONNECT' : 'FAIL'} · ${formatSpellLabel(practiceSpellId)} · ${result.hitCount}/${result.beats.length} timed · ${result.wildMagic.mistimedCount} mistimed · ${result.critCount} crit${powerNote}${pageNote}`
      );
      if (result.wildMagic.triggered) {
        const w = result.wildMagic;
        pushLog(
          `  WILD MAGIC · mistime ${(w.mistimeRatio * 100).toFixed(0)}% of non-skipped (${w.mistimedCount}/${result.beats.length - w.skippedCount}, skipped ${w.skippedCount}) · wrong dir ${w.wrongDirectionCount} · caster backlash stub ×${w.backlashPower01.toFixed(3)} (damage NYI)`
        );
      }
      for (const b of result.beats) {
        const miss = magicQteMissLabel(b.missKind);
        pushLog(
          `  ${b.beatIndex + 1}. ${b.required} · ${magicQteGradeLabel(b.grade)}` +
            (miss
              ? ` · ${miss}`
              : ` · Δ ${Math.round(b.timingErrorMs)} ms`)
        );
      }
    },
    [
      MC.critPowerMult,
      consumePageForSpell,
      ink.label,
      ink.powerMult,
      inventory.tomes,
      practiceSpellId,
      pushLog,
    ]
  );

  const attackSchools = MAGIC_SCHOOL_IDS.filter(
    (s): s is Exclude<MagicSchoolId, 'staffMagic'> => s !== 'staffMagic'
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(#12081f, #050308)',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
        padding: '20px 24px 48px',
      }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: '#c4b5fd', fontSize: 13 }}>
            ← Title
          </Link>
          <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#ddd6fe' }}>
            Magic QTE Lab
          </h1>
        </div>
        <p style={{ margin: '10px 0 18px', fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
          Spells start <strong>Locked</strong> until unlocked (tome / lab). Decipher
          progress reveals <em>timing</em> first (spinning arrows that land on the
          required dir at eclipse), then true <em>directions</em>. Unknown dirs are
          randomized per cast (pattern does not leak) but readable by watching the
          spin. A connecting cast spends one <strong>page</strong> ({ink.label} ×
          {ink.powerMult}). Keys: arrows or WASD.
        </p>

        {FORMULA_ERRORS.length > 0 ? (
          <section
            style={{
              ...card,
              marginBottom: 14,
              borderColor: 'rgba(248,113,113,0.5)',
              color: '#fecaca',
            }}
          >
            Formula validation errors:
            <ul>
              {FORMULA_ERRORS.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 10 }}>CASTER</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CASTER_IDS.map((id) => {
              const c = castersById[id]!;
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{
                    ...btn,
                    borderColor:
                      casterId === c.id
                        ? 'rgba(167, 243, 208, 0.7)'
                        : (btn.border as string),
                  }}
                  onClick={() => selectCaster(c.id)}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 10 }}>
            SPELLBOOK INVENTORY (equipped for combat preview)
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
            Ink: <strong>{ink.label}</strong> (power ×{ink.powerMult}) — school-special
            blends later.
            <br />
            Equipped:{' '}
            <strong>
              {inventory.equippedSpellId
                ? formatSpellLabel(inventory.equippedSpellId)
                : 'none'}
            </strong>
            {equippedTome
              ? ` · ${equippedTome.durability}/${equippedTome.maxDurability} pages`
              : ''}
          </div>
          <button
            type="button"
            style={{ ...btn, marginBottom: 10, background: 'transparent' }}
            onClick={restoreInventory}
          >
            Restore inventory pages
          </button>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {inventory.tomes.map((t) => {
              const sid = t.spellId as SpellId | undefined;
              if (!sid) return null;
              const eq = inventory.equippedSpellId === sid;
              return (
                <button
                  key={t.id}
                  type="button"
                  style={{
                    ...btn,
                    borderColor: eq
                      ? 'rgba(167, 243, 208, 0.7)'
                      : (btn.border as string),
                    opacity: eq ? 1 : 0.85,
                  }}
                  onClick={() => equipSpellbook(sid)}
                >
                  {formatSpellLabel(sid)}
                  <span style={{ opacity: 0.55, marginLeft: 6, fontSize: 11 }}>
                    {t.durability}/{t.maxDurability}p
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 8 }}>
            Add any tome to this caster’s inventory (lab only):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
            {SPELL_IDS.map((id) => {
              const owned = inventory.tomes.some((t) => t.spellId === id);
              return (
                <button
                  key={`add-${id}`}
                  type="button"
                  disabled={owned}
                  style={{
                    ...btn,
                    padding: '4px 8px',
                    fontSize: 11,
                    opacity: owned ? 0.35 : 0.85,
                    background: 'transparent',
                  }}
                  onClick={() => addSpellbookToInventory(id)}
                >
                  + {SPELL_DEFS[id].label}
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 10 }}>
            PRACTICE SPELL (locked spells show but cannot cast)
          </div>
          {attackSchools.map((school) => (
            <div key={school} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 6 }}>
                {formatMagicSchoolLabel(school)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {spellsInSchool(school).map((id) => {
                  const k = getSpellKnowledge(caster, id);
                  const selected = practiceSpellId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      style={{
                        ...btn,
                        padding: '6px 10px',
                        fontSize: 12,
                        borderColor: selected
                          ? 'rgba(167, 243, 208, 0.7)'
                          : (btn.border as string),
                        opacity: k.unlocked ? 1 : 0.55,
                        background: k.unlocked
                          ? (btn.background as string)
                          : 'rgba(30, 20, 40, 0.65)',
                      }}
                      onClick={() => setPracticeSpellId(id)}
                      title={formatSpellKnowledgeLabel(k)}
                    >
                      {SPELL_DEFS[id].label}
                      <span style={{ opacity: 0.55, marginLeft: 6, fontSize: 10 }}>
                        {!k.unlocked
                          ? 'Locked'
                          : `${Math.round(k.decipher01 * 100)}% · ${qteBeatCount(id)}q`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
            <strong>{caster.name}</strong> ·{' '}
            <strong>{formatSpellLabel(practiceSpellId)}</strong> ·{' '}
            {formatSpellKnowledgeLabel(knowledge)}
            <br />
            Mt {spellEffectiveMt(practiceSpellId)}
            {spellDef.designMt != null ? ` (design; listed Mt ${spellDef.mt})` : ''} ·{' '}
            {beatCount} QTEs · {spellDef.pages || '—'} pages
            <br />
            Spell XP <strong>{caster.combatStats.spellSkill[practiceSpellId]}</strong> ·
            school{' '}
            <strong>
              {(caster.combatStats.weaponSkill as Record<string, number>)[
                spellDef.school
              ] ?? 1}
            </strong>{' '}
            · competence <strong>{competence.competence.toFixed(2)}</strong>
            <br />
            Reveal: {describeSpellReveal(reveal)}
            <br />
            {knowledge.decipher01 >= 1 ? (
              <>
                Pattern:{' '}
                <code style={{ fontSize: 12 }}>
                  {formatSpellQtePattern(practiceSpellId)}
                </code>
              </>
            ) : (
              <span style={{ opacity: 0.6 }}>
                Authored pattern hidden until fully deciphered
              </span>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
              marginTop: 12,
            }}
          >
            <button type="button" style={btn} onClick={toggleUnlockPracticeSpell}>
              {knowledge.unlocked ? 'Lock spell' : 'Force unlock'}
            </button>
            <label style={{ fontSize: 12, opacity: 0.85, flex: 1, minWidth: 180 }}>
              Decipher {(knowledge.decipher01 * 100).toFixed(0)}%
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(knowledge.decipher01 * 100)}
                onChange={(e) => scrubDecipher(Number(e.target.value) / 100)}
                style={{ width: '100%', display: 'block', marginTop: 4 }}
              />
            </label>
            <button
              type="button"
              style={{ ...btn, background: 'transparent' }}
              onClick={() => scrubDecipher(0.7)}
              title="Preset matching the 3-beat 70% example"
            >
              Set 70%
            </button>
            <button
              type="button"
              style={{ ...btn, background: 'transparent' }}
              onClick={() => scrubDecipher(1)}
            >
              Full decipher
            </button>
          </div>
        </section>

        <section style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8 }}>SCALED WINDOW</div>
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            Collapse <strong>{qteWindow.durationMs} ms</strong> · hit{' '}
            <strong>{qteWindow.successWindowMs} ms</strong> (±{Math.round(hitHalf)}) · crit ±
            <strong>{Math.round(critHalf)}</strong> · perfect ~
            <strong>{Math.round(perfectMs)}</strong>
            <br />
            Base collapse {T.durationMs} · fade-in {T.fadeInMs} / out {T.resolvedFadeOutMs}
            <br />
            Full timed + all crits ×{examplePower.toFixed(2)} (1.0 × {MC.critPowerMult}^
            {beatCount} × ink {ink.powerMult})
          </div>
        </section>

        <section style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 10 }}>
            CAST PRACTICE SEQUENCE
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, opacity: 0.75, lineHeight: 1.45 }}>
            Locked spells cannot cast. Undeciphered casts show eclipse only; partial
            decipher shows spinning collapses that align at eclipse (read the tip),
            then true arrows. Spin direction and speed (50–150%) are random each
            attempt. Mistimed correct dirs still connect at reduced power; wrong dir
            / timeout voids the page.
          </p>
          <button
            type="button"
            style={btn}
            onClick={beginSequence}
            disabled={activeSingle || activeSequence || !knowledge.unlocked}
          >
            {activeSequence
              ? 'Sequence running…'
              : !knowledge.unlocked
                ? `${formatSpellLabel(practiceSpellId)} Locked`
                : `Cast ${formatSpellLabel(practiceSpellId)} (${beatCount} QTE)`}
          </button>
        </section>

        <section style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 10 }}>
            SINGLE BEAT DRILL
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              style={{
                ...btn,
                borderColor:
                  directionMode === 'random'
                    ? 'rgba(167, 243, 208, 0.7)'
                    : (btn.border as string),
              }}
              onClick={() => setDirectionMode('random')}
            >
              Random direction
            </button>
            {MAGIC_QTE_DIRECTIONS.map((d) => (
              <button
                key={d}
                type="button"
                style={{
                  ...btn,
                  borderColor:
                    directionMode === d
                      ? 'rgba(167, 243, 208, 0.7)'
                      : (btn.border as string),
                }}
                onClick={() => setDirectionMode(d)}
              >
                Lock {d}
              </button>
            ))}
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              marginBottom: 14,
              opacity: 0.85,
            }}
          >
            <input
              type="checkbox"
              checked={autoChain}
              onChange={(e) => setAutoChain(e.target.checked)}
            />
            Auto-chain next single drill after result
          </label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={btn}
              onClick={beginTrial}
              disabled={activeSingle || activeSequence}
            >
              {activeSingle ? 'Drill running…' : 'Start single drill'}
            </button>
            <span style={{ fontSize: 13, opacity: 0.7 }}>
              Hit {stats.hit} · Crit {stats.crit} · Miss {stats.miss}
            </span>
            <button
              type="button"
              style={{ ...btn, background: 'transparent', opacity: 0.7 }}
              onClick={() => {
                setStats({ hit: 0, crit: 0, miss: 0 });
                setLog([]);
              }}
            >
              Reset stats
            </button>
          </div>
        </section>

        <section style={card}>
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8 }}>LOG</div>
          {log.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.45 }}>No practice yet.</div>
          ) : (
            <div
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
                lineHeight: 1.5,
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {log.map((line, i) => (
                <div key={`${i}-${line.slice(0, 16)}`}>{line}</div>
              ))}
            </div>
          )}
        </section>
      </div>

      {activeSingle ? (
        <MagicDirectionalQte
          required={required}
          window={qteWindow}
          onResult={onResult}
          onCancel={() => {
            setActiveSingle(false);
            pushLog('drill cancelled');
          }}
        />
      ) : null}

      {activeSequence && liveSequenceSpec ? (
        <MagicDirectionalQteSequence
          spec={liveSequenceSpec}
          window={qteWindow}
          onComplete={onSequenceComplete}
          onCancel={() => {
            setActiveSequence(false);
            setLiveSequenceSpec(null);
            pushLog('cast practice cancelled');
          }}
        />
      ) : null}
    </div>
  );
}
