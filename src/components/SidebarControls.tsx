import React, { useState } from 'react';
import { AppState, PresetType } from '../types';
import { COLOR_MAPS } from '../utils/mathUtils';
import {
  Activity,
  Compass,
  Eye,
  Sliders,
  RotateCcw,
  Play,
  Pause,
  Layers,
  HelpCircle,
  Info,
  CheckCircle,
  AlertTriangle,
  Flame,
  Globe,
  Settings
} from 'lucide-react';

interface SidebarControlsProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onResetParticles: () => void;
  onAddPointSourceSink: (type: 'source' | 'sink') => void;
}

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  state,
  setState,
  onResetParticles,
  onAddPointSourceSink,
}) => {
  const [formulaError, setFormulaError] = useState<string | null>(null);

  const presets = [
    { id: 'source', name: 'Fluid Source', desc: 'Positive divergence (expansion) near center.' },
    { id: 'sink', name: 'Fluid Sink', desc: 'Negative divergence (contraction) near center.' },
    { id: 'vortex', name: 'Vortex (Swirl)', desc: 'Pure rotational circulation. Divergence is exactly zero!' },
    { id: 'saddle', name: 'Saddle Point', desc: 'Inflow on X, outflow on Y. Divergence is zero.' },
    { id: 'dipole', name: 'Dipole Pair', desc: 'One source & one sink. Clear source/sink poles.' },
    { id: 'quadrupole', name: 'Quadrupole Grid', desc: 'Four alternate source/sink charges.' },
    { id: 'wave', name: 'Sinusoidal Wave', desc: 'Grid of alternating sources and sinks.' },
    { id: 'uniform_sink', name: 'Uniform + Sink', desc: 'Water flowing into a localized drain.' },
    { id: 'custom', name: 'Custom Formula ✎', desc: 'Input your own mathematical field expressions!' },
  ];

  const updateState = (key: keyof AppState, value: any) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handlePresetChange = (presetId: PresetType) => {
    updateState('preset', presetId);
  };

  const handleCustomFormulaSubmit = () => {
    // Validate formula characters roughly
    const validate = (str: string) => {
      const stripped = str.toLowerCase()
        .replace(/(sin|cos|tan|sqrt|exp|pow|abs|pi|e|log|asin|acos|atan|sinh|cosh|tanh|ln)/g, '')
        .replace(/[0-9xxyz\s+\-*/().,^]/g, '');
      return stripped.length === 0;
    };

    if (!validate(state.customFx) || !validate(state.customFy) || (state.dimension === '3D' && !validate(state.customFz))) {
      setFormulaError('Formula has forbidden terms. Use: x, y, z, sin, cos, tan, exp, pow, sqrt, abs, pi, e.');
    } else {
      setFormulaError(null);
      // Force reload by re-triggering current formula
      updateState('preset', 'custom');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-900 border-r border-slate-800 flex flex-col font-sans select-none text-slate-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: '8s' }} />
          <div>
            <h1 className="font-display font-bold text-lg text-white leading-tight">Vector Calculus</h1>
            <p className="text-xs text-slate-500 font-mono">ANALYTICS LAB</p>
          </div>
        </div>
      </div>

      {/* Main Form Fields Container */}
      <div className="p-4 flex-1 space-y-6">
        {/* 1. Dimension Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-mono font-bold">
            <span>Dimension</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-emerald-400 font-normal">
              {state.dimension} Mode
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => updateState('dimension', '2D')}
              className={`py-1.5 text-sm font-medium rounded-md transition-all ${
                state.dimension === '2D'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              2D Space
            </button>
            <button
              onClick={() => updateState('dimension', '3D')}
              className={`py-1.5 text-sm font-medium rounded-md transition-all ${
                state.dimension === '3D'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              3D Volume
            </button>
          </div>
        </div>

        {/* 1.5. Operator Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-mono font-bold">
            <span>Scalar Operator</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-emerald-400 font-normal">
              {state.operator === 'divergence' ? 'Divergence ∇·F' : 'Curl ∇×F'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => updateState('operator', 'divergence')}
              className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                state.operator === 'divergence'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Div (∇ · F)
            </button>
            <button
              onClick={() => updateState('operator', 'curl')}
              className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                state.operator === 'curl'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Curl (∇ × F)
            </button>
          </div>
        </div>

        {/* 2. Vector Field Selector */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider font-mono font-bold">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Vector Field Pattern
          </label>
          <div className="relative">
            <select
              value={state.preset}
              onChange={(e) => handlePresetChange(e.target.value as PresetType)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/40">
            {presets.find((p) => p.id === state.preset)?.desc}
          </p>
        </div>

        {/* 3. Custom Formulas Inputs */}
        {state.preset === 'custom' && (
          <div className="space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-800 animate-fade-in">
            <div className="text-xs font-mono font-bold text-slate-400 border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <span>Field Components</span>
              <span className="text-[10px] text-emerald-400">f(x, y, z)</span>
            </div>
            
            <div className="space-y-2 font-mono text-xs">
              <div>
                <label className="text-slate-500">F_x =</label>
                <input
                  type="text"
                  value={state.customFx}
                  onChange={(e) => updateState('customFx', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-emerald-500 font-mono mt-0.5"
                  placeholder="e.g. x * exp(-(x^2 + y^2))"
                />
              </div>
              <div>
                <label className="text-slate-500">F_y =</label>
                <input
                  type="text"
                  value={state.customFy}
                  onChange={(e) => updateState('customFy', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-emerald-500 font-mono mt-0.5"
                  placeholder="e.g. y * exp(-(x^2 + y^2))"
                />
              </div>
              {state.dimension === '3D' && (
                <div>
                  <label className="text-slate-500">F_z =</label>
                  <input
                    type="text"
                    value={state.customFz}
                    onChange={(e) => updateState('customFz', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-emerald-500 font-mono mt-0.5"
                    placeholder="e.g. z * exp(-(x^2 + y^2))"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleCustomFormulaSubmit}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-1.5 rounded text-xs transition-all flex items-center justify-center gap-1 mt-2"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Apply Formula
            </button>

            {formulaError && (
              <div className="p-2 bg-red-950/50 border border-red-900 rounded text-[10px] text-red-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{formulaError}</span>
              </div>
            )}
            
            <div className="text-[10px] text-slate-500 mt-1">
              <strong>Supported:</strong> sin, cos, tan, sqrt, exp, pow, abs, pi, e, log, ln, +, -, *, /, ^.
            </div>
          </div>
        )}

        {/* 4. Controls / Field Sliders */}
        <div className="space-y-4">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider font-mono font-bold border-b border-slate-800 pb-1">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            Field Parameters
          </label>

          {/* Strength Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Source/Sink Intensity</span>
              <span className="text-white font-bold">{state.strength.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={state.strength}
              onChange={(e) => updateState('strength', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Vortex Speed (Always visible but styled disabled if not vortex, or hide) */}
          {state.preset === 'vortex' && (
            <div className="space-y-1 animate-fade-in">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Vorticity / Swirl Speed</span>
                <span className="text-white font-bold">{state.vortexSpeed.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={state.vortexSpeed}
                onChange={(e) => updateState('vortexSpeed', parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}

          {/* Wave Frequency */}
          {state.preset === 'wave' && (
            <div className="space-y-1 animate-fade-in">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Wave Spatial Frequency</span>
                <span className="text-white font-bold">{state.frequency.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.5"
                step="0.1"
                value={state.frequency}
                onChange={(e) => updateState('frequency', parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}

          {/* Grid Density / Arrow Count */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Vector Arrow Density</span>
              <span className="text-white font-bold">{state.arrowDensity} × {state.arrowDensity}</span>
            </div>
            <input
              type="range"
              min="8"
              max="28"
              step="2"
              value={state.arrowDensity}
              onChange={(e) => updateState('arrowDensity', parseInt(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* 5. Particle Flow Controls */}
        <div className="space-y-4">
          <label className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-mono font-bold border-b border-slate-800 pb-1">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Dynamic Fluid Flow
            </span>
            <span className="text-[10px] text-emerald-500">Particles</span>
          </label>

          {/* Particle Count */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Particle Count</span>
              <span className="text-white font-bold">{state.particleCount}</span>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="20"
              value={state.particleCount}
              onChange={(e) => updateState('particleCount', parseInt(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Particle Speed */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Flow/Drift Speed</span>
              <span className="text-white font-bold">{state.particleSpeed.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="4.0"
              step="0.1"
              value={state.particleSpeed}
              onChange={(e) => updateState('particleSpeed', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateState('particleTrails', !state.particleTrails)}
              className={`py-1 text-xs font-medium rounded border transition-all ${
                state.particleTrails
                  ? 'bg-slate-800 text-emerald-400 border-emerald-500/50'
                  : 'bg-slate-950 text-slate-500 border-slate-800'
              }`}
            >
              {state.particleTrails ? '✓ Trails: ON' : 'Trails: OFF'}
            </button>
            <button
              onClick={onResetParticles}
              className="py-1 text-xs font-medium rounded border bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900 transition-all flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-seed
            </button>
          </div>
        </div>

        {/* 6. 3D Volume Slicing (Only in 3D Mode) */}
        {state.dimension === '3D' && (
          <div className="space-y-3 bg-slate-950/70 p-3 rounded-lg border border-slate-800 animate-fade-in">
            <div className="flex items-center gap-1 text-xs text-slate-400 uppercase tracking-wider font-mono font-bold border-b border-slate-800 pb-1">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              3D Scalar Cross-Section
            </div>
            
            <p className="text-[11px] text-slate-400">
              Select slice plane axis and coordinate to visualize divergence inside the volume:
            </p>

            <div className="flex gap-1.5">
              {(['X', 'Y', 'Z'] as const).map((axis) => (
                <button
                  key={axis}
                  onClick={() => updateState('sliceAxis', axis)}
                  className={`flex-1 py-1 text-xs font-bold rounded transition-all ${
                    state.sliceAxis === axis
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {axis} = {axis === 'X' ? state.zSlice.toFixed(2) : axis === 'Y' ? state.zSlice.toFixed(2) : state.zSlice.toFixed(2)}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <input
                type="range"
                min="-2"
                max="2"
                step="0.05"
                value={state.zSlice}
                onChange={(e) => updateState('zSlice', parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-2.0</span>
                <span>Center (0)</span>
                <span>+2.0</span>
              </div>
            </div>
          </div>
        )}

        {/* 7. Color Scale Map selection & Opacity */}
        <div className="space-y-4">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider font-mono font-bold border-b border-slate-800 pb-1">
            <Flame className="w-3.5 h-3.5 text-emerald-400" />
            Scalar Divergence Map
          </label>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {COLOR_MAPS.map((cmap) => (
                <button
                  key={cmap.id}
                  onClick={() => updateState('colorMapId', cmap.id)}
                  className={`p-1.5 rounded border text-left text-xs transition-all ${
                    state.colorMapId === cmap.id
                      ? 'bg-slate-800 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold truncate mb-1">{cmap.name}</div>
                  <div
                    className="h-2 w-full rounded"
                    style={{ background: cmap.gradientCSS }}
                  />
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Overlay Opacity</span>
                <span className="text-white font-bold">{(state.colorOverlayIntensity * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.1"
                value={state.colorOverlayIntensity}
                onChange={(e) => updateState('colorOverlayIntensity', parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 8. Display/Overlay Options */}
        <div className="space-y-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider font-mono font-bold border-b border-slate-800 pb-1">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            Display Toggles
          </label>

          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <button
              onClick={() => updateState('showArrows', !state.showArrows)}
              className={`py-1 rounded border text-center transition-all ${
                state.showArrows
                  ? 'bg-slate-800 border-emerald-500 text-emerald-400 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              {state.showArrows ? '✓ Vector Arrows' : '✕ Vector Arrows'}
            </button>

            <button
              onClick={() => updateState('showParticles', !state.showParticles)}
              className={`py-1 rounded border text-center transition-all ${
                state.showParticles
                  ? 'bg-slate-800 border-emerald-500 text-emerald-400 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              {state.showParticles ? '✓ Fluid flow' : '✕ Fluid flow'}
            </button>

            <button
              onClick={() => updateState('showGridLines', !state.showGridLines)}
              className={`py-1 rounded border text-center transition-all ${
                state.showGridLines
                  ? 'bg-slate-800 border-emerald-500 text-emerald-400 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              {state.showGridLines ? '✓ Coordinate grid' : '✕ Coordinate grid'}
            </button>

            <button
              onClick={() => updateState('isPlaying', !state.isPlaying)}
              className={`py-1 rounded border text-center transition-all flex items-center justify-center gap-1 ${
                state.isPlaying
                  ? 'bg-slate-800 border-emerald-500 text-emerald-400 font-bold'
                  : 'bg-slate-950 border-slate-800 text-amber-500/80 font-bold animate-pulse'
              }`}
            >
              {state.isPlaying ? (
                <>
                  <Pause className="w-3 h-3 text-emerald-400 fill-emerald-400" /> Playing
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-amber-500/80 fill-amber-500/40" /> Paused
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Sandbox addition (Interactive Click tools) */}
        {state.dimension === '2D' && (
          <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 font-mono text-xs text-slate-400">
            <span className="font-bold text-slate-300">💡 Interaction Hint:</span>
            <p className="text-[11px] leading-relaxed mt-1">
              Click anywhere on the interactive canvas to probe the exact vector values, coordinates, and local scalar {state.operator === 'divergence' ? 'divergence' : 'curl'}!
            </p>
          </div>
        )}
      </div>

      {/* Lab footer branding info */}
      <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-[10px] font-mono text-slate-500 flex flex-col gap-1">
        <div className="flex justify-between">
          <span>{state.operator === 'divergence' ? 'Divergence Div(F) = ∇ · F' : 'Curl Curl(F) = ∇ × F'}</span>
          <span>Version 1.3</span>
        </div>
        {state.operator === 'divergence' ? (
          <>
            <div>
              <span>∇ · F &gt; 0: Source (Expands)</span>
            </div>
            <div>
              <span>∇ · F &lt; 0: Sink (Compresses)</span>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>∇ × F &gt; 0: Counter-Clockwise Swirl</span>
            </div>
            <div>
              <span>∇ × F &lt; 0: Clockwise Swirl</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
