import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDetailedCharacter,
  listDetailedCharacters,
} from './data/detailedPlaceholderCharacters';
import {
  resolveCombatPose,
  strikeToPoseLine,
} from './data/combat/combatPoseArt';
import {
  DRINK_PACES,
  DRINK_SIP_ACTIONS,
  SAMPLE_DRINKS,
  type AlcoholDrink,
  type DrinkPace,
  type DrinkSipAction,
  type HeldDrink,
} from './data/social/sampleDrinks';
import { compileCombatant } from './utils/combat/compileCombatant';
import { getCombatCastInventory } from './data/starters/combatCastInventory';
import { BAC_TUNING } from './utils/social/bacTuning';
import {
  formatBac,
  formatEthanolG,
  formatMl,
  minutesToFinish,
  paceMlPerMinute,
  setHeldPace,
  sipFromHeld,
  soberUp,
  startHeldDrink,
  tickDrinking,
  widmarkR,
} from './utils/social/bloodAlcohol';
import type { Unit as DetailedUnit } from './types/characters';

const DEFAULT_ID = 'unit_amberyl';

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '28px 32px 48px',
  fontFamily: 'system-ui, sans-serif',
  background: 'linear-gradient(180deg, #1a0a14 0%, #120810 40%, #0a0810 100%)',
  color: '#f5eef2',
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
  border: '1px solid rgba(244, 114, 182, 0.28)',
  borderRadius: 14,
  padding: 18,
  background: 'linear-gradient(180deg, rgba(40, 18, 30, 0.95) 0%, rgba(18, 10, 16, 0.98) 100%)',
  boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
};

const selectStyle: CSSProperties = {
  background: '#1a1218',
  color: '#f5eef2',
  border: '1px solid rgba(244, 114, 182, 0.4)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 14,
};

const smallBtn: CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid rgba(244, 114, 182, 0.35)',
  background: 'rgba(244, 114, 182, 0.12)',
  color: '#f5eef2',
  cursor: 'pointer',
};

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
  const shown =
    typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value;
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
          {shown}/{max}
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

function Pill({ children, tone = 'default' }: { children: string; tone?: 'default' | 'hot' | 'cool' }) {
  const border =
    tone === 'hot'
      ? 'rgba(244,114,182,0.55)'
      : tone === 'cool'
        ? 'rgba(125,211,252,0.45)'
        : 'rgba(255,255,255,0.18)';
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: 'rgba(255,255,255,0.04)',
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      {children}
    </span>
  );
}

function PortraitPlaceholder({ unit }: { unit: DetailedUnit }) {
  const kit = getCombatCastInventory(unit.id);
  const snap = compileCombatant(unit, kit?.items);
  const weaponType =
    snap.mainhand?.template.weaponType ??
    snap.mainhand?.instance.weaponType ??
    null;
  const pose = resolveCombatPose({
    characterName: unit.name,
    weaponType,
    role: 'Atk',
    line: strikeToPoseLine(unit.combatStats.currentStance.strike),
    sex: unit.sex,
  });

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '2 / 3',
        maxHeight: 360,
        borderRadius: 14,
        overflow: 'hidden',
        border: '2px solid rgba(244, 114, 182, 0.35)',
        background: 'linear-gradient(160deg, rgba(244,114,182,0.12) 0%, #120810 55%, #0a0810 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {pose.src ? (
        <img
          src={pose.src}
          alt={`${unit.name} profile`}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center bottom',
          }}
        />
      ) : (
        <div style={{ textAlign: 'center', opacity: 0.55, padding: 16 }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f9a8d4' }}>
            {unit.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Portrait placeholder</div>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          fontSize: 10,
          opacity: 0.55,
          background: 'rgba(0,0,0,0.45)',
          padding: '3px 8px',
          borderRadius: 6,
        }}
      >
        {pose.via === 'exact' || pose.via.startsWith('any') || pose.via.includes('weapon')
          ? 'Combat pose stand-in'
          : 'Profile art TBD'}
      </div>
    </div>
  );
}

