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
  skin: string; // for future skins
}

export default function Fish3D({ width, height, fishX, fishY, fishRotation, isInvincible, skin }: Fish3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const fishRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const clockRef = useRef(new THREE.Clock());

  // Load and setup 3D scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera - orthographic for 2D-like side view
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.1,
      1000
    );
    camera.position.z = 100;
    cameraRef.current = camera;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Load GLB model
    const loader = new GLTFLoader();
    loader.load(
      '/models/fish-skins/golden-fish.glb',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(18, 18, 18); // adjust scale to match 2D fish size (BASE.fishRadius ~18)
        model.position.set(0, 0, 0);

        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        scene.add(model);
        fishRef.current = model;

        // Setup animation if exists
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new AnimationMixer(model);
          mixerRef.current = mixer;

          // Play first animation (usually swim/tail)
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        console.log('Golden Fish 3D model loaded successfully!');
      },
      undefined,
      (error) => {
        console.error('Failed to load golden-fish.glb:', error);
      }
    );

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      const mixer = mixerRef.current;
      if (mixer) {
        mixer.update(clockRef.current.getDelta());
      }

      // Update fish position and rotation from props
      const fish = fishRef.current;
      if (fish && cameraRef.current) {
        // Convert 2D game coordinates to 3D
        // Game fishX is ~0.28 * width (left side), fishY is from top
        const gameFishX = fishX - width * 0.28; // offset to center
        fish.position.x = gameFishX;
        fish.position.y = height / 2 - fishY; // flip Y because canvas Y is down

        // Apply rotation (from engine fishRotation)
        fish.rotation.z = fishRotation * -1.2; // adjust multiplier for nice tilt

        // Subtle bob for liveliness (if no animation)
        if (!mixer) {
          fish.position.y += Math.sin(Date.now() * 0.003) * 1.5;
        }

        // Shield effect (blue tint when invincible)
        if (isInvincible) {
          fish.traverse((child) => {
            if ((child as THREE.Mesh).material) {
              const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
              if (mat.color) {
                mat.color.setHex(0x7dd3fc); // light blue tint
              }
            }
          });
        } else {
          fish.traverse((child) => {
            if ((child as THREE.Mesh).material) {
              const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
              if (mat.color && mat.userData.originalColor) {
                mat.color.copy(mat.userData.originalColor);
              }
            }
          });
        }
      }

      renderer.render(scene, cameraRef.current!);
    };

    animate();

    // Cleanup
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
    };
  }, [width, height, skin]);

  // Update position/rotation when props change (smooth)
  useEffect(() => {
    const fish = fishRef.current;
    if (fish) {
      const gameFishX = fishX - width * 0.28;
      fish.position.x = gameFishX;
      fish.position.y = height / 2 - fishY;
      fish.rotation.z = fishRotation * -1.2;
    }
  }, [fishX, fishY, fishRotation, isInvincible]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-none z-10"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}
