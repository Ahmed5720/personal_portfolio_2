import {
  orientationToSerialized,
  serializedToOrientation,
  type CameraOrientation,
  type CameraOrientationSerialized,
} from './cameraOrientation';
import {
  cloneLightingSettings,
  DEFAULT_LIGHTING,
  type LightingSettings,
  type LightingSettingsSerialized,
} from './lighting';
import {
  cloneOrbitSettings,
  DEFAULT_ORBIT_SETTINGS,
  type OrbitSettings,
} from './orbit';

export interface MenuLayoutSerialized {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface SceneConfigSerialized {
  orientations: CameraOrientationSerialized[];
  menu: MenuLayoutSerialized;
  lights?: LightingSettingsSerialized;
  /** @deprecated use `orbit` — kept for older exports */
  orbitPivot?: OrbitSettings;
  orbit?: OrbitSettings;
}

export function serializeSceneConfigJson(
  orientations: CameraOrientation[],
  menu: MenuLayoutSerialized,
  lights: LightingSettings,
  orbit: OrbitSettings,
): string {
  const config: SceneConfigSerialized = {
    orientations: orientations.map(orientationToSerialized),
    menu: { ...menu },
    lights: cloneLightingSettings(lights),
    orbit: cloneOrbitSettings(orbit),
  };
  return JSON.stringify(config, null, 2);
}

function resolveOrbitFromConfig(
  config: SceneConfigSerialized,
): OrbitSettings {
  const source = config.orbit ?? config.orbitPivot;
  if (!source) {
    return cloneOrbitSettings(DEFAULT_ORBIT_SETTINGS);
  }
  return cloneOrbitSettings({
    x: source.x,
    y: source.y,
    z: source.z,
    distance: source.distance ?? DEFAULT_ORBIT_SETTINGS.distance,
  });
}

export function parseSceneConfigJson(json: string): {
  orientations: CameraOrientation[];
  menu: MenuLayoutSerialized;
  lights: LightingSettings;
  orbit: OrbitSettings;
} {
  const parsed = JSON.parse(json) as SceneConfigSerialized | CameraOrientationSerialized[];

  if (Array.isArray(parsed)) {
    return {
      orientations: parsed.map(serializedToOrientation),
      menu: { width: 420, height: 420, centerX: 50, centerY: 50 },
      lights: cloneLightingSettings(DEFAULT_LIGHTING),
      orbit: cloneOrbitSettings(DEFAULT_ORBIT_SETTINGS),
    };
  }

  return {
    orientations: parsed.orientations.map(serializedToOrientation),
    menu: { ...parsed.menu },
    lights: cloneLightingSettings(parsed.lights ?? DEFAULT_LIGHTING),
    orbit: resolveOrbitFromConfig(parsed),
  };
}
