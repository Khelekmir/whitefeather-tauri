import { useMemo, type CSSProperties } from 'react';
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
import {
  DETAILED_ITEM_BANK,
  getCombatCastInventory,
} from './data/starters/combatCastInventory';
import {
  getProtectingArmor,
  listEquippedResolved,
  sumEquippedWeight,
} from './utils/items/resolveItem';

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

function injuryTags(part: BodyPartHealth): string[] {
  const tags: string[] = [];
  if (part.bruise) tags.push('bruise');
  if (part.sprain) tags.push('sprain');
  if (part.fracture) tags.push('fracture');
  if (part.broken) tags.push('broken');
  if (part.dressed) tags.push('dressed');
  if (part.vulnerary) tags.push('vulnerary');
  if (part.bleed > 0) tags.push(`bleed ${(part.bleed * 100).toFixed(0)}%`);
  if (part.internalBleed > 0) tags.push(`i-bleed ${(part.internalBleed * 100).toFixed(0)}%`);
  return tags;
}

function ItemizedHealthTable({ unit }: { unit: DetailedUnit }) {
  const rows = useMemo(() => {
    return BODY_PARTS.map((id: BodyPartId) => {
      const part = unit.combatStats.itemizedHealth[id];
      return { id, part, tags: injuryTags(part) };
    });
  }, [unit]);

  const injuredOnly = rows.filter((r) => r.part.health < 1 || r.tags.length > 0);

  return (
    <div>
      <p style={{ opacity: 0.75, fontSize: 14, marginTop: 0 }}>
        Tracking {BODY_PARTS.length} body areas (0–1 health).{' '}
        {injuredOnly.length === 0
          ? 'No active injuries.'
          : `${injuredOnly.length} area(s) not fully healthy.`}
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>
              <th style={{ padding: '8px 10px' }}>Body part</th>
              <th style={{ padding: '8px 10px', width: 140 }}>Health</th>
              <th style={{ padding: '8px 10px', width: 70 }}>%</th>
              <th style={{ padding: '8px 10px' }}>Flags / bleed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, part, tags }) => {
              const dimmed = part.health >= 1 && tags.length === 0;
              return (
                <tr
                  key={id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    opacity: dimmed ? 0.55 : 1,
                    background:
                      part.health < 0.85 ? 'rgba(248,113,113,0.06)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 10px' }}>
                    <code style={{ fontSize: 12, opacity: 0.7 }}>{id}</code>
                    <div>{formatBodyPartLabel(id)}</div>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <FractionBar value={part.health} color={healthColor(part.health)} />
                  </td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>
                    {(part.health * 100).toFixed(0)}%
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {tags.length === 0 ? (
                      <span style={{ opacity: 0.4 }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {tags.map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.12)',
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
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
  const entries = Object.entries(base);

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: 14,
        maxWidth: 420,
      }}
    >
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Base stats</h3>
      <dl
        style={{
          margin: 0,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '4px 12px',
          fontSize: 13,
        }}
      >
        {entries.map(([key, value]) => (
          <div key={key} style={{ display: 'contents' }}>
            <dt style={{ opacity: 0.7 }}>{key}</dt>
            <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
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

function EquipmentLoadoutTable({ unit }: { unit: DetailedUnit }) {
  const kit = getCombatCastInventory(unit.id);
  const itemsById = kit?.items ?? DETAILED_ITEM_BANK;
  const resolvedRows = listEquippedResolved(unit.equipment, itemsById);
  const totalWeight = sumEquippedWeight(unit.equipment, itemsById);
  const stomachLayers = getProtectingArmor('stomachUpper', unit.equipment, itemsById);
  const thighLayers = getProtectingArmor('thighOuterLeft', unit.equipment, itemsById);
  const kneeLayers = getProtectingArmor('kneeLeft', unit.equipment, itemsById);
  const calfLayers = getProtectingArmor('lowerLegLeft', unit.equipment, itemsById);
  const emptySlots = EQUIPMENT_SLOTS.filter((slot) => unit.equipment[slot] == null);
  const unresolved = EQUIPMENT_SLOTS.filter((slot) => {
    const id = unit.equipment[slot];
    return id != null && !resolvedRows.some((r) => r.slot === slot);
  });

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

  const renderCard = (slot: EquipmentSlotId, resolved: (typeof resolvedRows)[0]['resolved']) => {
    const { instance, template, material, weight, coverage, durabilityRatio } = resolved;
    const isArmor = instance.itemType === 'armor';
    const covText = isArmor ? coverageLabelList(coverage) : '';

    return (
      <div
        key={slot}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.55, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              {formatEquipmentSlotLabel(slot)}
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: 2 }}>{instance.name}</div>
          </div>
          <span
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 999,
              background:
                instance.itemType === 'armor'
                  ? 'rgba(56,189,248,0.15)'
                  : instance.itemType === 'shield'
                    ? 'rgba(74,222,128,0.15)'
                    : 'rgba(251,146,60,0.15)',
              border: '1px solid rgba(255,255,255,0.12)',
              whiteSpace: 'nowrap',
            }}
          >
            {instance.itemType}
            {instance.weaponType ? ` · ${instance.weaponType}` : ''}
          </span>
        </div>

        {instance.description && (
          <p style={{ margin: 0, fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
            {instance.description}
          </p>
        )}

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
          {template.sizePreset && (
            <div>
              <span style={{ opacity: 0.5 }}>Plate size</span>
              <div>{template.sizePreset}</div>
            </div>
          )}
          {template.garmentLength && (
            <div>
              <span style={{ opacity: 0.5 }}>Garment length</span>
              <div>{template.garmentLength}</div>
            </div>
          )}
          {template.footwearLength && (
            <div>
              <span style={{ opacity: 0.5 }}>Footwear height</span>
              <div>{template.footwearLength}</div>
            </div>
          )}
          {template.headwearStyle && (
            <div>
              <span style={{ opacity: 0.5 }}>Headwear style</span>
              <div>{template.headwearStyle}</div>
            </div>
          )}
          {template.underwearStyle && (
            <div>
              <span style={{ opacity: 0.5 }}>Underwear style</span>
              <div>{template.underwearStyle}</div>
            </div>
          )}
          {template.undershirtStyle && (
            <div>
              <span style={{ opacity: 0.5 }}>Undershirt style</span>
              <div>{template.undershirtStyle}</div>
            </div>
          )}
          {template.flags?.sex && (
            <div>
              <span style={{ opacity: 0.5 }}>Cut / sex</span>
              <div>{template.flags.sex}</div>
            </div>
          )}
          <div>
            <span style={{ opacity: 0.5 }}>Instance dur.</span>
            <div>{(durabilityRatio * 100).toFixed(0)}%</div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>Durability</div>
          <FractionBar
            value={durabilityRatio}
            color={durabilityRatio > 0.6 ? '#4ade80' : durabilityRatio > 0.3 ? '#fbbf24' : '#f87171'}
            height={6}
          />
        </div>

        {isArmor && (
          <div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>Body coverage</div>
            {covText ? (
              <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.9 }}>{covText}</div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.5 }}>No coverage map (slot default empty).</div>
            )}
          </div>
        )}

        <div style={{ fontSize: 11, opacity: 0.45, fontFamily: 'ui-monospace, monospace' }}>
          template: {template.templateId}
          <br />
          id: {instance.id}
        </div>
      </div>
    );
  };

  const section = (title: string, rows: typeof resolvedRows) =>
    rows.length === 0 ? null : (
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, opacity: 0.9 }}>{title}</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {rows.map(({ slot, resolved }) => renderCard(slot, resolved))}
        </div>
      </div>
    );

  return (
    <div>
      <p style={{ opacity: 0.75, fontSize: 14, marginTop: 0 }}>
        {resolvedRows.length} equipped · gear weight ≈ <strong>{totalWeight.toFixed(2)}</strong>
        {' · '}
        {emptySlots.length} empty slot{emptySlots.length === 1 ? '' : 's'}
        {unresolved.length > 0 && (
          <span style={{ color: '#fca5a5' }}>
            {' · '}
            {unresolved.length} unresolved id(s)
          </span>
        )}
      </p>

      <div
        style={{
          marginBottom: 18,
          padding: 12,
          borderRadius: 8,
          background: 'rgba(167,139,250,0.08)',
          border: '1px solid rgba(167,139,250,0.25)',
          fontSize: 13,
        }}
      >
        <strong>Coverage checks</strong>
        {(
          [
            ['head', 'Head (helmet / hat / ornament)', getProtectingArmor('head', unit.equipment, itemsById)],
            ['face', 'Face (full vs half helm)', getProtectingArmor('face', unit.equipment, itemsById)],
            ['stomachUpper', 'Upper belly', stomachLayers],
            ['chestLeft', 'Chest (bra / slip / plate)', getProtectingArmor('chestLeft', unit.equipment, itemsById)],
            ['thighOuterLeft', 'Outer thigh (dress / slip / boot)', thighLayers],
            ['kneeLeft', 'Knee (robe / full slip / riding boot)', kneeLayers],
            ['lowerLegLeft', 'Lower leg / calf (boots vs shoes)', calfLayers],
            ['groin', 'Groin (panty / cloth / slip skirt)', getProtectingArmor('groin', unit.equipment, itemsById)],
          ] as const
        ).map(([partId, label, layers]) => (
          <div key={partId} style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 600 }}>{label}</div>
            {layers.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No covering layer.</div>
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
                    {layer.template.sizePreset ? ` · plate ${layer.template.sizePreset}` : ''} · cov{' '}
                    {((layer.coverage[partId] ?? 0) * 100).toFixed(0)}%
                    {i === 0 ? ' ← outermost' : ''}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>

      {unresolved.length > 0 && (
        <div
          style={{
            marginBottom: 16,
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
      )}

      {section('Armor', armorRows)}
      {section('Weapons & shields', weaponRows)}
      {section('Other', otherRows)}

      {resolvedRows.length === 0 && (
        <p style={{ opacity: 0.7 }}>No equipped items resolved for this character.</p>
      )}

      <details style={{ marginTop: 8, opacity: 0.65, fontSize: 12 }}>
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

  return (
    <div>
      <p style={{ opacity: 0.75, fontSize: 14, marginTop: 0 }}>
        Cover High / Mid / Low reshapes presented hit locations. Strike High / Mid / Low contests
        that cover (same / adjacent / opposite). Ranks grow with use, same as weapons. Preferred:{' '}
        <strong>{formatStanceLabel(preferredCover)}</strong> /{' '}
        <strong>{formatStanceLabel(preferredStrike)}</strong>
        {currentStance.cover !== preferredCover || currentStance.strike !== preferredStrike
          ? ` · live ${formatStanceLabel(currentStance.cover)} / ${formatStanceLabel(currentStance.strike)}`
          : ''}
        .
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>
              <th style={{ padding: '8px 10px' }}>Stance</th>
              <th style={{ padding: '8px 10px', width: 160 }}>Rank</th>
              <th style={{ padding: '8px 10px', width: 80 }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {STANCE_IDS.map((id: StanceId) => {
              const rank = stanceSkill[id];
              const preferred = id === preferredCover || id === preferredStrike;
              const dimmed = rank <= 1 && !preferred;
              const barRatio = rank / maxRank;
              return (
                <tr
                  key={id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    opacity: dimmed ? 0.5 : 1,
                    background: preferred
                      ? 'rgba(125,211,252,0.1)'
                      : rank > 1
                        ? 'rgba(167,139,250,0.08)'
                        : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 10px' }}>
                    <code style={{ fontSize: 12, opacity: 0.7 }}>{id}</code>
                    <div>
                      {formatStanceLabel(id)}
                      {preferred ? (
                        <span style={{ opacity: 0.55, fontSize: 12 }}> · preferred</span>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <FractionBar
                      value={barRatio}
                      color={rank > 10 ? '#7dd3fc' : rank > 1 ? '#38bdf8' : '#64748b'}
                    />
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: rank > 1 ? 600 : 400,
                    }}
                  >
                    {rank}
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

function WeaponSkillTable({ unit }: { unit: DetailedUnit }) {

  const { weaponSkill } = unit.combatStats;
  const maxRank = Math.max(...WEAPON_TYPES.map((id) => weaponSkill[id]), 1);
  const trained = WEAPON_TYPES.filter((id) => weaponSkill[id] > 1);

  return (
    <div>
      <p style={{ opacity: 0.75, fontSize: 14, marginTop: 0 }}>
        Tracking {WEAPON_TYPES.length} weapon types. Ranks grow without a hard cap as weapons are
        used in combat. {trained.length} type(s) above untrained baseline (rank &gt; 1).
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>
              <th style={{ padding: '8px 10px' }}>Weapon type</th>
              <th style={{ padding: '8px 10px', width: 160 }}>Rank</th>
              <th style={{ padding: '8px 10px', width: 80 }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {WEAPON_TYPES.map((id: WeaponTypeId) => {
              const rank = weaponSkill[id];
              const dimmed = rank <= 1 && id !== 'unequipped';
              const barRatio = rank / maxRank;
              return (
                <tr
                  key={id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    opacity: dimmed ? 0.5 : 1,
                    background: rank > 1 ? 'rgba(167,139,250,0.08)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 10px' }}>
                    <code style={{ fontSize: 12, opacity: 0.7 }}>{id}</code>
                    <div>{formatWeaponTypeLabel(id)}</div>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <FractionBar
                      value={barRatio}
                      color={rank > 10 ? '#c084fc' : rank > 1 ? '#a78bfa' : '#64748b'}
                    />
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: rank > 1 ? 600 : 400,
                    }}
                  >
                    {rank}
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

function CharacterPicker({ currentId }: { currentId?: string }) {
  const cast = listDetailedCharacters();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
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
  const unit = id ? getDetailedCharacter(id) : undefined;

  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    padding: '28px 32px 48px',
    fontFamily: 'system-ui, sans-serif',
    background: 'linear-gradient(180deg, #12081f 0%, #0a0a12 40%, #0a0a12 100%)',
    color: '#f0f0f5',
    boxSizing: 'border-box',
  };

  if (!unit) {
    return (
      <div style={pageStyle}>
        <button type="button" onClick={() => navigate('/characters')} style={{ marginBottom: 16 }}>
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

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <button type="button" onClick={() => navigate('/characters')} style={{ padding: '8px 16px' }}>
          ← Character List
        </button>
        <button type="button" onClick={() => navigate('/')} style={{ padding: '8px 16px' }}>
          Title
        </button>
      </div>

      <CharacterPicker currentId={unit.id} />

      <header style={{ marginBottom: 28 }}>
        <p style={{ margin: '0 0 6px', opacity: 0.65, fontSize: 13, letterSpacing: 0.5 }}>
          DETAILED MODEL · COMBAT FOCUS
        </p>
        <h1 style={{ margin: '0 0 8px', fontSize: '2rem' }}>{unit.name}</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>
          {unit.class ?? '—'} · Lv. {unit.level ?? '?'} · {unit.sex} · age {unit.age} ·{' '}
          {unit.allegiance}
        </p>
        <p style={{ margin: '12px 0 0', maxWidth: 640, opacity: 0.8, lineHeight: 1.5 }}>
          {unit.description}
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 13, opacity: 0.65 }}>
          Aggregate HP pool: {base.healthCurrent}/{base.health} · Stamina:{' '}
          {base.staminaCurrent}/{base.staminaCap}
        </p>
      </header>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid #444', paddingBottom: 8 }}>
          Combat stats
        </h2>
        <BaseCombatPanel unit={unit} />
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid #444', paddingBottom: 8 }}>
          Stance skills
        </h2>
        <StanceSkillTable unit={unit} />
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid #444', paddingBottom: 8 }}>
          Weapon skills
        </h2>
        <WeaponSkillTable unit={unit} />
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid #444', paddingBottom: 8 }}>
          Equipment
        </h2>
        <EquipmentLoadoutTable unit={unit} />
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid #444', paddingBottom: 8 }}>
          Itemized health
        </h2>
        <ItemizedHealthTable unit={unit} />
      </section>
    </div>
  );
}

export default CharacterDetail;
