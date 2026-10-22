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
/**
 * 画法统一:24×24,只用描边,颜色继承 currentColor。
 *
 * 🔴 每个图标最多五六笔。
 * 第一版画得太细碎(脊柱四条横杠、手腕五段折线),20px 下糊成一团灰,
 * 放大到 26px 才看得出画的是什么 —— 那说明是图本身太密,不是尺寸太小。
 * 现在每个只保留最能认出来的那几笔。
 */
const PATHS: Record<IconName, JSX.Element> = {
  // 头 + 肩,一条弧表示往侧面倒
  neck: (
    <>
      <circle cx="12" cy="6" r="3.4" />
      <path d="M6.5 20c0-3.3 2.4-5.8 5.5-5.8s5.5 2.5 5.5 5.8" />
      <path d="M16.8 7.4a4.6 4.6 0 0 1 1.1 4.6" />
      <path d="M17.9 12l1.7-.5M17.9 12l-1.3-1.2" />
    </>
  ),
  // 肩线 + 两个向上的箭头
  shoulders: (
    <>
      <circle cx="12" cy="6" r="3" />
      <path d="M5 18c0-3.6 3.1-6.3 7-6.3s7 2.7 7 6.3" />
      <path d="M5.5 8.5v-3M5.5 5.5l-1.6 1.6M5.5 5.5l1.6 1.6" />
      <path d="M18.5 8.5v-3M18.5 5.5l-1.6 1.6M18.5 5.5l1.6 1.6" />
    </>
  ),
  // 一条脊柱 + 一个旋转箭头
  spine: (
    <>
      <path d="M12 3.5v17" />
      <path d="M9 8h6M9 14h6" />
      <path d="M16.5 17.5a6 6 0 0 0 3-5.2" />
      <path d="M16.5 17.5l2 .6M16.5 17.5l.3-2" />
    </>
  ),
  // 小臂 + 手掌往下折
  wrist: (
    <>
      <path d="M4 9h7.5" />
      <path d="M11.5 9a4 4 0 0 1 4 4v1" />
      <path d="M15.5 14v4.5" />
      <path d="M12.5 18.5h6" />
    </>
  ),
  // 坐着的人:躯干 + 大腿 + 小腿
  hip: (
    <>
      <circle cx="8" cy="5" r="2.6" />
      <path d="M8 8v6.5h7.5" />
      <path d="M15.5 14.5V20" />
      <path d="M12.5 20h6" />
    </>
  ),
  // 一条腿 + 脚
  leg: (
    <>
      <path d="M9.5 3.5v7.5l4.5 4.5V20" />
      <path d="M14 20h5" />
      <path d="M9.5 11h4.5" />
    </>
  ),
  // 脚掌 + 一个圆圈箭头
  ankle: (
    <>
      <path d="M9.5 4v9" />
      <path d="M9.5 13h6.5v3" />
      <path d="M6 18.5h12" />
      <path d="M6.5 15.2a3.4 3.4 0 1 0 1.6-1.9" />
      <path d="M8.1 13.3l.3 2M8.1 13.3l-2 .4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  // 两只手掌相对,中间两道表示互推
  press: (
    <>
      <path d="M9 5.5v13M15 5.5v13" />
      <path d="M4.5 12h3M16.5 12h3" />
      <path d="M6.6 10.1L4.5 12l2.1 1.9" />
      <path d="M17.4 10.1L19.5 12l-2.1 1.9" />
    </>
  ),
}

export function MovementIcon({ name, size = 26 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="mv-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
