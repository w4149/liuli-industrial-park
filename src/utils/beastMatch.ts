// 脊兽人格测试 —— 计分与原型匹配算法
// 流程：答案 → 各维原始分累加 → 按题库可达最大绝对值归一化到 [-1, 1]
//       → 与十兽原型向量算欧氏距离 → 最近为主人格、次近为副脊兽
//       → 置信度 = 1 - d1/d2；四维皆近中值触发骑凤仙人彩蛋

import { RidgeBeastScores, RidgeBeastPersonality, RidgeBeastType } from '@/types'
import {
  BEAST_QUESTIONS,
  BEAST_PROFILES,
  BeastDim,
  IMMORTAL_THRESHOLD,
} from '@/data/ridgeBeasts'

const DIMS: BeastDim[] = ['V', 'J', 'R', 'C']

// 每个维度按题库计算可达的最大绝对分值，保证归一化后落在 [-1, 1]
const computeMaxAbs = (): Record<BeastDim, number> => {
  const maxAbs: Record<BeastDim, number> = { V: 0, J: 0, R: 0, C: 0 }
  for (const q of BEAST_QUESTIONS) {
    for (const dim of DIMS) {
      let best = 0
      for (const opt of q.options) {
        const s = Math.abs(opt.scores[dim] || 0)
        if (s > best) best = s
      }
      maxAbs[dim] += best
    }
  }
  return maxAbs
}

const MAX_ABS = computeMaxAbs()

/**
 * 根据每题选中的选项下标计算四维归一化得分
 * @param answers 长度与题库一致的选项下标数组
 */
export const computeBeastScores = (answers: number[]): RidgeBeastScores => {
  const raw: Record<BeastDim, number> = { V: 0, J: 0, R: 0, C: 0 }
  BEAST_QUESTIONS.forEach((q, i) => {
    const opt = q.options[answers[i]]
    if (!opt) return
    for (const dim of DIMS) {
      raw[dim] += opt.scores[dim] || 0
    }
  })
  const norm = { V: 0, J: 0, R: 0, C: 0 }
  for (const dim of DIMS) {
    norm[dim] = MAX_ABS[dim] > 0 ? Number((raw[dim] / MAX_ABS[dim]).toFixed(4)) : 0
  }
  return norm
}

const euclidean = (a: RidgeBeastScores, b: Record<BeastDim, number>): number =>
  Math.sqrt(DIMS.reduce((sum, dim) => sum + (a[dim] - b[dim]) ** 2, 0))

export interface BeastMatchResult {
  primary: RidgeBeastType
  secondary: RidgeBeastType
  confidence: number
  isImmortal: boolean
  scores: RidgeBeastScores
}

/**
 * 四维得分匹配脊兽原型
 * 平局裁决：取用户绝对值最大的维度，选择在该维度上与用户同向且更突出的原型
 */
export const matchBeast = (scores: RidgeBeastScores): BeastMatchResult => {
  const ranked = (Object.keys(BEAST_PROFILES) as RidgeBeastType[])
    .map((type) => ({ type, dist: euclidean(scores, BEAST_PROFILES[type].vector) }))
    .sort((a, b) => a.dist - b.dist)

  let [first, second] = ranked

  // 平局：按用户最强维度的同向突出度裁决
  if (Math.abs(first.dist - second.dist) < 1e-6) {
    const strongestDim = DIMS.reduce((best, dim) =>
      Math.abs(scores[dim]) > Math.abs(scores[best]) ? dim : best
    , DIMS[0])
    const sign = Math.sign(scores[strongestDim]) || 1
    const v1 = BEAST_PROFILES[first.type].vector[strongestDim] * sign
    const v2 = BEAST_PROFILES[second.type].vector[strongestDim] * sign
    if (v2 > v1) [first, second] = [second, first]
  }

  const confidence = second.dist > 0 ? Number((1 - first.dist / second.dist).toFixed(4)) : 1
  const isImmortal = DIMS.every((dim) => Math.abs(scores[dim]) < IMMORTAL_THRESHOLD)

  return { primary: first.type, secondary: second.type, confidence, isImmortal, scores }
}

/** 由答案直接生成完整的人格档案对象 */
export const buildPersonality = (answers: number[]): RidgeBeastPersonality => {
  const scores = computeBeastScores(answers)
  const match = matchBeast(scores)
  const profile = BEAST_PROFILES[match.primary]
  return {
    type: profile.type,
    traits: [...profile.traits],
    description: profile.description,
    customized_image: profile.image,
    scores,
    secondary_type: match.secondary,
    confidence: match.confidence,
    is_immortal: match.isImmortal,
    tested_at: new Date().toISOString(),
  }
}
