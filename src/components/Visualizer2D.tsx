import React, { useRef, useEffect, useState } from 'react';
import { AppState } from '../types';
import { calculateDivergence, calculateCurl, evaluateField, getDivergenceColor } from '../utils/mathUtils';
import { Info, Play, Pause, RefreshCw, Layers } from 'lucide-react';

interface Visualizer2DProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  compiledCustom: {
    fx: (x: number, y: number, z: number) => number;
    fy: (x: number, y: number, z: number) => number;
    fz: (x: number, y: number, z: number) => number;
  };
}

interface Particle {
  x: number; // math coord
  y: number; // math coord
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  history: { x: number; y: number }[]; // math coords
}

export const Visualizer2D: React.FC<Visualizer2DProps> = ({ state, setState, compiledCustom }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const hoverCoordRef = useRef<{ x: number; y: number } | null>(null);
  const [probeData, setProbeData] = useState<{
    mathX: number;
    mathY: number;
    fx: number;
    fy: number;
    divergence: number;
    curl: number;
  } | null>(null);

  // Math bounds: [-3, 3] on X, aspect ratio adjusted on Y
  const [bounds, setBounds] = useState({ minX: -3.0, maxX: 3.0, minY: -3.0, maxY: 3.0 });

  // Handle resize and setup canvas
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const width = Math.max(300, rect.width);
      const height = Math.max(300, rect.height);
      
      canvas.width = width;
      canvas.height = height;

      // Adjust coordinate bounds to maintain square aspect ratio in the center
      const aspect = width / height;
      if (aspect > 1) {
        setBounds({
          minX: -3.0 * aspect,
          maxX: 3.0 * aspect,
          minY: -3.0,
          maxY: 3.0,
        });
      } else {
        setBounds({
          minX: -3.0,
          maxX: 3.0,
          minY: -3.0 / aspect,
          maxY: 3.0 / aspect,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Small delay to ensure container is fully rendered
    const timer = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Conversion helpers
  const toMathX = (px: number, width: number) => {
    return bounds.minX + (px / width) * (bounds.maxX - bounds.minX);
  };

  const toMathY = (py: number, height: number) => {
    // Invert Y so math Y goes upwards
    return bounds.maxY - (py / height) * (bounds.maxY - bounds.minY);
  };

  const toPixelX = (mx: number, width: number) => {
    return ((mx - bounds.minX) / (bounds.maxX - bounds.minX)) * width;
  };

  const toPixelY = (my: number, height: number) => {
    return ((bounds.maxY - my) / (bounds.maxY - bounds.minY)) * height;
  };

  // Re-seed particles
  const initParticles = (count: number) => {
    const arr: Particle[] = [];
    for (let i = 0; i < count; i++) {
      // Seed particles uniformly across boundaries
      const mx = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const my = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
      const maxLife = 50 + Math.random() * 150;
      arr.push({
        x: mx,
        y: my,
        vx: 0,
        vy: 0,
        life: Math.random() * maxLife,
        maxLife,
        color: `hsla(${140 + Math.random() * 40}, 90%, 75%, ${0.6 + Math.random() * 0.4})`,
        history: [],
      });
    }
    particlesRef.current = arr;
  };

  // Keep particle count in sync
  useEffect(() => {
    if (state.particleCount !== particlesRef.current.length) {
      initParticles(state.particleCount);
    }
  }, [state.particleCount, bounds]);

  // Main render and animation loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We'll compute the maximum absolute operator value once on a rough grid to auto-scale the color overlay
    let maxOpVal = 2.0;
    if (state.preset === 'wave') maxOpVal = state.strength * state.frequency * 1.5;
    else if (state.preset === 'source' || state.preset === 'sink') maxOpVal = state.strength * 2.0;
    else if (state.preset === 'custom') maxOpVal = 4.0;
    else maxOpVal = state.strength * 1.2;

    if (maxOpVal <= 0.1) maxOpVal = 1.0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      // 1. CLEAR & BACKGROUND
      ctx.fillStyle = '#0b0f19'; // Deep rich dark background
      ctx.fillRect(0, 0, w, h);

      // 2. DRAW COORD GRID LINES (Optional)
      if (state.showGridLines) {
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.lineWidth = 1;
        
        // Draw standard mathematical axes
        const originX = toPixelX(0, w);
        const originY = toPixelY(0, h);

        // Draw grid lines every 1 unit
        const startX = Math.floor(bounds.minX);
        const endX = Math.ceil(bounds.maxX);
        for (let x = startX; x <= endX; x++) {
          const px = toPixelX(x, w);
          ctx.beginPath();
          ctx.moveTo(px, 0);
          ctx.lineTo(px, h);
          ctx.stroke();

          // Tick label
          if (x !== 0 && px > 10 && px < w - 10) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.font = '10px monospace';
            ctx.fillText(x.toString(), px - 4, originY + 12);
          }
        }

        const startY = Math.floor(bounds.minY);
        const endY = Math.ceil(bounds.maxY);
        for (let y = startY; y <= endY; y++) {
          const py = toPixelY(y, h);
          ctx.beginPath();
          ctx.moveTo(0, py);
          ctx.lineTo(w, py);
          ctx.stroke();

          // Tick label
          if (y !== 0 && py > 10 && py < h - 10) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.font = '10px monospace';
            ctx.fillText(y.toString(), originX + 5, py + 4);
          }
        }

        // Draw main axes in stronger slate
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(originX, 0); ctx.lineTo(originX, h);
        ctx.moveTo(0, originY); ctx.lineTo(w, originY);
        ctx.stroke();
      }

      // 3. DRAW OPERATOR COLOR OVERLAY (DIVERGENCE OR CURL)
      if (state.colorOverlayIntensity > 0) {
        // To be extremely high performance, we draw the overlay on a grid of cells (e.g. cell width = 6px)
        const cellSize = 6;
        const cols = Math.ceil(w / cellSize);
        const rows = Math.ceil(h / cellSize);

        // Create an image buffer or use fillRect
        // fillRect is very fast in modern browsers for standard resolutions, especially with 6px cells
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const px = c * cellSize + cellSize / 2;
            const py = r * cellSize + cellSize / 2;

            const mx = toMathX(px, w);
            const my = toMathY(py, h);

            const opVal = state.operator === 'divergence'
              ? calculateDivergence(mx, my, 0, state, false, compiledCustom)
              : calculateCurl(mx, my, 0, state, false, 'Z', compiledCustom);
            const col = getDivergenceColor(opVal, maxOpVal, state.colorMapId);

            ctx.fillStyle = col;
            // Draw slightly overlapping to avoid grid seam lines
            ctx.globalAlpha = state.colorOverlayIntensity;
            ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.5, cellSize + 0.5);
          }
        }
        ctx.globalAlpha = 1.0; // reset alpha
      }

      // 4. DRAW VECTOR ARROWS (FLOW FIELD GEOMETRY)
      if (state.showArrows) {
        const density = state.arrowDensity;
        const arrowSpacingX = w / (density + 1);
        const arrowSpacingY = h / (density + 1);

        ctx.lineWidth = 1.2;
        
        for (let i = 1; i <= density; i++) {
          for (let j = 1; j <= density; j++) {
            const px = i * arrowSpacingX;
            const py = j * arrowSpacingY;

            const mx = toMathX(px, w);
            const my = toMathY(py, h);

            // Get vector value at this point
            const vec = evaluateField(mx, my, 0, state, compiledCustom);

            // Compute magnitude of vector for arrow size scaling
            const mag = Math.sqrt(vec.fx * vec.fx + vec.fy * vec.fy);
            if (mag < 0.001) continue;

            // Normalized direction
            const dx = vec.fx / mag;
            const dy = -vec.fy / mag; // inverted Y for pixel space

            // Determine length of arrow (proportional to magnitude, capped at spacing)
            const maxLength = Math.min(arrowSpacingX, arrowSpacingY) * 0.9;
            const scaleFactor = 0.45;
            const arrowLength = Math.min(maxLength, mag * maxLength * scaleFactor);
            if (arrowLength < 1.5) continue;

            const startX = px - (dx * arrowLength) / 2;
            const startY = py - (dy * arrowLength) / 2;
            const endX = px + (dx * arrowLength) / 2;
            const endY = py + (dy * arrowLength) / 2;

            // Compute local operator to color the arrow or use elegant high contrast color
            const opAtPoint = state.operator === 'divergence'
              ? calculateDivergence(mx, my, 0, state, false, compiledCustom)
              : calculateCurl(mx, my, 0, state, false, 'Z', compiledCustom);
            
            // Draw vector arrow
            // Let arrow color blend: white/light slate or slightly tinted by divergence/curl
            const absOpNorm = Math.min(1.0, Math.abs(opAtPoint) / maxOpVal);
            if (opAtPoint > 0.05) {
              ctx.strokeStyle = `rgba(254, 226, 226, ${0.45 + absOpNorm * 0.55})`; // Light red tone
            } else if (opAtPoint < -0.05) {
              ctx.strokeStyle = `rgba(219, 234, 254, ${0.45 + absOpNorm * 0.55})`; // Light blue tone
            } else {
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'; // Neutral Slate/White
            }

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Arrow head
            const headSize = Math.max(2.5, arrowLength * 0.22);
            const angle = Math.atan2(endY - startY, endX - startX);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
              endX - headSize * Math.cos(angle - Math.PI / 6),
              endY - headSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              endX - headSize * Math.cos(angle + Math.PI / 6),
              endY - headSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // 5. UPDATE AND DRAW FLOW PARTICLES (FLUID STREAMLINES)
      if (state.showParticles) {
        const particles = particlesRef.current;
        const dt = 0.016 * state.particleSpeed;

        particles.forEach((p) => {
          if (state.isPlaying) {
            // Store previous coordinate for trail
            p.history.push({ x: p.x, y: p.y });
            if (p.history.length > 10) {
              p.history.shift();
            }

            // Evaluate field velocity at particle's current coordinate
            const vel = evaluateField(p.x, p.y, 0, state, compiledCustom);
            p.vx = vel.fx;
            p.vy = vel.fy;

            // Apply Euler step
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= 1;

            // Check boundaries or dead particle or trapped in sink (extremely low velocity inside sink)
            const isOutOfBounds =
              p.x < bounds.minX ||
              p.x > bounds.maxX ||
              p.y < bounds.minY ||
              p.y > bounds.maxY;

            const velSq = p.vx * p.vx + p.vy * p.vy;
            const isTrappedInSink = state.preset === 'sink' && velSq < 0.005 && p.life < p.maxLife * 0.7;

            if (p.life <= 0 || isOutOfBounds || isTrappedInSink) {
              // Re-spawn particle
              if (state.preset === 'source') {
                // For source, spawn very near the origin to showcase outward flow beautifully!
                const rAngle = Math.random() * Math.PI * 2;
                const rDist = Math.random() * 0.3;
                p.x = rDist * Math.cos(rAngle);
                p.y = rDist * Math.sin(rAngle);
              } else if (state.preset === 'uniform_sink') {
                // Spawn on the left edge mainly
                p.x = bounds.minX + Math.random() * 0.5;
                p.y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
              } else {
                // General uniform re-spawn
                p.x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
                p.y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
              }
              p.life = 40 + Math.random() * p.maxLife;
              p.history = [];
              p.vx = 0;
              p.vy = 0;
            }
          }

          // Draw Particle
          const px = toPixelX(p.x, w);
          const py = toPixelY(p.y, h);

          // Render Trail line if enabled
          if (state.particleTrails && p.history.length > 1) {
            ctx.beginPath();
            const startHistoryPx = toPixelX(p.history[0].x, w);
            const startHistoryPy = toPixelY(p.history[0].y, h);
            ctx.moveTo(startHistoryPx, startHistoryPy);

            for (let k = 1; k < p.history.length; k++) {
              const hpx = toPixelX(p.history[k].x, w);
              const hpy = toPixelY(p.history[k].y, h);
              ctx.lineTo(hpx, hpy);
            }
            ctx.lineTo(px, py);

            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1.0;
            ctx.stroke();
          }

          // Render Particle Head
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          // Glowing particle core
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          
          // Outer halo
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });
      }

      // 6. DRAW INTERACTIVE COORDINATE PROBE / MEASUREMENT TOOL
      const hoverCoord = hoverCoordRef.current;
      if (hoverCoord) {
        const px = hoverCoord.x;
        const py = hoverCoord.y;
        const mx = toMathX(px, w);
        const my = toMathY(py, h);

        const val = evaluateField(mx, my, 0, state, compiledCustom);
        const divVal = calculateDivergence(mx, my, 0, state, false, compiledCustom);
        const curlVal = calculateCurl(mx, my, 0, state, false, 'Z', compiledCustom);

        // Update local React state to render probe card overlay
        // Only update on rate limit or let it flow
        setProbeData({
          mathX: mx,
          mathY: my,
          fx: val.fx,
          fy: val.fy,
          divergence: divVal,
          curl: curlVal,
        });

        // Draw probe reticle
        ctx.strokeStyle = '#ef4444'; // glowing red
        ctx.lineWidth = 1.5;
        
        // Outer concentric rings
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.beginPath();
        ctx.arc(px, py, 18, 0, Math.PI * 2);
        ctx.stroke();

        // Horizontal and vertical dashed sightlines
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, py); ctx.lineTo(w, py);
        ctx.moveTo(px, 0); ctx.lineTo(px, h);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash
      } else {
        if (probeData) {
          setProbeData(null);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [bounds, state, compiledCustom]);

  // Handle Mouse Events for Coordinate Probe
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    hoverCoordRef.current = { x, y };
  };

  const handleMouseLeave = () => {
    hoverCoordRef.current = null;
    setProbeData(null);
  };

  const handleResetClick = () => {
    initParticles(state.particleCount);
  };

  return (
    <div id="visualizer-container" ref={containerRef} className="relative w-full h-full flex-1 min-h-0 bg-slate-950 overflow-hidden select-none">
      <canvas
        id="vector-field-canvas"
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="block w-full h-full cursor-crosshair"
      />

      {/* Floating Measurement Probe Info Card */}
      {probeData && (
        <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur-md border border-red-500/40 rounded-lg p-3 shadow-2xl w-64 text-xs font-mono text-slate-300 z-30 transition-all pointer-events-none">
          <div className="text-red-400 font-bold border-b border-slate-800 pb-1.5 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            ACTIVE SPACE PROBE
          </div>
          <div className="space-y-1.5 mt-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Coordinate:</span>
              <span className="text-white">({probeData.mathX.toFixed(3)}, {probeData.mathY.toFixed(3)})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vector F_x:</span>
              <span className="text-white font-semibold">{probeData.fx.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vector F_y:</span>
              <span className="text-white font-semibold">{probeData.fy.toFixed(3)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/80 pt-1.5">
              <span className="text-slate-500">Field Strength:</span>
              <span className="text-white font-bold">
                {Math.sqrt(probeData.fx * probeData.fx + probeData.fy * probeData.fy).toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 px-2 py-1 rounded border border-slate-800/60 mt-1">
              <span className="text-emerald-400 font-semibold text-[11px]">∇ · F (Div):</span>
              <span className={`font-bold text-xs ${probeData.divergence > 0.05 ? 'text-rose-400' : probeData.divergence < -0.05 ? 'text-blue-400' : 'text-slate-300'}`}>
                {probeData.divergence > 0 ? '+' : ''}{probeData.divergence.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 px-2 py-1 rounded border border-slate-800/60 mt-1">
              <span className="text-amber-400 font-semibold text-[11px]">∇ × F (Curl):</span>
              <span className={`font-bold text-xs ${probeData.curl > 0.05 ? 'text-rose-400' : probeData.curl < -0.05 ? 'text-blue-400' : 'text-slate-300'}`}>
                {probeData.curl > 0 ? '+' : ''}{probeData.curl.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Math Panel / HUD */}
      <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur border border-slate-800/80 rounded-lg p-3 text-xs font-mono space-y-1 text-slate-300 pointer-events-none z-10">
        <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest border-b border-slate-800 pb-1 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          Field HUD (2D CONTINUUM)
        </div>
        <div className="pt-1">
          <span className="text-slate-500">Active Equation:</span>
        </div>
        {state.preset === 'custom' ? (
          <div className="text-emerald-400 font-bold">
            F = ({state.customFx || '0'}) i^ + ({state.customFy || '0'}) j^
          </div>
        ) : (
          <div className="text-emerald-400 font-bold">
            {state.preset === 'source' && 'F = (x · e^{-r^2}) i^ + (y · e^{-r^2}) j^'}
            {state.preset === 'sink' && 'F = (-x · e^{-r^2}) i^ + (-y · e^{-r^2}) j^'}
            {state.preset === 'vortex' && 'F = (-y · e^{-r^2/4}) i^ + (x · e^{-r^2/4}) j^'}
            {state.preset === 'saddle' && 'F = (x/2) i^ + (-y/2) j^'}
            {state.preset === 'dipole' && 'F = (F_x) i^ + (F_y) j^'}
            {state.preset === 'quadrupole' && 'F = (F_x) i^ + (F_y) j^'}
            {state.preset === 'wave' && 'F = sin(x) i^ + sin(y) j^'}
            {state.preset === 'uniform_sink' && 'F = (1 - x·e^{-r^2}) i^ + (-y·e^{-r^2}) j^'}
          </div>
        )}
      </div>
    </div>
  );
};
