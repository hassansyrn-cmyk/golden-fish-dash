import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SkinId } from './types';

interface Fish3DProps {
  skin: SkinId;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}

// Simple procedural 3D fish using Three.js geometry
export default function Fish3D({ skin, x, y, rotation, width, height }: Fish3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const fishGroupRef = useRef<THREE.Group | null>(null);
  const tailRef = useRef<THREE.Group | null>(null);
  const animationRef = useRef<number | null>(null);

  // Skin color configurations
  const skinConfig = {
    golden: { body: '#ff9f1c', belly: '#fff0c2', fin: '#ff7b00', glow: '#ffd166' },
    ruby: { body: '#c1121f', belly: '#ffccd5', fin: '#780000', glow: '#ff4d6d' },
    emerald: { body: '#0077b6', belly: '#90e0ef', fin: '#00b4d8', glow: '#48cae4' },
    diamond: { body: '#4cc9f0', belly: '#f0f9ff', fin: '#4361ee', glow: '#a5d8ff' },
    legendary: { body: '#1a1a1a', belly: '#fffbe6', fin: '#ffd60a', glow: '#ffe066' },
  };

  const config = skinConfig[skin];

  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Orthographic camera for 2D-like projection
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.1,
      1000
    );
    camera.position.z = 10;
    cameraRef.current = camera;

    // Renderer with transparent background
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      preserveDrawingBuffer: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create fish group
    const fishGroup = new THREE.Group();
    fishGroupRef.current = fishGroup;
    scene.add(fishGroup);

    // Body (ellipsoid using SphereGeometry scaled)
    const bodyGeometry = new THREE.SphereGeometry(18, 32, 16);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: config.body,
      shininess: 30,
      specular: 0x222222
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.scale.set(1.3, 0.9, 0.8);
    fishGroup.add(body);

    // Belly (lighter part)
    const bellyGeometry = new THREE.SphereGeometry(14, 24, 12);
    const bellyMaterial = new THREE.MeshPhongMaterial({ 
      color: config.belly,
      shininess: 20
    });
    const belly = new THREE.Mesh(bellyGeometry, bellyMaterial);
    belly.scale.set(1.1, 0.6, 0.7);
    belly.position.y = -6;
    fishGroup.add(belly);

    // Tail
    const tailGroup = new THREE.Group();
    tailRef.current = tailGroup;
    fishGroup.add(tailGroup);

    const tailGeometry = new THREE.ConeGeometry(8, 22, 3);
    const tailMaterial = new THREE.MeshPhongMaterial({ 
      color: config.fin,
      shininess: 25
    });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -22;
    tailGroup.add(tail);

    // Dorsal fin
    const dorsalGeometry = new THREE.PlaneGeometry(12, 18);
    const dorsalMaterial = new THREE.MeshPhongMaterial({ 
      color: config.fin,
      side: THREE.DoubleSide,
      shininess: 20
    });
    const dorsal = new THREE.Mesh(dorsalGeometry, dorsalMaterial);
    dorsal.rotation.x = -0.3;
    dorsal.position.set(5, 14, 0);
    fishGroup.add(dorsal);

    // Pectoral fin (left)
    const pectoralGeometry = new THREE.PlaneGeometry(10, 8);
    const pectoral = new THREE.Mesh(pectoralGeometry, dorsalMaterial);
    pectoral.rotation.y = 0.8;
    pectoral.position.set(8, -4, 8);
    fishGroup.add(pectoral);

    // Eye
    const eyeGeometry = new THREE.SphereGeometry(4, 16, 12);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(14, 6, 8);
    fishGroup.add(eye);

    // Eye highlight
    const highlightGeometry = new THREE.SphereGeometry(1.5, 8, 8);
    const highlightMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    highlight.position.set(15.5, 7, 10);
    fishGroup.add(highlight);

    // Simple lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 100);
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      // Animate tail
      if (tailRef.current) {
        const tailSwing = Math.sin(Date.now() * 0.005) * 0.6;
        tailRef.current.rotation.y = tailSwing;
      }

      // Subtle body swimming motion
      const swimOffset = Math.sin(Date.now() * 0.003) * 0.8;
      fishGroup.position.y = swimOffset;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [skin, width, height]);

  // Update position and rotation every frame
  useEffect(() => {
    if (!fishGroupRef.current || !cameraRef.current) return;

    // Map game coordinates to Three.js world
    // Game fishX is around width * 0.28, fishY from top
    const gameToThreeX = (x: number) => (x - width / 2);
    const gameToThreeY = (y: number) => (height / 2 - y); // invert Y

    fishGroupRef.current.position.x = gameToThreeX(x);
    fishGroupRef.current.position.y = gameToThreeY(y);

    // Apply subtle rotation
    fishGroupRef.current.rotation.z = rotation * 0.6; // dampen rotation
  }, [x, y, rotation]);

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
        zIndex: 10 
      }} 
    />
  );
}
