'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, type RootState } from '@react-three/fiber'
import * as THREE from 'three'
import { HERO3D_COLORS, HERO3D_TIER_SETTINGS, type Hero3DTier } from './hero-3d-config'

/** Central Beewaz security shield — a beveled, slowly-rotating polyhedron. */
function ShieldCore() {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15
  })
  return (
    <mesh ref={meshRef}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={HERO3D_COLORS.navy}
        emissive={HERO3D_COLORS.orange}
        emissiveIntensity={0.25}
        metalness={0.65}
        roughness={0.32}
      />
    </mesh>
  )
}

/** A single rotating radar ring around the shield. */
function RadarRing({ radius, speed, opacity }: { radius: number; speed: number; opacity: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed
  })
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius, radius + 0.015, 64]} />
      <meshBasicMaterial color={HERO3D_COLORS.orange} transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** Restrained security-zone nodes orbiting the shield, connected by thin lines. */
function SecurityNodes({ count }: { count: number }) {
  const positions = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const radius = 1.9
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle * 1.7) * 0.35, Math.sin(angle) * radius))
    }
    return pts
  }, [count])

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const linePoints: THREE.Vector3[] = []
    positions.forEach((p) => {
      linePoints.push(new THREE.Vector3(0, 0, 0), p)
    })
    geometry.setFromPoints(linePoints)
    return geometry
  }, [positions])

  if (count === 0) return null

  return (
    <>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color={HERO3D_COLORS.blueAccent} transparent opacity={0.18} />
      </lineSegments>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial
            color={HERO3D_COLORS.blueAccent}
            emissive={HERO3D_COLORS.blueAccent}
            emissiveIntensity={0.9}
          />
        </mesh>
      ))}
    </>
  )
}

/** Restrained pointer parallax — slight tilt, clamped angle, smooth damping. Tier A only. */
function PointerTilt({ enabled }: { enabled: boolean }) {
  const targetRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!enabled) return
    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      const maxTilt = 0.18
      targetRef.current = { x: ny * maxTilt, y: nx * maxTilt }
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [enabled])

  useFrame((state) => {
    if (!enabled) return
    const group = state.scene
    group.rotation.x += (targetRef.current.x - group.rotation.x) * 0.06
    group.rotation.y += (targetRef.current.y - group.rotation.y) * 0.06
  })

  return null
}

export interface Hero3DSceneProps {
  tier: Hero3DTier
  onReady: () => void
  onContextLost: () => void
}

export default function Hero3DScene({ tier, onReady, onContextLost }: Hero3DSceneProps) {
  const settings = tier === 'C' ? HERO3D_TIER_SETTINGS.B : HERO3D_TIER_SETTINGS[tier]

  const handleCreated = (state: RootState) => {
    onReady()
    // Deliberately no `webglcontextrestored` handling / recreation attempt —
    // once a context is lost we stay on the static fallback for the rest of
    // this page's life rather than risk a retry loop.
    state.gl.domElement.addEventListener('webglcontextlost', (event: Event) => {
      event.preventDefault()
      onContextLost()
    })
  }

  return (
    <Canvas
      dpr={settings.dpr}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 4.5], fov: 40 }}
      onCreated={handleCreated}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 3]} intensity={1.2} color={HERO3D_COLORS.orange} />
      <pointLight position={[-3, -2, -2]} intensity={0.6} color={HERO3D_COLORS.blueAccent} />
      <ShieldCore />
      <RadarRing radius={1.4} speed={0.2} opacity={0.35} />
      <RadarRing radius={1.75} speed={-0.12} opacity={0.22} />
      <SecurityNodes count={settings.nodeCount} />
      <PointerTilt enabled={settings.enablePointerTilt} />
    </Canvas>
  )
}
