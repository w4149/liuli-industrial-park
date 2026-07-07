import { User, POI, InspirationMessage, Badge, ShopItem } from '@/types'
import { mockPOIs } from '@/data/mockPois'

const mockBadges: Badge[] = [
  { id: 'badge-001', name: '初访者', description: '第一次来到琉璃文创园区', pixel_image: '🎖️', condition: { type: 'visit', target: 'any', value: 1 }, rarity: 'common', created_at: new Date().toISOString() },
  { id: 'badge-002', name: '文字探索者', description: '成功回答文字历史连廊问题', pixel_image: '📜', condition: { type: 'quiz', poiId: 'poi-001' }, rarity: 'rare', created_at: new Date().toISOString() },
  { id: 'badge-003', name: '灵感收集者', description: '收集了10条灵感', pixel_image: '✨', condition: { type: 'inspiration', target: 'collect', value: 10 }, rarity: 'rare', created_at: new Date().toISOString() },
]

const mockMessages: InspirationMessage[] = [
  { id: 'msg-001', author_id: 'user-001', poi_id: 'poi-004', content: '你可以翻过这个小矮墙，躺在里面的草地上，闭上眼睛，你会获得美妙的感受', likes: 42, adoptions: 18, created_at: '2024-01-15T10:30:00Z' },
  { id: 'msg-002', author_id: 'user-002', poi_id: 'poi-004', content: '建议在下午3点来这里，阳光透过树叶洒下来特别美', likes: 28, adoptions: 12, created_at: '2024-01-14T15:20:00Z' },
]

const mockShopItems: ShopItem[] = [
  { id: 'item-001', name: '琉璃挂件', description: '精美琉璃材质挂件', price: 50, stock: 100, image: '' },
  { id: 'item-002', name: '脊兽徽章', description: '像素风格脊兽徽章套装', price: 100, stock: 50, image: '' },
  { id: 'item-003', name: '园区地图', description: '手绘风格园区地图', price: 30, stock: 200, image: '' },
]

let userStore: Record<string, User> = {}

export const api = {
  auth: {
    async signIn(openid: string, nickname: string, avatar: string): Promise<User> {
      if (userStore[openid]) {
        return userStore[openid]
      }
      const newUser: User = {
        id: `user-${Date.now()}`,
        openid,
        nickname,
        avatar,
        inspiration_value: 0,
        badges: [],
        spatial_profile: {
          total_visit_duration: 0,
          most_visited_pois: [],
          route_pattern: 'explorer',
          discovered_hidden_details: 0,
          inspiration_adoptions: 0,
        },
        ridge_beast_personality: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      userStore[openid] = newUser
      return newUser
    },

    async getUser(openid: string): Promise<User | null> {
      return userStore[openid] || null
    },
  },

  poi: {
    async getAll(): Promise<POI[]> {
      return mockPOIs
    },

    async getById(id: string): Promise<POI | null> {
      return mockPOIs.find(p => p.id === id) || null
    },
  },

  inspiration: {
    async getMessages(poiId: string): Promise<InspirationMessage[]> {
      return mockMessages.filter(m => m.poi_id === poiId)
    },

    async createMessage(authorId: string, poiId: string, content: string): Promise<InspirationMessage> {
      const newMessage: InspirationMessage = {
        id: `msg-${Date.now()}`,
        author_id: authorId,
        poi_id: poiId,
        content,
        likes: 0,
        adoptions: 0,
        created_at: new Date().toISOString(),
      }
      mockMessages.push(newMessage)
      return newMessage
    },

    async likeMessage(messageId: string): Promise<void> {
      const message = mockMessages.find(m => m.id === messageId)
      if (message) {
        message.likes += 1
      }
    },

    async adoptMessage(messageId: string, userId: string): Promise<void> {
      const message = mockMessages.find(m => m.id === messageId)
      if (message) {
        message.adoptions += 1
      }
      const user = Object.values(userStore).find(u => u.id === userId)
      if (user) {
        user.inspiration_value += 10
        user.spatial_profile.inspiration_adoptions += 1
      }
    },
  },

  achievement: {
    async getAllBadges(): Promise<Badge[]> {
      return mockBadges
    },

    async awardBadge(userId: string, badgeId: string): Promise<void> {
      const user = Object.values(userStore).find(u => u.id === userId)
      if (user && !user.badges.includes(badgeId)) {
        user.badges.push(badgeId)
      }
    },
  },

  shop: {
    async getAllItems(): Promise<ShopItem[]> {
      return mockShopItems
    },

    async purchaseItem(userId: string, itemId: string): Promise<void> {
      const item = mockShopItems.find(i => i.id === itemId)
      const user = Object.values(userStore).find(u => u.id === userId)
      if (!item || !user) throw new Error('商品或用户不存在')
      if (item.stock <= 0) throw new Error('商品已售罄')
      if (user.inspiration_value < item.price) throw new Error('灵感值不足')
      user.inspiration_value -= item.price
      item.stock -= 1
    },
  },
}