import { GUI } from 'dat.gui';
import {
  cloneLightingSettings,
  createDefaultSpotlight,
  DEFAULT_LIGHTING,
  MAX_SPOTLIGHTS,
  type LightingSettings,
  type LightingSettingsSerialized,
} from './lighting';

export interface DebugLightingController {
  getSettings(): LightingSettings;
  dispose(): void;
}

export function createDebugLightingController(
  gui: GUI,
  initial?: LightingSettingsSerialized,
): DebugLightingController {
  const settings = cloneLightingSettings(initial ?? DEFAULT_LIGHTING);
  const spotlightFolders: GUI[] = [];

  const ambientFolder = gui.addFolder('Ambient');
  ambientFolder.addColor(settings, 'ambientColor').name('color');
  ambientFolder.add(settings, 'ambientIntensity', 0, 2, 0.01).name('intensity');
  ambientFolder.open();

  const dirFolder = gui.addFolder('Directional light');
  dirFolder.add(settings.directional, 'enabled');
  dirFolder.add(settings.directional.direction, '0', -1, 1, 0.01).name('dir X');
  dirFolder.add(settings.directional.direction, '1', -1, 1, 0.01).name('dir Y');
  dirFolder.add(settings.directional.direction, '2', -1, 1, 0.01).name('dir Z');
  dirFolder.addColor(settings.directional, 'color').name('color');
  dirFolder
    .add(settings.directional, 'intensity', 0, 5, 0.01)
    .name('intensity');
  dirFolder.open();

  const spotFolder = gui.addFolder('Spotlights');
  const spotActions = {
    addSpotlight: () => {
      if (settings.spotlights.length >= MAX_SPOTLIGHTS) return;
      settings.spotlights.push(createDefaultSpotlight());
      rebuildSpotlightControls();
    },
  };
  spotFolder.add(spotActions, 'addSpotlight').name('add spotlight');
  spotFolder.open();

  function rebuildSpotlightControls() {
    for (const folder of spotlightFolders) {
      folder.destroy();
    }
    spotlightFolders.length = 0;

    settings.spotlights.forEach((spot, index) => {
      const folder = spotFolder.addFolder(`Spotlight ${index}`);
      folder.add(spot, 'enabled');
      folder.add(spot.position, '0', -5, 5, 0.01).name('pos X');
      folder.add(spot.position, '1', -5, 5, 0.01).name('pos Y');
      folder.add(spot.position, '2', -5, 5, 0.01).name('pos Z');
      folder.add(spot.direction, '0', -1, 1, 0.01).name('dir X');
      folder.add(spot.direction, '1', -1, 1, 0.01).name('dir Y');
      folder.add(spot.direction, '2', -1, 1, 0.01).name('dir Z');
      folder.addColor(spot, 'color').name('color');
      folder.add(spot, 'intensity', 0, 10, 0.01).name('intensity');
      folder.add(spot, 'angleDeg', 1, 89, 0.5).name('cone angle');
      folder.add(spot, 'penumbra', 0, 1, 0.01).name('softness');
      folder.add(spot, 'range', 0.1, 20, 0.1).name('range');

      const removeAction = {
        remove: () => {
          settings.spotlights.splice(index, 1);
          rebuildSpotlightControls();
        },
      };
      folder.add(removeAction, 'remove');
      folder.open();
      spotlightFolders.push(folder);
    });
  }

  rebuildSpotlightControls();

  return {
    getSettings() {
      return cloneLightingSettings(settings);
    },
    dispose() {
      for (const folder of spotlightFolders) {
        folder.destroy();
      }
      ambientFolder.destroy();
      dirFolder.destroy();
      spotFolder.destroy();
    },
  };
}
