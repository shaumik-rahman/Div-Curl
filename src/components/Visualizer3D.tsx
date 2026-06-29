import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AppState } from '../types';
import { calculateDivergence, calculateCurl, evaluateField, getDivergenceColor } from '../utils/mathUtils';
import { Info, RotateCw, RefreshCw, Layers } from 'lucide-react';

interface Visualizer3DProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  compiledCustom: {
    fx: (x: number, y: number, z: number) => number;
    fy: (x: number, y: number, z: number) => number;
    fz: (x: number, y: number, z: number) => number;
  };
}

export const Visualizer3D: React.FC<Visualizer3DProps> = ({ state, setState, compiledCustom }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<AppState>(state);

  // Sync state reference for animation frame closure
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Orbit rotation state (manual self-contained implementation)
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraRotation = useRef({ theta: Math.PI / 4, phi: Math.PI / 3, radius: 5.8 });

  // References for Three.js objects to update dynamically
  const arrowsGroupRef = useRef<THREE.Group | null>(null);
  const slicePlaneRef = useRef<THREE.Mesh | null>(null);
  const sliceTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const sliceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const particlesArrayRef = useRef<Float32Array | null>(null);
  const particlesLifeRef = useRef<Float32Array | null>(null);
  const particlesInitialLifeRef = useRef<Float32Array | null>(null);

  // Mouse drag handlers for custom 3D rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;

    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    cameraRotation.current.theta -= deltaX * 0.007;
    // Clamp phi to avoid pole flipping
    cameraRotation.current.phi = Math.max(
      0.1,
      Math.min(Math.PI - 0.1, cameraRotation.current.phi - deltaY * 0.007)
    );

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Re-seed particles in 3D
  const reset3DParticles = () => {
    const count = stateRef.current.particleCount;
    if (particlesArrayRef.current && particlesLifeRef.current && particlesInitialLifeRef.current) {
      for (let i = 0; i < count; i++) {
        particlesArrayRef.current[i * 3] = (Math.random() - 0.5) * 4.0;
        particlesArrayRef.current[i * 3 + 1] = (Math.random() - 0.5) * 4.0;
        particlesArrayRef.current[i * 3 + 2] = (Math.random() - 0.5) * 4.0;

        const maxLife = 60 + Math.random() * 120;
        particlesLifeRef.current[i] = Math.random() * maxLife;
        particlesInitialLifeRef.current[i] = maxLife;
      }
      if (particlesGeometryRef.current) {
        particlesGeometryRef.current.attributes.position.needsUpdate = true;
      }
    }
  };

  // Main Three.js Lifecycle
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Create custom canvas for slice plane texture
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = 128;
    sliceCanvas.height = 128;
    sliceCanvasRef.current = sliceCanvas;

    const sliceTexture = new THREE.CanvasTexture(sliceCanvas);
    sliceTexture.colorSpace = THREE.SRGBColorSpace;
    sliceTextureRef.current = sliceTexture;

    // 1. SETUP THREE.JS SCENE & RENDERER
    const rect = container.getBoundingClientRect();
    const width = rect.width || 500;
    const height = rect.height || 500;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19); // slate dark labs

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);

    // 2. ADD LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa5f3fc, 0.3); // soft cyan fill
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // 3. ADD GRID AND BOX OUTLINE
    const boxGeometry = new THREE.BoxGeometry(4, 4, 4);
    const boxEdges = new THREE.EdgesGeometry(boxGeometry);
    const boxMaterial = new THREE.LineBasicMaterial({
      color: 0x334155, // slate-700
      linewidth: 1,
      transparent: true,
      opacity: 0.4,
    });
    const boxOutline = new THREE.LineSegments(boxEdges, boxMaterial);
    scene.add(boxOutline);

    // Optional coordinate axis lines
    const axesGroup = new THREE.Group();
    const axisMatX = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.3 });
    const axisMatY = new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.3 });
    const axisMatZ = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.3 });

    const lineX = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2.2, 0, 0), new THREE.Vector3(2.2, 0, 0)]),
      axisMatX
    );
    const lineY = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -2.2, 0), new THREE.Vector3(0, 2.2, 0)]),
      axisMatY
    );
    const lineZ = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -2.2), new THREE.Vector3(0, 0, 2.2)]),
      axisMatZ
    );
    axesGroup.add(lineX, lineY, lineZ);
    scene.add(axesGroup);

    // 4. CREATE VECTOR ARROWS GROUP
    const arrowsGroup = new THREE.Group();
    scene.add(arrowsGroup);
    arrowsGroupRef.current = arrowsGroup;

    // 5. CREATE SLICE PLANE
    const planeGeo = new THREE.PlaneGeometry(4, 4);
    const planeMat = new THREE.MeshBasicMaterial({
      map: sliceTexture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false, // Prevents particles from being clipped awkwardly
    });
    const sliceMesh = new THREE.Mesh(planeGeo, planeMat);
    scene.add(sliceMesh);
    slicePlaneRef.current = sliceMesh;

    // 6. CREATE PARTICLES (3D CLOUD)
    const maxParticles = 500;
    const particlePositions = new Float32Array(maxParticles * 3);
    const particleLife = new Float32Array(maxParticles);
    const particleInitialLife = new Float32Array(maxParticles);

    // Seed initial particle properties
    for (let i = 0; i < maxParticles; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 4.0;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4.0;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 4.0;

      const maxLife = 60 + Math.random() * 120;
      particleLife[i] = Math.random() * maxLife;
      particleInitialLife[i] = maxLife;
    }

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particlesGeometryRef.current = particlesGeometry;
    particlesArrayRef.current = particlePositions;
    particlesLifeRef.current = particleLife;
    particlesInitialLifeRef.current = particleInitialLife;

    // Create canvas texture for round glowing particles
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const grad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(52, 211, 153, 0.8)'); // emerald glowing halo
      grad.addColorStop(1, 'rgba(52, 211, 153, 0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 16, 16);
    }
    const pTexture = new THREE.CanvasTexture(pCanvas);

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.15,
      map: pTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleSystem);

    // 7. HANDLE RESIZE WITHIN THREE
    const handleResize = () => {
      const r = container.getBoundingClientRect();
      const w = r.width || 500;
      const h = r.height || 500;
      
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // 8. ANIMATION LOOP
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const curState = stateRef.current;
      const dt = clock.getDelta();

      // Gentle auto-rotation when idle
      if (!isDragging.current && curState.isPlaying) {
        cameraRotation.current.theta += 0.08 * dt;
      }

      // Calculate camera position using Spherical coordinates
      const theta = cameraRotation.current.theta;
      const phi = cameraRotation.current.phi;
      const r = cameraRotation.current.radius;

      camera.position.x = r * Math.sin(phi) * Math.sin(theta);
      camera.position.y = r * Math.cos(phi);
      camera.position.z = r * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 0, 0);

      // Re-populate Vector Field Arrows if presets or density changed
      // (Using simple flag checks or recreating on change for simplicity)
      // To keep it high-performance, we recreate arrows when density, preset, or strength parameters change.
      // We will throttle reconstruction or just run it dynamically.
      const maxDiv = curState.strength * 2.0 + 0.1;

      // Update slice plane orientation and texture
      if (sliceMesh && sliceCanvas && sliceTexture) {
        const axis = curState.sliceAxis;
        const sliceVal = curState.zSlice; // ranges from -2 to 2

        // Positioning slice
        if (axis === 'X') {
          sliceMesh.position.set(sliceVal, 0, 0);
          sliceMesh.rotation.set(0, Math.PI / 2, 0);
        } else if (axis === 'Y') {
          sliceMesh.position.set(0, sliceVal, 0);
          sliceMesh.rotation.set(Math.PI / 2, 0, 0);
        } else {
          // Z axis
          sliceMesh.position.set(0, 0, sliceVal);
          sliceMesh.rotation.set(0, 0, 0);
        }

        // Render color overlay inside canvas texture
        const ctx2 = sliceCanvas.getContext('2d');
        if (ctx2) {
          const wTex = sliceCanvas.width;
          const hTex = sliceCanvas.height;
          ctx2.fillStyle = '#111827';
          ctx2.fillRect(0, 0, wTex, hTex);

          // Render a grid of pixels
          const cell = 4;
          for (let yGrid = 0; yGrid < hTex; yGrid += cell) {
            for (let xGrid = 0; xGrid < wTex; xGrid += cell) {
              // Convert texture pixel to math coord between -2 and 2
              const valX_ratio = xGrid / wTex;
              const valY_ratio = yGrid / hTex;

              const mathCoord1 = -2.0 + valX_ratio * 4.0;
              const mathCoord2 = -2.0 + (1.0 - valY_ratio) * 4.0; // Inverted Y

              let mx = 0, my = 0, mz = 0;
              if (axis === 'X') {
                mx = sliceVal;
                my = mathCoord1;
                mz = mathCoord2;
              } else if (axis === 'Y') {
                mx = mathCoord1;
                my = sliceVal;
                mz = mathCoord2;
              } else {
                mx = mathCoord1;
                my = mathCoord2;
                mz = sliceVal;
              }

              const opVal = curState.operator === 'divergence'
                ? calculateDivergence(mx, my, mz, curState, true, compiledCustom)
                : calculateCurl(mx, my, mz, curState, true, axis, compiledCustom);
              const col = getDivergenceColor(opVal, maxDiv, curState.colorMapId);
              ctx2.fillStyle = col;
              ctx2.fillRect(xGrid, yGrid, cell, cell);
            }
          }
          sliceTexture.needsUpdate = true;
        }

        sliceMesh.visible = curState.colorOverlayIntensity > 0;
        planeMat.opacity = curState.colorOverlayIntensity * 0.9;
      }

      // Update 3D Fluid Particles Flow
      if (curState.showParticles && particlesArrayRef.current && particlesLifeRef.current) {
        const positions = particlesArrayRef.current;
        const life = particlesLifeRef.current;
        const initLife = particlesInitialLifeRef.current!;
        const speed = curState.particleSpeed * 0.8;
        const activeCount = curState.particleCount;

        particleSystem.visible = true;

        for (let i = 0; i < maxParticles; i++) {
          if (i >= activeCount) {
            // Hide unused particles by moving them out of camera sight
            positions[i * 3] = 999;
            positions[i * 3 + 1] = 999;
            positions[i * 3 + 2] = 999;
            continue;
          }

          if (curState.isPlaying) {
            let px = positions[i * 3];
            let py = positions[i * 3 + 1];
            let pz = positions[i * 3 + 2];

            // If a particle was hidden, bring it back
            if (px > 50) {
              px = (Math.random() - 0.5) * 4.0;
              py = (Math.random() - 0.5) * 4.0;
              pz = (Math.random() - 0.5) * 4.0;
              life[i] = Math.random() * initLife[i];
            }

            const vel = evaluateField(px, py, pz, curState, compiledCustom);

            // Euler drift
            px += vel.fx * speed * dt;
            py += vel.fy * speed * dt;
            pz += vel.fz * speed * dt;
            life[i] -= 1;

            const isOutOfBounds =
              Math.abs(px) > 2.0 || Math.abs(py) > 2.0 || Math.abs(pz) > 2.0;

            const velSq = vel.fx * vel.fx + vel.fy * vel.fy + vel.fz * vel.fz;
            const isTrappedInSink = curState.preset === 'sink' && velSq < 0.005 && life[i] < initLife[i] * 0.7;

            if (life[i] <= 0 || isOutOfBounds || isTrappedInSink) {
              if (curState.preset === 'source') {
                // Spawn near center source core
                const angle1 = Math.random() * Math.PI * 2;
                const angle2 = Math.random() * Math.PI;
                const dist = Math.random() * 0.3;
                px = dist * Math.sin(angle2) * Math.sin(angle1);
                py = dist * Math.cos(angle2);
                pz = dist * Math.sin(angle2) * Math.cos(angle1);
              } else {
                px = (Math.random() - 0.5) * 4.0;
                py = (Math.random() - 0.5) * 4.0;
                pz = (Math.random() - 0.5) * 4.0;
              }
              life[i] = 40 + Math.random() * initLife[i];
            }

            positions[i * 3] = px;
            positions[i * 3 + 1] = py;
            positions[i * 3 + 2] = pz;
          }
        }
        particlesGeometry.attributes.position.needsUpdate = true;
      } else {
        particleSystem.visible = false;
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    // Initialize/Re-create Vector Field Arrows on parameter shifts
    const updateFieldArrows = () => {
      const curState = stateRef.current;
      const density = Math.min(curState.arrowDensity, 16); // cap 3D grid to 16 density for maximum graphics performance
      const spacing = 4.0 / (density + 1);

      if (!arrowsGroup) return;

      // Clear previous arrows
      while (arrowsGroup.children.length > 0) {
        scene.remove(arrowsGroup.children[0]);
        arrowsGroup.remove(arrowsGroup.children[0]);
      }

      if (!curState.showArrows) return;

      const maxDiv = curState.strength * 2.0 + 0.1;

      for (let i = 1; i <= density; i++) {
        for (let j = 1; j <= density; j++) {
          for (let k = 1; k <= density; k++) {
            const px = -2.0 + i * spacing;
            const py = -2.0 + j * spacing;
            const pz = -2.0 + k * spacing;

            const vec = evaluateField(px, py, pz, curState, compiledCustom);
            const mag = Math.sqrt(vec.fx * vec.fx + vec.fy * vec.fy + vec.fz * vec.fz);
            if (mag < 0.01) continue;

            // Arrow direction vector
            const dir = new THREE.Vector3(vec.fx / mag, vec.fy / mag, vec.fz / mag);
            const origin = new THREE.Vector3(px, py, pz);

            // Determine length of arrow proportional to spacing and strength
            const maxLength = spacing * 0.95;
            const arrowLength = Math.min(maxLength, mag * maxLength * 0.45);
            if (arrowLength < 0.05) continue;

            // Operator-colored Arrow (Divergence or Curl along the slice plane axis)
            const opAtPoint = curState.operator === 'divergence'
              ? calculateDivergence(px, py, pz, curState, true, compiledCustom)
              : calculateCurl(px, py, pz, curState, true, curState.sliceAxis, compiledCustom);
            const absOpNorm = Math.min(1.0, Math.abs(opAtPoint) / maxDiv);

            let colorHex = 0xe2e8f0; // standard slate light arrow
            if (opAtPoint > 0.05) {
              // Blend towards red
              colorHex = 0xfc8181;
            } else if (opAtPoint < -0.05) {
              // Blend towards blue
              colorHex = 0x63b3ed;
            }

            const arrowHelper = new THREE.ArrowHelper(
              dir,
              origin,
              arrowLength,
              colorHex,
              arrowLength * 0.25, // head length
              arrowLength * 0.16  // head width
            );

            // Set thin line materials for clean render look
            if (arrowHelper.line) {
              (arrowHelper.line.material as THREE.LineBasicMaterial).transparent = true;
              (arrowHelper.line.material as THREE.LineBasicMaterial).opacity = 0.5 + absOpNorm * 0.5;
            }
            if (arrowHelper.cone) {
              (arrowHelper.cone.material as THREE.MeshBasicMaterial).transparent = true;
              (arrowHelper.cone.material as THREE.MeshBasicMaterial).opacity = 0.5 + absOpNorm * 0.5;
            }

            arrowsGroup.add(arrowHelper);
          }
        }
      }
    };

    // Recreate arrows on core state updates
    updateFieldArrows();

    // Trigger animation loop
    animate();

    // Setup an observer to rebuild arrows when layout metrics update
    const intervalId = setInterval(() => {
      // Periodic check or let state dependencies reconstruct
      updateFieldArrows();
    }, 2500);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(intervalId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      planeGeo.dispose();
      planeMat.dispose();
      boxEdges.dispose();
      boxGeometry.dispose();
      boxMaterial.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      pTexture.dispose();
      sliceTexture.dispose();
    };
  }, [state.preset, state.strength, state.frequency, state.vortexSpeed, state.arrowDensity, state.showArrows, state.operator, state.sliceAxis, compiledCustom]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex-1 min-h-0 bg-slate-950 overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="block w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Manual Controls Tutorial Prompt */}
      <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg p-2.5 text-[10px] font-mono text-slate-400 max-w-xs space-y-1 z-10 pointer-events-none">
        <div className="text-slate-300 font-bold uppercase tracking-wider">3D INTERACTION GUIDE</div>
        <div className="flex items-center gap-1.5">
          <span className="px-1 py-0.5 rounded bg-slate-950 border border-slate-800 font-bold text-white text-[9px]">DRAG MOUSE</span>
          <span>Rotate 3D field camera angle</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="px-1 py-0.5 rounded bg-slate-950 border border-slate-800 font-bold text-white text-[9px]">SLICER SLIDER</span>
          <span>Scan spatial plane slices</span>
        </div>
      </div>

      {/* Floating 3D Vector field HUD */}
      <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur border border-slate-800/85 rounded-lg p-3 text-xs font-mono space-y-1 text-slate-300 pointer-events-none z-10">
        <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest border-b border-slate-800 pb-1 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          Field HUD (3D CONTUMACY)
        </div>
        <div className="pt-1">
          <span className="text-slate-500">Active Equation:</span>
        </div>
        {state.preset === 'custom' ? (
          <div className="text-emerald-400 font-bold">
            F = ({state.customFx || '0'}) i^ + ({state.customFy || '0'}) j^ + ({state.customFz || '0'}) k^
          </div>
        ) : (
          <div className="text-emerald-400 font-bold">
            {state.preset === 'source' && 'F = (x·e^{-r^2}) i^ + (y·e^{-r^2}) j^ + (z·e^{-r^2}) k^'}
            {state.preset === 'sink' && 'F = (-x·e^{-r^2}) i^ + (-y·e^{-r^2}) j^ + (-z·e^{-r^2}) k^'}
            {state.preset === 'vortex' && 'F = (-y·e^{-r^2/4}) i^ + (x·e^{-r^2/4}) j^ + (0) k^'}
            {state.preset === 'saddle' && 'F = (x/2) i^ + (-y/2) j^ + (0) k^'}
            {state.preset === 'dipole' && 'F = (F_x) i^ + (F_y) j^ + (F_z) k^'}
            {state.preset === 'quadrupole' && 'F = (F_x) i^ + (F_y) j^ + (F_z) k^'}
            {state.preset === 'wave' && 'F = sin(x) i^ + sin(y) j^ + sin(z) k^'}
            {state.preset === 'uniform_sink' && 'F = (1 - x·e^{-r^2}) i^ + (-y·e^{-r^2}) j^ + (-z·e^{-r^2}) k^'}
          </div>
        )}
      </div>

      <button
        onClick={reset3DParticles}
        className="absolute top-4 right-4 bg-slate-900 hover:bg-slate-850 text-emerald-400 border border-slate-800 hover:border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all z-20"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Re-seed Flow
      </button>
    </div>
  );
};
