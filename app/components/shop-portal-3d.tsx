"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Float, useGLTF, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { makeSparkTexture } from "@/app/components/fx/particles";
import { playUiHoverSfx } from "@/lib/sfx";

const GOLD = "#D4AF37";
const PARTICLES_COUNT = 30;

function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const texture = useMemo(makeSparkTexture, []);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLES_COUNT }, () => ({
      x: (Math.random() - 0.5) * 4,
      y: (Math.random() - 0.5) * 4,
      z: (Math.random() - 0.5) * 4,
      speed: 0.5 + Math.random(),
      phase: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    
    particles.forEach((p, i) => {
      dummy.position.set(
        p.x + Math.sin(t * p.speed + p.phase) * 0.2,
        p.y + Math.cos(t * p.speed * 0.8 + p.phase) * 0.2 + (t * p.speed) % 4 - 2,
        p.z + Math.sin(t * p.speed * 1.2 + p.phase) * 0.2
      );
      dummy.rotation.set(t * p.speed, t * p.speed, t * p.speed);
      const scale = 0.5 + Math.sin(t * p.speed * 2 + p.phase) * 0.2;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLES_COUNT]}>
      <planeGeometry args={[0.2, 0.2]} />
      <meshBasicMaterial
        map={texture}
        color={GOLD}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

function PortalDoor() {
  const group = useRef<THREE.Group>(null);
  const doorLeftGroup = useRef<THREE.Group>(null);
  const doorRightGroup = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);

  useEffect(() => {
    // Play a sound when the portal opens
    playUiHoverSfx();
  }, []);

  // Animación de apertura
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Animar puertas abriéndose en los primeros 2 segundos
    const openProgress = Math.min(1, Math.max(0, (t - 0.5) / 1.5));
    // Easing easeOutCubic
    const ease = 1 - Math.pow(1 - openProgress, 3);
    
    if (doorLeftGroup.current) {
      doorLeftGroup.current.rotation.y = -(Math.PI / 2 + 0.2) * ease;
    }
    if (doorRightGroup.current) {
      doorRightGroup.current.rotation.y = (Math.PI / 2 + 0.2) * ease;
    }
    
    if (light.current) {
      light.current.intensity = ease * 2 + Math.sin(t * 5) * 0.2; // parpadeo sutil
    }
  });

  return (
    <group ref={group}>
      {/* Marco */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3.2, 4.2, 0.4]} />
        <meshStandardMaterial color="#2a1f1a" roughness={0.9} metalness={0.1} />
      </mesh>
      
      {/* Interior (Portal) */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[2.8, 3.8]} />
        <meshBasicMaterial color="#ffc107" toneMapped={false} />
      </mesh>
      
      {/* Cristal Mágico (Refracción) */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[2.8, 3.8]} />
        <MeshTransmissionMaterial 
          backside 
          samples={4} 
          thickness={0.5} 
          chromaticAberration={0.5} 
          anisotropy={0.3} 
          distortion={0.5} 
          distortionScale={0.5} 
          temporalDistortion={0.1} 
          color="#ffeb3b"
        />
      </mesh>

      {/* Puerta Izquierda */}
      <group ref={doorLeftGroup} position={[-1.4, 0, 0.2]}>
        <mesh position={[0.7, 0, 0]}>
          <boxGeometry args={[1.4, 3.8, 0.1]} />
          <meshPhysicalMaterial color="#4a3525" roughness={0.7} metalness={0.2} clearcoat={0.3} />
        </mesh>
      </group>

      {/* Puerta Derecha */}
      <group ref={doorRightGroup} position={[1.4, 0, 0.2]}>
        <mesh position={[-0.7, 0, 0]}>
          <boxGeometry args={[1.4, 3.8, 0.1]} />
          <meshPhysicalMaterial color="#4a3525" roughness={0.7} metalness={0.2} clearcoat={0.3} />
        </mesh>
      </group>

      {/* Luz dorada interior */}
      <pointLight ref={light} position={[0, 0, 1]} color={GOLD} intensity={0} distance={10} decay={2} />
    </group>
  );
}

export default function ShopPortal3D() {
  return (
    <div className="absolute inset-0 z-0 h-[300px] w-full pointer-events-none">
      <Canvas
        camera={{ position: [0, 1, 5], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: true }}
      >
        <Env />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
          <PortalDoor />
        </Float>
        
        <Particles />
        <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={10} blur={2} far={4} />
      </Canvas>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
