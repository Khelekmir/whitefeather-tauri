import { CLIMATE_TUNING as C } from '../../data/world/climateTuning';
import type { WeatherSky, WorldWeather } from '../../types/world';

export function createDefaultWorldWeather(
  overrides?: Partial<WorldWeather>
): WorldWeather {
  const hour = overrides?.hour ?? 14;
  const sky = overrides?.sky ?? 'clear';
  const wind01 = overrides?.wind01 ?? C.windBySky[sky];
  const precip01 = overrides?.precip01 ?? C.precipBySky[sky];
  const ambientF =
    overrides?.ambientF ?? computeAmbientF(hour, sky, wind01);
  return {
    dayIndex: overrides?.dayIndex ?? 0,
    hour,
    sky,
    precip01,
    wind01,
    ambientF,
    surfaceWet01: overrides?.surfaceWet01 ?? 0.08,
  };
}

/** Smooth diurnal sine-ish blend between night low and afternoon high. */
export function diurnalBaseF(hour: number): number {
  const { nightLowF, afternoonHighF, troughHour, peakHour } = C.diurnal;
  const h = ((hour % 24) + 24) % 24;
  // Map hour onto 0–1 progress from trough to peak and back.
  const spanRise = (peakHour - troughHour + 24) % 24 || 12;
  const spanFall = 24 - spanRise;
  let t: number;
  if (h >= troughHour && h <= peakHour) {
    t = (h - troughHour) / spanRise;
  } else {
    const fromPeak = h > peakHour ? h - peakHour : h + 24 - peakHour;
    t = 1 - fromPeak / spanFall;
  }
  const smooth = t * t * (3 - 2 * t);
  return nightLowF + (afternoonHighF - nightLowF) * smooth;
}

export function computeAmbientF(
  hour: number,
  sky: WeatherSky,
  wind01: number
): number {
  const base = diurnalBaseF(hour);
  const skyDelta = C.skyAmbientDeltaF[sky];
  const windChill =
    wind01 *
    C.windChillPerWindF *
    (sky === 'clear' || sky === 'cloud' ? 0.35 : 1); // precip skies get full wind chill
  return Math.round((base + skyDelta - windChill) * 10) / 10;
}

function pickSky(from: WeatherSky, rng: () => number): WeatherSky {
  const row = C.skyTransition[from];
  const r = rng();
  let acc = 0;
  for (const sky of Object.keys(row) as WeatherSky[]) {
    acc += row[sky];
    if (r <= acc) return sky;
  }
  return from;
}

export interface AdvanceWeatherOpts {
  forceSky?: WeatherSky;
  /** Inject RNG for tests (0–1). */
  rng?: () => number;
  /**
   * When true (e.g. Sleep indoors), still advance clock/ambient curve
   * but exposure shelter is separate — weather itself can still rain outside.
   */
  sleeping?: boolean;
}

/**
 * Advance world weather by `hours`.
 * Weather first on Pass Time so body-temp can read post-advance climate.
 */
export function advanceWeather(
  state: WorldWeather,
  hours: number,
  opts?: AdvanceWeatherOpts
): WorldWeather {
  const h = Math.max(0, hours);
  if (h === 0) return state;

  const rng = opts?.rng ?? Math.random;
  let dayIndex = state.dayIndex;
  let hour = state.hour + h;
  while (hour >= 24) {
    hour -= 24;
    dayIndex += 1;
  }

  let sky = opts?.forceSky ?? state.sky;
  if (!opts?.forceSky && h >= C.skyRollMinHours) {
    // One roll per whole hour chunk advanced (cap rolls for long sleeps).
    const rolls = Math.min(8, Math.floor(h));
    for (let i = 0; i < rolls; i++) {
      sky = pickSky(sky, rng);
    }
  }

  const precip01 = C.precipBySky[sky];
  const wind01 = C.windBySky[sky];
  const ambientF = computeAmbientF(hour, sky, wind01);

  let surfaceWet01 = state.surfaceWet01;
  if (precip01 > 0) {
    surfaceWet01 += precip01 * C.wetRisePerHour * h;
  } else {
    surfaceWet01 -= C.wetDecayPerHour * h;
  }
  surfaceWet01 = Math.max(0, Math.min(1, surfaceWet01));

  return {
    dayIndex,
    hour: Math.round(hour * 1000) / 1000,
    sky,
    precip01,
    wind01,
    ambientF,
    surfaceWet01: Math.round(surfaceWet01 * 1000) / 1000,
  };
}

/** Force sky immediately and refresh derived fields (debug / SocialLab). */
export function forceWeatherSky(
  state: WorldWeather,
  sky: WeatherSky
): WorldWeather {
  const precip01 = C.precipBySky[sky];
  const wind01 = C.windBySky[sky];
  return {
    ...state,
    sky,
    precip01,
    wind01,
    ambientF: computeAmbientF(state.hour, sky, wind01),
  };
}
