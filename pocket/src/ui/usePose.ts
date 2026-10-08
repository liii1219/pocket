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
import type { Landmark } from '../lib/pose/angles'

export type PoseStatus = 'idle' | 'loading' | 'running' | 'denied' | 'error'

interface UsePoseResult {
  videoRef: React.RefObject<HTMLVideoElement>
  status: PoseStatus
  message: string | null
  /** 最近一帧的关键点;没人或没检测到就是空数组 */
  landmarks: Landmark[]
  start: () => Promise<void>
  stop: () => void
}

const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`
const MODEL_PATH = `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`

export function usePose(onFrame?: (lms: Landmark[]) => void): UsePoseResult {
  const videoRef = useRef<HTMLVideoElement>(null!)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef(-1)
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  const [status, setStatus] = useState<PoseStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [landmarks, setLandmarks] = useState<Landmark[]>([])

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const v = videoRef.current
    if (v) v.srcObject = null
    setStatus('idle')
    setLandmarks([])
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
        const pts = (res.landmarks?.[0] ?? []) as Landmark[]
        setLandmarks(pts)
        onFrameRef.current?.(pts)
      } catch {
        // 单帧失败不该中断整个会话 —— 吞掉,下一帧继续(借鉴 licha 的自吞式投递)
      }
    }
    rafRef.current = requestAnimationFrame(loop)
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
        })
      }
    } catch (e) {
      setStatus('error')
      setMessage(`Could not load the checker: ${(e as Error).message}`)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      const v = videoRef.current
      if (!v) return
      v.srcObject = stream
      await v.play()
      setStatus('running')
      setMessage(null)
      lastTsRef.current = -1
      rafRef.current = requestAnimationFrame(loop)
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
  }, [loop])

  useEffect(() => stop, [stop])

  return { videoRef, status, message, landmarks, start, stop }
}
