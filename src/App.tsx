import { useState, useEffect } from 'react';
import { AppState } from './types';
import { SidebarControls } from './components/SidebarControls';
import { Visualizer2D } from './components/Visualizer2D';
import { Visualizer3D } from './components/Visualizer3D';
import { compileSafeFormula, COLOR_MAPS } from './utils/mathUtils';
import { Info, HelpCircle, BookOpen, Layers, Zap, CheckCircle } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState>({
    dimension: '2D',
    preset: 'source',
    strength: 1.8,
    vortexSpeed: 2.0,
    frequency: 1.5,
    arrowDensity: 16,
    particleCount: 180,
    particleSpeed: 1.5,
    particleTrails: true,
    colorMapId: 'cool-warm',
    colorOverlayIntensity: 0.7,
    zSlice: 0.0,
    sliceAxis: 'Z',
    customFx: 'x * exp(-(x^2 + y^2))',
    customFy: 'y * exp(-(x^2 + y^2))',
    customFz: 'z * exp(-(x^2 + y^2))',
    showArrows: true,
    showParticles: true,
    showGridLines: true,
    isPlaying: true,
    selectedCoordinate: null,
    operator: 'divergence',
  });

  // State to hold compiled custom functions
  const [compiledCustom, setCompiledCustom] = useState({
    fx: (x: number, y: number, z: number) => x * Math.exp(-(x * x + y * y)),
    fy: (x: number, y: number, z: number) => y * Math.exp(-(x * x + y * y)),
    fz: (x: number, y: number, z: number) => z * Math.exp(-(x * x + y * y)),
  });

  // Recompile custom formula whenever custom strings change in state
  useEffect(() => {
    if (state.preset === 'custom') {
      const compiledFx = compileSafeFormula(state.customFx);
      const compiledFy = compileSafeFormula(state.customFy);
      const compiledFz = compileSafeFormula(state.customFz);

      setCompiledCustom({
        fx: compiledFx,
        fy: compiledFy,
        fz: compiledFz,
      });
    }
  }, [state.customFx, state.customFy, state.customFz, state.preset]);

  // Handle manual particle re-seeding / reset trigger
  const [resetKey, setResetKey] = useState(0);
  const handleResetParticles = () => {
    setResetKey((prev) => prev + 1);
  };

  const activeColorMap = COLOR_MAPS.find((m) => m.id === state.colorMapId) || COLOR_MAPS[0];

  // Helper values to show in color scale legend
  let maxOperatorLabel = 'High';
  let minOperatorLabel = 'Low';
  if (state.preset === 'source' || state.preset === 'sink') {
    maxOperatorLabel = `+${(state.strength * 2.0).toFixed(1)}`;
    minOperatorLabel = `-${(state.strength * 2.0).toFixed(1)}`;
  } else if (state.preset === 'wave') {
    const lim = (state.strength * state.frequency * 1.5).toFixed(1);
    maxOperatorLabel = `+${lim}`;
    minOperatorLabel = `-${lim}`;
  } else if (state.preset === 'vortex') {
    if (state.operator === 'divergence') {
      maxOperatorLabel = '0.0 (Zero)';
      minOperatorLabel = '0.0 (Zero)';
    } else {
      maxOperatorLabel = `+${(state.vortexSpeed * 2.0).toFixed(1)}`;
      minOperatorLabel = `-${(state.vortexSpeed * 2.0).toFixed(1)}`;
    }
  } else if (state.preset === 'saddle') {
    maxOperatorLabel = '0.0 (Zero)';
    minOperatorLabel = '0.0 (Zero)';
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-950 text-white overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR CONTROLS - takes 20-25% width */}
      <aside className="w-full md:w-[26%] lg:w-[22%] h-2/5 md:h-full flex-shrink-0 z-20 shadow-2xl">
        <SidebarControls
          state={state}
          setState={setState}
          onResetParticles={handleResetParticles}
          onAddPointSourceSink={() => {}}
        />
      </aside>

      {/* MAIN VIEWPORT / VISUALIZATION CANVAS - takes the rest */}
      <main className="flex-1 h-3/5 md:h-full flex flex-col relative min-w-0">
        
        {/* TOP GLOWING BAR / HEADER SECTION */}
        <header className="p-4 bg-slate-900/60 backdrop-blur border-b border-slate-800/80 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono uppercase tracking-widest animate-pulse">
                {state.operator === 'divergence' ? '∇ · F Divergence Solver' : '∇ × F Curl Solver'}
              </span>
              <span className="text-slate-500 text-xs font-mono">• Interactive Lab</span>
            </div>
            <h2 className="text-base md:text-lg font-display font-semibold text-slate-100 mt-1">
              {state.preset === 'custom' ? (
                <span>Custom Math Field Exploration</span>
              ) : (
                <span>
                  {state.preset === 'source' && 'Vector Source Field'}
                  {state.preset === 'sink' && 'Vector Sink Field'}
                  {state.preset === 'vortex' && (state.operator === 'divergence' ? 'Solenoidal Vortex (Zero Divergence)' : 'Rotational Vortex (High Curl)')}
                  {state.preset === 'saddle' && (state.operator === 'divergence' ? 'Saddle Point (Zero Divergence)' : 'Saddle Point (Irrotational / Zero Curl)')}
                  {state.preset === 'dipole' && 'Bipolar Source-Sink Field'}
                  {state.preset === 'quadrupole' && 'Symmetric Quadrupole Grid'}
                  {state.preset === 'wave' && 'Checkerboard Wave Continuum'}
                  {state.preset === 'uniform_sink' && 'Uniform Stream Drain'}
                </span>
              )}
            </h2>
          </div>

          {/* Glowing red "UDVASH" logo at the top right corner */}
          <div className="flex flex-col items-end pr-1">
            <span 
              id="udvash-brand"
              className="font-display font-extrabold text-xl md:text-2xl text-red-500 tracking-wider neon-glow-red animate-pulse-slow"
            >
              UDVASH
            </span>
            <span className="text-[8px] font-mono text-red-400/50 tracking-widest mt-0.5">MATH DYNAMICS</span>
          </div>
        </header>

        {/* VISUALIZATION CONTAINER AREA */}
        <div className="flex-1 min-h-0 relative flex flex-col">
          {state.dimension === '2D' ? (
            <Visualizer2D
              key={`2d-${resetKey}`}
              state={state}
              setState={setState}
              compiledCustom={compiledCustom}
            />
          ) : (
            <Visualizer3D
              key={`3d-${resetKey}`}
              state={state}
              setState={setState}
              compiledCustom={compiledCustom}
            />
          )}


        </div>

        {/* BOTTOM QUICK MATH GUIDE DRAWER */}
        <footer className="p-3 bg-slate-900/80 backdrop-blur border-t border-slate-800/80 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="leading-snug text-center sm:text-left">
              {state.operator === 'divergence' ? (
                <span>
                  <strong>The Divergence Theorem:</strong> Net expansion of field flux through a bounding surface equals the volume integral of <strong>∇ · F</strong>.
                </span>
              ) : (
                <span>
                  <strong>Stokes' Theorem:</strong> The circulation of a vector field around a closed loop equals the surface integral of its curl (<strong>∇ × F</strong>).
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
              FPS: 60 (WebGL/Canvas)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
              Grid Solver: Finite Difference
            </span>
          </div>
        </footer>

      </main>
    </div>
  );
}
