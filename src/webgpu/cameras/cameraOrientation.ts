const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface CameraOrientation {
  position: [number, number, number];
  pitch: number;
  yaw: number;
  roll: number;
  fov: number;
}

/** JSON-friendly format for pasting into cameraOrientations.ts */
export interface CameraOrientationSerialized {
  position: [number, number, number];
  pitchDeg: number;
  yawDeg: number;
  rollDeg: number;
  fovDeg: number;
}

export function orientationToSerialized(
  orientation: CameraOrientation,
): CameraOrientationSerialized {
  return {
    position: [...orientation.position],
    pitchDeg: orientation.pitch * RAD2DEG,
    yawDeg: orientation.yaw * RAD2DEG,
    rollDeg: orientation.roll * RAD2DEG,
    fovDeg: orientation.fov * RAD2DEG,
  };
}

export function serializedToOrientation(
  serialized: CameraOrientationSerialized,
): CameraOrientation {
  return {
    position: [...serialized.position],
    pitch: serialized.pitchDeg * DEG2RAD,
    yaw: serialized.yawDeg * DEG2RAD,
    roll: serialized.rollDeg * DEG2RAD,
    fov: serialized.fovDeg * DEG2RAD,
  };
}

export function serializeOrientationsJson(
  orientations: CameraOrientation[],
): string {
  return JSON.stringify(
    orientations.map(orientationToSerialized),
    null,
    2,
  );
}

export function parseOrientationsJson(json: string): CameraOrientation[] {
  const parsed = JSON.parse(json) as CameraOrientationSerialized[];
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of camera orientations');
  }
  return parsed.map(serializedToOrientation);
}

export function cloneOrientation(source: CameraOrientation): CameraOrientation {
  return {
    position: [...source.position],
    pitch: source.pitch,
    yaw: source.yaw,
    roll: source.roll,
    fov: source.fov,
  };
}
