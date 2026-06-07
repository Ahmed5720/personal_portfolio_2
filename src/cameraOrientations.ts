import type { SceneConfigSerialized } from './webgpu/cameras/sceneConfig';

/**
 * Hardcoded scene config loaded on startup.
 *
 * How to update:
 * 1. Position the camera, menu, lights, and orbit pivot in the debug panel; save each camera view.
 * 2. Click "export JSON" in the debug panel (copies to clipboard).
 * 3. Paste the exported object below, replacing HARDCODED_SCENE_CONFIG.
 */
export const HARDCODED_SCENE_CONFIG: SceneConfigSerialized =

{
  "orientations": [
    {
      "position": [
        0,
        0.04,
        0.55
      ],
      "pitchDeg": -8,
      "yawDeg": 0,
      "rollDeg": 0,
      "fovDeg": 72
    },
    {
      "position": [
        0,
        -0.11,
        -0.04
      ],
      "pitchDeg": -3.4000000000000004,
      "yawDeg": 0,
      "rollDeg": 0,
      "fovDeg": 55
    },
    {
      "position": [
        0.23,
        0.15,
        -0.55
      ],
      "pitchDeg": -2.2,
      "yawDeg": 0,
      "rollDeg": 0,
      "fovDeg": 55
    },
    {
      "position": [
        0.4,
        0.21,
        -0.55
      ],
      "pitchDeg": -2.2,
      "yawDeg": 0,
      "rollDeg": 0,
      "fovDeg": 55
    },
    {
      "position": [
        0.54,
        0.18,
        -0.55
      ],
      "pitchDeg": -2.2,
      "yawDeg": 0,
      "rollDeg": 0,
      "fovDeg": 55
    },
    {
      "position": [
        0.42,
        0.11,
        -0.56
      ],
      "pitchDeg": -2.2,
      "yawDeg": 0,
      "rollDeg": 0,
      "fovDeg": 55
    },
    {
      "position": [
        0.54,
        0.07,
        -0.56
      ],
      "pitchDeg": -2.2,
      "yawDeg": 0,
      "rollDeg": 0,
      "fovDeg": 55
    },
    {
      "position": [
        0.54,
        -0.01,
        -0.56
      ],
      "pitchDeg": -2.2,
      "yawDeg": 0,
      "rollDeg": 0,
      "fovDeg": 55
    },
    {
      "position": [
        0.44,
        0.02,
        -0.5700000000000001
      ],
      "pitchDeg": -2.2,
      "yawDeg": 0,
      "rollDeg": 0,
      "fovDeg": 55
    },
    {
      "position": [
        0.3,
        0.05,
        -0.5700000000000001
      ],
      "pitchDeg": -1.5000000000000002,
      "yawDeg": 0,
      "rollDeg": 0,
      "fovDeg": 55
    }
  ],
  "menu": {
    "width": 329,
    "height": 312,
    "centerX": 54,
    "centerY": 36.9
  },
  "lights": {
    "ambientColor": [
      31.83229463208306,
      21.594721978608522,
      4.842330363832011
    ],
    "ambientIntensity": 0.01,
    "directional": {
      "enabled": true,
      "direction": [
        -0.4,
        -1,
        -0.3
      ],
      "color": [
        60.09289190253622,
        44.105677957330684,
        21.53549356409935
      ],
      "intensity": 0.01
    },
    "spotlights": [
      {
        "enabled": true,
        "position": [
          0.06,
          1.33,
          0.23
        ],
        "direction": [
          0,
          -1,
          0
        ],
        "color": [
          97,
          172.52624073171557,
          255
        ],
        "intensity": 0.01,
        "angleDeg": 45,
        "penumbra": 0.04,
        "range": 6.300000000000001
      }
    ]
  },
  "orbit": {
    "x": 0,
    "y": 0,
    "z": -1.26,
    "distance": 2.14
  }
}