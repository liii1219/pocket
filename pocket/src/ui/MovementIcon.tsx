/**
 * MovementIcon — 每个动作前面的小图标。
 *
 * 为什么要有:课表里一屏七八个动作,全是文字。用户测试里有人一路往下滑,
 * 滑到底也没看出哪几个是脖子的、哪几个是眼睛的。图标不是装饰,它是让人
 * 一眼分出"这条跟我酸的地方有没有关系"。
 *
 * 🔴 画的是**身体部位**,不是动作姿势。
 * 之前 3D 小人那次的教训:一个静态姿势表达不了"往哪动",反而让人猜。
 * 部位图标只承诺一件事 —— 这个动作管哪儿 —— 而且这件事它做得到。
 * "怎么做"交给 cues 和 MovementDiagram,它们本来就是干这个的。
 */

import type { Movement } from '../lib/movements'

export type IconName =
  | 'neck' | 'shoulders' | 'spine' | 'wrist' | 'hip' | 'leg' | 'ankle' | 'eye' | 'press'

/** 显式表,不从 loads 推。推出来的结果没法一个个核对,表可以。 */
const ICON_BY_ID: Record<string, IconName> = {
  'neck-release': 'neck',
  'chin-tuck': 'neck',
  'neck-acupressure': 'neck',

  'shoulder-openers': 'shoulders',
  'shoulder-shrug': 'shoulders',
  'lateral-raise': 'shoulders',
  'scap-squeeze': 'shoulders',
  'desk-row': 'shoulders',
  'reach-dots': 'shoulders',

  'wall-push': 'press',
  'prayer-press': 'press',

  'seated-twist': 'spine',
  'side-bend': 'spine',
  'pelvic-tilt': 'spine',
  'hip-hinge': 'spine',

  'wrist-stretch': 'wrist',

  'glute-squeeze': 'hip',
  'seated-march': 'hip',

  'desk-leg-press': 'leg',
  'chair-squat': 'leg',

  'calf-raise': 'ankle',
  'ankle-circles': 'ankle',

  'eye-exercises': 'eye',
  'palming': 'eye',
  'focal-shift': 'eye',
}

/** 没列进表的新动作退回按部位猜,总比不画强。 */
export function iconFor(m: Movement): IconName {
  const named = ICON_BY_ID[m.id]
  if (named) return named
  if (m.loads.length === 0) return 'eye'
  if (m.loads.includes('neck')) return 'neck'
  if (m.loads.includes('shoulder')) return 'shoulders'
  if (m.loads.includes('wrist')) return 'wrist'
  if (m.loads.includes('ankle')) return 'ankle'
  if (m.loads.includes('knee')) return 'leg'
  if (m.loads.includes('hip')) return 'hip'
  return 'spine'
}

/**
 * 画法统一:24×24,只用描边,颜色继承 currentColor。
 * 不填色,这样在深浅两套主题下都不用改。
 */
const PATHS: Record<IconName, JSX.Element> = {
  neck: (
    <>
      <circle cx="12" cy="6.5" r="3.2" />
      <path d="M7 20c0-3.2 2.2-5.5 5-5.5s5 2.3 5 5.5" />
      <path d="M16.5 8.5c1.6 1 2.3 2.6 2 4.2" />
      <path d="M18.9 12.9l-1.6-.6M18.9 12.9l.3-1.7" />
    </>
  ),
  shoulders: (
    <>
      <circle cx="12" cy="5.5" r="2.6" />
      <path d="M5 16c0-3.3 3.1-5.8 7-5.8s7 2.5 7 5.8" />
      <path d="M5 19.5h3M16 19.5h3" />
      <path d="M6.5 7.6L5 9.1M5 9.1l1.8.2M5 9.1l.2 1.8" />
      <path d="M17.5 7.6L19 9.1M19 9.1l-1.8.2M19 9.1l-.2 1.8" />
    </>
  ),
  spine: (
    <>
      <path d="M12 3.5v17" />
      <path d="M9 6.5h6M9 10h6M9 13.5h6M9 17h6" />
      <path d="M17.5 8.5c2 2 2 5 0 7" />
      <path d="M17.5 15.5l1.6-.4M17.5 15.5l-.3-1.6" />
    </>
  ),
  wrist: (
    <>
      <path d="M4 17.5l5-5" />
      <path d="M9 12.5c1.6-1.6 3.6-1.9 5.2-.9" />
      <path d="M14.2 11.6l2.1-2.1M16.3 9.5l1.9 1.9M18.2 11.4l-2.1 2.1" />
      <path d="M10.5 15.8l2.4 2.4" />
      <path d="M12.9 18.2c1.5 1 3 .6 4.1-.5" />
    </>
  ),
  hip: (
    <>
      <circle cx="8.5" cy="5" r="2.4" />
      <path d="M8.5 8v6.5h7" />
      <path d="M8.5 14.5v5.5" />
      <path d="M15.5 14.5c1.8-1.3 2.6-3 2.6-5" />
      <path d="M18.1 11.2l-1.4.8M18.1 11.2l1.1 1.2" />
    </>
  ),
  leg: (
    <>
      <path d="M9 3.5v6.5l4 4v6.5" />
      <path d="M13 20.5h4" />
      <path d="M9 10h4" />
      <path d="M17.5 7.5c1.6 1.8 1.6 4.4 0 6.2" />
      <path d="M17.5 13.7l1.6-.3M17.5 13.7l-.4-1.6" />
    </>
  ),
  ankle: (
    <>
      <path d="M10 4v8.5" />
      <path d="M10 12.5h6.5" />
      <path d="M16.5 12.5v3" />
      <ellipse cx="12.5" cy="18" rx="6" ry="2.6" />
      <path d="M8 16.6l-1.4 1.1M6.6 17.7l1.5.9" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.7" />
    </>
  ),
  press: (
    <>
      <path d="M9.5 5.5v13" />
      <path d="M14.5 5.5v13" />
      <path d="M9.5 8.5H6.5M9.5 12H6.5M9.5 15.5H6.5" />
      <path d="M14.5 8.5h3M14.5 12h3M14.5 15.5h3" />
      <path d="M3.5 12h1.4M19.1 12h1.4" />
    </>
  ),
}

export function MovementIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="mv-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
