import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  BODY_PARTS,
  EQUIPMENT_SLOTS,
  STANCE_IDS,
  WEAPON_TYPES,
  formatBodyPartLabel,
  formatEquipmentSlotLabel,
  formatStanceLabel,
  formatWeaponTypeLabel,
  type BodyPartHealth,
  type BodyPartId,
  type EquipmentSlotId,
  type StanceId,
  type Unit as DetailedUnit,
  type WeaponTypeId,
} from './types/characters';
import {
  getDetailedCharacter,
  listDetailedCharacters,
} from './data/detailedPlaceholderCharacters';
import { getCombatCastInventory } from './data/starters/combatCastInventory';
import type { Item, ItemSlot } from './types/items';
import {
  getProtectingArmor,
  listEquippedResolved,
  sumEquippedWeight,
} from './utils/items/resolveItem';
import {
  discardEquipped,
  equipItem,
  listUnequippedOwned,
  unequipSlot,
} from './utils/items/equipGear';
import {
  applyDirectPressure,
  releaseDirectPressure,
  useBandageOnPart,
  useVulneraryOnPart,
  BANDAGE_TEMPLATE_ID,
  VULNERARY_TEMPLATE_ID,
} from './utils/combat/woundCare';
import {
  clearTraumaFlag,
  highestTrauma,
  setTraumaFlag,
  type TraumaLevel,
} from './utils/combat/traumaFlags';
import { syncConcussionFlag } from './utils/combat/sensoryPerformance';
import {
  calcBloodCombatPenalties,
  getBloodStatus,
} from './utils/combat/bloodVolume';
import {
  deriveHealthFromItemized,
  summarizeBleed,
} from './utils/combat/deriveHealthPool';

/* ── shared visual tokens ───────────────────────────────────────── */

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '24px 28px 56px',
  fontFamily: 'system-ui, sans-serif',
  background: 'linear-gradient(180deg, #1a0a12 0%, #0a0a12 35%, #0a1018 100%)',
  color: '#f0f0f5',
  boxSizing: 'border-box',
};

const cardStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: 16,
};

const btn: CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  background: 'rgba(167,139,250,0.18)',
  color: '#e9d5ff',
  border: '1px solid rgba(167,139,250,0.45)',
  borderRadius: 6,
  cursor: 'pointer',
};

const btnNav: CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  background: 'rgba(255,255,255,0.06)',
  color: '#f0f0f5',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 6,
  cursor: 'pointer',
};

const btnDanger: CSSProperties = {
  ...btn,
  background: 'rgba(248,113,113,0.14)',
  borderColor: 'rgba(248,113,113,0.4)',
  color: '#fecaca',
};

const btnMuted: CSSProperties = {
  ...btn,
  opacity: 0.7,
};

const sectionLabel: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  opacity: 0.7,
};

function SectionCard({
  title,
  eyebrow,
  children,
  style,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section style={{ ...cardStyle, ...style }}>
      {eyebrow ? (
        <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: 0.5, opacity: 0.5 }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 style={{ ...sectionLabel, marginBottom: 14 }}>{title}</h2>
      {children}
    </section>
  );
}

/** Clone unit + owned bank; resync equippedSlot from loadout (lab-safe). */
function cloneWardrobe(unitId: string): {
  unit: DetailedUnit;
  itemsById: Record<string, Item>;
} | null {
  const src = getDetailedCharacter(unitId);
  if (!src) return null;
  const kit = getCombatCastInventory(unitId);
  const unit = structuredClone(src) as DetailedUnit;
  const itemsById = structuredClone(kit?.items ?? {}) as Record<string, Item>;
  for (const item of Object.values(itemsById)) {
    item.equippedSlot = null;
  }
  for (const slot of EQUIPMENT_SLOTS) {
    const id = unit.equipment[slot];
    if (id && itemsById[id]) itemsById[id].equippedSlot = slot;
  }
  if (unit.combatStats.base.bloodLoss === undefined) {
    unit.combatStats.base.bloodLoss = 0;
  }
  return { unit, itemsById };
}

function healthColor(health: number): string {
  if (health >= 0.95) return '#4ade80';
  if (health >= 0.7) return '#fbbf24';
  if (health >= 0.4) return '#fb923c';
  return '#f87171';
}

function FractionBar({
  value,
  color,
  height = 8,
}: {
  value: number;
  color: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div
      style={{
        height,
        borderRadius: 4,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        minWidth: 64,
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
  );
}

function StatBar({
  label,
  value,
  max,
  color,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1);
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          marginBottom: 4,
          opacity: 0.9,
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {fmt(value)}/{fmt(max)}
          {suffix ? ` ${suffix}` : ''}
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
          style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }}
        />
      </div>
    </div>
  );
}