function SocialPanel({ unit }: { unit: DetailedUnit }) {
  const { static: s, dynamic: d } = unit.socialStats;
  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 12px', fontSize: '1.1rem', color: '#f9a8d4' }}>Social</h2>
      <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>
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
        ) : null}
      </div>
      <StatBar label="Stress" value={d.stress} color="#fb923c" />
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
        <Pill tone="hot">{d.intoxicationStage}</Pill>
        <Pill>{`BAC ${formatBac(d.BAC)}`}</Pill>
        <Pill>{`Peak ${formatBac(d.peakBAC)}`}</Pill>
        <Pill tone="cool">{`Gut ${formatEthanolG(d.unabsorbedEthanolG ?? 0)}g`}</Pill>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.65 }}>
        Growth H {s.happinessGrowth} · Decay H {s.happinessDecay} · Growth S {s.stressGrowth} ·
        Decay S {s.stressDecay}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.55 }}>
        Widmark r={widmarkR(unit.sex).toFixed(2)} · {unit.weight} lb · sex {unit.sex}
        {(d.unabsorbedEthanolG ?? 0) > 0.001
          ? ' · alcohol still absorbing'
          : ''}
        {d.hoursSinceLastDrink != null
          ? ` · ${d.hoursSinceLastDrink.toFixed(2)} h since last drink`
          : ''}
      </div>
    </section>
  );
}

