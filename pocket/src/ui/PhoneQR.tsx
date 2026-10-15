/**
 * PhoneQR — 扫码在手机上打开。
 *
 * 为什么需要:摄像头判定最大的限制是笔记本摄像头在桌前只拍得到上半身,
 * 深蹲和髋铰链因此判不了。把手机立在两米外就全解决了 ——
 * 手机能拍到全身,有超广角,而且 HTTPS 下浏览器允许开摄像头。
 *
 * macOS 的接力相机不解决这个问题:iPhone 夹在笔记本上,机位和内置摄像头一样。
 *
 * 只在"看起来是电脑"的时候显示 —— 已经在手机上了就别再给二维码。
 * qrcode 库按需加载,不进首屏包。
 */

import { useEffect, useState } from 'react'

/** 粗略判断是不是手机。宁可多显示,也不要该显示时不显示。 */
function looksLikeDesktop(): boolean {
  if (typeof navigator === 'undefined') return true
  const coarse = matchMedia('(pointer: coarse)').matches
  return !coarse && innerWidth > 700
}

export function PhoneQR() {
  const [src, setSrc] = useState<string | null>(null)
  const show = looksLikeDesktop() && location.protocol === 'https:'

  useEffect(() => {
    if (!show) return
    let alive = true
    import('qrcode')
      .then((QR) =>
        QR.toDataURL(location.href, {
          margin: 1,
          width: 240,
          color: { dark: '#1a1f26', light: '#ffffff' },
        }),
      )
      .then((url) => {
        if (alive) setSrc(url)
      })
      .catch(() => {
        /* 生成不出来就不显示,不该因为一个二维码报错 */
      })
    return () => {
      alive = false
    }
  }, [show])

  if (!show || !src) return null
  return (
    <div className="phoneqr">
      <img src={src} alt="QR code to open this page on a phone" width={120} height={120} />
      <div>
        <p className="phoneqr-title">Use your phone instead</p>
        <p className="phoneqr-note">
          Scan this, then stand the phone up a couple of metres away. It can see your whole
          body, which a laptop camera on a desk cannot.
        </p>
      </div>
    </div>
  )
}
