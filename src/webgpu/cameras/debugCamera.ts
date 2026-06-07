import { GUI } from 'dat.gui';
import type { GUIController } from 'dat.gui';
import { mat4, quat } from 'wgpu-matrix';
import type { Mat4, RotationOrder } from 'wgpu-matrix';
import { MENU_ORIENTATION_SLOT, type MenuLayout } from '../../cameraConstants';
import {
  cloneOrientation,
  type CameraOrientation,
} from './cameraOrientation';
import { serializeSceneConfigJson } from './sceneConfig';
import { DEFAULT_LIGHTING, type LightingSettings } from './lighting';
import {
  applyOrbitAngles,
  cloneOrbitSettings,
  DEFAULT_ORBIT_SETTINGS,
  ORBIT_DAMPING,
  ORBIT_MAX_DISTANCE,
  ORBIT_MIN_DISTANCE,
  ORBIT_MOMENTUM_SCALE,
  ORBIT_SENSITIVITY,
  ORBIT_VELOCITY_SMOOTH,
  ORBIT_ZOOM_SENSITIVITY,
  readSphericalOrbit,
  type OrbitSettings,
} from './orbit';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const INTERP_DURATION = 1.2;
const EULER_ORDER: RotationOrder = 'yxz';
const ORBIT_VELOCITY_EPSILON = 0.00005;

export type { CameraOrientation } from './cameraOrientation';

interface GuiParams {
  posX: number;
  posY: number;
  posZ: number;
  pitch: number;
  yaw: number;
  roll: number;
  fov: number;
  savedCount: number;
  activeSlot: number;
}

interface InterpolationState {
  from: CameraOrientation;
  to: CameraOrientation;
  elapsed: number;
  targetIndex: number;
}

export interface DebugCameraOptions {
  canvas?: HTMLCanvasElement;
  onActiveSlotChange?: (slotIndex: number) => void;
  onOrbitActiveChange?: (active: boolean) => void;
  onMenuLayoutChange?: (layout: MenuLayout) => void;
  initialOrientations?: CameraOrientation[];
  initialMenuLayout?: MenuLayout;
  initialOrbit?: OrbitSettings;
  getLightingSettings?: () => LightingSettings;
}

export interface DebugCameraController {
  update(deltaTime: number): Mat4;
  getFovRadians(): number;
  dispose(): void;
}

