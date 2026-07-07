import { User, RidgeBeastPersonality, SpatialProfile } from '@/types'

export interface ProfileService {
  analyzeSpatialProfile: (user: User, visitData: any[]) => SpatialProfile
  calculateRidgeBeastPersonality: (user: User, answers: Record<string, string>) => RidgeBeastPersonality
  generateCustomizedBeastImage: (personality: RidgeBeastPersonality) => string
}

const RIDGE_BEASTS: Record<string, Omit<RidgeBeastPersonality, 'customized_image'>> = {
  龙: {
    type: '龙',
    traits: ['威严', '智慧', '领导力'],
    description: '你如同传说中的龙，拥有强大的领导力和智慧，是团队中的核心人物。',
  },
  凤: {
    type: '凤',
    traits: ['优雅', '创造力', '美丽'],
    description: '你如同凤凰般优雅，充满创造力和艺术气息，总能带来惊喜。',
  },
  狮子: {
    type: '狮子',
    traits: ['勇敢', '自信', '保护者'],
    description: '你如同雄狮般勇敢自信，是身边人的守护者，敢于面对挑战。',
  },
  天马: {
    type: '天马',
    traits: ['自由', '梦想', '探索'],
    description: '你如同天马般向往自由，拥有无限的梦想和探索精神。',
  },
  海马: {
    type: '海马',
    traits: ['神秘', '灵活', '适应力'],
    description: '你如同海马般神秘灵活，适应力强，总能在不同环境中游刃有余。',
  },
  狻猊: {
    type: '狻猊',
    traits: ['安静', '专注', '内省'],
    description: '你如同狻猊般安静专注，喜欢内省，拥有深邃的内心世界。',
  },
  狎鱼: {
    type: '狎鱼',
    traits: ['活泼', '友善', '社交'],
    description: '你如同狎鱼般活泼友善，喜欢社交，是人群中的开心果。',
  },
  獬豸: {
    type: '獬豸',
    traits: ['正义', '公正', '洞察力'],
    description: '你如同獬豸般追求正义公正，拥有敏锐的洞察力，明辨是非。',
  },
  斗牛: {
    type: '斗牛',
    traits: ['坚韧', '毅力', '斗志'],
    description: '你如同斗牛般坚韧不拔，拥有强大的毅力和斗志，永不放弃。',
  },
  行什: {
    type: '行什',
    traits: ['独特', '创新', '远见'],
    description: '你如同行什般独特创新，拥有远见卓识，总能看到别人看不到的东西。',
  },
}

export const profileService: ProfileService = {
  analyzeSpatialProfile(user: User, visitData: any[]): SpatialProfile {
    const profile: SpatialProfile = {
      total_visit_duration: user.spatial_profile.total_visit_duration,
      most_visited_pois: user.spatial_profile.most_visited_pois,
      route_pattern: 'explorer',
      discovered_hidden_details: user.spatial_profile.discovered_hidden_details,
      inspiration_adoptions: user.spatial_profile.inspiration_adoptions,
    }

    const visitCount = visitData.length
    if (visitCount > 0) {
      const uniquePOIs = new Set(visitData.map((v: any) => v.poi_id)).size
      const avgStayTime = visitData.reduce((sum: number, v: any) => sum + (v.duration || 0), 0) / visitCount

      if (uniquePOIs > 5 && avgStayTime < 60) {
        profile.route_pattern = 'explorer'
      } else if (uniquePOIs <= 3 && avgStayTime > 180) {
        profile.route_pattern = 'lingerer'
      } else {
        profile.route_pattern = 'efficient'
      }
    }

    return profile
  },

  calculateRidgeBeastPersonality(user: User, answers: Record<string, string>): RidgeBeastPersonality {
    let scores: Record<string, number> = {
      龙: 0,
      凤: 0,
      狮子: 0,
      天马: 0,
      海马: 0,
      狻猊: 0,
      狎鱼: 0,
      獬豸: 0,
      斗牛: 0,
      行什: 0,
    }

    const routePattern = user.spatial_profile.route_pattern
    if (routePattern === 'explorer') scores.天马 += 3
    if (routePattern === 'lingerer') scores.狻猊 += 3
    if (routePattern === 'efficient') scores.龙 += 3

    const adoptionCount = user.spatial_profile.inspiration_adoptions
    if (adoptionCount > 10) scores.狎鱼 += 2
    if (adoptionCount > 5) scores.凤 += 1

    const badgeCount = user.badges.length
    if (badgeCount > 5) scores.狮子 += 2
    if (badgeCount > 3) scores.斗牛 += 1

    Object.keys(answers).forEach((key) => {
      const answer = answers[key]
      if (answer === 'A') scores.龙 += 1
      if (answer === 'B') scores.凤 += 1
      if (answer === 'C') scores.狮子 += 1
      if (answer === 'D') scores.天马 += 1
      if (answer === 'E') scores.海马 += 1
      if (answer === 'F') scores.狻猊 += 1
      if (answer === 'G') scores.狎鱼 += 1
      if (answer === 'H') scores.獬豸 += 1
      if (answer === 'I') scores.斗牛 += 1
      if (answer === 'J') scores.行什 += 1
    })

    const maxScore = Math.max(...Object.values(scores))
    const topBeasts = Object.keys(scores).filter((key) => scores[key] === maxScore)
    const selectedBeast = topBeasts[Math.floor(Math.random() * topBeasts.length)]

    const baseBeast = RIDGE_BEASTS[selectedBeast] || RIDGE_BEASTS.龙

    return {
      ...baseBeast,
      customized_image: this.generateCustomizedBeastImage(baseBeast),
    }
  },

  generateCustomizedBeastImage(personality: RidgeBeastPersonality): string {
    const colors = {
      龙: '#FFD700',
      凤: '#FF69B4',
      狮子: '#8B4513',
      天马: '#87CEEB',
      海马: '#20B2AA',
      狻猊: '#696969',
      狎鱼: '#FFA500',
      獬豸: '#4682B4',
      斗牛: '#DC143C',
      行什: '#9370DB',
    }

    return `data:image/svg+xml;base64,${btoa(`
      <svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
        <circle cx="64" cy="64" r="60" fill="${colors[personality.type] || '#CCCCCC'}" opacity="0.2"/>
        <text x="64" y="75" font-family="serif" font-size="48" text-anchor="middle" fill="${colors[personality.type] || '#333333'}">
          ${personality.type}
        </text>
      </svg>
    `)}`
  },
}
