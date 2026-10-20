/**
 * World climate / weather — driver surface for body temperature.
 * Temperatures are Fahrenheit.
 */

export const WEATHER_SKIES = [
  'clear',
  'cloud',
  'sprinkle',
  'lightRain',
  'heavyRain',
  'storm',
] as const;
export type WeatherSky = (typeof WEATHER_SKIES)[number];

/** Legacy sky id from older saves. */
export function migrateWeatherSky(raw: string): WeatherSky {
  if ((WEATHER_SKIES as readonly string[]).includes(raw)) {
    return raw as WeatherSky;
  }
  // Former single "rain" band → light rain.
  if (raw === 'rain') return 'lightRain';
  return 'clear';
}

export interface WorldWeather {
  /** Days since campaign start (increments past midnight). */
  dayIndex: number;
  /** Hour of day 0–24 (fractional OK). */
  hour: number;
  sky: WeatherSky;
  /** 0–1 precip rate (0 when clear/cloud). */
  precip01: number;
  /** 0–1 wind. */
  wind01: number;
  /** Ambient air °F at current hour/sky (recomputed on advance). */
  ambientF: number;
  /** Ground/air moisture pressure 0–1 (rises in rain, decays when dry). */
  surfaceWet01: number;
}

export function formatWeatherSkyLabel(sky: WeatherSky): string {
  switch (sky) {
    case 'clear':
      return 'Clear';
    case 'cloud':
      return 'Cloudy';
    case 'sprinkle':
      return 'Sprinkle';
    case 'lightRain':
      return 'Light rain';
    case 'heavyRain':
      return 'Heavy rain';
    case 'storm':
      return 'Storm';
  }
}

export function formatClockHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60) % 60;
  const ampm = whole >= 12 ? 'PM' : 'AM';
  const hr12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${hr12}:${mins.toString().padStart(2, '0')} ${ampm}`;
}
