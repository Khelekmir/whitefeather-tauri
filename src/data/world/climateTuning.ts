/**
 * Temperate fantasy climate placeholders (°F).
 * Later: seasons / regional climates shift these ranges.
 *
 * Precip bands are tuned with garment rainSoakPerHour so that, from a dry cloak
 * over ~1 hour outdoors:
 * - sprinkle → barely damp
 * - lightRain → lightly damp
 * - heavyRain → cloak ≈ 0.5 saturated
 * - storm → cloak + clothing fully wet (coverage overwhelmed)
 */

import type { WeatherSky } from '../../types/world';

export const CLIMATE_TUNING = {
  /**
   * Diurnal ambient curve (°F) before sky/wind.
   * Night low ~46°F, afternoon high ~72°F.
   */
  diurnal: {
    nightLowF: 46,
    afternoonHighF: 72,
    /** Hour of minimum (overnight). */
    troughHour: 5,
    /** Hour of maximum. */
    peakHour: 15,
  },

  /** Additive ambient deltas by sky. */
  skyAmbientDeltaF: {
    clear: 0,
    cloud: -4,
    sprinkle: -5,
    lightRain: -7,
    heavyRain: -9,
    storm: -12,
  } as Record<WeatherSky, number>,

  /** Extra chill per wind01 under precip / open sky. */
  windChillPerWindF: 6,

  /**
   * Precip rate 0–1 by sky.
   * Paired with garmentWetTuning.rainSoakPerHour ≈ 3.5
   * (≈97% of target in 1h from dry).
   */
  precipBySky: {
    clear: 0,
    cloud: 0,
    /** Hardly dampens cloak over an hour (~0.06). */
    sprinkle: 0.06,
    /** Lightly dampens cloak over an hour (~0.20). */
    lightRain: 0.21,
    /** Saturates cloak to ~0.5 over an hour. */
    heavyRain: 0.52,
    /** Full wet through cloak + clothing in ~1h (with coverage overwhelm). */
    storm: 1,
  } as Record<WeatherSky, number>,

  windBySky: {
    clear: 0.15,
    cloud: 0.25,
    sprinkle: 0.28,
    lightRain: 0.4,
    heavyRain: 0.55,
    storm: 0.85,
  } as Record<WeatherSky, number>,

  /** surfaceWet01 rise per hour at precip01=1. */
  wetRisePerHour: 0.35,
  /** surfaceWet01 decay per hour when dry. */
  wetDecayPerHour: 0.12,

  /**
   * Markov-ish weights when rolling sky after ≥1h advance.
   * Former single "rain" mass split across sprinkle / light / heavy.
   */
  skyTransition: {
    clear: {
      clear: 0.6,
      cloud: 0.26,
      sprinkle: 0.08,
      lightRain: 0.04,
      heavyRain: 0.015,
      storm: 0.005,
    },
    cloud: {
      clear: 0.26,
      cloud: 0.4,
      sprinkle: 0.14,
      lightRain: 0.12,
      heavyRain: 0.06,
      storm: 0.02,
    },
    sprinkle: {
      clear: 0.18,
      cloud: 0.32,
      sprinkle: 0.22,
      lightRain: 0.18,
      heavyRain: 0.08,
      storm: 0.02,
    },
    lightRain: {
      clear: 0.12,
      cloud: 0.28,
      sprinkle: 0.12,
      lightRain: 0.28,
      heavyRain: 0.14,
      storm: 0.06,
    },
    heavyRain: {
      clear: 0.08,
      cloud: 0.22,
      sprinkle: 0.08,
      lightRain: 0.22,
      heavyRain: 0.28,
      storm: 0.12,
    },
    storm: {
      clear: 0.06,
      cloud: 0.2,
      sprinkle: 0.06,
      lightRain: 0.22,
      heavyRain: 0.28,
      storm: 0.18,
    },
  } as Record<WeatherSky, Record<WeatherSky, number>>,

  /** Hours between automatic sky rolls (smaller chunks still accumulate precip). */
  skyRollMinHours: 1,

  /**
   * Future hooks:
   * - season / region ambient range shifts
   * Body temp consumer is live — see bodyTempTuning + advanceBodyTemperature.
   */
  future: {
    seasonsRegionalClimate: true,
  },
} as const;
