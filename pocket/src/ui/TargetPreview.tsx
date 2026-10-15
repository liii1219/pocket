/**
 * TargetPreview — 碰目标玩法的示意图。
 *
 * 🔴 为什么不用三维小人:这类动作**没有固定姿势**,姿势取决于圈出现在哪。
 * 给它套一个摆好的小人等于什么都没说 —— 用户问"这个小人要表达什么意思",
 * 问得对,它确实不表达任何东西。
 *
 * 用户真正需要知道的是"圈会出现在哪",而且每个玩法还不一样:
 * 头顶 / 身体两侧远端 / 耳朵旁边。所以这里直接把候选位置画出来。
 */

import { targetSpots, targetTrack } from '../lib/pose/checkers'

/** 画面比例和摄像头一致(4:3),这样预览里的位置和实际位置对得上。 */
const W = 100
const H = 75

export function TargetPreview({ checkId }: { checkId: string }) {
  const spots = targetSpots(checkId)
  const track = targetTrack(checkId)
  if (spots.length === 0 || !track) return null

  const useHead = track === 'head'

  return (
    <div className="targetpreview">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Where the circles appear">
        {/* 取景框 */}
        <rect x={1} y={1} width={W - 2} height={H - 2} rx={4}
              fill="none" stroke="var(--line)" strokeWidth={1.2} />

        {/* 简笔人形,位置和真人在画面里的大致位置一致 */}
        <g stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.75}>
          <circle cx={50} cy={30} r={6} />
          <path d="M50 36 V54" />
          <path d="M50 41 L40 50 M50 41 L60 50" />
        </g>

        {/* 候选位置 */}
        {spots.map(([x, y], i) => (
          <circle
            key={i}
            cx={x * W}
            cy={y * H}
            r={5}
            fill="var(--accent)"
            fillOpacity={0.18}
            stroke="var(--accent)"
            strokeWidth={1.6}
          />
        ))}

        {/* 碰的那个点:手或头 */}
        {useHead ? (
          <circle cx={50} cy={30} r={3} fill="var(--accent)" />
        ) : (
          <>
            <circle cx={40} cy={50} r={3} fill="var(--accent)" />
            <circle cx={60} cy={50} r={3} fill="var(--accent)" />
          </>
        )}
      </svg>
      <p className="targetpreview-note">
        Circles appear here, one at a time. Touch each one with{' '}
        {useHead ? 'your head' : 'either hand'} and the next one moves somewhere else.
      </p>
    </div>
  )
}
