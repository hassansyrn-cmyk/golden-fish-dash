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
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

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

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0.5, 1, 1);
    scene.add(dirLight);

    const loader = new GLTFLoader();
    loader.load(
      '/models/fish-skins/golden-fish.glb',
      (gltf) => {
        const model = gltf.scene;

        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        // Make it face RIGHT (like the 2D fish in the game)
        // Most GLB fish are facing +Z, so rotate Y by -90 degrees
        model.rotation.y = -Math.PI / 2;

        // Large scale to match 2D fish size
        model.scale.set(38, 38, 38);

        scene.add(model);
        fishRef.current = model;

        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new AnimationMixer(model);
          mixerRef.current = mixer;
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        console.log('%c[3D Fish] Model loaded and facing right', 'color:#22c55e');
      },
      undefined,
      (error) => console.error('[3D Fish] Load error:', error)
    );

    const animate = () => {
      requestAnimationFrame(animate);

      if (mixerRef.current) {
        mixerRef.current.update(clockRef.current.getDelta());
      }

      const fish = fishRef.current;
      if (fish) {
        // Perfect alignment with 2D fish center
        const worldX = fishX - width / 2;
        const worldY = height / 2 - fishY;

        fish.position.x = worldX;
        fish.position.y = worldY;

        // Tilt with velocity (Z rotation on top of the Y facing)
        fish.rotation.z = fishRotation * -1.1;

        // Shield effect
        if (isInvincible) {
          fish.traverse((child: any) => {
            if (child.material?.color) child.material.color.setHex(0x67e8f9);
          });
        }
      }

      renderer.render(scene, cameraRef.current!);
    };

    animate();

    return () => {
      renderer.dispose();
      if (mixerRef.current) mixerRef.current.stopAllAction();
    };
  }, [width, height, skin]);

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
      className="absolute top-0 left-0 pointer-events-none z-[30]"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}
