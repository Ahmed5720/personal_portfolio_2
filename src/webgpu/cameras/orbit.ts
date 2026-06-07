export interface OrbitSettings {
  x: number;
  y: number;
  z: number;
  distance: number;
}

export const DEFAULT_ORBIT_SETTINGS: OrbitSettings = {
  x: 0,
  y: 0,
  z: 0,
  distance: 0.55,
};

export const ORBIT_SENSITIVITY = 0.002;
export const ORBIT_ZOOM_SENSITIVITY = 0.001;
export const ORBIT_MIN_DISTANCE = 0.1;
export const ORBIT_MAX_DISTANCE = 10;
export const ORBIT_DAMPING = 3.2;
export const ORBIT_MOMENTUM_SCALE = 0.28;
export const ORBIT_VELOCITY_SMOOTH = 10;
export const MIN_ORBIT_PITCH = -89 * (Math.PI / 180);
export const MAX_ORBIT_PITCH = 89 * (Math.PI / 180);

export function cloneOrbitSettings(source: OrbitSettings): OrbitSettings {
  return {
    x: source.x,
    y: source.y,
    z: source.z,
    distance: source.distance,
  };
}

export interface SphericalOrbit {
  yaw: number;
  pitch: number;
  radius: number;
}

export function readSphericalOrbit(
  position: [number, number, number],
  orbit: OrbitSettings,
): SphericalOrbit {
  const ox = position[0] - orbit.x;
  const oy = position[1] - orbit.y;
  const oz = position[2] - orbit.z;

  let radius = Math.hypot(ox, oy, oz);
  if (radius < 0.01) {
    radius = 0.01;
  }

  return {
    yaw: Math.atan2(ox, oz),
    pitch: Math.asin(Math.max(-1, Math.min(1, oy / radius))),
    radius,
  };
}

export function positionFromSphericalOrbit(
  spherical: SphericalOrbit,
  orbit: OrbitSettings,
): [number, number, number] {
  const cosPitch = Math.cos(spherical.pitch);
  return [
    orbit.x + spherical.radius * cosPitch * Math.sin(spherical.yaw),
    orbit.y + spherical.radius * Math.sin(spherical.pitch),
    orbit.z + spherical.radius * cosPitch * Math.cos(spherical.yaw),
  ];
}

export function applyOrbitAngles(
  yaw: number,
  pitch: number,
  orbit: OrbitSettings,
): {
  position: [number, number, number];
  yaw: number;
  pitch: number;
} {
  const clampedPitch = Math.max(
    MIN_ORBIT_PITCH,
    Math.min(MAX_ORBIT_PITCH, pitch),
  );
  const position = positionFromSphericalOrbit(
    { yaw, pitch: clampedPitch, radius: orbit.distance },
    orbit,
  );
  return { position, yaw, pitch: clampedPitch };
}