function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'ok' | 'info' }) {
  const tones = {
    neutral: { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.12)', color: '#e5e7eb' },
    warn: { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', color: '#fecaca' },
    ok: { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.3)', color: '#bbf7d0' },
    info: { bg: 'rgba(125,211,252,0.12)', border: 'rgba(125,211,252,0.3)', color: '#bae6fd' },
  }[tone];
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 7px',
        borderRadius: 4,
        background: tones.bg,
        border: `1px solid ${tones.border}`,
        color: tones.color,
      }}
    >
      {children}
    </span>
  );
}

function injuryTags(part: BodyPartHealth): { label: string; tone: 'neutral' | 'warn' | 'ok' | 'info' }[] {
  const tags: { label: string; tone: 'neutral' | 'warn' | 'ok' | 'info' }[] = [];
  if ((part.bruise ?? 0) > 0.05) {
    tags.push({ label: `bruise ${(part.bruise * 100).toFixed(0)}%`, tone: 'warn' });
  }
  const trauma = highestTrauma(part);
  if (trauma !== 'none') tags.push({ label: trauma, tone: 'warn' });
  if (part.concussed) tags.push({ label: 'concussed', tone: 'warn' });
  if (part.dressed) tags.push({ label: 'dressed', tone: 'ok' });
  if (part.vulnerary) tags.push({ label: 'vulnerary', tone: 'ok' });
  if (part.directPressure) tags.push({ label: 'pressure', tone: 'info' });
  if (part.bleed > 0) tags.push({ label: `bleed ${(part.bleed * 100).toFixed(0)}%`, tone: 'warn' });
  if (part.internalBleed > 0) {
    tags.push({ label: `i-bleed ${(part.internalBleed * 100).toFixed(0)}%`, tone: 'warn' });
  }
  if (part.lodgedArrow) {
    tags.push({
      label: `shaft:${part.lodgedArrow.headStyle}/${part.lodgedArrow.material}`,
      tone: 'warn',
    });
  }
  return tags;
}

