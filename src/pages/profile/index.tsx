import React, { useState, useEffect } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import BadgeDisplay from '@/components/BadgeDisplay'
import DeveloperMode from '@/components/DeveloperMode'
import { Badge, RidgeBeastPersonality, SpatialProfile } from '@/types'
import { BEAST_PROFILES } from '@/data/ridgeBeasts'
import { formatTime } from '@/utils'
import { useUserStore } from '@/store/useUserStore'
import { api } from '@/services/api'
import './index.scss'

const mockBadges: Badge[] = [
  {
    id: 'badge-001',
    name: '初访者',
    description: '第一次来到琉璃文创园区',
    pixel_image: '',
    condition: { type: 'visit', target: 'any', value: 1 },
    rarity: 'common',
  },
]

const mockSpatialProfile: SpatialProfile = {
  total_visit_duration: 3600,
  most_visited_pois: ['poi-002', 'poi-004'],
  route_pattern: 'explorer',
  discovered_hidden_details: 2,
  inspiration_adoptions: 3,
}

const Profile: React.FC = () => {
  const { user, badges, setBadges } = useUserStore()
  const [spatialProfile, setSpatialProfile] = useState<SpatialProfile>(mockSpatialProfile)
  const [personality, setPersonality] = useState<RidgeBeastPersonality | null>(null)
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<string[]>([])
  const [showDeveloperMode, setShowDeveloperMode] = useState(false)

  // 本地已获得徽章集 + 用户档案徽章合并；初访者徽章默认解锁
  const loadEarnedBadges = () => {
    let earned: string[] = []
    try {
      earned = Taro.getStorageSync('earned_badges') || []
    } catch { /* ignore */ }
    // 历史兼容：测过脊兽但旧版未写入本地徽章集的用户，补发识兽者
    try {
      const result = Taro.getStorageSync('ridge_beast_result')
      if (result && result.type && !earned.includes('badge-004')) {
        earned.push('badge-004')
        Taro.setStorageSync('earned_badges', earned)
      }
    } catch { /* ignore */ }
    const merged = new Set<string>(['badge-001', ...earned, ...(user?.badges || [])])
    setEarnedBadgeIds(Array.from(merged))
  }

  // 从本地存档/用户档案读取脊兽人格测试结果
  const loadPersonality = () => {
    try {
      const saved = Taro.getStorageSync('ridge_beast_result')
      if (saved && saved.type) {
        setPersonality(saved as RidgeBeastPersonality)
        return
      }
    } catch { /* ignore */ }
    setPersonality(user?.ridge_beast_personality || null)
  }

  useDidShow(() => {
    loadPersonality()
    loadEarnedBadges()
  })

  useEffect(() => {
    const loadBadges = async () => {
      try {
        const fetchedBadges = await api.achievement.getAllBadges()
        if (fetchedBadges.length > 0) {
          setBadges(fetchedBadges)
        } else {
          setBadges(mockBadges)
        }
      } catch {
        setBadges(mockBadges)
      }
    }

    loadBadges()
    loadPersonality()
    loadEarnedBadges()

    if (user && user.spatial_profile) {
      setSpatialProfile(user.spatial_profile)
    }
  }, [user])

  const goPersonality = () => {
    Taro.navigateTo({ url: '/pages/personality/index' })
  }

  const goHideSeek = () => {
    Taro.navigateTo({ url: '/pages/hideSeek/index' })
  }

  const showWip = () => {
    Taro.showToast({ title: '功能开发中，敬请期待', icon: 'none' })
  }

  const routePatternLabels: Record<string, string> = {
    explorer: '探索者',
    efficient: '高效者',
    lingerer: '沉思者',
  }

  const handleBack = () => {
    Taro.switchTab({
      url: '/pages/index/index',
      fail: () => {
        Taro.navigateTo({ url: '/pages/index/index' })
      }
    })
  }

  return (
    <View className="profile-page">
      <View className="header">
        <Text className="header-back-btn" onClick={handleBack}>←</Text>
        <Text className="title">我的档案</Text>
      </View>

      <View className="user-card">
        <View className="avatar-wrapper">
          <Image className="avatar" src={user?.avatar || 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=avatar%20portrait%20friendly%20face&image_size=square'} mode="aspectFill" />
        </View>
        <View className="user-info">
          <Text className="user-name">{user?.nickname || '游客'}</Text>
          <Text className="user-id">ID: {user?.id?.slice(-6).toUpperCase() || '888888'}</Text>
        </View>
        <View className="inspiration-display">
          <Text className="inspiration-icon">✨</Text>
          <Text className="inspiration-number">{user?.inspiration_value || 0}</Text>
        </View>
      </View>

      <>
          {personality ? (
            <View
              className="personality-card"
              style={{ borderLeft: `4PX solid ${BEAST_PROFILES[personality.type].glaze.color}` }}
            >
              <View className="personality-header">
                <Text className="personality-title">脊兽人格</Text>
                <button className="retry-btn" onClick={goPersonality}>
                  查看详情
                </button>
              </View>
              <View className="personality-content">
                <View
                  className="beast-icon"
                  style={{ background: BEAST_PROFILES[personality.type].glaze.gradient }}
                >
                  <span>{BEAST_PROFILES[personality.type].emoji}</span>
                </View>
                <View className="beast-info">
                  <Text className="beast-name">
                    {personality.type}·{BEAST_PROFILES[personality.type].alias}
                    <Text className="beast-glaze-tag">{BEAST_PROFILES[personality.type].glaze.name}</Text>
                  </Text>
                  <View className="traits-row">
                    {personality.traits.map((trait, index) => (
                      <span key={index} className="trait-tag">{trait}</span>
                    ))}
                  </View>
                  <Text className="beast-desc">{personality.description}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="personality-card">
              <View className="personality-header">
                <Text className="personality-title">脊兽人格</Text>
              </View>
              <View className="personality-empty" onClick={goPersonality}>
                <Text className="personality-empty-icon">🏯</Text>
                <Text className="personality-empty-text">还未测试，去看看你是屋脊上的哪尊脊兽 →</Text>
              </View>
            </View>
          )}

          <View className="stats-card">
            <Text className="card-title">空间档案</Text>
            <View className="stats-grid">
              <View className="stat-item">
                <Text className="stat-icon">⏳</Text>
                <Text className="stat-value">{formatTime(spatialProfile.total_visit_duration)}</Text>
                <Text className="stat-label">总停留时长</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-icon">🧭</Text>
                <Text className="stat-value">{routePatternLabels[spatialProfile.route_pattern]}</Text>
                <Text className="stat-label">探索风格</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-icon">💎</Text>
                <Text className="stat-value">{spatialProfile.discovered_hidden_details}</Text>
                <Text className="stat-label">发现宝藏</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-icon">💡</Text>
                <Text className="stat-value">{spatialProfile.inspiration_adoptions}</Text>
                <Text className="stat-label">灵感采纳</Text>
              </View>
            </View>
          </View>

          <BadgeDisplay badges={badges} earnedIds={earnedBadgeIds} />

          <View className="actions-card">
            <button className="action-item" onClick={goPersonality}>
              <span className="action-icon">🐉</span>
              <span className="action-label">脊兽人格测试</span>
              <span className="action-arrow">›</span>
            </button>
            <button className="action-item" onClick={goHideSeek}>
              <span className="action-icon">🙈</span>
              <span className="action-label">脊兽躲猫猫</span>
              <span className="action-arrow">›</span>
            </button>
            <button className="action-item" onClick={showWip}>
              <span className="action-icon">📊</span>
              <span className="action-label">生成空间报告</span>
              <span className="action-arrow">›</span>
            </button>
            <button className="action-item" onClick={showWip}>
              <span className="action-icon">📝</span>
              <span className="action-label">隐私设置</span>
              <span className="action-arrow">›</span>
            </button>
            <button className="action-item" onClick={() => Taro.navigateTo({ url: '/pages/bodyRecord/index' })}>
              <span className="action-icon">🎨</span>
              <span className="action-label">身体记录</span>
              <span className="action-arrow">›</span>
            </button>
            <button className="action-item" onClick={() => Taro.navigateTo({ url: '/pages/bodyProfile/index' })}>
              <span className="action-icon">🧍</span>
              <span className="action-label">身体档案</span>
              <span className="action-arrow">›</span>
            </button>
            <button className="action-item" onClick={() => setShowDeveloperMode(true)}>
              <span className="action-icon">🔧</span>
              <span className="action-label">开发者模式</span>
              <span className="action-arrow">›</span>
            </button>
          </View>
      </>

      {showDeveloperMode && (
        <DeveloperMode onClose={() => setShowDeveloperMode(false)} />
      )}
    </View>
  )
}

export default Profile