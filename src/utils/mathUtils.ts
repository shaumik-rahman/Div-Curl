import { PresetType } from '../types';

// Safe Math expression evaluator
export function compileSafeFormula(formulaStr: string): (x: number, y: number, z: number) => number {
  if (!formulaStr || formulaStr.trim() === '') {
    return () => 0;
  }

  // Convert to lowercase and trim
  let expr = formulaStr.toLowerCase().trim();

  // Whitelist of allowed characters/words
  // We only allow: x, y, z, numbers, basic math operators, parentheses, and standard Math functions
  const safeRegex = /^[0-9xxyz\s+\-*/().,^]|(sin|cos|tan|sqrt|exp|pow|abs|pi|e|log|asin|acos|atan|sinh|cosh|tanh|ln)(?=\b|\()/i;
  
  // Strip out valid words to check if anything malicious remains
  const stripped = expr
    .replace(/(sin|cos|tan|sqrt|exp|pow|abs|pi|e|log|asin|acos|atan|sinh|cosh|tanh|ln)/g, '')
    .replace(/[0-9xxyz\s+\-*/().,^]/g, '');

  if (stripped.length > 0) {
    // Contains invalid characters
    return () => 0;
  }

  // Pre-process expression to make it standard JS
  // Replace '^' with exponentiation operator '**'
  expr = expr.replace(/\^/g, '**');

  // Replace constants
  expr = expr.replace(/\bpi\b/g, 'Math.PI');
  expr = expr.replace(/\be\b/g, 'Math.E');

  // Replace math functions with Math.xxx
  const mathFunctions = ['sin', 'cos', 'tan', 'sqrt', 'exp', 'pow', 'abs', 'log', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh'];
  mathFunctions.forEach((fn) => {
    // Replace e.g., "sin(" with "Math.sin(" but not "Math.sin" again
    const regex = new RegExp(`\\b${fn}\\(`, 'g');
    expr = expr.replace(regex, `Math.${fn}(`);
  });
  
  // Custom ln mapping to Math.log
  expr = expr.replace(/\bln\(/g, 'Math.log(');

  try {
    // Create a safe compiled function
    const compiled = new Function('x', 'y', 'z', `
      try {
        const val = ${expr};
        return isNaN(val) || !isFinite(val) ? 0 : val;
      } catch (e) {
        return 0;
      }
    `);
    return compiled as (x: number, y: number, z: number) => number;
  } catch (err) {
    return () => 0;
  }
}

// Preset vector field definitions
export interface VectorValue {
  fx: number;
  fy: number;
  fz: number;
}

export function evaluatePresetField(
  preset: PresetType,
  x: number,
  y: number,
  z: number,
  strength: number,
  frequency: number,
  vortexSpeed: number
): VectorValue {
  // Center is at 0, 0, 0
  const r2_2d = x * x + y * y;
  const r_2d = Math.sqrt(r2_2d);
  
  const r2_3d = x * x + y * y + z * z;
  const r_3d = Math.sqrt(r2_3d);

  const eps = 0.15; // avoiding singularity

  switch (preset) {
    case 'source': {
      // Localized source: expands from center, then decays
      const decay = Math.exp(-r2_3d / 4);
      return {
        fx: strength * x * decay,
        fy: strength * y * decay,
        fz: strength * z * decay,
      };
    }
    case 'sink': {
      // Localized sink: flows into center
      const decay = Math.exp(-r2_3d / 4);
      return {
        fx: -strength * x * decay,
        fy: -strength * y * decay,
        fz: -strength * z * decay,
      };
    }
    case 'vortex': {
      // Swirling rotation around Z-axis
      // V = (-y, x, 0)
      const decay = Math.exp(-r2_3d / 4);
      return {
        fx: -vortexSpeed * y * decay,
        fy: vortexSpeed * x * decay,
        fz: 0, // No vertical flow in vortex unless spiral, let's keep pure rotation
      };
    }
    case 'saddle': {
      // Inflow on X, outflow on Y (saddle)
      // Div is zero for (x, -y, 0)
      return {
        fx: strength * x * 0.5,
        fy: -strength * y * 0.5,
        fz: 0,
      };
    }
    case 'dipole': {
      // Source at (-1.5, 0, 0) and Sink at (1.5, 0, 0)
      const sourceX = -1.2;
      const sinkX = 1.2;
      
      const rSource2_2d = (x - sourceX) ** 2 + y * y;
      const rSource_2d = Math.sqrt(rSource2_2d + eps);
      const rSink2_2d = (x - sinkX) ** 2 + y * y;
      const rSink_2d = Math.sqrt(rSink2_2d + eps);

      const fSourceX = (x - sourceX) / (rSource_2d ** 3);
      const fSourceY = y / (rSource_2d ** 3);
      const fSourceZ = z / (Math.sqrt(rSource2_2d + z * z + eps) ** 3);

      const fSinkX = -(x - sinkX) / (rSink_2d ** 3);
      const fSinkY = -y / (rSink_2d ** 3);
      const fSinkZ = -z / (Math.sqrt(rSink2_2d + z * z + eps) ** 3);

      return {
        fx: strength * (fSourceX + fSinkX) * 0.8,
        fy: strength * (fSourceY + fSinkY) * 0.8,
        fz: strength * (fSourceZ + fSinkZ) * 0.8,
      };
    }
    case 'quadrupole': {
      // 4 charges:
      // Sources at (-1, -1), (1, 1)
      // Sinks at (-1, 1), (1, -1)
      const pts = [
        { cx: -1.2, cy: -1.2, sign: 1 },
        { cx: 1.2, cy: 1.2, sign: 1 },
        { cx: -1.2, cy: 1.2, sign: -1 },
        { cx: 1.2, cy: -1.2, sign: -1 },
      ];

      let fx = 0;
      let fy = 0;
      let fz = 0;

      pts.forEach((pt) => {
        const dx = x - pt.cx;
        const dy = y - pt.cy;
        const dz = z;
        const dist2 = dx * dx + dy * dy + dz * dz + eps;
        const dist = Math.sqrt(dist2);
        const fmag = pt.sign / (dist2 * dist);
        fx += dx * fmag;
        fy += dy * fmag;
        fz += dz * fmag;
      });

      return {
        fx: strength * fx * 0.6,
        fy: strength * fy * 0.6,
        fz: strength * fz * 0.6,
      };
    }
    case 'wave': {
      // Oscillating waves of divergence
      // F = (sin(freq * x), sin(freq * y), sin(freq * z))
      // Div = freq * (cos(freq * x) + cos(freq * y) + cos(freq * z))
      return {
        fx: strength * Math.sin(frequency * x) * 0.6,
        fy: strength * Math.sin(frequency * y) * 0.6,
        fz: strength * Math.sin(frequency * z) * 0.6,
      };
    }
    case 'uniform_sink': {
      // Uniform horizontal flow with a drain in the center
      const decay = Math.exp(-r2_3d / 2);
      return {
        fx: strength * (0.5 - x * decay),
        fy: -strength * y * decay,
        fz: -strength * z * decay,
      };
    }
    default:
      return { fx: 0, fy: 0, fz: 0 };
  }
}

// Primary field evaluation wrapper
export function evaluateField(
  x: number,
  y: number,
  z: number,
  state: {
    preset: PresetType;
    strength: number;
    frequency: number;
    vortexSpeed: number;
    customFx: string;
    customFy: string;
    customFz: string;
  },
  compiledCustom?: {
    fx: (x: number, y: number, z: number) => number;
    fy: (x: number, y: number, z: number) => number;
    fz: (x: number, y: number, z: number) => number;
  }
): VectorValue {
  if (state.preset === 'custom' && compiledCustom) {
    return {
      fx: compiledCustom.fx(x, y, z),
      fy: compiledCustom.fy(x, y, z),
      fz: compiledCustom.fz(x, y, z),
    };
  }

  return evaluatePresetField(
    state.preset,
    x,
    y,
    z,
    state.strength,
    state.frequency,
    state.vortexSpeed
  );
}

// Numerical divergence calculation using central differences
export function calculateDivergence(
  x: number,
  y: number,
  z: number,
  state: {
    preset: PresetType;
    strength: number;
    frequency: number;
    vortexSpeed: number;
    customFx: string;
    customFy: string;
    customFz: string;
  },
  is3d: boolean = false,
  compiledCustom?: {
    fx: (x: number, y: number, z: number) => number;
    fy: (x: number, y: number, z: number) => number;
    fz: (x: number, y: number, z: number) => number;
  }
): number {
  const h = 0.005; // central difference step

  // Fx derivative with respect to x
  const f_xp = evaluateField(x + h, y, z, state, compiledCustom);
  const f_xm = evaluateField(x - h, y, z, state, compiledCustom);
  const dfx_dx = (f_xp.fx - f_xm.fx) / (2 * h);

  // Fy derivative with respect to y
  const f_yp = evaluateField(x, y + h, z, state, compiledCustom);
  const f_ym = evaluateField(x, y - h, z, state, compiledCustom);
  const dfy_dy = (f_yp.fy - f_ym.fy) / (2 * h);

  if (!is3d) {
    return dfx_dx + dfy_dy;
  }

  // Fz derivative with respect to z
  const f_zp = evaluateField(x, y, z + h, state, compiledCustom);
  const f_zm = evaluateField(x, y, z - h, state, compiledCustom);
  const dfz_dz = (f_zp.fz - f_zm.fz) / (2 * h);

  return dfx_dx + dfy_dy + dfz_dz;
}

// Numerical curl calculation using central differences
export function calculateCurl(
  x: number,
  y: number,
  z: number,
  state: {
    preset: PresetType;
    strength: number;
    frequency: number;
    vortexSpeed: number;
    customFx: string;
    customFy: string;
    customFz: string;
  },
  is3d: boolean = false,
  sliceAxis: 'X' | 'Y' | 'Z' = 'Z',
  compiledCustom?: {
    fx: (x: number, y: number, z: number) => number;
    fy: (x: number, y: number, z: number) => number;
    fz: (x: number, y: number, z: number) => number;
  }
): number {
  const h = 0.005; // central difference step

  if (!is3d || sliceAxis === 'Z') {
    // 2D scalar curl or 3D curl Z-component: dFy/dx - dFx/dy
    const f_xp = evaluateField(x + h, y, z, state, compiledCustom);
    const f_xm = evaluateField(x - h, y, z, state, compiledCustom);
    const dfy_dx = (f_xp.fy - f_xm.fy) / (2 * h);

    const f_yp = evaluateField(x, y + h, z, state, compiledCustom);
    const f_ym = evaluateField(x, y - h, z, state, compiledCustom);
    const dfx_dy = (f_yp.fx - f_ym.fx) / (2 * h);

    return dfy_dx - dfx_dy;
  }

  if (sliceAxis === 'X') {
    // Curl X-component: dFz/dy - dFy/dz
    const f_yp = evaluateField(x, y + h, z, state, compiledCustom);
    const f_ym = evaluateField(x, y - h, z, state, compiledCustom);
    const dfz_dy = (f_yp.fz - f_ym.fz) / (2 * h);

    const f_zp = evaluateField(x, y, z + h, state, compiledCustom);
    const f_zm = evaluateField(x, y, z - h, state, compiledCustom);
    const dfy_dz = (f_zp.fy - f_zm.fy) / (2 * h);

    return dfz_dy - dfy_dz;
  }

  if (sliceAxis === 'Y') {
    // Curl Y-component: dFx/dz - dFz/dx
    const f_zp = evaluateField(x, y, z + h, state, compiledCustom);
    const f_zm = evaluateField(x, y, z - h, state, compiledCustom);
    const dfx_dz = (f_zp.fx - f_zm.fx) / (2 * h);

    const f_xp = evaluateField(x + h, y, z, state, compiledCustom);
    const f_xm = evaluateField(x - h, y, z, state, compiledCustom);
    const dfz_dx = (f_xp.fz - f_xm.fz) / (2 * h);

    return dfx_dz - dfz_dx;
  }

  return 0;
}

// Predefined beautiful Color Scales
export const COLOR_MAPS = [
  {
    id: 'cool-warm',
    name: 'Cool-Warm (Standard)',
    negativeColor: 'rgb(59, 130, 246)', // Blue
    neutralColor: 'rgb(243, 244, 246)',  // Light grey
    positiveColor: 'rgb(239, 68, 68)',   // Red
    gradientCSS: 'linear-gradient(to right, #3b82f6, #f3f4f6, #ef4444)',
  },
  {
    id: 'cyan-magenta',
    name: 'Neon Electra',
    negativeColor: 'rgb(6, 182, 212)',  // Cyan
    neutralColor: 'rgb(17, 24, 39)',    // Slate 900
    positiveColor: 'rgb(236, 72, 153)',  // Pink
    gradientCSS: 'linear-gradient(to right, #06b6d4, #111827, #ec4899)',
  },
  {
    id: 'emerald-rose',
    name: 'Geophysical (Emerald-Rose)',
    negativeColor: 'rgb(16, 185, 129)', // Emerald
    neutralColor: 'rgb(255, 255, 255)', // White
    positiveColor: 'rgb(244, 63, 94)',   // Rose
    gradientCSS: 'linear-gradient(to right, #10b981, #ffffff, #f43f5e)',
  },
  {
    id: 'lava',
    name: 'Thermal Lava',
    negativeColor: 'rgb(76, 29, 149)',  // Deep Violet (heavy sink)
    neutralColor: 'rgb(31, 41, 55)',    // Dark grey
    positiveColor: 'rgb(249, 115, 22)',  // Bright Orange
    gradientCSS: 'linear-gradient(to right, #4c1d95, #1f2937, #f97316)',
  },
];

export function getDivergenceColor(val: number, maxVal: number, colorMapId: string): string {
  const map = COLOR_MAPS.find((m) => m.id === colorMapId) || COLOR_MAPS[0];

  // Clamp normalized value between -1 and 1
  let norm = maxVal > 0 ? val / maxVal : 0;
  norm = Math.max(-1, Math.min(1, norm));

  // Parse negative, neutral, and positive colors
  const parseRGB = (colStr: string) => {
    const match = colStr.match(/\d+/g);
    if (match && match.length >= 3) {
      return { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) };
    }
    return { r: 128, g: 128, b: 128 };
  };

  const cNeg = parseRGB(map.negativeColor);
  const cNeu = parseRGB(map.neutralColor);
  const cPos = parseRGB(map.positiveColor);

  let r, g, b;
  if (norm < 0) {
    // Interpolate between cNeg and cNeu
    const t = norm + 1; // goes from 0 (cNeg) to 1 (cNeu)
    r = Math.round(cNeg.r * (1 - t) + cNeu.r * t);
    g = Math.round(cNeg.g * (1 - t) + cNeu.g * t);
    b = Math.round(cNeg.b * (1 - t) + cNeu.b * t);
  } else {
    // Interpolate between cNeu and cPos
    const t = norm; // goes from 0 (cNeu) to 1 (cPos)
    r = Math.round(cNeu.r * (1 - t) + cPos.r * t);
    g = Math.round(cNeu.g * (1 - t) + cPos.g * t);
    b = Math.round(cNeu.b * (1 - t) + cPos.b * t);
  }

  return `rgb(${r}, ${g}, ${b})`;
}
