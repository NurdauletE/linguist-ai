"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import type { AvatarState } from "@/types/dialogue";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import type { Group, Mesh } from "three";

const AVATAR_IMAGE = "/avatar.png";

export interface AvatarProps {
  state?: AvatarState;
  className?: string;
}

const scaleByState = {
  idle: { min: 1, max: 1.05 },
  listening: { min: 1.02, max: 1.12 },
  speaking: { min: 1.03, max: 1.1 },
  thinking: { min: 1.02, max: 1.08 },
};

const durationByState = {
  idle: 2.5,
  listening: 0.8,
  speaking: 0.5,
  thinking: 1.2,
};

const glowColorByState = {
  idle: "rgba(99, 102, 241, 0.4)",
  listening: "rgba(129, 140, 248, 0.55)",
  speaking: "rgba(129, 140, 248, 0.5)",
  thinking: "rgba(148, 163, 184, 0.45)",
};

interface AvatarHeadProps {
  state: AvatarState;
}

function AvatarHead({ state }: AvatarHeadProps) {
  const groupRef = useRef<Group | null>(null);
  const mouthRef = useRef<Mesh | null>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const group = groupRef.current;
    const mouth = mouthRef.current;

    if (group) {
      const wobbleAmplitude =
        state === "speaking" ? 0.05 : state === "listening" ? 0.035 : 0.02;
      group.position.y = Math.sin(t * 2) * wobbleAmplitude;

      const lookAmplitude =
        state === "listening" ? 0.25 : state === "thinking" ? 0.18 : 0.12;
      group.rotation.y = Math.sin(t * 0.6) * lookAmplitude;
    }

    if (mouth) {
      if (state === "speaking") {
        const open =
          0.4 + (Math.sin(t * 8) + 1) * 0.45; // активное открытие рта под речь
        mouth.scale.y = open;
      } else {
        mouth.scale.y = 0.5; // спокойное, почти закрытое положение
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.1, 0]}>
      {/* Голова */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.85, 32, 32]} />
        <meshStandardMaterial color="#faccaa" roughness={0.6} metalness={0.05} />
      </mesh>

      {/* Волосы (как мягкий «ореол») */}
      <mesh position={[0, 0.2, -0.15]}>
        <sphereGeometry args={[0.95, 32, 32]} />
        <meshStandardMaterial color="#4b5563" roughness={1} metalness={0} />
      </mesh>

      {/* Глаза */}
      <mesh position={[-0.3, 0.1, 0.75]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.3, 0.1, 0.75]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Зрачки */}
      <mesh position={[-0.3, 0.1, 0.82]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#020617" />
      </mesh>
      <mesh position={[0.3, 0.1, 0.82]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#020617" />
      </mesh>

      {/* Нос — треугольник с округленными углами */}
      <mesh position={[0, -0.15, 0.84]} rotation={[0, 0, 0]}>
        <extrudeGeometry
          args={[
            useMemo(() => {
              const s = 0.08; // half-width
              const h = 0.14; // height
              const r = 0.03; // radius
              const shape = new THREE.Shape();
              // Bottom-left
              shape.moveTo(-s + r, 0);
              // Bottom-right
              shape.lineTo(s - r, 0);
              shape.quadraticCurveTo(s, 0, s - r / 2, r);
              // Top
              shape.lineTo(r / 2, h - r);
              shape.quadraticCurveTo(0, h, -r / 2, h - r);
              // Back to bottom-left
              shape.lineTo(-s + r / 2, r);
              shape.quadraticCurveTo(-s, 0, -s + r, 0);
              return shape;
            }, []),
            {
              depth: 0.04,
              bevelEnabled: true,
              bevelThickness: 0.02,
              bevelSize: 0.02,
              bevelSegments: 3
            }
          ]}
        />
        <meshStandardMaterial color="#faccaa" roughness={0.6} />
      </mesh>

      {/* Рот */}
      <mesh ref={mouthRef} position={[0, -0.45, 0.72]}>
        <boxGeometry args={[0.6, 0.18, 0.1]} />
        <meshStandardMaterial color="#ff3b3b" />
      </mesh>

      {/* Щёки — лёгкий румянец */}
      <mesh position={[-0.5, -0.15, 0.7]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#f97373" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0.5, -0.15, 0.7]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#f97373" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

export function Avatar({ state = "idle", className = "" }: AvatarProps) {
  const scaleRange = scaleByState[state];
  const duration = durationByState[state];
  const glowColor = glowColorByState[state];

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {state === "listening" && (
        <motion.span
          className="absolute -top-1 right-1/4 z-10 h-3 w-3 rounded-full bg-indigo-400 shadow-lg shadow-indigo-400/50"
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: 1,
          }}
          transition={{
            scale: { repeat: Infinity, duration: 1 },
          }}
          aria-hidden
        />
      )}

      <motion.div
        className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-slate-600/50 bg-slate-800"
        style={{
          boxShadow: `0 0 60px 20px ${glowColor}, 0 0 100px 30px ${glowColor}`,
        }}
        animate={{
          scale: [scaleRange.min, scaleRange.max, scaleRange.min],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Canvas
          camera={{ position: [0, 0.1, 3], fov: 35 }}
          dpr={[1, 2]}
        >
          <ambientLight intensity={0.9} />
          <directionalLight
            position={[2, 4, 3]}
            intensity={1.2}
            castShadow
          />
          <AvatarHead state={state} />
        </Canvas>
      </motion.div>
    </div>
  );
}

/** Маленькая иконка аватара для сообщений в чате */
export function AvatarChatIcon({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-indigo-100 ${className}`}
      aria-hidden
    >
      <Image
        src={AVATAR_IMAGE}
        alt=""
        fill
        className="z-10 object-cover object-top"
        sizes="32px"
        unoptimized
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-indigo-500 text-xs font-bold text-white" aria-hidden>
        L
      </div>
    </div>
  );
}
