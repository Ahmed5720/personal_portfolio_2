export const MAX_SPOTLIGHTS = 4;

export interface DirectionalLightSettings {
  enabled: boolean;
  direction: [number, number, number];
  color: [number, number, number];
  intensity: number;
}

export interface SpotlightSettings {
  enabled: boolean;
  position: [number, number, number];
  direction: [number, number, number];
  color: [number, number, number];
  intensity: number;
  angleDeg: number;
  penumbra: number;
  range: number;
}

export interface LightingSettings {
  ambientColor: [number, number, number];
  ambientIntensity: number;
  directional: DirectionalLightSettings;
  spotlights: SpotlightSettings[];
}

export interface LightingSettingsSerialized {
  ambientColor: [number, number, number];
  ambientIntensity: number;
  directional: DirectionalLightSettings;
  spotlights: SpotlightSettings[];
}

export const DEFAULT_LIGHTING: LightingSettings = {
  ambientColor: [0.15, 0.12, 0.1],
  ambientIntensity: 0.35,
  directional: {
    enabled: true,
    direction: [-0.4, -1, -0.3],
    color: [1, 0.96, 0.9],
    intensity: 1.2,
  },
  spotlights: [],
};

export function createDefaultSpotlight(): SpotlightSettings {
  return {
    enabled: true,
    position: [0, 1.5, 0],
    direction: [0, -1, 0],
    color: [1, 0.95, 0.85],
    intensity: 2,
    angleDeg: 35,
    penumbra: 0.2,
    range: 8,
  };
}

export function cloneLightingSettings(
  source: LightingSettings,
): LightingSettings {
  return {
    ambientColor: [...source.ambientColor],
    ambientIntensity: source.ambientIntensity,
    directional: {
      ...source.directional,
      direction: [...source.directional.direction],
      color: [...source.directional.color],
    },
    spotlights: source.spotlights.map((spot) => ({
      ...spot,
      position: [...spot.position],
      direction: [...spot.direction],
      color: [...spot.color],
    })),
  };
}

export function serializeLightingSettings(
  settings: LightingSettings,
): LightingSettingsSerialized {
  return cloneLightingSettings(settings);
}

export function normalizeVec3(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Header (4 vec4) + 4 spotlights (4 vec4 each) = 320 bytes */
export const LIGHTING_UNIFORM_SIZE = 320;

export function packLightingUniform(settings: LightingSettings): Float32Array {
  const data = new Float32Array(LIGHTING_UNIFORM_SIZE / 4);
  const dir = normalizeVec3(settings.directional.direction);

  data.set(settings.ambientColor, 0);
  data[3] = settings.ambientIntensity;

  data.set(dir, 4);
  data[7] = settings.directional.enabled ? 1 : 0;

  data.set(settings.directional.color, 8);
  data[11] = settings.directional.intensity;

  data[12] = settings.spotlights.length;

  for (let i = 0; i < MAX_SPOTLIGHTS; i++) {
    const base = 16 + i * 16;
    const spot = settings.spotlights[i];
    if (!spot) continue;

    const spotDir = normalizeVec3(spot.direction);
    const outerCos = Math.cos((spot.angleDeg * Math.PI) / 180);
    const innerCos = Math.cos(
      ((spot.angleDeg * (1 - spot.penumbra)) * Math.PI) / 180,
    );

    data.set(spot.position, base + 0);
    data[base + 3] = spot.enabled ? 1 : 0;

    data.set(spotDir, base + 4);
    data[base + 7] = spot.intensity;

    data.set(spot.color, base + 8);
    data[base + 11] = outerCos;

    data[base + 12] = spot.range;
    data[base + 13] = innerCos;
  }

  return data;
}