export function createDebugCameraController(
  gui: GUI,
  options: DebugCameraOptions = {},
): DebugCameraController {
  const orientation: CameraOrientation = {
    position: [3, 2, 5],
    pitch: 0,
    yaw: 0,
    roll: 0,
    fov: (2 * Math.PI) / 5,
  };

  const savedOrientations: CameraOrientation[] = [];
  let activeSlotIndex = -1;
  let interpolation: InterpolationState | null = null;

  const viewMatrix = mat4.create();

  const params: GuiParams = {
    posX: orientation.position[0],
    posY: orientation.position[1],
    posZ: orientation.position[2],
    pitch: 0,
    yaw: 0,
    roll: 0,
    fov: orientation.fov * RAD2DEG,
    savedCount: 0,
    activeSlot: -1,
  };

  syncGuiFromOrientation();

  const menuLayout = {
    width: options.initialMenuLayout?.width ?? 420,
    height: options.initialMenuLayout?.height ?? 420,
    centerX: options.initialMenuLayout?.centerX ?? 50,
    centerY: options.initialMenuLayout?.centerY ?? 50,
  };

  function notifyMenuLayout() {
    options.onMenuLayoutChange?.({
      width: menuLayout.width,
      height: menuLayout.height,
      centerX: menuLayout.centerX,
      centerY: menuLayout.centerY,
    });
  }

  const menuFolder = gui.addFolder('2D Menu');
  menuFolder
    .add(menuLayout, 'width', 160, 900, 1)
    .name('width (px)')
    .onChange(notifyMenuLayout);
  menuFolder
    .add(menuLayout, 'height', 160, 900, 1)
    .name('height (px)')
    .onChange(notifyMenuLayout);
  menuFolder
    .add(menuLayout, 'centerX', 0, 100, 0.1)
    .name('center X (%)')
    .onChange(notifyMenuLayout);
  menuFolder
    .add(menuLayout, 'centerY', 0, 100, 0.1)
    .name('center Y (%)')
    .onChange(notifyMenuLayout);
  menuFolder.open();

  notifyMenuLayout();

  const cameraFolder = gui.addFolder('Camera');
  cameraFolder.add(params, 'posX', -20, 20, 0.01).onChange(applyGuiToOrientation);
  cameraFolder.add(params, 'posY', -20, 20, 0.01).onChange(applyGuiToOrientation);
  cameraFolder.add(params, 'posZ', -20, 20, 0.01).onChange(applyGuiToOrientation);
  cameraFolder.add(params, 'pitch', -180, 180, 0.1).onChange(applyGuiToOrientation);
  cameraFolder.add(params, 'yaw', -180, 360, 0.1).onChange(applyGuiToOrientation);
  cameraFolder.add(params, 'roll', -180, 180, 0.1).onChange(applyGuiToOrientation);
  cameraFolder.add(params, 'fov', 10, 120, 0.1).onChange(applyGuiToOrientation);
  cameraFolder.open();

  const orbit = cloneOrbitSettings(
    options.initialOrbit ?? DEFAULT_ORBIT_SETTINGS,
  );

  function snapCameraToOrbit() {
    if (interpolation) return;

    const spherical = readSphericalOrbit(orientation.position, orbit);
    const snapped = applyOrbitAngles(spherical.yaw, spherical.pitch, orbit);
    orientation.position = snapped.position;
    orientation.yaw = snapped.yaw;
    orientation.pitch = snapped.pitch;
    orientation.roll = 0;
    syncGuiFromOrientation();
  }

  const orbitFolder = gui.addFolder('Orbit');
  orbitFolder.add(orbit, 'x', -5, 5, 0.01).name('pivot X');
  orbitFolder.add(orbit, 'y', -5, 5, 0.01).name('pivot Y');
  orbitFolder.add(orbit, 'z', -5, 5, 0.01).name('pivot Z');
  orbitFolder
    .add(orbit, 'distance', 0.1, 10, 0.01)
    .name('distance')
    .onChange(snapCameraToOrbit);
  orbitFolder.open();

  const savesFolder = gui.addFolder('Saved orientations');
  const saveActions = {
    save: () => {
      savedOrientations.push(cloneOrientation(captureOrientation()));
      setActiveSlot(savedOrientations.length - 1);
      refreshSaveList();
    },
    updateCurrent: () => {
      if (activeSlotIndex < 0) {
        console.warn('No active slot selected — recall a slot first or save a new one');
        return;
      }
      savedOrientations[activeSlotIndex] = cloneOrientation(captureOrientation());
    },
    exportJson: async () => {
      if (savedOrientations.length === 0) {
        console.warn('No saved orientations to export');
        return;
      }

      const lights = options.getLightingSettings?.() ?? DEFAULT_LIGHTING;
      const json = serializeSceneConfigJson(
        savedOrientations,
        menuLayout,
        lights,
        orbit,
      );
      const message =
        'Paste into HARDCODED_SCENE_CONFIG in src/cameraOrientations.ts';

      try {
        await navigator.clipboard.writeText(json);
        console.log(`${message}\n\n${json}`);
      } catch {
        console.log(`${message}\n\n${json}`);
      }
    },
    clearAll: () => {
      savedOrientations.length = 0;
      setActiveSlot(-1);
      refreshSaveList();
    },
  };
  savesFolder.add(saveActions, 'save');
  savesFolder.add(saveActions, 'updateCurrent').name('update current slot');
  savesFolder.add(saveActions, 'exportJson').name('export JSON');
  savesFolder.add(saveActions, 'clearAll');
  savesFolder.add(params, 'savedCount').name('Saved count').listen();
  savesFolder.add(params, 'activeSlot').name('Active slot').listen();
  savesFolder.open();

  const slotControllers: GUIController[] = [];

  function refreshSaveList() {
    for (const controller of slotControllers) {
      controller.remove();
    }
    slotControllers.length = 0;

    savedOrientations.forEach((slot, index) => {
      const action = {
        recall: () => {
          applyOrientation(cloneOrientation(slot));
          setActiveSlot(index);
          syncGuiFromOrientation();
        },
      };
      const controller = savesFolder.add(action, 'recall').name(`Slot ${index}`);
      slotControllers.push(controller);
    });
  }

  function setActiveSlot(index: number) {
    activeSlotIndex = index;
    updateListDisplay();
    options.onActiveSlotChange?.(activeSlotIndex);
  }

  function updateListDisplay() {
    params.savedCount = savedOrientations.length;
    params.activeSlot = activeSlotIndex;
  }

  function applyGuiToOrientation() {
    if (interpolation) return;

    orientation.position = [params.posX, params.posY, params.posZ];
    orientation.pitch = params.pitch * DEG2RAD;
    orientation.yaw = params.yaw * DEG2RAD;
    orientation.roll = params.roll * DEG2RAD;
    orientation.fov = params.fov * DEG2RAD;
  }

  function syncGuiFromOrientation() {
    params.posX = orientation.position[0];
    params.posY = orientation.position[1];
    params.posZ = orientation.position[2];
    params.pitch = orientation.pitch * RAD2DEG;
    params.yaw = orientation.yaw * RAD2DEG;
    params.roll = orientation.roll * RAD2DEG;
    params.fov = orientation.fov * RAD2DEG;
    updateListDisplay();
  }

  function captureOrientation(): CameraOrientation {
    return cloneOrientation(orientation);
  }

  function applyOrientation(next: CameraOrientation) {
    orientation.position = [...next.position];
    orientation.pitch = next.pitch;
    orientation.yaw = next.yaw;
    orientation.roll = next.roll;
    orientation.fov = next.fov;
  }

  function startInterpolation(targetIndex: number) {
    if (savedOrientations.length === 0) return;

    resetOrbitMomentum();

    const leavingMenu =
      activeSlotIndex === MENU_ORIENTATION_SLOT &&
      targetIndex !== MENU_ORIENTATION_SLOT;

    interpolation = {
      from: captureOrientation(),
      to: cloneOrientation(savedOrientations[targetIndex]),
      elapsed: 0,
      targetIndex,
    };

    if (leavingMenu) {
      options.onActiveSlotChange?.(targetIndex);
    }
  }

  function goToNext() {
    if (savedOrientations.length === 0) return;
    const targetIndex =
      activeSlotIndex < 0
        ? 0
        : (activeSlotIndex + 1) % savedOrientations.length;
    startInterpolation(targetIndex);
  }

  function goToPrevious() {
    if (savedOrientations.length === 0) return;
    const targetIndex =
      activeSlotIndex < 0
        ? savedOrientations.length - 1
        : (activeSlotIndex - 1 + savedOrientations.length) %
          savedOrientations.length;
    startInterpolation(targetIndex);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToNext();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToPrevious();
    }
  }

  window.addEventListener('keydown', onKeyDown);

  let isOrbiting = false;
  let lastPointerX = 0;
  let lastPointerTime = 0;
  let orbitVelYaw = 0;
  let orbitActive = false;

  function setOrbitActive(active: boolean) {
    if (orbitActive === active) return;
    orbitActive = active;
    options.onOrbitActiveChange?.(active);
  }

  function resetOrbitMomentum() {
    orbitVelYaw = 0;
    if (!isOrbiting) {
      setOrbitActive(false);
    }
  }

  function applySphericalDelta(deltaYaw: number) {
    if (interpolation) return;

    const spherical = readSphericalOrbit(orientation.position, orbit);
    const snapped = applyOrbitAngles(
      spherical.yaw + deltaYaw,
      spherical.pitch,
      orbit,
    );
    orientation.position = snapped.position;
    orientation.yaw = snapped.yaw;
    orientation.pitch = snapped.pitch;
    orientation.roll = 0;
    syncGuiFromOrientation();
  }

  function stepOrbitMomentum(deltaTime: number) {
    if (interpolation || isOrbiting) return;

    if (Math.abs(orbitVelYaw) < ORBIT_VELOCITY_EPSILON) {
      resetOrbitMomentum();
      return;
    }

    setOrbitActive(true);
    applySphericalDelta(orbitVelYaw * deltaTime);

    const decay = Math.exp(-ORBIT_DAMPING * deltaTime);
    orbitVelYaw *= decay;
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || interpolation) return;

    isOrbiting = true;
    orbitVelYaw = 0;
    setOrbitActive(true);

    notifyLeavingMenuView();
    snapCameraToOrbit();
    lastPointerX = event.clientX;
    lastPointerTime = performance.now();
    options.canvas?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!isOrbiting) return;

    const deltaX = event.clientX - lastPointerX;
    const now = performance.now();
    const deltaTime = Math.max(0.001, (now - lastPointerTime) / 1000);

    lastPointerX = event.clientX;
    lastPointerTime = now;

    if (deltaX === 0) return;

    const deltaYaw = deltaX * ORBIT_SENSITIVITY;
    applySphericalDelta(deltaYaw);

    const targetVelYaw = (deltaYaw / deltaTime) * ORBIT_MOMENTUM_SCALE;
    const blend = 1 - Math.exp(-ORBIT_VELOCITY_SMOOTH * deltaTime);
    orbitVelYaw += (targetVelYaw - orbitVelYaw) * blend;
  }

  function endOrbit(event: PointerEvent) {
    if (!isOrbiting) return;

    isOrbiting = false;
    if (options.canvas?.hasPointerCapture(event.pointerId)) {
      options.canvas.releasePointerCapture(event.pointerId);
    }
  }

  function notifyLeavingMenuView() {
    if (activeSlotIndex === MENU_ORIENTATION_SLOT) {
      options.onActiveSlotChange?.(-1);
    }
  }

  function applyOrbitZoom(deltaY: number) {
    if (interpolation) return;

    const zoomFactor = Math.exp(deltaY * ORBIT_ZOOM_SENSITIVITY);
    orbit.distance = Math.max(
      ORBIT_MIN_DISTANCE,
      Math.min(ORBIT_MAX_DISTANCE, orbit.distance * zoomFactor),
    );
    notifyLeavingMenuView();
    snapCameraToOrbit();
  }

  function onWheel(event: WheelEvent) {
    if (interpolation) return;

    event.preventDefault();
    applyOrbitZoom(event.deltaY);
  }

  const canvas = options.canvas;
  if (canvas) {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endOrbit);
    canvas.addEventListener('pointercancel', endOrbit);
    canvas.addEventListener('wheel', onWheel, { passive: false });
  }

  if (options.initialOrientations?.length) {
    loadInitialOrientations(options.initialOrientations);
  }

  function loadInitialOrientations(initial: CameraOrientation[]) {
    savedOrientations.length = 0;
    for (const slot of initial) {
      savedOrientations.push(cloneOrientation(slot));
    }
    applyOrientation(cloneOrientation(savedOrientations[0]));
    if (!options.initialOrbit) {
      orbit.distance = readSphericalOrbit(orientation.position, orbit).radius;
    }
    setActiveSlot(0);
    syncGuiFromOrientation();
    refreshSaveList();
  }

  return {
    update(deltaTime: number) {
      if (interpolation) {
        interpolation.elapsed += deltaTime;
        const t = Math.min(1, interpolation.elapsed / INTERP_DURATION);
        const eased = smoothStep(t);
        applyOrientation(
          lerpOrientation(interpolation.from, interpolation.to, eased),
        );
        syncGuiFromOrientation();

        if (t >= 1) {
          setActiveSlot(interpolation.targetIndex);
          interpolation = null;
        }
      } else {
        stepOrbitMomentum(deltaTime);
      }

      computeViewMatrix(orientation, viewMatrix);
      return viewMatrix;
    },

    getFovRadians() {
      return orientation.fov;
    },

    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      if (canvas) {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', endOrbit);
        canvas.removeEventListener('pointercancel', endOrbit);
        canvas.removeEventListener('wheel', onWheel);
      }
    },
  };
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(from: number, to: number, t: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return from + delta * t;
}

function lerpOrientation(
  from: CameraOrientation,
  to: CameraOrientation,
  t: number,
): CameraOrientation {
  return {
    position: [
      lerp(from.position[0], to.position[0], t),
      lerp(from.position[1], to.position[1], t),
      lerp(from.position[2], to.position[2], t),
    ],
    pitch: lerpAngle(from.pitch, to.pitch, t),
    yaw: lerpAngle(from.yaw, to.yaw, t),
    roll: lerpAngle(from.roll, to.roll, t),
    fov: lerp(from.fov, to.fov, t),
  };
}

function computeViewMatrix(orientation: CameraOrientation, out: Mat4): Mat4 {
  const rotation = quat.fromEuler(
    orientation.pitch,
    orientation.yaw,
    orientation.roll,
    EULER_ORDER,
  );
  const cameraMatrix = mat4.fromQuat(rotation);
  cameraMatrix[12] = orientation.position[0];
  cameraMatrix[13] = orientation.position[1];
  cameraMatrix[14] = orientation.position[2];
  cameraMatrix[15] = 1;
  return mat4.invert(cameraMatrix, out);
}
