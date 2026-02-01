// Core types for tape label pattern generation

export type GradientDef = {
  id: string;
  type: 'linear';
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  stops: { offset: string; color: string; opacity: number }[];
};

export type PatternElement = {
  type: 'path';
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  opacity?: number;
};

export type WavePattern = {
  gradients: GradientDef[];
  elements: PatternElement[];
  backgroundColor: string;
};

export type ColorScheme = {
  colors: [string, string]; // [background, accent]
  name: string;
  opacity: number;
};

export type PatternConfig = {
  maxElements?: number; // Default: 60
  enableGradients?: boolean; // Default: false (solid colors only)
  simplifyPaths?: boolean; // Default: true (reduce path points)
};
