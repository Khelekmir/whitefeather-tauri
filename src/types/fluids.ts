/**
 * Fluid samples: identity-bearing reagents for alchemy / mucosal transfer /
 * partner reaction. Cloth soil stays anonymous intensity; these objects are
 * stamped at emission (encounter deposits) or at explicit collect/harvest.
 *
 * Kept free of characters.ts imports to avoid cycles (LewdDynamic references these).
 */

/**
 * Open string ids — recipes and consumables add new ones without schema churn.
 * Examples: 'ethanol', 'magResElixir', 'slugAttractant', 'ironTonic'.
 */
export type FluidPropertyId = string;

/** Matches unit sex keys without importing characters. */
export type FluidDonorSex = 'M' | 'F';

/** One stamped influence carried by a fluid sample or ephemeral deposit. */
export interface FluidProperty {
  id: FluidPropertyId;
  /** Relative potency 0–1+ at stamp time (transfer fractions already applied). */
  potency01: number;
  /** Consumable / effect / recipe key that produced this trace. */
  sourceId?: string;
  /** Lab / inventory label. */
  label?: string;
}

/**
 * Bodily (and fantasy) fluids that can be deposited, collected, or mixed.
 * Broader than climax FluidKind — includes blood / sweat / urine for collect events.
 */
export type FluidSampleKind =
  | 'semen'
  | 'preEjaculate'
  | 'femaleEjaculate'
  | 'vaginalSecretion'
  | 'saliva'
  | 'blood'
  | 'sweat'
  | 'urine'
  | 'slugMucin'
  | 'other';

/** Where an ephemeral encounter deposit currently sits. */
export type FluidDepositLocus =
  | 'mouth'
  | 'vagina'
  | 'anus'
  | 'skin'
  | 'cloth'
  | 'held'
  | 'unknown';

/**
 * Scene-local deposit (arousal lifetime). Discarded when leaving the encounter.
 * Swallow / partner reaction / mid-scene harvest read this — not cloth soil.
 */
export interface EncounterFluidDeposit {
  id: string;
  kind: FluidSampleKind;
  fromId: string;
  fromSex?: FluidDonorSex;
  volume01: number;
  locus: FluidDepositLocus;
  properties: FluidProperty[];
}

/**
 * Persistent harvested / collected sample (inventory vial, folk-remedy stock).
 * Properties are frozen at collect time — later changes to the donor do not rewrite this.
 */
export interface FluidSample {
  id: string;
  kind: FluidSampleKind;
  fromId: string;
  fromSex?: FluidDonorSex;
  volume01: number;
  properties: FluidProperty[];
  /** Optional cycle-hour or world-hour stamp when collected. */
  collectedAt?: number;
  label?: string;
}

/**
 * Active substance on a character that should stamp onto emitted fluids.
 * Food, medicine, other fluids, and elixirs push traces here; stampFluidProperties reads them.
 */
export interface UnitSubstanceTrace {
  id: FluidPropertyId;
  potency01: number;
  sourceId?: string;
  label?: string;
  /**
   * Per-fluid transfer fraction (0–1). Omitted kinds use DEFAULT_FLUID_TRANSFER[kind].
   * Set a kind to 0 to block transfer into that fluid.
   */
  fluidTransfer?: Partial<Record<FluidSampleKind, number>>;
  /** Hours left before this trace clears; omit = until removed. */
  hoursRemaining?: number;
}
