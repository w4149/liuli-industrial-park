import { supabase } from '@/utils/supabase'
import {
  User, POI, InspirationMessage, Badge, ShopItem, AudioMarker, PigeonLetter,
  ColorWordLink, BodyRecord, BodyStory, BodyColor, RidgeBeastPersonality, HideSeekPresence, HideSeekDuel,
} from '@/types'
import { mockPOIs } from '@/data/mockPois'

const getEnv = () => {
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    return (window as any).__ENV__
  }
  return {}
}
const getSupabaseUrl = () => {
  const env = getEnv()
  return env.SUPABASE_URL || process.env.SUPABASE_URL || ''
}
const getSupabaseKey = () => {
  const env = getEnv()
  return env.SUPABASE_KEY || process.env.SUPABASE_KEY || ''
}

// 上传文件到 Supabase Storage，返回可访问的公开 URL
const uploadToStorage = async (bucket: string, path: string, file: File): Promise<string> => {
  const supabaseUrl = getSupabaseUrl()
  const supabaseKey = getSupabaseKey()
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || 'Upload failed')
  }
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
}

const mockBadges: Badge[] = [
  { id: 'badge-001', name: '初访者', description: '第一次来到琉璃文创园区', pixel_image: '🎖️', condition: { type: 'visit', target: 'any', value: 1 }, rarity: 'common', created_at: new Date().toISOString() },
  { id: 'badge-002', name: '文字探索者', description: '成功回答文字历史连廊问题', pixel_image: '📜', condition: { type: 'quiz', poiId: 'poi-001' }, rarity: 'rare', created_at: new Date().toISOString() },
  { id: 'badge-003', name: '灵感收集者', description: '收集了10条灵感', pixel_image: '✨', condition: { type: 'inspiration', target: 'collect', value: 10 }, rarity: 'rare', created_at: new Date().toISOString() },
  { id: 'badge-004', name: '识兽者', description: '完成脊兽人格测试，找到屋脊上属于你的那尊脊兽', pixel_image: '🏯', condition: { type: 'quiz', target: 'beast_test', value: 1 }, rarity: 'common' },
  { id: 'badge-005', name: '骑凤仙人', description: '四维皆衡，进退有度——传说走投无路时，凤凰会载你腾空而起', pixel_image: '🕊️', condition: { type: 'quiz', target: 'beast_test_immortal', value: 1 }, rarity: 'legendary' },
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

const useSupabase = true

export const api = {
  auth: {
    async signIn(openid: string, nickname: string, avatar: string): Promise<User> {
      if (!useSupabase) {
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
      }

      try {
        const { data: existingUser } = await supabase.from('users').eqSingle('openid', openid)

        if (existingUser) {
          return existingUser as User
        }

        const newUser: Omit<User, 'id'> = {
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

        const { data: createdUser } = await supabase.from('users').insert([newUser])

        if (createdUser && createdUser.length > 0) {
          return createdUser[0] as User
        }
      } catch (error) {
        console.warn('Supabase create user failed, using mock:', error)
      }

      const fallbackUser: User = {
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
      userStore[openid] = fallbackUser
      return fallbackUser
    },

    async getUser(openid: string): Promise<User | null> {
      if (!useSupabase) {
        return userStore[openid] || null
      }

      try {
        const { data } = await supabase.from('users').eqSingle('openid', openid)
        return data as User | null
      } catch (error) {
        console.warn('Supabase get user failed:', error)
        return userStore[openid] || null
      }
    },
  },

  user: {
    // 保存脊兽人格测试结果（重测覆盖）
    async savePersonality(userId: string, personality: RidgeBeastPersonality): Promise<void> {
      if (!useSupabase) {
        const target = Object.values(userStore).find(u => u.id === userId)
        if (target) target.ridge_beast_personality = personality
        return
      }

      try {
        await supabase.from('users').update(
          { ridge_beast_personality: personality, updated_at: new Date().toISOString() },
          'id', userId,
        )
      } catch (error) {
        console.warn('Supabase save personality failed:', error)
      }
    },

    // 增加灵感值，返回更新后的总值（失败时返回 null）
    async addInspiration(userId: string, delta: number): Promise<number | null> {
      if (!useSupabase) {
        const target = Object.values(userStore).find(u => u.id === userId)
        if (!target) return null
        target.inspiration_value += delta
        return target.inspiration_value
      }

      try {
        const { data: userData } = await supabase.from('users').eqSingle('id', userId)
        if (!userData) return null
        const next = ((userData.inspiration_value as number) || 0) + delta
        await supabase.from('users').update({ inspiration_value: next }, 'id', userId)
        return next
      } catch (error) {
        console.warn('Supabase add inspiration failed:', error)
        return null
      }
    },
  },

  poi: {
    async getAll(): Promise<POI[]> {
      if (!useSupabase) {
        return mockPOIs
      }

      try {
        const { data } = await supabase.from('pois').select()
        return (data || mockPOIs) as POI[]
      } catch (error) {
        console.warn('Supabase get POIs failed, using mock:', error)
        return mockPOIs
      }
    },

    async getById(id: string): Promise<POI | null> {
      if (!useSupabase) {
        return mockPOIs.find(p => p.id === id) || null
      }

      try {
        const { data } = await supabase.from('pois').eqSingle('id', id)
        return data as POI | null
      } catch (error) {
        console.warn('Supabase get POI failed, using mock:', error)
        return mockPOIs.find(p => p.id === id) || null
      }
    },
  },

  inspiration: {
    async getMessages(poiId: string): Promise<InspirationMessage[]> {
      if (!useSupabase) {
        return mockMessages.filter(m => m.poi_id === poiId)
      }

      try {
        const { data } = await supabase.from('inspiration_messages').eq('poi_id', poiId)
        return (data || mockMessages.filter(m => m.poi_id === poiId)) as InspirationMessage[]
      } catch (error) {
        console.warn('Supabase get messages failed, using mock:', error)
        return mockMessages.filter(m => m.poi_id === poiId)
      }
    },

    async createMessage(authorId: string, poiId: string, content: string): Promise<InspirationMessage> {
      if (!useSupabase) {
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
      }

      try {
        const newMessage: Omit<InspirationMessage, 'id'> = {
          author_id: authorId,
          poi_id: poiId,
          content,
          likes: 0,
          adoptions: 0,
          created_at: new Date().toISOString(),
        }

        const { data } = await supabase.from('inspiration_messages').insert([newMessage])

        if (data && data.length > 0) {
          return data[0] as InspirationMessage
        }
      } catch (error) {
        console.warn('Supabase create message failed, using mock:', error)
      }

      return {
        id: `msg-${Date.now()}`,
        author_id: authorId,
        poi_id: poiId,
        content,
        likes: 0,
        adoptions: 0,
        created_at: new Date().toISOString(),
      }
    },

    async likeMessage(messageId: string): Promise<void> {
      if (!useSupabase) {
        const message = mockMessages.find(m => m.id === messageId)
        if (message) {
          message.likes += 1
        }
        return
      }

      try {
        const { data: messages } = await supabase.from('inspiration_messages').eqSingle('id', messageId)
        if (messages) {
          await supabase.from('inspiration_messages').update(
            { likes: (messages.likes || 0) + 1 },
            'id',
            messageId
          )
        }
      } catch (error) {
        console.warn('Supabase like message failed:', error)
      }
    },

    async adoptMessage(messageId: string, userId: string): Promise<void> {
      if (!useSupabase) {
        const message = mockMessages.find(m => m.id === messageId)
        if (message) {
          message.adoptions += 1
        }
        const user = Object.values(userStore).find(u => u.id === userId)
        if (user) {
          user.inspiration_value += 10
          user.spatial_profile.inspiration_adoptions += 1
        }
        return
      }

      try {
        const { data: messageData } = await supabase.from('inspiration_messages').eqSingle('id', messageId)
        if (messageData) {
          await supabase.from('inspiration_messages').update(
            { adoptions: (messageData.adoptions || 0) + 1 },
            'id',
            messageId
          )
        }

        const { data: userData } = await supabase.from('users').eqSingle('id', userId)
        if (userData) {
          await supabase.from('users').update(
            { inspiration_value: (userData.inspiration_value || 0) + 10 },
            'id',
            userId
          )
        }
      } catch (error) {
        console.warn('Supabase adopt message failed:', error)
      }
    },
  },

  achievement: {
    async getAllBadges(): Promise<Badge[]> {
      if (!useSupabase) {
        return mockBadges
      }

      try {
        const { data } = await supabase.from('badges').select()
        const remote = (data || []) as Badge[]
        // 与本地徽章目录合并（id 去重）：新徽章未入库时也能完整展示锁定/解锁列表
        const remoteIds = new Set(remote.map((b) => b.id))
        return [...remote, ...mockBadges.filter((b) => !remoteIds.has(b.id))]
      } catch (error) {
        console.warn('Supabase get badges failed, using mock:', error)
        return mockBadges
      }
    },

    async awardBadge(userId: string, badgeId: string): Promise<void> {
      if (!useSupabase) {
        const user = Object.values(userStore).find(u => u.id === userId)
        if (user && !user.badges.includes(badgeId)) {
          user.badges.push(badgeId)
        }
        return
      }

      try {
        const { data: userData } = await supabase.from('users').eqSingle('id', userId)
        if (userData) {
          const badges = (userData.badges || []) as string[]
          if (!badges.includes(badgeId)) {
            badges.push(badgeId)
            await supabase.from('users').update({ badges }, 'id', userId)
          }
        }
      } catch (error) {
        console.warn('Supabase award badge failed:', error)
      }
    },
  },

  shop: {
    async getAllItems(): Promise<ShopItem[]> {
      if (!useSupabase) {
        return mockShopItems
      }

      try {
        const { data } = await supabase.from('shop_items').select()
        return (data || mockShopItems) as ShopItem[]
      } catch (error) {
        console.warn('Supabase get shop items failed, using mock:', error)
        return mockShopItems
      }
    },

    async purchaseItem(userId: string, itemId: string): Promise<void> {
      if (!useSupabase) {
        const item = mockShopItems.find(i => i.id === itemId)
        const user = Object.values(userStore).find(u => u.id === userId)
        if (!item || !user) throw new Error('商品或用户不存在')
        if (item.stock <= 0) throw new Error('商品已售罄')
        if (user.inspiration_value < item.price) throw new Error('灵感值不足')
        user.inspiration_value -= item.price
        item.stock -= 1
        return
      }

      try {
        const { data: itemData } = await supabase.from('shop_items').eqSingle('id', itemId)
        if (!itemData) {
          throw new Error('商品不存在')
        }

        const { data: userData } = await supabase.from('users').eqSingle('id', userId)
        if (!userData) {
          throw new Error('用户不存在')
        }

        if (itemData.stock <= 0) {
          throw new Error('商品已售罄')
        }

        if ((userData.inspiration_value || 0) < itemData.price) {
          throw new Error('灵感值不足')
        }

        await supabase.from('shop_items').update(
          { stock: itemData.stock - 1 },
          'id',
          itemId
        )

        await supabase.from('users').update(
          { inspiration_value: (userData.inspiration_value || 0) - itemData.price },
          'id',
          userId
        )
      } catch (error) {
        console.warn('Supabase purchase failed:', error)
        throw error
      }
    },
  },

  audio: {
    // 获取全部用户声音标记（自由上传的标记 zone_name 为空，需全量查询）
    async getAllMarkers(): Promise<AudioMarker[]> {
      if (!useSupabase) return []
      try {
        const { data } = await supabase.from('audio_markers').select()
        return (data || []) as AudioMarker[]
      } catch (error) {
        console.warn('Get all audio markers failed:', error)
        return []
      }
    },

    // 获取某区域（校准点名称）的所有用户声音标记
    async getMarkersForZone(zoneName: string): Promise<AudioMarker[]> {
      if (!useSupabase) return []
      try {
        const { data } = await supabase.from('audio_markers').eq('zone_name', zoneName)
        return (data || []) as AudioMarker[]
      } catch (error) {
        console.warn('Get audio markers failed:', error)
        return []
      }
    },

    // 上传音频文件到 Storage（桶 LIULI，目录 audio/），返回公开 URL
    async uploadAudio(file: File, path: string): Promise<string> {
      return uploadToStorage('LIULI', `audio/${path}`, file)
    },

    // 创建声音标记记录
    async createMarker(marker: Omit<AudioMarker, 'id' | 'created_at'>): Promise<AudioMarker> {
      const newMarker = { ...marker, created_at: new Date().toISOString() }
      if (!useSupabase) {
        return { ...newMarker, id: `audio-${Date.now()}` } as AudioMarker
      }
      try {
        const { data } = await supabase.from('audio_markers').insert([newMarker])
        if (data && data.length > 0) {
          return data[0] as AudioMarker
        }
      } catch (error) {
        console.warn('Create audio marker failed:', error)
      }
      return { ...newMarker, id: `audio-${Date.now()}` } as AudioMarker
    },
  },

  pigeon: {
    // 获取所有已发送信件（弹幕数据）
    async getAllLetters(): Promise<PigeonLetter[]> {
      if (!useSupabase) return []
      try {
        const { data } = await supabase.from('pigeon_letters').eq('is_draft', 'false')
        return (data || []) as PigeonLetter[]
      } catch (error) {
        console.warn('Get letters failed:', error)
        return []
      }
    },

    // 获取草稿
    async getDrafts(): Promise<PigeonLetter[]> {
      if (!useSupabase) return []
      try {
        const { data } = await supabase.from('pigeon_letters').eq('is_draft', 'true')
        return (data || []) as PigeonLetter[]
      } catch (error) {
        console.warn('Get drafts failed:', error)
        return []
      }
    },

    // 创建/发送信件
    async createLetter(letter: Omit<PigeonLetter, 'id' | 'created_at'>): Promise<PigeonLetter> {
      const newLetter = { ...letter, created_at: new Date().toISOString() }
      if (!useSupabase) {
        return { ...newLetter, id: `letter-${Date.now()}` } as PigeonLetter
      }
      try {
        const { data } = await supabase.from('pigeon_letters').insert([newLetter])
        if (data && data.length > 0) {
          return data[0] as PigeonLetter
        }
      } catch (error) {
        console.warn('Create letter failed:', error)
      }
      return { ...newLetter, id: `letter-${Date.now()}` } as PigeonLetter
    },

    // 保存草稿
    async saveDraft(letter: Omit<PigeonLetter, 'id' | 'created_at' | 'is_draft'>): Promise<PigeonLetter> {
      return this.createLetter({ ...letter, is_draft: true })
    },

    // 上传图片到 Storage（桶 LIULI，目录 image/），返回公开 URL
    async uploadStamp(file: File, path: string): Promise<string> {
      return uploadToStorage('LIULI', `image/${path}`, file)
    },
  },

  // ===== 选色游戏：词语 → 颜色(hex) 映射 =====
  colorWord: {
    // 获取用户最新的选色结果
    async getLatest(userId: string): Promise<ColorWordLink | null> {
      if (!useSupabase) return null
      try {
        const { data } = await supabase.from('color_word_links').eq('user_id', userId)
        console.log('[colorWord.getLatest] userId=', userId, 'data=', data)
        if (!data || data.length === 0) return null
        const sorted = [...data].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        return sorted[0] as ColorWordLink
      } catch (error) {
        console.error('Get color word link failed:', error)
        return null
      }
    },

    // 保存新的选色结果
    async save(link: Omit<ColorWordLink, 'id' | 'created_at'>): Promise<ColorWordLink> {
      const newLink = { ...link, created_at: new Date().toISOString() }
      console.log('[colorWord.save] payload=', newLink)
      if (!useSupabase) {
        return { ...newLink, id: `link-${Date.now()}` } as ColorWordLink
      }
      try {
        const { data, error } = await supabase.from('color_word_links').insert([newLink]) as any
        console.log('[colorWord.save] response data=', data, 'error=', error)
        if (error) {
          console.error('Save color word link DB error:', error)
          throw new Error(error.message || 'Insert failed')
        }
        if (data && data.length > 0) {
          return data[0] as ColorWordLink
        }
        throw new Error('No data returned from insert')
      } catch (error: any) {
        console.error('Save color word link failed:', error)
        throw error
      }
    },
  },

  // ===== 身体状态记录（涂色快照） =====
  bodyRecord: {
    // 获取用户所有历史涂色记录（按时间倒序）
    async getAll(userId: string): Promise<BodyRecord[]> {
      if (!useSupabase) return []
      try {
        const { data } = await supabase.from('body_records').eq('user_id', userId)
        const list = (data || []) as BodyRecord[]
        return list.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      } catch (error) {
        console.warn('Get body records failed:', error)
        return []
      }
    },

    // 创建一条新的涂色记录
    async create(record: Omit<BodyRecord, 'id' | 'created_at'>): Promise<BodyRecord> {
      const newRecord = { ...record, created_at: new Date().toISOString() }
      if (!useSupabase) {
        return { ...newRecord, id: `rec-${Date.now()}` } as BodyRecord
      }
      try {
        const { data } = await supabase.from('body_records').insert([newRecord])
        if (data && data.length > 0) {
          return data[0] as BodyRecord
        }
      } catch (error) {
        console.warn('Create body record failed:', error)
      }
      return { ...newRecord, id: `rec-${Date.now()}` } as BodyRecord
    },
  },

  // ===== 脊兽躲猫猫：实时位置共享 =====
  hideSeek: {
    // 上报/更新自己的位置（按 user_key upsert）
    async upsertPresence(presence: Omit<HideSeekPresence, 'id' | 'updated_at'>): Promise<void> {
      if (!useSupabase) return
      const payload = { ...presence, updated_at: new Date().toISOString() }
      try {
        const { data } = await supabase.from('hide_seek_presence').update(payload, 'user_key', presence.user_key)
        if (!data || data.length === 0) {
          await supabase.from('hide_seek_presence').insert([payload])
        }
      } catch (error) {
        // 并发首次插入可能撞唯一约束，下一轮心跳会走 update 成功
        console.warn('Upsert hide-seek presence failed:', error)
      }
    },

    // 拉取活跃玩家（3 分钟内有心跳）
    async getActivePresences(): Promise<HideSeekPresence[]> {
      if (!useSupabase) return []
      try {
        const { data } = await supabase.from('hide_seek_presence').select()
        const list = (data || []) as HideSeekPresence[]
        const cutoff = Date.now() - 3 * 60 * 1000
        return list.filter((p) => new Date(p.updated_at).getTime() > cutoff)
      } catch (error) {
        console.warn('Get hide-seek presences failed:', error)
        return []
      }
    },

    // 退出游戏时移除自己的位置
    async removePresence(userKey: string): Promise<void> {
      if (!useSupabase) return
      try {
        await supabase.from('hide_seek_presence').delete('user_key', userKey)
      } catch (error) {
        console.warn('Remove hide-seek presence failed:', error)
      }
    },

    // 发起对决：输入对方身份咒语，落库一条事件
    async sendDuel(duel: Omit<HideSeekDuel, 'id' | 'created_at'>): Promise<boolean> {
      if (!useSupabase) return false
      try {
        await supabase.from('hide_seek_duels').insert([duel])
        return true
      } catch (error) {
        console.warn('Send hide-seek duel failed:', error)
        return false
      }
    },

    // 拉取针对我的对决事件（sinceIso 之后，按时间升序）
    async getDuelsForTarget(targetSpell: string, sinceIso: string): Promise<HideSeekDuel[]> {
      if (!useSupabase) return []
      try {
        const { data } = await supabase.from('hide_seek_duels').eq('target_spell', targetSpell)
        const list = (data || []) as HideSeekDuel[]
        const since = new Date(sinceIso).getTime()
        return list
          .filter((d) => new Date(d.created_at).getTime() > since)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      } catch (error) {
        console.warn('Get hide-seek duels failed:', error)
        return []
      }
    },
  },

  // ===== 身体小故事 =====
  bodyStory: {
    // 获取用户所有故事
    async getAll(userId: string): Promise<BodyStory[]> {
      if (!useSupabase) return []
      try {
        const { data } = await supabase.from('body_stories').eq('user_id', userId)
        const list = (data || []) as BodyStory[]
        return list.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      } catch (error) {
        console.warn('Get body stories failed:', error)
        return []
      }
    },

    // 按 [身体部位 + 词] 查询故事（客户端过滤）
    async getByPartAndWord(userId: string, part: string, word: string): Promise<BodyStory[]> {
      const all = await this.getAll(userId)
      return all.filter((s) => s.body_part === part && s.word === word)
    },

    // 创建一条故事
    async create(story: Omit<BodyStory, 'id' | 'created_at'>): Promise<BodyStory> {
      const newStory = { ...story, created_at: new Date().toISOString() }
      if (!useSupabase) {
        return { ...newStory, id: `story-${Date.now()}` } as BodyStory
      }
      try {
        const { data } = await supabase.from('body_stories').insert([newStory])
        if (data && data.length > 0) {
          return data[0] as BodyStory
        }
      } catch (error) {
        console.warn('Create body story failed:', error)
      }
      return { ...newStory, id: `story-${Date.now()}` } as BodyStory
    },
  },
}