function ItemizedHealthTable({
  unit,
  bandageCount,
  vulneraryCount,
  onBandage,
  onVulnerary,
  onLabInjure,
  onLabTrauma,
  onTogglePressure,
}: {
  unit: DetailedUnit;
  bandageCount: number;
  vulneraryCount: number;
  onBandage: (part: BodyPartId) => void;
  onVulnerary: (part: BodyPartId) => void;
  onLabInjure: (part: BodyPartId) => void;
  onLabTrauma: (part: BodyPartId, level: TraumaLevel) => void;
  onTogglePressure: (part: BodyPartId) => void;
}) {
  const rows = useMemo(() => {
    return BODY_PARTS.map((id: BodyPartId) => {
      const part = unit.combatStats.itemizedHealth[id];
      return { id, part, tags: injuryTags(part) };
    });
  }, [unit]);

  const injuredOnly = rows.filter((r) => r.part.health < 1 || r.tags.length > 0);
  const bleed = summarizeBleed(unit.combatStats.itemizedHealth);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 12,
          fontSize: 13,
          opacity: 0.85,
        }}
      >
        <Tag tone={injuredOnly.length === 0 ? 'ok' : 'warn'}>
          {injuredOnly.length === 0
            ? 'No active injuries'
            : `${injuredOnly.length} area(s) injured`}
        </Tag>
        <Tag>Care · {bandageCount} bandage · {vulneraryCount} vulnerary</Tag>
        {bleed.totalBleedRate > 0 ? (
          <Tag tone="warn">Bleed rate {bleed.totalBleedRate.toFixed(2)}</Tag>
        ) : null}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              <th style={{ padding: '8px 10px' }}>Body part</th>
              <th style={{ padding: '8px 10px', width: 140 }}>Health</th>
              <th style={{ padding: '8px 10px', width: 56 }}>%</th>
              <th style={{ padding: '8px 10px' }}>Flags</th>
              <th style={{ padding: '8px 10px', width: 220 }}>Care / lab</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, part, tags }) => {
              const dimmed = part.health >= 1 && tags.length === 0;
              const needsCare =
                part.health < 1 ||
                part.bleed > 0 ||
                part.internalBleed > 0 ||
                !!part.lodgedArrow;
              return (
                <tr
                  key={id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    opacity: dimmed ? 0.45 : 1,
                    background:
                      part.health < 0.85 ? 'rgba(248,113,113,0.06)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 500 }}>{formatBodyPartLabel(id)}</div>
                    <code style={{ fontSize: 11, opacity: 0.45 }}>{id}</code>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <FractionBar value={part.health} color={healthColor(part.health)} />
                  </td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>
                    {(part.health * 100).toFixed(0)}%
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {tags.length === 0 ? (
                      <span style={{ opacity: 0.35 }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {tags.map((t) => (
                          <Tag key={t.label} tone={t.tone}>
                            {t.label}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {needsCare ? (
                        <>
                          <button
                            type="button"
                            style={{ ...btn, padding: '2px 8px', fontSize: 11 }}
                            title={
                              part.dressed
                                ? 'Already bandaged'
                                : bandageCount > 0
                                  ? 'Consume field bandage'
                                  : 'Lab free apply (no stock)'
                            }
                            onClick={() => onBandage(id)}
                          >
                            Bandage
                          </button>
                          <button
                            type="button"
                            style={{ ...btn, padding: '2px 8px', fontSize: 11 }}
                            title={
                              part.vulnerary
                                ? 'Already salved'
                                : vulneraryCount > 0
                                  ? 'Consume vulnerary'
                                  : 'Lab free apply (no stock)'
                            }
                            onClick={() => onVulnerary(id)}
                          >
                            Vulnerary
                          </button>
                          <button
                            type="button"
                            style={{
                              ...btn,
                              padding: '2px 8px',
                              fontSize: 11,
                              opacity: part.directPressure ? 1 : 0.7,
                            }}
                            title="Hold / release hand pressure on the wound"
                            onClick={() => onTogglePressure(id)}
                          >
                            {part.directPressure ? 'Release' : 'Pressure'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          style={{ ...btnMuted, padding: '2px 8px', fontSize: 11 }}
                          onClick={() => onLabInjure(id)}
                        >
                          Lab injure
                        </button>
                      )}
                      {(['sprain', 'fracture', 'broken'] as TraumaLevel[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          style={{
                            ...btnMuted,
                            padding: '2px 6px',
                            fontSize: 10,
                            opacity: highestTrauma(part) === level ? 1 : 0.55,
                          }}
                          title={`Set ${level} (independent of health)`}
                          onClick={() => onLabTrauma(id, level)}
                        >
                          {level}
                        </button>
                      ))}
                      {highestTrauma(part) !== 'none' ? (
                        <button
                          type="button"
                          style={{ ...btn, padding: '2px 6px', fontSize: 10 }}
                          onClick={() => onLabTrauma(id, 'none')}
                        >
                          clear
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BaseCombatPanel({ unit }: { unit: DetailedUnit }) {
  const { base } = unit.combatStats;
  const primary = [
    ['skill', base.skill],
    ['speed', base.speed],
    ['magic', base.magic],
    ['luck', base.luck],
  ] as const;
  const secondary = Object.entries(base).filter(
    ([key]) =>
      ![
        'skill',
        'speed',
        'magic',
        'luck',
        'health',
        'healthCurrent',
        'staminaCap',
        'staminaCurrent',
        'bloodLoss',
      ].includes(key)
  );

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 14,
        }}
      >
        {primary.map(([key, value]) => (
          <div
            key={key}
            style={{
              padding: '10px 8px',
              borderRadius: 8,
              background: 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.22)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {key}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
      {secondary.length > 0 ? (
        <dl
          style={{
            margin: 0,
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '4px 12px',
            fontSize: 13,
          }}
        >
          {secondary.map(([key, value]) => (
            <div key={key} style={{ display: 'contents' }}>
              <dt style={{ opacity: 0.65 }}>{key}</dt>
              <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {typeof value === 'number' ? value : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function coverageLabelList(coverage: Record<string, number | undefined>): string {
  return Object.entries(coverage)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([part, v]) => `${formatBodyPartLabel(part as BodyPartId)} ${(v! * 100).toFixed(0)}%`)
    .join(' · ');
}

function EquipmentPanel({
  unit,
  itemsById,
  note,
  onUnequip,
  onEquip,
  onDiscard,
  onReset,
}: {
  unit: DetailedUnit;
  itemsById: Record<string, Item>;
  note: string | null;
  onUnequip: (slot: ItemSlot) => void;
  onEquip: (itemId: string) => void;
  onDiscard: (slot: ItemSlot) => void;
  onReset: () => void;
}) {
  const resolvedRows = listEquippedResolved(unit.equipment, itemsById);
  const totalWeight = sumEquippedWeight(unit.equipment, itemsById);
  const emptySlots = EQUIPMENT_SLOTS.filter((slot) => unit.equipment[slot] == null);
  const unresolved = EQUIPMENT_SLOTS.filter((slot) => {
    const id = unit.equipment[slot];
    return id != null && !resolvedRows.some((r) => r.slot === slot);
  });
  const bag = listUnequippedOwned({ unit, itemsById });

  const armorRows = resolvedRows.filter((r) => r.resolved.instance.itemType === 'armor');
  const weaponRows = resolvedRows.filter(
    (r) =>
      r.resolved.instance.itemType === 'weapon' || r.resolved.instance.itemType === 'shield'
  );
  const otherRows = resolvedRows.filter(
    (r) =>
      r.resolved.instance.itemType !== 'armor' &&
      r.resolved.instance.itemType !== 'weapon' &&
      r.resolved.instance.itemType !== 'shield'
  );

  const coverageChecks = [
    ['head', 'Head'],
    ['face', 'Face'],
    ['chestLeft', 'Chest'],
    ['stomachUpper', 'Upper belly'],
    ['groin', 'Groin'],
    ['thighOuterLeft', 'Outer thigh'],
    ['kneeLeft', 'Knee'],
    ['lowerLegLeft', 'Lower leg'],
  ] as const;

  const renderCard = (slot: EquipmentSlotId, resolved: (typeof resolvedRows)[0]['resolved']) => {
    const { instance, template, material, weight, coverage, durabilityRatio } = resolved;
    const isArmor = instance.itemType === 'armor';
    const covText = isArmor ? coverageLabelList(coverage) : '';
    const ruined = durabilityRatio <= 0;

    return (
      <div
        key={slot}
        style={{
          ...cardStyle,
          border: ruined
            ? '1px solid rgba(248,113,113,0.45)'
            : '1px solid rgba(255,255,255,0.12)',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.55,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              {formatEquipmentSlotLabel(slot)}
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: 2 }}>{instance.name}</div>
          </div>
          <Tag
            tone={
              instance.itemType === 'armor'
                ? 'info'
                : instance.itemType === 'shield'
                  ? 'ok'
                  : 'neutral'
            }
          >
            {instance.itemType}
            {instance.weaponType ? ` · ${instance.weaponType}` : ''}
            {ruined ? ' · ruined' : ''}
          </Tag>
        </div>

        {instance.description ? (
          <p style={{ margin: 0, fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
            {instance.description}
          </p>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 12px',
            fontSize: 12,
          }}
        >
          <div>
            <span style={{ opacity: 0.5 }}>Material</span>
            <div>{template.material}</div>
          </div>
          <div>
            <span style={{ opacity: 0.5 }}>Mat. strength</span>
            <div>{material.strength}</div>
          </div>
          <div>
            <span style={{ opacity: 0.5 }}>Mat. durability</span>
            <div>{material.durability}</div>
          </div>
          <div>
            <span style={{ opacity: 0.5 }}>Weight</span>
            <div>{weight.toFixed(2)}</div>
          </div>
          {template.sizePreset ? (
            <div>
              <span style={{ opacity: 0.5 }}>Plate size</span>
              <div>{template.sizePreset}</div>
            </div>
          ) : null}
          {template.garmentLength ? (
            <div>
              <span style={{ opacity: 0.5 }}>Garment length</span>
              <div>{template.garmentLength}</div>
            </div>
          ) : null}
          {template.sleeveStyle ? (
            <div>
              <span style={{ opacity: 0.5 }}>Sleeve style</span>
              <div>{template.sleeveStyle}</div>
            </div>
          ) : null}
          {template.footwearLength ? (
            <div>
              <span style={{ opacity: 0.5 }}>Footwear height</span>
              <div>{template.footwearLength}</div>
            </div>
          ) : null}
          {template.headwearStyle ? (
            <div>
              <span style={{ opacity: 0.5 }}>Headwear style</span>
              <div>{template.headwearStyle}</div>
            </div>
          ) : null}
          <div>
            <span style={{ opacity: 0.5 }}>Instance dur.</span>
            <div>{(durabilityRatio * 100).toFixed(0)}%</div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>Durability</div>
          <FractionBar
            value={durabilityRatio}
            color={
              durabilityRatio > 0.6 ? '#4ade80' : durabilityRatio > 0.3 ? '#fbbf24' : '#f87171'
            }
            height={6}
          />
        </div>

        {isArmor ? (
          <div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>Body coverage</div>
            {covText ? (
              <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.9 }}>{covText}</div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.5 }}>No coverage map.</div>
            )}
          </div>
        ) : null}

        {isArmor && instance.panelDurability && Object.keys(instance.panelDurability).length > 0 ? (
          <div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>
              Panel integrity (by area)
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.9 }}>
              {(
                Object.entries(instance.panelDurability) as [BodyPartId, number | undefined][]
              )
                .filter(([, v]) => v != null)
                .map(([part, v]) => {
                  const cov = coverage[part] ?? 0;
                  const frac =
                    instance.maxDurability > 0 ? (v! / instance.maxDurability) * 100 : 0;
                  return `${formatBodyPartLabel(part)} ${frac.toFixed(0)}%${
                    cov > 0 && cov < 1 ? ` (cov ${(cov * 100).toFixed(0)}%)` : ''
                  }`;
                })
                .join(' · ')}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <button type="button" style={btn} onClick={() => onUnequip(slot)}>
            Unequip
          </button>
          {ruined && isArmor ? (
            <button type="button" style={btnDanger} onClick={() => onDiscard(slot)}>
              Discard ruined
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const section = (title: string, rows: typeof resolvedRows) =>
    rows.length === 0 ? null : (
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, opacity: 0.85 }}>{title}</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {rows.map(({ slot, resolved }) => renderCard(slot, resolved))}
        </div>
      </div>
    );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <Tag>
          {resolvedRows.length} equipped · {bag.length} in bank · weight {totalWeight.toFixed(2)}
        </Tag>
        <Tag>{emptySlots.length} empty slot{emptySlots.length === 1 ? '' : 's'}</Tag>
        {unresolved.length > 0 ? (
          <Tag tone="warn">{unresolved.length} unresolved</Tag>
        ) : null}
        <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={onReset}>
          Reset starter loadout
        </button>
      </div>

      {note ? (
        <p
          role="status"
          data-testid="wardrobe-note"
          style={{
            margin: '0 0 14px',
            fontSize: 13,
            color: '#c4b5fd',
            lineHeight: 1.4,
          }}
        >
          {note}
        </p>
      ) : null}

      {unresolved.length > 0 ? (
        <div
          style={{
            marginBottom: 14,
            padding: 10,
            borderRadius: 8,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(248,113,113,0.35)',
            fontSize: 12,
          }}
        >
          Could not resolve catalog data for:{' '}
          {unresolved.map((slot) => `${slot}=${unit.equipment[slot]}`).join(', ')}
        </div>
      ) : null}

      <details
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          background: 'rgba(125,211,252,0.06)',
          border: '1px solid rgba(125,211,252,0.2)',
          fontSize: 13,
        }}
      >
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Coverage stack checks</summary>
        {coverageChecks.map(([partId, label]) => {
          const layers = getProtectingArmor(partId, unit.equipment, itemsById);
          return (
            <div key={partId} style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.45 }}>
              <div style={{ fontWeight: 600 }}>{label}</div>
              {layers.length === 0 ? (
                <div style={{ opacity: 0.65 }}>No covering layer.</div>
              ) : (
                <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {layers.map((layer, i) => (
                    <li key={layer.instance.id}>
                      <strong>{layer.instance.name}</strong> ({layer.instance.slot})
                      {layer.template.garmentLength
                        ? ` · garment ${layer.template.garmentLength}`
                        : ''}
                      {layer.template.footwearLength
                        ? ` · footwear ${layer.template.footwearLength}`
                        : ''}
                      {layer.template.sizePreset ? ` · plate ${layer.template.sizePreset}` : ''} ·
                      cov {((layer.coverage[partId] ?? 0) * 100).toFixed(0)}%
                      {i === 0 ? ' ← outermost' : ''}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </details>

      {section('Armor', armorRows)}
      {section('Weapons & shields', weaponRows)}
      {section('Other', otherRows)}

      {resolvedRows.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No equipped items resolved for this character.</p>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, opacity: 0.85 }}>
          Owned · unequipped ({bag.length})
        </h3>
        {bag.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.55 }}>
            Nothing in the bank off-body. Unequip a piece to stash it here.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {bag.map((item) => (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 8,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 13,
                }}
              >
                <span>
                  <span style={{ opacity: 0.55 }}>{formatEquipmentSlotLabel(item.slot)}</span>
                  {' · '}
                  <strong>{item.name}</strong>
                  <span style={{ opacity: 0.55 }}>
                    {' '}
                    · {item.itemType}
                    {item.weaponType ? ` / ${item.weaponType}` : ''}
                  </span>
                </span>
                <button type="button" style={btn} onClick={() => onEquip(item.id)}>
                  Equip
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <details style={{ opacity: 0.6, fontSize: 12 }}>
        <summary style={{ cursor: 'pointer' }}>Empty slots ({emptySlots.length})</summary>
        <p style={{ marginTop: 8 }}>
          {emptySlots.map(formatEquipmentSlotLabel).join(' · ') || 'None'}
        </p>
      </details>
    </div>
  );
}

function StanceSkillTable({ unit }: { unit: DetailedUnit }) {
  const { stanceSkill, preferredCover, preferredStrike, currentStance } = unit.combatStats;
  const maxRank = Math.max(...STANCE_IDS.map((id) => stanceSkill[id]), 1);
  const preferredIds = new Set([preferredCover, preferredStrike]);
  const trained = STANCE_IDS.filter((id) => stanceSkill[id] > 1 || preferredIds.has(id));
  const rest = STANCE_IDS.filter((id) => !trained.includes(id));

  const renderRow = (id: StanceId) => {
    const rank = stanceSkill[id];
    const preferred = preferredIds.has(id);
    const barRatio = rank / maxRank;
    return (
      <tr
        key={id}
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: preferred
            ? 'rgba(125,211,252,0.1)'
            : rank > 1
              ? 'rgba(167,139,250,0.08)'
              : 'transparent',
        }}
      >
        <td style={{ padding: '7px 8px' }}>
          {formatStanceLabel(id)}
          {preferred ? <span style={{ opacity: 0.5, fontSize: 11 }}> · preferred</span> : null}
        </td>
        <td style={{ padding: '7px 8px', width: 100 }}>
          <FractionBar
            value={barRatio}
            color={rank > 10 ? '#7dd3fc' : rank > 1 ? '#38bdf8' : '#64748b'}
            height={6}
          />
        </td>
        <td
          style={{
            padding: '7px 8px',
            width: 48,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: rank > 1 ? 600 : 400,
          }}
        >
          {rank}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <p style={{ opacity: 0.7, fontSize: 12, margin: '0 0 10px', lineHeight: 1.4 }}>
        Preferred cover / strike:{' '}
        <strong>{formatStanceLabel(preferredCover)}</strong> /{' '}
        <strong>{formatStanceLabel(preferredStrike)}</strong>
        {currentStance.cover !== preferredCover || currentStance.strike !== preferredStrike
          ? ` · live ${formatStanceLabel(currentStance.cover)} / ${formatStanceLabel(currentStance.strike)}`
          : ''}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>{trained.map(renderRow)}</tbody>
      </table>
      {rest.length > 0 ? (
        <details style={{ marginTop: 8, opacity: 0.55, fontSize: 12 }}>
          <summary style={{ cursor: 'pointer' }}>Untrained ({rest.length})</summary>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <tbody>{rest.map(renderRow)}</tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}

function WeaponSkillTable({ unit }: { unit: DetailedUnit }) {
  const { weaponSkill } = unit.combatStats;
  const maxRank = Math.max(...WEAPON_TYPES.map((id) => weaponSkill[id]), 1);
  const trained = WEAPON_TYPES.filter((id) => weaponSkill[id] > 1);
  const rest = WEAPON_TYPES.filter((id) => weaponSkill[id] <= 1 && id !== 'unequipped');

  const renderRow = (id: WeaponTypeId) => {
    const rank = weaponSkill[id];
    const barRatio = rank / maxRank;
    return (
      <tr
        key={id}
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: rank > 1 ? 'rgba(167,139,250,0.08)' : 'transparent',
        }}
      >
        <td style={{ padding: '7px 8px' }}>{formatWeaponTypeLabel(id)}</td>
        <td style={{ padding: '7px 8px', width: 100 }}>
          <FractionBar
            value={barRatio}
            color={rank > 10 ? '#c084fc' : rank > 1 ? '#a78bfa' : '#64748b'}
            height={6}
          />
        </td>
        <td
          style={{
            padding: '7px 8px',
            width: 48,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: rank > 1 ? 600 : 400,
          }}
        >
          {rank}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <p style={{ opacity: 0.7, fontSize: 12, margin: '0 0 10px' }}>
        {trained.length} trained type{trained.length === 1 ? '' : 's'} (rank &gt; 1)
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {trained.length > 0 ? trained.map(renderRow) : (
            <tr>
              <td style={{ padding: '7px 8px', opacity: 0.55 }} colSpan={3}>
                No trained weapon types yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {rest.length > 0 ? (
        <details style={{ marginTop: 8, opacity: 0.55, fontSize: 12 }}>
          <summary style={{ cursor: 'pointer' }}>Untrained ({rest.length})</summary>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <tbody>{rest.map(renderRow)}</tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}

function CharacterPicker({ currentId }: { currentId?: string }) {
  const cast = listDetailedCharacters();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
      {cast.map((u) => (
        <Link
          key={u.id}
          to={`/characters/detailed/${u.id}`}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            textDecoration: 'none',
            color: '#fff',
            background: u.id === currentId ? '#4a1d96' : 'rgba(255,255,255,0.08)',
            border: u.id === currentId ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.15)',
            fontSize: 13,
          }}
        >
          {u.name}
        </Link>
      ))}
    </div>
  );
}

function CharacterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [unit, setUnit] = useState<DetailedUnit | null>(() =>
    id ? cloneWardrobe(id)?.unit ?? null : null
  );
  const [itemsById, setItemsById] = useState<Record<string, Item>>(() =>
    id ? cloneWardrobe(id)?.itemsById ?? {} : {}
  );
  const [gearNote, setGearNote] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setUnit(null);
      setItemsById({});
      setGearNote(null);
      return;
    }
    const cloned = cloneWardrobe(id);
    if (!cloned) {
      setUnit(null);
      setItemsById({});
      setGearNote(null);
      return;
    }
    setUnit(cloned.unit);
    setItemsById(cloned.itemsById);
    setGearNote(null);
  }, [id]);

  const syncGear = (nextUnit: DetailedUnit, nextItems: Record<string, Item>) => {
    setUnit({
      ...nextUnit,
      equipment: { ...nextUnit.equipment },
    });
    setItemsById({ ...nextItems });
  };

  const onUnequip = (slot: ItemSlot) => {
    if (!unit) return;
    const r = unequipSlot({ unit, itemsById }, slot);
    if (!r.ok) {
      setGearNote(r.message);
      return;
    }
    syncGear(unit, itemsById);
    setGearNote(`Unequipped ${r.item.name} (${formatEquipmentSlotLabel(slot)}).`);
  };

  const onEquip = (itemId: string) => {
    if (!unit) return;
    const r = equipItem({ unit, itemsById }, itemId);
    if (!r.ok) {
      setGearNote(r.message);
      return;
    }
    syncGear(unit, itemsById);
    const prev = r.previous ? ` (replaced ${r.previous.name})` : '';
    setGearNote(
      `Equipped ${r.item.name} → ${formatEquipmentSlotLabel(r.item.equippedSlot as ItemSlot)}${prev}.`
    );
  };

  const onDiscard = (slot: ItemSlot) => {
    if (!unit) return;
    const r = discardEquipped({ unit, itemsById }, slot);
    if (!r.ok) {
      setGearNote(r.message);
      return;
    }
    syncGear(unit, itemsById);
    setGearNote(`Discarded ${r.item.name} (${formatEquipmentSlotLabel(slot)}).`);
  };

  const onReset = () => {
    if (!id) return;
    const cloned = cloneWardrobe(id);
    if (!cloned) return;
    setUnit(cloned.unit);
    setItemsById(cloned.itemsById);
    setGearNote('Reset to starter loadout.');
  };

  const mutatePartCare = (part: BodyPartId, kind: 'bandage' | 'vulnerary') => {
    if (!unit) return;
    const nextUnit = structuredClone(unit) as DetailedUnit;
    const nextItems = { ...itemsById };
    const r =
      kind === 'bandage'
        ? useBandageOnPart(nextUnit.combatStats.itemizedHealth, part, nextItems, {
            allowLabFree: true,
          })
        : useVulneraryOnPart(nextUnit.combatStats.itemizedHealth, part, nextItems, {
            allowLabFree: true,
          });
    if (!r.ok) {
      setGearNote(r.message);
      return;
    }
    setUnit(nextUnit);
    setItemsById(nextItems);
    const label = formatBodyPartLabel(part);
    const spent = r.consumedId ? ' · consumed' : r.labFree ? ' · lab free' : '';
    const already = r.already ? ' (already applied)' : '';
    setGearNote(
      `${kind === 'bandage' ? 'Bandage' : 'Vulnerary'} → ${label}${already}${spent}.${
        r.ok && r.warning ? ` ${r.warning}` : ''
      }`
    );
  };

  const onLabInjure = (part: BodyPartId) => {
    if (!unit) return;
    const nextUnit = structuredClone(unit) as DetailedUnit;
    const s = nextUnit.combatStats.itemizedHealth[part];
    s.health = Math.max(0, Math.round((s.health - 0.35) * 1000) / 1000);
    const chip = 0.35;
    s.bleed = Math.max(s.bleed, Math.min(1, chip * 0.85));
    s.internalBleed = Math.max(s.internalBleed, Math.min(1, chip * 0.15));
    const concussed = syncConcussionFlag(nextUnit.combatStats.itemizedHealth);
    setUnit(nextUnit);
    setGearNote(
      `Lab injure ${formatBodyPartLabel(part)} → health ${(s.health * 100).toFixed(0)}% · bleed ${(s.bleed * 100).toFixed(0)}% / i-bleed ${(s.internalBleed * 100).toFixed(0)}%${
        part === 'head' && concussed ? ' · CONCUSSED' : ''
      }.`
    );
  };

  const onLabTrauma = (part: BodyPartId, level: TraumaLevel) => {
    if (!unit) return;
    const nextUnit = structuredClone(unit) as DetailedUnit;
    if (level === 'none') {
      clearTraumaFlag(nextUnit.combatStats.itemizedHealth, part);
    } else {
      setTraumaFlag(nextUnit.combatStats.itemizedHealth, part, level);
    }
    setUnit(nextUnit);
    setGearNote(
      level === 'none'
        ? `Cleared trauma on ${formatBodyPartLabel(part)}.`
        : `Set ${level} on ${formatBodyPartLabel(part)} (health unchanged).`
    );
  };

  const onTogglePressure = (part: BodyPartId) => {
    if (!unit) return;
    const nextUnit = structuredClone(unit) as DetailedUnit;
    const s = nextUnit.combatStats.itemizedHealth[part];
    const r = s.directPressure
      ? releaseDirectPressure(nextUnit.combatStats.itemizedHealth, part)
      : applyDirectPressure(nextUnit.combatStats.itemizedHealth, part);
    if (!r.ok) {
      setGearNote(r.message);
      return;
    }
    setUnit(nextUnit);
    setGearNote(
      s.directPressure
        ? `Released pressure on ${formatBodyPartLabel(part)}.`
        : `Applying direct pressure on ${formatBodyPartLabel(part)}.`
    );
  };

  if (!unit) {
    return (
      <div style={pageStyle}>
        <button type="button" onClick={() => navigate('/characters')} style={{ ...btnNav, marginBottom: 16 }}>
          ← Character List
        </button>
        <h1>Character not found</h1>
        <p style={{ opacity: 0.8 }}>
          No detailed unit with id <code>{id}</code>. Pick one of the design cast:
        </p>
        <CharacterPicker currentId={id} />
      </div>
    );
  }

  const { base } = unit.combatStats;
  const blood = getBloodStatus(unit);
  const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
  const derived = deriveHealthFromItemized(
    unit.combatStats.itemizedHealth,
    base.health,
    base.bloodLoss,
    bloodPen.vitality
  );
  const hpCurrent = derived.healthCurrent;
  const staminaCurrent = base.staminaCurrent ?? base.staminaCap;

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <button type="button" onClick={() => navigate('/characters')} style={btnNav}>
          ← Character List
        </button>
        <button type="button" onClick={() => navigate('/battleground')} style={btnNav}>
          Battleground
        </button>
        <button type="button" onClick={() => navigate('/')} style={btnNav}>
          Title
        </button>
      </div>

      <CharacterPicker currentId={unit.id} />

      {/* Identity + vitals */}
      <header
        style={{
          ...cardStyle,
          marginBottom: 18,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(220px, 0.8fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div>
          <p style={{ margin: '0 0 6px', opacity: 0.55, fontSize: 12, letterSpacing: 0.6 }}>
            COMBAT DOSSIER
          </p>
          <h1 style={{ margin: '0 0 8px', fontSize: '1.85rem' }}>{unit.name}</h1>
          <p style={{ margin: 0, opacity: 0.85, fontSize: 14 }}>
            {unit.class ?? '—'} · Lv. {unit.level ?? '?'} · {unit.sex} · age {unit.age} ·{' '}
            {unit.allegiance}
          </p>
          {unit.description ? (
            <p style={{ margin: '10px 0 0', maxWidth: 560, opacity: 0.7, lineHeight: 1.45, fontSize: 13 }}>
              {unit.description}
            </p>
          ) : null}
        </div>
        <div>
          <StatBar
            label="Health"
            value={hpCurrent}
            max={base.health}
            color={healthColor(hpCurrent / Math.max(1, base.health))}
          />
          <StatBar
            label="Stamina"
            value={staminaCurrent}
            max={base.staminaCap}
            color="#38bdf8"
          />
          <StatBar
            label="Blood"
            value={blood.remainingLiters}
            max={blood.volumeLiters}
            color={
              blood.lossClass === 'none' || blood.lossClass === 'slight'
                ? '#f87171'
                : blood.lossClass === 'mild' || blood.lossClass === 'moderate'
                  ? '#fb923c'
                  : '#dc2626'
            }
            suffix="L"
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <Tag tone={blood.lossClass === 'none' ? 'ok' : 'warn'}>
              blood · {blood.lossClass}
            </Tag>
            {derived.totalBleedRate > 0 ? (
              <Tag tone="warn">bleed {derived.totalBleedRate.toFixed(2)}</Tag>
            ) : (
              <Tag tone="ok">no active bleed</Tag>
            )}
          </div>
        </div>
      </header>

      {/* Stats + skills */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(0, 1.1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <SectionCard title="Base stats" eyebrow="Combat attributes">
          <BaseCombatPanel unit={unit} />
        </SectionCard>

        <SectionCard title="Skills" eyebrow="Stance · weapon">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 13, opacity: 0.75 }}>Stance</h3>
              <StanceSkillTable unit={unit} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 13, opacity: 0.75 }}>Weapons</h3>
              <WeaponSkillTable unit={unit} />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Health + equipment */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <SectionCard title="Itemized health" eyebrow="Wound care · trauma lab">
          <ItemizedHealthTable
            unit={unit}
            bandageCount={Object.values(itemsById).filter(
              (i) => i.templateId === BANDAGE_TEMPLATE_ID
            ).length}
            vulneraryCount={Object.values(itemsById).filter(
              (i) => i.templateId === VULNERARY_TEMPLATE_ID
            ).length}
            onBandage={(part) => mutatePartCare(part, 'bandage')}
            onVulnerary={(part) => mutatePartCare(part, 'vulnerary')}
            onLabInjure={onLabInjure}
            onLabTrauma={onLabTrauma}
            onTogglePressure={onTogglePressure}
          />
        </SectionCard>

        <SectionCard title="Equipment" eyebrow="Loadout · coverage · bank">
          <EquipmentPanel
            unit={unit}
            itemsById={itemsById}
            note={gearNote}
            onUnequip={onUnequip}
            onEquip={onEquip}
            onDiscard={onDiscard}
            onReset={onReset}
          />
        </SectionCard>
      </div>
    </div>
  );
}

export default CharacterDetail;