function DrinkLabPanel({
  held,
  pace,
  onStartDrink,
  onPaceChange,
  onSipAction,
  onPassHours,
  onSober,
  onPutDown,
  log,
}: {
  held: HeldDrink | null;
  pace: DrinkPace;
  onStartDrink: (drink: AlcoholDrink) => void;
  onPaceChange: (pace: DrinkPace) => void;
  onSipAction: (action: DrinkSipAction) => void;
  onPassHours: (hours: number) => void;
  onSober: () => void;
  onPutDown: () => void;
  log: string[];
}) {
  const finishMin = held ? minutesToFinish(held.pace, held.remainingMl) : null;
  const rate =
    held != null ? paceMlPerMinute(held.pace, held.remainingMl) : paceMlPerMinute(pace, 100);

  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#f9a8d4' }}>Drink lab</h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.7 }}>
        Start a serving, pick a pace (ml/min). Swallowing fills the gut; BAC rises over ~20–30 min
        as it absorbs. Gulp / mouthful / sip swallow without advancing the clock (still delayed BAC).
      </p>

      <div style={{ fontSize: 12, marginBottom: 10, opacity: 0.9 }}>
        {held ? (
          <>
            Holding <strong>{held.drink.label}</strong> — {formatMl(held.remainingMl)} /{' '}
            {held.drink.volumeMl} ml left · {held.drink.abvPercent}% ABV · pace{' '}
            <strong>{held.pace}</strong> (~{formatMl(rate)} ml/min
            {finishMin != null && Number.isFinite(finishMin)
              ? ` · ~${finishMin.toFixed(1)} min to finish`
              : ''}
            )
          </>
        ) : (
          <span style={{ opacity: 0.6 }}>No drink in hand — pick a serving below.</span>
        )}
      </div>

      <h3 style={{ margin: '0 0 6px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
        START SERVING
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {SAMPLE_DRINKS.map((drink) => (
          <button
            key={drink.id}
            type="button"
            style={smallBtn}
            onClick={() => onStartDrink(drink)}
            title={`${drink.volumeMl} ml · ${drink.abvPercent}% ABV`}
          >
            {drink.label}
            <span style={{ opacity: 0.55, marginLeft: 6 }}>
              {drink.volumeMl}ml/{drink.abvPercent}%
            </span>
          </button>
        ))}
        {held ? (
          <button type="button" style={{ ...smallBtn, opacity: 0.75 }} onClick={onPutDown}>
            Put down
          </button>
        ) : null}
      </div>

      <h3 style={{ margin: '0 0 6px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
        PACE
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {DRINK_PACES.map((p) => {
          const active = (held?.pace ?? pace) === p;
          const label =
            p === 'slam'
              ? `slam (all in ${BAC_TUNING.slamMinutes}m)`
              : `${p} (${BAC_TUNING.paceMlPerMinute[p]} ml/m)`;
          return (
            <button
              key={p}
              type="button"
              style={{
                ...smallBtn,
                borderColor: active
                  ? 'rgba(244,114,182,0.85)'
                  : 'rgba(244, 114, 182, 0.35)',
                background: active
                  ? 'rgba(244,114,182,0.28)'
                  : 'rgba(244, 114, 182, 0.12)',
              }}
              onClick={() => onPaceChange(p)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <h3 style={{ margin: '0 0 6px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
        MOUTH (no time)
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {DRINK_SIP_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            style={smallBtn}
            disabled={!held}
            onClick={() => onSipAction(action)}
            title={`${BAC_TUNING.sipActionMl[action]} ml, no time pass`}
          >
            {action}
            <span style={{ opacity: 0.55, marginLeft: 6 }}>
              {BAC_TUNING.sipActionMl[action]}ml
            </span>
          </button>
        ))}
      </div>

      <h3 style={{ margin: '0 0 6px', fontSize: 11, opacity: 0.65, letterSpacing: 0.4 }}>
        PASS TIME
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {(
          [
            [1 / 60, '1 min'],
            [5 / 60, '5 min'],
            [0.25, '15 min'],
            [1, '1 h'],
            [3, '3 h'],
          ] as const
        ).map(([hours, label]) => (
          <button key={label} type="button" style={smallBtn} onClick={() => onPassHours(hours)}>
            Pass {label}
          </button>
        ))}
        <button
          type="button"
          style={{ ...smallBtn, borderColor: 'rgba(255,255,255,0.2)' }}
          onClick={onSober}
        >
          Sober up
        </button>
      </div>

      <div
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          maxHeight: 160,
          overflowY: 'auto',
          opacity: 0.85,
          lineHeight: 1.45,
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 8,
          padding: '8px 10px',
        }}
      >
        {log.length === 0 ? (
          <span style={{ opacity: 0.5 }}>No activity yet.</span>
        ) : (
          log.map((line, i) => <div key={`${i}-${line.slice(0, 16)}`}>{line}</div>)
        )}
      </div>
    </section>
  );
}

function LewdPanel({ unit }: { unit: DetailedUnit }) {
  const { static: s, dynamic: d, itemizedLewd } = unit.lewdStats;
  const expEntries = Object.entries(s.experience ?? {});
  const itemizedCount = itemizedLewd ? Object.keys(itemizedLewd).length : 0;

  return (
    <section style={cardStyle}>
      <h2 style={{ margin: '0 0 12px', fontSize: '1.1rem', color: '#f9a8d4' }}>Lewd</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          ['Allure', s.allure],
          ['Libido', s.libido],
          ['Charisma', s.charisma],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              padding: '8px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.55 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 650 }}>{value}</div>
          </div>
        ))}
      </div>

      <StatBar label="Lust" value={d.lust ?? 0} max={100} color="#e879f9" />
      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
        <Pill tone="hot">{`PNS ${d.PNS ?? 0}`}</Pill>
        <Pill tone="hot">{`SNS ${d.SNS ?? 0}`}</Pill>
        <Pill>{`Cycle ${d.ovulationCycleCurrent ?? 0}/${s.ovulationCycleLength}`}</Pill>
      </div>

      <div style={{ marginBottom: 12 }}>
        {s.submissive ? <Pill tone="hot">Submissive</Pill> : <Pill>Dominant lean</Pill>}
        {s.whitefeather ? <Pill tone="hot">Whitefeather</Pill> : null}
        {s.attractedToBoys ? <Pill>Attracted to boys</Pill> : null}
        {s.attractedToGirls ? <Pill>Attracted to girls</Pill> : null}
      </div>

      <h3 style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.7, letterSpacing: 0.4 }}>
        EXPERIENCE
      </h3>
      <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
        {expEntries.length === 0 ? (
          <span style={{ opacity: 0.55 }}>No experience records.</span>
        ) : (
          expEntries.map(([key, exp]) => (
            <div key={key} style={{ marginBottom: 4 }}>
              <span style={{ opacity: 0.55 }}>{key} · </span>
              {exp.encounters} encounters
              {exp.first ? ` · first: ${exp.first}` : ' · first: —'}
            </div>
          ))
        )}
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 11, opacity: 0.55 }}>
        Itemized lewd regions tracked: {itemizedCount} (detail UI later).
      </p>
    </section>
  );
}

