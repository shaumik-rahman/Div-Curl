export type DimensionType = '2D' | '3D';

export type PresetType =
  | 'source'
  | 'sink'
  | 'vortex'
  | 'saddle'
  | 'dipole'
  | 'quadrupole'
  | 'wave'
  | 'uniform_sink'
  | 'custom';

export interface FieldPreset {
  id: PresetType;
  name: string;
  description: string;
  formula2D: { fx: string; fy: string };
  formula3D: { fx: string; fy: string; fz: string };
  defaultParams: {
    strength: number;
    scale: number;
    frequency: number;
  };
}

export interface ColorMap {
  id: string;
  name: string;
  negativeColor: string; // Hex or rgb
  neutralColor: string;
  positiveColor: string;
  gradientCSS: string;
}

export interface AppState {
  dimension: DimensionType;
  preset: PresetType;
  strength: number;
  vortexSpeed: number;
  frequency: number;
  arrowDensity: number; // 10 to 40
  particleCount: number; // 0 to 500
  particleSpeed: number; // 0.1 to 3
  particleTrails: boolean;
  colorMapId: string;
  colorOverlayIntensity: number; // 0 to 1
  zSlice: number; // for 3D slice plane (-1 to 1)
  sliceAxis: 'X' | 'Y' | 'Z';
  customFx: string;
  customFy: string;
  customFz: string;
  showArrows: boolean;
  showParticles: boolean;
  showGridLines: boolean;
  isPlaying: boolean;
  selectedCoordinate: { x: number; y: number } | null;
  operator: 'divergence' | 'curl';
}
