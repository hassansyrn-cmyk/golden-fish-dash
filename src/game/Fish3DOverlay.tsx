import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { EngineState } from './engine';
import { FISH_X_RATIO } from './engine';

// ==========================================
// ADJUSTABLE TUNING CONSTANTS (Near top)
// ==========================================
const SCALE = 24.0;            // Base scale of the 3D fish model (adjusted to match 2D collider perfectly)
const OFFSET_X = 0.0;          // Fine-tune player X position (relative to 2D center)
const OFFSET_Y = 0.0;          // Fine-tune player Y position (relative to 2D center)
const OFFSET_Z = 0.0;          // Distance/Depth placement (normally 0 for orthographic)
const BASE_ROTATION_X = 0.0;   // In radians
const BASE_ROTATION_Y = Math.PI; // In radians (adjust to make fish face RIGHT)
const BASE_ROTATION_Z = 0.0;   // In radians
const LIGHTING_INTENSITY = 2.0; // Soft lighting multiplier

interface Fish3DOverlayProps {
  engineStateRef: React.RefObject<EngineState | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onLoaded: () => void;
  onError: () => void;
}

export default function Fish3DOverlay({
  engineStateRef,
  canvasRef,
  onLoaded,
  onError,
}: Fish3DOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const fishGroupRef = useRef<THREE.Group | null>(null);
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);

  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    // 1. Get initial dimensions matching the 2D canvas
    const width = canvasRef.current.clientWidth || window.innerWidth;
    const height = canvasRef.current.clientHeight || window.innerHeight;

    // 2. Setup Three.js WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Setup Scene
    const scene = new THREE.Scene();

    // 4. Setup Orthographic Camera
    // Map top-left as (0, 0) and bottom-right as (width, height)
    // Left, Right, Top, Bottom, Near, Far
    const camera = new THREE.OrthographicCamera(0, width, 0, height, -1000, 1000);
    camera.position.z = 100;

    // 5. Setup Lighting (Radiant & high-quality highlights)
    const ambientLight = new THREE.AmbientLight(0xffffff, LIGHTING_INTENSITY * 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, LIGHTING_INTENSITY * 1.2);
    dirLight1.position.set(0.5, -1, 1).normalize(); // pointing downwards and forwards
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x80d8ff, LIGHTING_INTENSITY * 0.5); // light blue soft rim
    dirLight2.position.set(-0.5, 1, -1).normalize();
    scene.add(dirLight2);

    // 6. Setup Fish Group
    const fishGroup = new THREE.Group();
    scene.add(fishGroup);
    fishGroupRef.current = fishGroup;

    // 7. Load GLB Model
    const loader = new GLTFLoader();
    const modelPath = '/models/fish-skins/golden-fish.glb';

    loader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;

        // Auto-center and configure scale
        model.scale.set(SCALE, SCALE, SCALE);
        model.position.set(0, 0, 0);

        // Apply base orientation rotation
        model.rotation.x = BASE_ROTATION_X;
        model.rotation.y = BASE_ROTATION_Y;
        model.rotation.z = BASE_ROTATION_Z;

        // Add to group
        fishGroup.add(model);

        // Setup shadows and clean up materials if needed
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              const mat = child.material as THREE.Material;
              mat.depthWrite = true;
            }
          }
        });

        // Setup Animations
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;

          // Find the appropriate animation name (swim, idle, swimming)
          const animNames = ['swim', 'idle', 'swimming'];
          let clip = gltf.animations[0]; // fallback to first clip

          for (const name of animNames) {
            const found = gltf.animations.find((c) => c.name.toLowerCase().includes(name));
            if (found) {
              clip = found;
              break;
            }
          }

          const action = mixer.clipAction(clip);
          action.play();
          activeActionRef.current = action;
        }

        // Notify parent that loading succeeded
        onLoaded();
      },
      undefined,
      (error) => {
        console.error('Failed to load 3D golden-fish model:', error);
        setLoadError(true);
        onError();
      }
    );

    // 8. Animation & Sync Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const tick = () => {
      const state = engineStateRef.current;
      const canvas = canvasRef.current;

      if (state && canvas && !loadError) {
        // Handle resizing if width/height changed dynamically
        const currentWidth = canvas.clientWidth;
        const currentHeight = canvas.clientHeight;

        if (renderer.domElement.width !== currentWidth * renderer.getPixelRatio() ||
            renderer.domElement.height !== currentHeight * renderer.getPixelRatio()) {
          renderer.setSize(currentWidth, currentHeight);
          camera.right = currentWidth;
          camera.bottom = currentHeight;
          camera.updateProjectionMatrix();
        }

        // Synchronize position
        const fishX = currentWidth * FISH_X_RATIO;
        const fishY = state.fishY;
        fishGroup.position.set(fishX + OFFSET_X, fishY + OFFSET_Y, OFFSET_Z);

        // Synchronize rotation (pitch)
        // Adjust model rotation to tilt up/down based on fishRotation
        fishGroup.rotation.z = state.fishRotation;

        // Blink when invincible
        const invincible = state.timeMs < state.invincibleUntil;
        fishGroup.visible = !invincible || Math.floor(state.timeMs / 100) % 2 === 0;

        // Update Mixer & Animations
        const delta = clock.getDelta();
        if (mixerRef.current) {
          mixerRef.current.update(delta);
        } else {
          // If no pre-baked animation, add a clean procedural idle swim wiggle
          // Sine wave oscillation for fish body rotation
          const swimPhase = state.timeMs * 0.012;
          // Apply a gentle Y-axis (and subtle Z-axis wiggle)
          fishGroup.rotation.y = BASE_ROTATION_Y + Math.sin(swimPhase) * 0.15;
        }

        // Render scene
        renderer.render(scene, camera);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    // 9. Clean up on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);

      // Dispose of renderer
      if (rendererRef.current) {
        const dom = rendererRef.current.domElement;
        if (dom && dom.parentNode) {
          dom.parentNode.removeChild(dom);
        }
        rendererRef.current.dispose();
      }

      // Dispose of three elements inside scene recursively
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else if (object.material) {
            object.material.dispose();
          }
        }
      });
    };
  }, [canvasRef, engineStateRef, loadError, onLoaded, onError]);

  if (loadError) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
}
