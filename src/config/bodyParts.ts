/**
 * 流线型人体轮廓 — SVG 路径 + 区域检测
 * 坐标系 viewBox: 0 0 200 420
 */
import type React from 'react'

// ─── 类型 ────────────────────────────────────────
export interface BodyZone {
  key: string
  label: string
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

// ─── 流线型人形轮廓（单条闭合贝塞尔路径）──────────
export const BODY_SILHOUETTE = `
M 100 8
C 118 8, 124 22, 124 40
C 124 56, 116 66, 108 70
C 110 76, 112 82, 114 86
C 128 90, 154 98, 166 112
C 174 122, 176 148, 174 178
C 172 200, 166 218, 158 228
C 152 234, 146 230, 142 222
C 138 210, 136 196, 136 182
C 136 200, 140 230, 140 260
C 140 290, 138 330, 134 358
C 132 374, 130 392, 134 406
C 136 414, 128 418, 120 418
C 112 418, 110 410, 110 400
C 110 386, 112 362, 112 338
C 112 310, 108 282, 104 262
C 102 254, 100 250, 100 250
C 100 250, 98 254, 96 262
C 92 282, 88 310, 88 338
C 88 362, 90 386, 90 400
C 90 410, 88 418, 80 418
C 72 418, 64 414, 66 406
C 70 392, 68 374, 66 358
C 62 330, 60 290, 60 260
C 60 230, 64 200, 64 182
C 64 196, 62 210, 58 222
C 54 230, 48 234, 42 228
C 34 218, 28 200, 26 178
C 24 148, 26 122, 34 112
C 46 98, 72 90, 86 86
C 88 82, 90 76, 92 70
C 84 66, 76 56, 76 40
C 76 22, 82 8, 100 8
Z
`.trim()

// ─── 身体区域定义（用于检测笔触位置）────────────
// 匹配优先级：越小越具体的区域越靠前（手 < 肘 < 臂 …）
export const BODY_ZONES: BodyZone[] = [
  // ── 手部（最小，最优先）──
  { key: 'leftHand',   label: '左手',   xMin: 18, xMax: 52,  yMin: 200, yMax: 240 },
  { key: 'rightHand',  label: '右手',   xMin: 148, xMax: 182, yMin: 200, yMax: 240 },
  // ── 肘部 ──
  { key: 'leftElbow',  label: '左肘',   xMin: 24, xMax: 60,  yMin: 148, yMax: 172 },
  { key: 'rightElbow', label: '右肘',   xMin: 140, xMax: 176, yMin: 148, yMax: 172 },
  // ── 前臂 / 上臂 ──
  { key: 'leftForearm',  label: '左小臂', xMin: 20, xMax: 58,  yMin: 172, yMax: 200 },
  { key: 'rightForearm', label: '右小臂', xMin: 142, xMax: 180, yMin: 172, yMax: 200 },
  { key: 'leftUpperArm',  label: '左大臂', xMin: 26, xMax: 64,  yMin: 92,  yMax: 148 },
  { key: 'rightUpperArm', label: '右大臂', xMin: 136, xMax: 174, yMin: 92,  yMax: 148 },
  // ── 脚踝 ──
  { key: 'leftAnkle',  label: '左脚踝', xMin: 60, xMax: 92,  yMin: 348, yMax: 372 },
  { key: 'rightAnkle', label: '右脚踝', xMin: 108, xMax: 140, yMin: 348, yMax: 372 },
  // ── 脚 ──
  { key: 'leftFoot',  label: '左脚',   xMin: 58, xMax: 94,  yMin: 372, yMax: 420 },
  { key: 'rightFoot', label: '右脚',   xMin: 106, xMax: 142, yMin: 372, yMax: 420 },
  // ── 膝部 ──
  { key: 'leftKnee',  label: '左膝',   xMin: 60, xMax: 96,  yMin: 278, yMax: 308 },
  { key: 'rightKnee', label: '右膝',   xMin: 104, xMax: 140, yMin: 278, yMax: 308 },
  // ── 小腿 ──
  { key: 'leftCalf',  label: '左小腿', xMin: 60, xMax: 96,  yMin: 308, yMax: 348 },
  { key: 'rightCalf', label: '右小腿', xMin: 104, xMax: 140, yMin: 308, yMax: 348 },
  // ── 大腿 ──
  { key: 'leftThigh',  label: '左大腿', xMin: 58, xMax: 98,  yMin: 218, yMax: 278 },
  { key: 'rightThigh', label: '右大腿', xMin: 102, xMax: 142, yMin: 218, yMax: 278 },
  // ── 躯干（较大，靠后匹配）──
  { key: 'head',      label: '头',   xMin: 72, xMax: 128, yMin: 0,   yMax: 70  },
  { key: 'neck',      label: '脖子', xMin: 82, xMax: 118, yMin: 70,  yMax: 92  },
  { key: 'shoulder',  label: '肩膀', xMin: 55, xMax: 145, yMin: 86,  yMax: 110 },
  { key: 'chest',     label: '胸口', xMin: 55, xMax: 145, yMin: 110, yMax: 148 },
  { key: 'belly',     label: '肚子', xMin: 55, xMax: 145, yMin: 148, yMax: 182 },
  { key: 'hip',       label: '胯',   xMin: 55, xMax: 145, yMin: 182, yMax: 218 },
]

/** 根据 SVG 坐标检测身体部位 */
export function detectBodyPart(x: number, y: number): string | null {
  for (const zone of BODY_ZONES) {
    if (x >= zone.xMin && x <= zone.xMax && y >= zone.yMin && y <= zone.yMax) {
      return zone.key
    }
  }
  return null
}

/** 获取部位标签 */
export function getPartLabel(key: string): string {
  return BODY_ZONES.find((z) => z.key === key)?.label || key
}

// ─── 兼容旧导出 ──────────────────────────────────
export const BODY_PART_GEOMS = BODY_ZONES.map((z) => ({
  key: z.key,
  label: z.label,
  shape: 'rect' as const,
  cx: (z.xMin + z.xMax) / 2,
  cy: (z.yMin + z.yMax) / 2,
  w: z.xMax - z.xMin,
  h: z.yMax - z.yMin,
}))

export const BODY_SEGMENTS = BODY_ZONES.map((z) => ({
  key: z.key,
  label: z.label,
  yTop: z.yMin,
  yBot: z.yMax,
}))

export function segmentPath(): string { return '' }
/** @deprecated */
export function partStyle(): React.CSSProperties {
  return { position: 'absolute', left: '0', top: '0', width: '0', height: '0' }
}
