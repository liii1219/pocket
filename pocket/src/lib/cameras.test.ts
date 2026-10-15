import { describe, expect, it } from 'vitest'
import { usableCameras } from '../ui/usePose'

const dev = (label: string, deviceId = label): MediaDeviceInfo =>
  ({ kind: 'videoinput', label, deviceId, groupId: '' }) as MediaDeviceInfo

describe('usableCameras', () => {
  it('滤掉"桌上视角"这类拍不到人的设备', () => {
    const got = usableCameras([
      dev('MacBook Pro相机'),
      dev('“ljh”的桌上视角相机'),
      dev('MacBook Pro桌上视角相机'),
      dev('“ljh”的相机'),
    ])
    expect(got.map((c) => c.label)).toEqual(['MacBook Pro相机', '“ljh”的相机'])
  })

  it('英文 Desk View 也滤掉', () => {
    const got = usableCameras([dev('FaceTime HD Camera'), dev("ljh's Desk View Camera")])
    expect(got).toHaveLength(1)
  })

  it('同名但不同设备不去重 —— 它们是两路真实的摄像头', () => {
    const got = usableCameras([dev('Camera A', 'id1'), dev('Camera A', 'id2')])
    expect(got).toHaveLength(2)
  })

  it('不是视频输入的忽略', () => {
    const mic = { kind: 'audioinput', label: 'Mic', deviceId: 'm', groupId: '' } as MediaDeviceInfo
    expect(usableCameras([mic, dev('Cam')])).toHaveLength(1)
  })

  it('全被滤掉时退回原始列表,不能一个都不给', () => {
    const got = usableCameras([dev('Desk View'), dev('桌上视角相机')])
    expect(got).toHaveLength(2)
  })
})

describe('usableCameras 按 deviceId 去重', () => {
  it('同名但不同设备的两路都要保留', () => {
    // 回归:macOS 会给不同的物理设备同一个名字。按名字去重会把真正能用的
    // 那一路吃掉,结果下拉框只剩一个、整个不显示。
    const same = [
      { kind: 'videoinput', label: 'FaceTime HD Camera', deviceId: 'a', groupId: '' },
      { kind: 'videoinput', label: 'FaceTime HD Camera', deviceId: 'b', groupId: '' },
    ] as MediaDeviceInfo[]
    expect(usableCameras(same)).toHaveLength(2)
  })

  it('同一个 deviceId 出现两次才去重', () => {
    const dup = [
      { kind: 'videoinput', label: 'Cam', deviceId: 'x', groupId: '' },
      { kind: 'videoinput', label: 'Cam', deviceId: 'x', groupId: '' },
    ] as MediaDeviceInfo[]
    expect(usableCameras(dup)).toHaveLength(1)
  })
})
