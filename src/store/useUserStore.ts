import { create } from 'zustand'
import { User, Badge, ShopItem } from '@/types'

interface UserStore {
  user: User | null
  badges: Badge[]
  shopItems: ShopItem[]
  isLoading: boolean
  error: string | null
  triggeredAudioPoints: string[]
  // 地图滤波后的当前位置（GCJ02 坐标系，与触发判定同源）
  currentPosition: { lng: number; lat: number } | null
  setUser: (user: User | null) => void
  updateInspirationValue: (value: number) => void
  addBadge: (badge: Badge) => void
  setBadges: (badges: Badge[]) => void
  setShopItems: (items: ShopItem[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  setTriggeredAudioPoints: (points: string[]) => void
  setCurrentPosition: (pos: { lng: number; lat: number } | null) => void
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  badges: [],
  shopItems: [],
  isLoading: false,
  error: null,
  triggeredAudioPoints: [],
  currentPosition: null,
  setUser: (user) => set({ user }),
  updateInspirationValue: (value) =>
    set((state) => ({
      user: state.user
        ? { ...state.user, inspiration_value: value }
        : null,
    })),
  addBadge: (badge) =>
    set((state) => ({
      badges: [...state.badges, badge],
      user: state.user
        ? {
            ...state.user,
            badges: [...(state.user.badges || []), badge.id],
          }
        : null,
    })),
  setBadges: (badges) => set({ badges }),
  setShopItems: (items) => set({ shopItems: items }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setTriggeredAudioPoints: (points) => set({ triggeredAudioPoints: points }),
  setCurrentPosition: (pos) => set({ currentPosition: pos }),
}))