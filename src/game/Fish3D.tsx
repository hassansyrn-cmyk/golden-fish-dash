import React, { Suspense, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Shared ref for fish position - updated by game loop, read by 3D overlay
export const fishPositionRef: React.MutableRefObject<{
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}> = { current: { x: 0, y: 0, rotation: 0, width: 400, height: 600 } };

interface FishModelProps {
  baseRotationY?: number;
}

function FishModel({ baseRotationY = Math.PI / 2 }: FishModelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  
  const gltf = useGLTF('/models/fish-skins/golden-fish.glb', true);
  
  const model = useMemo(() => {
    if (!gltf.scene) return null;
    const cloned = gltf.scene.clone(true);
    cloned.rotation.y = baseRotationY;
    return cloned;
  }, [gltf.scene, baseRotationY]);

  useFrame(() => {
    if (!groupRef.current || !model) return;

    const pos = fishPositionRef.current;
    if (!pos || pos.width === 0) return;

    const scale = 1;
    const centerX = pos.width / 2;
    const centerY = pos.height / 2;

    groupRef.current.position.x = (pos.x - centerX) * scale * 0.9;
    groupRef.current.position.y = -(pos.y - centerY) * scale * 0.9;
    groupRef.current.position.z = 0;

    groupRef.current.rotation.set(0, baseRotationY, pos.rotation || 0);
  });

  if (!model) return null;

  return (
    <group ref={groupRef}>
      <primitive object={model} scale={[0.65, 0.65, 0.65]} />
    </group>
  );
}

// Force transparent background for the 3D overlay
function TransparentBackground() {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.setClearColor(0x000000, 0); // fully transparent
    if (scene) scene.background = null;
  }, [gl, scene]);
  return null;
}

interface Fish3DErrorBoundaryProps {
  children: React.ReactNode;
  onError?: () => void;
}

class Fish3DErrorBoundary extends React.Component<Fish3DErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: Fish3DErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[Fish3D] GLB load or render error (game continues normally):', error, errorInfo);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

interface Fish3DProps {
  visible?: boolean;
  baseRotationY?: number;
}

export function Fish3D({ visible = true, baseRotationY = Math.PI / 2 }: Fish3DProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 20,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <Canvas
        style={{ 
          background: 'transparent',
          width: '100%',
          height: '100%',
        }}
        camera={{ 
          position: [0, 0, 120], 
          fov: 45,
          near: 1,
          far: 1000
        }}
        gl={{ 
          alpha: true, 
          antialias: true,
          preserveDrawingBuffer: true 
        }}
      >
        <TransparentBackground />
        <ambientLight intensity={0.9} />
        <directionalLight 
          position={[80, 60, 120]} 
          intensity={1.1} 
          castShadow={false}
        />
        
        <Fish3DErrorBoundary>
          <Suspense fallback={null}>
            <FishModel baseRotationY={baseRotationY} />
          </Suspense>
        </Fish3DErrorBoundary>
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/fish-skins/golden-fish.glb');