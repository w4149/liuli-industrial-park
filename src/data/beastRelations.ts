// 脊兽喜爱关系表（躲猫猫对决玩法）
// 规则：每尊脊兽对其余 10 尊只有「喜欢 / 不喜欢」两种态度，
// 完全均衡：每尊脊兽喜欢 5 尊、被 5 尊喜欢、被 5 尊不喜欢。
// 关系不要求对称（甲喜欢乙，乙未必喜欢甲）；凤与天马互相喜欢。

// 11 尊脊兽（十兽 + 骑凤仙人）
export const ALL_BEASTS = [
  '龙', '凤', '狮子', '天马', '海马', '狻猊', '狎鱼', '獬豸', '斗牛', '行什', '骑凤仙人',
] as const

export type RelationBeast = typeof ALL_BEASTS[number]

// 每尊脊兽的「喜欢」名单（均衡矩阵：每行恰 5 个，每尊恰被 5 尊喜欢）
export const BEAST_LIKES: Record<RelationBeast, RelationBeast[]> = {
  龙: ['狮子', '海马', '狻猊', '狎鱼', '獬豸'], // 不喜欢：凤、天马、斗牛、行什、骑凤仙人
  凤: ['天马', '龙', '狮子', '海马', '狻猊'], // 不喜欢：狎鱼、獬豸、斗牛、行什、骑凤仙人
  狮子: ['海马', '狻猊', '狎鱼', '獬豸', '斗牛'], // 不喜欢：龙、凤、天马、行什、骑凤仙人
  天马: ['凤', '龙', '狮子', '海马', '狻猊'], // 不喜欢：狎鱼、獬豸、斗牛、行什、骑凤仙人
  海马: ['狻猊', '狎鱼', '獬豸', '斗牛', '行什'], // 不喜欢：龙、凤、狮子、天马、骑凤仙人
  狻猊: ['狎鱼', '獬豸', '斗牛', '行什', '骑凤仙人'], // 不喜欢：龙、凤、狮子、天马、海马
  狎鱼: ['獬豸', '斗牛', '行什', '骑凤仙人', '凤'], // 不喜欢：龙、狮子、天马、海马、狻猊
  獬豸: ['斗牛', '行什', '骑凤仙人', '天马', '狎鱼'], // 不喜欢：龙、凤、狮子、海马、狻猊
  斗牛: ['行什', '骑凤仙人', '凤', '天马', '龙'], // 不喜欢：狮子、海马、狻猊、狎鱼、獬豸
  行什: ['骑凤仙人', '凤', '天马', '龙', '狮子'], // 不喜欢：海马、狻猊、狎鱼、獬豸、斗牛
  骑凤仙人: ['凤', '天马', '龙', '狮子', '海马'], // 不喜欢：狻猊、狎鱼、獬豸、斗牛、行什
}

// 甲（attacker）是否喜欢乙（target）
export const beastLikes = (attacker: string, target: string): boolean => {
  const list = BEAST_LIKES[attacker as RelationBeast]
  if (!list) return false
  return list.includes(target as RelationBeast)
}

// 某尊脊兽的「不喜欢」名单（由喜欢名单推导）
export const beastDislikes = (beast: RelationBeast): RelationBeast[] =>
  ALL_BEASTS.filter((b) => b !== beast && !BEAST_LIKES[beast].includes(b))
