/**
 * usePose — 摄像头 + MediaPipe 姿态检测。
 *
 * 这一层只负责"拿到关键点",不做任何判断 —— 判断全在 lib/pose/checkers.ts 的纯函数里。
 * 分层理由和 licha/mobile/core/health 一样:业务逻辑不碰运行时,才测得动。
 *
 * 🔴 隐私:wasm 和模型都在 public/ 下本地加载,画面只进 <video> 和内存,
 *    一帧都不上传、不落盘。断网也能跑(展台不依赖场地 WiFi)。
 */

import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState } from 'react'
import { smoothLandmarks, type Landmark } from '../lib/pose/angles'

export type PoseStatus = 'idle' | 'loading' | 'running' | 'denied' | 'error'

export interface CamOption {
  deviceId: string
  label: string
}

/**
 * macOS 的接力相机会把一台 iPhone 拆成好几个设备,其中"桌上视角 / Desk View"
 * 是俯拍桌面的,根本拍不到人。全都列出来的话用户面对四五个名字不知道选哪个。
 * 这里滤掉拍不到人的,并把重复的 label 去掉。
 */
const UNUSABLE = /desk view|桌上視角|桌上视角|screen|display/i

export function usableCameras(all: MediaDeviceInfo[]): CamOption[] {
  // 🔴 按 deviceId 去重,不按 label。macOS 会给不同的物理设备同一个名字,
  // 按名字去重会把真正能用的那一路也吃掉,下拉框就只剩一个、于是整个不显示。
  const seen = new Set<string>()
  const out: CamOption[] = []
  all
    .filter((d) => d.kind === 'videoinput')
    .forEach((d, i) => {
      const label = d.label || `Camera ${i + 1}`
      if (UNUSABLE.test(label)) return
      if (seen.has(d.deviceId)) return
      seen.add(d.deviceId)
      out.push({ deviceId: d.deviceId, label })
    })
  // 全被滤掉了说明规则太狠,退回原始列表 —— 宁可多几个,也不能一个都不给
  if (out.length === 0) {
    return all
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
  }
  return out
}

interface UsePoseResult {
  videoRef: React.RefObject<HTMLVideoElement>
  status: PoseStatus
  message: string | null
  /** 最近一帧的关键点;没人或没检测到就是空数组 */
  landmarks: Landmark[]
  start: () => Promise<void>
  stop: () => void
  /** 可选的摄像头。手机上超广角会是单独一个设备 */
  cameras: CamOption[]
  cameraId: string | null
  pickCamera: (id: string) => Promise<void>
  /**
   * 这个摄像头能不能变焦。
   * 🔴 镜头视野是硬件定死的,软件变不宽。能做的只有两件:
   *    1. 设备里有超广角镜头就让用户选它(手机常见,笔记本基本没有)
   *    2. 支持 zoom 的话推到最小 —— 等于不裁切,是这颗镜头能给的最宽画面
   */
  canZoom: boolean
  widen: () => Promise<void>
}

