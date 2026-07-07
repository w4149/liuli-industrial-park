import React, { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import BadgeDisplay from '@/components/BadgeDisplay'
import RidgeBeastTest from '@/components/RidgeBeastTest'
import { Badge, RidgeBeastPersonality, SpatialProfile } from '@/types'
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

const mockPersonality: RidgeBeastPersonality = {
  type: '龙',
  traits: ['威严', '智慧', '领导力'],
  description: '你如同传说中的龙，拥有强大的领导力和智慧，是团队中的核心人物。',
  customized_image: '',
}

const Profile: React.FC = () => {
  const { user, badges, setBadges } = useUserStore()
  const [spatialProfile, setSpatialProfile] = useState<SpatialProfile>(mockSpatialProfile)
  const [personality, setPersonality] = useState<RidgeBeastPersonality | null>(mockPersonality)
  const [showTest, setShowTest] = useState(false)

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

    if (user && user.spatial_profile) {
      setSpatialProfile(user.spatial_profile)
    }
  }, [user])

  const handleTestComplete = (result: RidgeBeastPersonality) => {
    setPersonality(result)
    setShowTest(false)
  }

  const routePatternLabels: Record<string, string> = {
    explorer: '探索者',
    efficient: '高效者',
    lingerer: '沉思者',
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  return (
    <View className="profile-page">
      <View className="header">
        <Text className="back-btn" onClick={handleBack}>←</Text>
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

      {showTest ? (
        <View className="test-section">
          <RidgeBeastTest onComplete={handleTestComplete} />
          <button className="back-btn" onClick={() => setShowTest(false)}>
            返回
          </button>
        </View>
      ) : (
        <>
          {personality && (
            <View className="personality-card">
              <View className="personality-header">
                <Text className="personality-title">脊兽人格</Text>
                <button className="retry-btn" onClick={() => setShowTest(true)}>
                  重新测试
                </button>
              </View>
              <View className="personality-content">
                <View className="beast-icon">
                  <span>{personality.type}</span>
                </View>
                <View className="beast-info">
                  <Text className="beast-name">{personality.type}</Text>
                  <View className="traits-row">
                    {personality.traits.map((trait, index) => (
                      <span key={index} className="trait-tag">{trait}</span>
                    ))}
                  </View>
                  <Text className="beast-desc">{personality.description}</Text>
                </View>
              </View>
            </View>
          )}

          <View className="stats-card">
            <Text className="card-title">空间档案</Text>
            <View className="stats-grid">
              <View className="stat-item">
                <Text className="stat-value">{formatTime(spatialProfile.total_visit_duration)}</Text>
                <Text className="stat-label">总停留时长</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-value">{routePatternLabels[spatialProfile.route_pattern]}</Text>
                <Text className="stat-label">探索风格</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-value">{spatialProfile.discovered_hidden_details}</Text>
                <Text className="stat-label">发现宝藏</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-value">{spatialProfile.inspiration_adoptions}</Text>
                <Text className="stat-label">灵感采纳</Text>
              </View>
            </View>
          </View>

          <BadgeDisplay badges={badges} />

          <View className="actions-card">
            <button className="action-item" onClick={() => setShowTest(true)}>
              <span className="action-icon">🐉</span>
              <span className="action-label">脊兽人格测试</span>
            </button>
            <button className="action-item">
              <span className="action-icon">📊</span>
              <span className="action-label">生成空间报告</span>
            </button>
            <button className="action-item">
              <span className="action-icon">📝</span>
              <span className="action-label">隐私设置</span>
            </button>
          </View>
        </>
      )}
    </View>
  )
}

export default Profile