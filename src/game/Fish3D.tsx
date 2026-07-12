import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';

interface Fish3DProps {
  width: number;
  height: number;
  fishX: number;
  fishY: number;
  fishRotation: number;
  isInvincible: boolean;
  skin: string;
}

export default function Fish3D({ width, height, fishX, fishY, fishRotation, isInvincible, skin }: Fish3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const fishRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const clockRef = useRef(new THREE.Clock());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Orthographic camera covering the full screen (same as 2D canvas)
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.1,
      2000
    );
    camera.position.set(0, 0, 500);
    cameraRef.current = camera;

    // Better lighting for 3D model
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0.5, 1, 1);
    scene.add(dirLight);

    // Load the GLB
    const loader = new GLTFLoader();
    loader.load(
      '/models/fish-skins/golden-fish.glb',
      (gltf) => {
        const model = gltf.scene;

        // Auto-center the model pivot
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        // Scale - start with reasonable size (adjust based on your GLB)
        // BASE.fishRadius is ~18-22 in 2D, so we scale the 3D model to match visually
        model.scale.set(22, 22, 22);

        scene.add(model);
        fishRef.current = model;

        // Play animation if available (tail swim etc)
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new AnimationMixer(model);
          mixerRef.current = mixer;
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
          console.log('%c[3D Fish] Animation found and playing', 'color:#0ea5e9');
        } else {
          console.log('%c[3D Fish] No animation in GLB', 'color:#f59e0b');
        }

        console.log('%c[3D Fish] Golden Fish model loaded successfully!', 'color:#22c55e');
      },
      undefined,
      (error) => {
        console.error('[3D Fish] Failed to load golden-fish.glb:', error);
      }
    );

    const animate = () => {
      requestAnimationFrame(animate);

      if (mixerRef.current) {
        mixerRef.current.update(clockRef.current.getDelta());
      }

      const fish = fishRef.current;
      if (fish && cameraRef.current) {
        // Correct positioning: convert screen pixels to 3D world coordinates
        // 3D camera is centered at (0,0), screen fishX/Y are from top-left
        const worldX = fishX - width / 2;
        const worldY = height / 2 - fishY;

        fish.position.x = worldX;
        fish.position.y = worldY;

        // Apply tilt from velocity (same feeling as 2D)
        fish.rotation.z = fishRotation * -1.1;

        // Extra subtle breathing/bob if no animation
        if (!mixerRef.current) {
          fish.position.y += Math.sin(Date.now() * 0.0025) * 2;
        }

        // Shield glow effect
        if (isInvincible) {
          fish.traverse((child: any) => {
            if (child.material && child.material.color) {
              child.material.color.setHex(0x67e8f9);
            }
          });
        }
      }

      renderer.render(scene, cameraRef.current);
    };

    animate();

    return () => {
      renderer.dispose();
      if (mixerRef.current) mixerRef.current.stopAllAction();
    };
  }, [width, height, skin]);

  // Live update when fish moves
  useEffect(() => {
    const fish = fishRef.current;
    if (fish) {
      const worldX = fishX - width / 2;
      const worldY = height / 2 - fishY;
      fish.position.x = worldX;
      fish.position.y = worldY;
      fish.rotation.z = fishRotation * -1.1;
    }
  }, [fishX, fishY, fishRotation, isInvincible, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-none z-[20]"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}