const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`
/**
 * 用 full 而不是 lite。lite 5.5MB / full 9.4MB,多 4MB 换明显更稳的关键点。
 * 模型和 wasm 都在 public/ 下,首次加载后浏览器会缓存,展台断网也能跑。
 */
const MODEL_PATH = `${import.meta.env.BASE_URL}models/pose_landmarker_full.task`

export interface FrameData {
  /** 画面归一化坐标,用来画骨架和判"在不在画面里" */
  landmarks: Landmark[]
  /** 米制三维坐标,以髋部为原点。角度一律用这个,与机位无关 */
  world: Landmark[]
  /** 人像蒙版,0..1。开了虚化才有 */
  mask: Float32Array | null
  maskW: number
  maskH: number
}

export function usePose(onFrame?: (f: FrameData) => void, wantMask = false): UsePoseResult {
  const videoRef = useRef<HTMLVideoElement>(null!)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef(-1)
  const smoothRef = useRef<Landmark[] | null>(null)
  const smoothWorldRef = useRef<Landmark[] | null>(null)
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  const [status, setStatus] = useState<PoseStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [landmarks, setLandmarks] = useState<Landmark[]>([])
  const [cameras, setCameras] = useState<CamOption[]>([])
  const [cameraId, setCameraId] = useState<string | null>(null)
  const [canZoom, setCanZoom] = useState(false)
  const wantMaskRef = useRef(wantMask)
  wantMaskRef.current = wantMask

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const v = videoRef.current
    if (v) v.srcObject = null
    setStatus('idle')
    setLandmarks([])
    smoothRef.current = null
    smoothWorldRef.current = null
  }, [])

  const loop = useCallback(() => {
    const v = videoRef.current
    const lm = landmarkerRef.current
    if (!v || !lm || v.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    // detectForVideo 要求时间戳严格递增,重复帧要跳过,否则会抛
    const ts = performance.now()
    if (ts > lastTsRef.current) {
      lastTsRef.current = ts
      try {
        const res: PoseLandmarkerResult = lm.detectForVideo(v, ts)
        const raw = (res.landmarks?.[0] ?? []) as Landmark[]
        const rawWorld = (res.worldLandmarks?.[0] ?? []) as Landmark[]

        // 平滑:模型逐帧独立推理,静止时也会抖,换算成角度就是 ±3° 的噪声
        const pts = smoothLandmarks(smoothRef.current, raw)
        const world = smoothLandmarks(smoothWorldRef.current, rawWorld)
        smoothRef.current = raw.length ? pts : null
        smoothWorldRef.current = rawWorld.length ? world : null
        setLandmarks(pts)

        const mp = res.segmentationMasks?.[0]
        let mask: Float32Array | null = null
        let maskW = 0
        let maskH = 0
        if (mp) {
          mask = mp.getAsFloat32Array()
          maskW = mp.width
          maskH = mp.height
        }
        onFrameRef.current?.({ landmarks: pts, world, mask, maskW, maskH })
        // MPMask 持有 GPU/WASM 资源,用完必须还,否则几十帧之后就爆
        mp?.close()
      } catch {
        // 单帧失败不该中断整个会话 —— 吞掉,下一帧继续(借鉴 licha 的自吞式投递)
      }
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  /** 开(或换)一路摄像头流。deviceId 为 null 表示让浏览器挑默认的前置。 */
  const openStream = useCallback(
    async (deviceId: string | null) => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      const v = videoRef.current
      if (!v) return
      v.srcObject = stream
      await v.play()

      const track = stream.getVideoTracks()[0]
      setCameraId(track?.getSettings().deviceId ?? null)
      // 变焦支持是逐设备的,而且不在 TS 的标准类型里
      const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } }
      setCanZoom(typeof caps.zoom?.min === 'number' && caps.zoom.max > caps.zoom.min)

      // 只有拿到权限之后 label 才非空,所以枚举放在这里
      try {
        const all = await navigator.mediaDevices.enumerateDevices()
        setCameras(usableCameras(all))
      } catch {
        /* 枚举失败不影响已经开着的那一路 */
      }

      setStatus('running')
      setMessage(null)
      lastTsRef.current = -1
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(loop)
    },
    [loop],
  )

  const pickCamera = useCallback(
    async (id: string) => {
      try {
        await openStream(id)
      } catch (e) {
        setStatus('error')
        setMessage(`Could not switch camera: ${(e as Error).message}`)
      }
    },
    [openStream],
  )

  /** 把变焦推到最小 —— 这颗镜头能给的最宽画面。不能让镜头本身变广角。 */
  const widen = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const caps = (track.getCapabilities?.() ?? {}) as { zoom?: { min: number } }
    if (typeof caps.zoom?.min !== 'number') return
    try {
      await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] } as unknown as MediaTrackConstraints)
    } catch {
      /* 有些设备报告支持但实际拒绝,忽略 */
    }
  }, [])

  const start = useCallback(async () => {
    setStatus('loading')
    setMessage('Loading the movement checker…')
    try {
      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
          // 默认都是 0.5。检测门槛不动(太高会一直找不到人),
          // 但追踪和"人还在不在"门槛提高 —— 宁可报"看不清",也不要用半可信的点去判动作。
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.65,
          minTrackingConfidence: 0.65,
          // 人像蒙版直接从姿态模型取,不用再下一个分割模型
          outputSegmentationMasks: wantMaskRef.current,
        })
      }
    } catch (e) {
      setStatus('error')
      setMessage(`Could not load the checker: ${(e as Error).message}`)
      return
    }

    try {
      await openStream(null)
    } catch (e) {
      const err = e as DOMException
      if (err.name === 'NotAllowedError') {
        setStatus('denied')
        setMessage('Camera access was refused. You can still do the session without the check.')
      } else {
        setStatus('error')
        setMessage(`Camera failed: ${err.message}`)
      }
    }
  }, [openStream])

  useEffect(() => stop, [stop])

  return { videoRef, status, message, landmarks, start, stop, cameras, cameraId, pickCamera, canZoom, widen }
}
