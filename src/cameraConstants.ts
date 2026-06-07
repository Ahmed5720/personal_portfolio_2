/** Zero-based index of the saved orientation where the menu is shown. */
export const MENU_ORIENTATION_SLOT = 1;

export interface MenuLayout {
  width: number;
  height: number;
  /** Horizontal center position as % of the viewport width. */
  centerX: number;
  /** Vertical center position as % of the viewport height. */
  centerY: number;
}

export const DEFAULT_MENU_LAYOUT: MenuLayout = {
  width: 420,
  height: 420,
  centerX: 50,
  centerY: 50,
};

/** Dark brown WebGPU clear color (RGBA, 0–1). */
export const SCENE_CLEAR_COLOR = [0.14, 0.08, 0.05, 1] as const;