function cloneUnit(id: string): DetailedUnit | null {
  const base = getDetailedCharacter(id);
  return base ? (structuredClone(base) as DetailedUnit) : null;
}

function Playground() {
  const navigate = useNavigate();
  const cast = listDetailedCharacters();
  const [selectedId, setSelectedId] = useState(DEFAULT_ID);
  const [unit, setUnit] = useState<DetailedUnit | null>(() => cloneUnit(DEFAULT_ID));
  const [held, setHeld] = useState<HeldDrink | null>(null);
  const [pace, setPace] = useState<DrinkPace>('moderate');
  const [drinkLog, setDrinkLog] = useState<string[]>([]);

  useEffect(() => {
    setUnit(cloneUnit(selectedId));
    setHeld(null);
    setDrinkLog([]);
  }, [selectedId]);

  const pushDrinkLog = (line: string) => {
    const stamped = `[${new Date().toLocaleTimeString()}] ${line}`;
    setDrinkLog((prev) => [stamped, ...prev].slice(0, 40));
  };

  const onStartDrink = (drink: AlcoholDrink) => {
    if (!unit) return;
    if (held && held.remainingMl > 0.05) {
      pushDrinkLog(
        `Puts down ${held.drink.label} (${formatMl(held.remainingMl)} ml left) to take ${drink.label}.`
      );
    }
    const next = startHeldDrink(drink, pace);
    setHeld(next);
    pushDrinkLog(
      `${unit.name} starts ${drink.label} (${drink.volumeMl}ml @ ${drink.abvPercent}% ABV) at ${pace} pace` +
        (pace === 'slam'
          ? ` — finish in ${BAC_TUNING.slamMinutes} min.`
          : ` (~${BAC_TUNING.paceMlPerMinute[pace]} ml/min · ~${minutesToFinish(pace, drink.volumeMl).toFixed(1)} min).`)
    );
  };

  const onPaceChange = (next: DrinkPace) => {
    setPace(next);
    if (held) {
      setHeld(setHeldPace(held, next));
      pushDrinkLog(
        `Pace → ${next}` +
          (next === 'slam'
            ? ` (slam: remaining ${formatMl(held.remainingMl)} ml over ${BAC_TUNING.slamMinutes} min).`
            : ` (~${BAC_TUNING.paceMlPerMinute[next]} ml/min · ~${minutesToFinish(next, held.remainingMl).toFixed(1)} min left).`)
      );
    }
  };

  const onSipAction = (action: DrinkSipAction) => {
    if (!unit || !held) return;
    const result = sipFromHeld(unit, held, action);
    setUnit(result.unit);
    setHeld(result.held);
    const gut = result.unit.socialStats.dynamic.unabsorbedEthanolG ?? 0;
    pushDrinkLog(
      `${action} ${formatMl(result.consumedMl)} ml of ${held.drink.label} → +${formatEthanolG(result.gutAddedG)}g gut` +
        (result.deltaBac > 0.00005
          ? ` · instant +${formatBac(result.deltaBac)} BAC`
          : '') +
        ` · BAC ${formatBac(result.unit.socialStats.dynamic.BAC)} · gut ${formatEthanolG(gut)}g` +
        (result.held
          ? ` · ${formatMl(result.held.remainingMl)} ml left`
          : ' · finished')
    );
  };

  const onPassHours = (hours: number) => {
    if (!unit) return;
    const before = unit.socialStats.dynamic.BAC;
    const gutBefore = unit.socialStats.dynamic.unabsorbedEthanolG ?? 0;
    const result = tickDrinking(unit, held, hours);
    setUnit(result.unit);
    setHeld(result.held);
    const mins = hours * 60;
    const timeLabel =
      mins < 1 ? `${Math.round(mins * 60)} s` : mins < 60 ? `${Math.round(mins)} min` : `${hours} h`;
    const gutAfter = result.unit.socialStats.dynamic.unabsorbedEthanolG ?? 0;
    const parts: string[] = [`Pass ${timeLabel}:`];
    if (result.consumedMl > 0) {
      parts.push(
        `swallowed ${formatMl(result.consumedMl)} ml (+${formatEthanolG(result.gutAddedG)}g gut)`
      );
    }
    if (result.absorbedG > 0.0005) {
      parts.push(
        `absorbed ${formatEthanolG(result.absorbedG)}g → +${formatBac(result.deltaBacAbsorbed)} BAC`
      );
    }
    if (result.metabolized > 0.00005) {
      parts.push(`metabolized −${formatBac(result.metabolized)}`);
    }
    parts.push(
      `BAC ${formatBac(before)} → ${formatBac(result.unit.socialStats.dynamic.BAC)} (${result.unit.socialStats.dynamic.intoxicationStage})`
    );
    parts.push(`gut ${formatEthanolG(gutBefore)}→${formatEthanolG(gutAfter)}g`);
    if (result.held) parts.push(`${formatMl(result.held.remainingMl)} ml left`);
    else if (held) parts.push('glass empty');
    pushDrinkLog(parts.join(' · '));
  };

  const onSober = () => {
    if (!unit) return;
    pushDrinkLog(`${unit.name} sobers up (lab reset).`);
    setHeld(null);
    setUnit({
      ...unit,
      socialStats: {
        ...unit.socialStats,
        dynamic: soberUp(unit.socialStats.dynamic),
      },
    });
  };

  const onPutDown = () => {
    if (!held) return;
    pushDrinkLog(`Puts down ${held.drink.label} (${formatMl(held.remainingMl)} ml left).`);
    setHeld(null);
  };

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate('/')} style={navBtn}>
          ← Title
        </button>
        <button type="button" onClick={() => navigate('/battleground')} style={navBtn}>
          ← Battleground
        </button>
        <button
          type="button"
          onClick={() => navigate(`/characters/detailed/${selectedId}`)}
          style={navBtn}
        >
          Combat Detail
        </button>
      </div>

      <header style={{ marginBottom: 24, textAlign: 'center' }}>
        <p style={{ margin: '0 0 6px', opacity: 0.55, fontSize: 12, letterSpacing: 1 }}>
          ADULT LAB
        </p>
        <h1 style={{ margin: '0 0 8px', fontSize: '2rem' }}>Playground</h1>
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
          Social / lewd profiles plus a BAC drink lab (Widmark sex + weight). Portrait is a
          temporary combat-pose stand-in.
        </p>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto 16px' }}>
        <label style={{ fontSize: 12, opacity: 0.7 }}>
          Character
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ ...selectStyle, display: 'block', marginTop: 4, minWidth: 240 }}
          >
            {cast.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.class})
              </option>
            ))}
          </select>
        </label>
      </div>

      {!unit ? (
        <p style={{ textAlign: 'center', opacity: 0.7 }}>Character not found.</p>
      ) : (
        <div
          className="playground-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 300px) 1fr',
            gap: 20,
            maxWidth: 1080,
            margin: '0 auto',
            alignItems: 'start',
          }}
        >
          <div style={cardStyle}>
            <PortraitPlaceholder unit={unit} />
            <h2 style={{ margin: '14px 0 4px', fontSize: '1.45rem' }}>{unit.name}</h2>
            <p style={{ margin: 0, opacity: 0.75, fontSize: 13 }}>
              {unit.class} · Lv. {unit.level ?? 1} · {unit.sex} · age {unit.age}
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
              {unit.description}
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.6 }}>
              {unit.height}&quot; · {unit.weight} lb · {unit.allegiance}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SocialPanel unit={unit} />
            <DrinkLabPanel
              held={held}
              pace={pace}
              onStartDrink={onStartDrink}
              onPaceChange={onPaceChange}
              onSipAction={onSipAction}
              onPassHours={onPassHours}
              onSober={onSober}
              onPutDown={onPutDown}
              log={drinkLog}
            />
            <LewdPanel unit={unit} />
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 820px) {
          .playground-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

export default Playground;
