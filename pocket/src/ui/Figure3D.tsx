/**
 * Figure3D — 三维动作示意小人。
 *
 * 为什么是三维:髋铰链和屈膝的区别在侧面最清楚,但用户不一定侧着站。
 * 二维简笔只能给一个固定视角,三维可以让人拖着转,从任意角度看同一个动作。
 *
 * 刻意只用基本几何体拼:
 * - 不加载任何外部模型文件,首屏不多一次下载,断网也能跑
 * - 棍状人没有身材,不会引发受访数据里那种"看到别人的身体"的比较
 *
 * 动画原理和二维版一致:每个动作给起止两组**关节角度**,之间插值。
 * 关节角而不是坐标 —— 这样肢体长度恒定,不会被拉伸。
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

import { RIGS, type Rig } from './rigs'


export { RIGS }

const lerp = (a = 0, b = 0, t: number) => a + (b - a) * t
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const CYCLE_MS = 2800

/** 一节肢体:在 group 原点起,沿 -Y 伸出 len。旋转 group 就是绕这个关节转。 */
function limb(len: number, radius: number, mat: THREE.Material) {
  const g = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len - radius * 2, 4, 10), mat)
  mesh.position.y = -len / 2
  g.add(mesh)
  return g
}

interface Parts {
  root: THREE.Group
  spine: THREE.Group
  head: THREE.Group
  hipL: THREE.Group; hipR: THREE.Group
  kneeL: THREE.Group; kneeR: THREE.Group
  ankleL: THREE.Group; ankleR: THREE.Group
  shoulderL: THREE.Group; shoulderR: THREE.Group
  elbowL: THREE.Group; elbowR: THREE.Group
}

function buildFigure(colour: number): { group: THREE.Group; parts: Parts } {
  const mat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0.05 })

  const root = new THREE.Group()

  // 躯干:从骨盆往上
  const spine = new THREE.Group()
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.4, 4, 12), mat)
  torso.position.y = 0.34
  spine.add(torso)
  root.add(spine)

  const head = new THREE.Group()
  head.position.y = 0.74
  // 脖子,让头和躯干分开
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.08, 4, 8), mat)
  neck.position.y = -0.1
  head.add(neck)
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), mat))
  spine.add(head)

  const mk = (parent: THREE.Group, x: number, y: number, len: number, r: number) => {
    const j = new THREE.Group()
    j.position.set(x, y, 0)
    const l = limb(len, r, mat)
    j.add(l)
    parent.add(j)
    return j
  }

  // 手臂挂在肩高
  const shoulderL = mk(spine, 0.2, 0.55, 0.3, 0.055)
  const shoulderR = mk(spine, -0.2, 0.55, 0.3, 0.055)
  const elbowL = mk(shoulderL, 0, -0.3, 0.28, 0.048)
  const elbowR = mk(shoulderR, 0, -0.3, 0.28, 0.048)

  // 腿挂在骨盆
  const hipL = mk(root, 0.1, 0, 0.42, 0.07)
  const hipR = mk(root, -0.1, 0, 0.42, 0.07)
  const kneeL = mk(hipL, 0, -0.42, 0.4, 0.06)
  const kneeR = mk(hipR, 0, -0.42, 0.4, 0.06)

  const foot = () => {
    const g = new THREE.Group()
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.2), mat)
    m.position.set(0, -0.02, 0.06)
    g.add(m)
    return g
  }
  const ankleL = foot(); ankleL.position.y = -0.4; kneeL.add(ankleL)
  const ankleR = foot(); ankleR.position.y = -0.4; kneeR.add(ankleR)

  return {
    group: root,
    parts: { root, spine, head, hipL, hipR, kneeL, kneeR, ankleL, ankleR, shoulderL, shoulderR, elbowL, elbowR },
  }
}

function applyRig(p: Parts, a: Rig, b: Rig, t: number) {
  p.root.position.y = lerp(a.rootY, b.rootY, t)
  p.root.rotation.x = lerp(a.rootX, b.rootX, t)
  p.spine.rotation.x = lerp(a.spineX, b.spineX, t)
  p.spine.rotation.y = lerp(a.spineY, b.spineY, t)
  p.head.rotation.z = lerp(a.headZ, b.headZ, t)

  const hl = lerp(a.hipLX ?? a.hipX, b.hipLX ?? b.hipX, t)
  const hr = lerp(a.hipRX ?? a.hipX, b.hipRX ?? b.hipX, t)
  p.hipL.rotation.x = hl
  p.hipR.rotation.x = hr

  const kl = lerp(a.kneeLX ?? a.kneeX, b.kneeLX ?? b.kneeX, t)
  const kr = lerp(a.kneeRX ?? a.kneeX, b.kneeRX ?? b.kneeX, t)
  p.kneeL.rotation.x = kl
  p.kneeR.rotation.x = kr

  const sh = lerp(a.shoulderX, b.shoulderX, t)
  p.shoulderL.rotation.x = sh
  p.shoulderR.rotation.x = sh
  const el = lerp(a.elbowX, b.elbowX, t)
  p.elbowL.rotation.x = el
  p.elbowR.rotation.x = el

  const an = lerp(a.ankleX, b.ankleX, t)
  p.ankleL.rotation.x = an
  p.ankleR.rotation.x = an
}

export function Figure3D({ movementId }: { movementId: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const frames = RIGS[movementId]

  useEffect(() => {
    const host = hostRef.current
    if (!host || !frames) return

    const w = host.clientWidth || 300
    const h = 230

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100)
    // 斜 40° 侧前方:髋铰链和屈膝的区别在这个角度最明显,正面会被压扁
    camera.position.set(1.55, 0.25, 1.85)
    camera.lookAt(0, -0.02, 0)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return // 没有 WebGL 就什么都不画,外层会退回二维图
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(w, h)
    host.appendChild(renderer.domElement)

    // 取当前主题的强调色,明暗切换时小人跟着变
    const css = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    const colour = new THREE.Color(css || '#1f8f6b').getHex()

    scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2.1))
    const key = new THREE.DirectionalLight(0xffffff, 1.5)
    key.position.set(2, 3, 2)
    scene.add(key)

    const pivot = new THREE.Group()
    const { group, parts } = buildFigure(colour)
    pivot.add(group)
    scene.add(pivot)

    // 拖着转 —— 这是三维相对二维唯一真正多出来的东西,所以要能转
    let dragging = false
    let lastX = 0
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; host.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      pivot.rotation.y += (e.clientX - lastX) * 0.01
      lastX = e.clientX
    }
    const up = () => { dragging = false }
    host.addEventListener('pointerdown', down)
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerup', up)
    host.addEventListener('pointercancel', up)

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = ((now - start) % CYCLE_MS) / CYCLE_MS
      const t = reduced ? 1 : ease(p < 0.5 ? p * 2 : (1 - p) * 2)
      applyRig(parts, frames.a, frames.b, t)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      host.removeEventListener('pointerdown', down)
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerup', up)
      host.removeEventListener('pointercancel', up)
      renderer.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
      renderer.domElement.remove()
    }
  }, [frames, movementId])

  if (!frames) return null
  return (
    <div className="fig3d">
      <div ref={hostRef} className="fig3d-canvas" />
      <p className="fig3d-hint">Drag to turn</p>
    </div>
  )
}
