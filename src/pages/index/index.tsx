import React, { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import MapCanvas from '@/components/MapCanvas'
import AudioPopup from '@/components/AudioPopup'
import { mockPOIs } from '@/data/mockPois'
import { mapConfig } from '@/config/map'
import { POI } from '@/types'
import './index.scss'

const Index: React.FC = () => {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [useCustomMap, setUseCustomMap] = useState(false)
  const [audioPoints, setAudioPoints] = useState<string[]>([])
  const [popupVisible, setPopupVisible] = useState(false)
  const prevPointsRef = useRef<string[]>([])
  const customMapUrl = require('@/assets/images/park-map.png')

  const handleAudioPointsChange = (names: string[]) => {
    const prev = prevPointsRef.current
    // 从空变为非空时弹出提示
    if (names.length > 0 && prev.length === 0) {
      setPopupVisible(true)
    }
    prevPointsRef.current = names
    setAudioPoints(names)
  }

  useEffect(() => {
    const mockLogin = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500))
        const mockUser = {
          id: `user-${Date.now()}`,
          openid: `mock-${Date.now()}`,
          nickname: '访客',
          avatar: '',
          inspiration_value: 0,
          badges: [],
        }
        setUser(mockUser)
      } catch (error) {
        console.error('Login error:', error)
      } finally {
        setIsLoading(false)
      }
    }
    mockLogin()
  }, [])

  const handlePOIClick = (poi: POI) => {
    Taro.showModal({
      title: poi.name,
      content: poi.description,
      showCancel: false,
    })
  }

  if (isLoading) {
    return (
      <View className="loading-page">
        <Text className="loading-text">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="index-page">
      <View className="header">
        <Text className="title">琉璃文创园区</Text>
        <View className="inspiration-badge">
          <Text className="badge-icon">✨</Text>
          <Text className="badge-value">{user?.inspiration_value || 0}</Text>
        </View>
      </View>

      <View className="content-section">
        <View className="welcome-card">
          <Text className="welcome-title">欢迎来到琉璃文创园区</Text>
          <Text className="welcome-text">点击地图上的点位，探索园区的精彩内容</Text>
          <View className="stats-row">
            <View className="stat-item">
              <Text className="stat-value">{mockPOIs.length}</Text>
              <Text className="stat-label">探索点位</Text>
            </View>
            <View className="stat-item">
              <Text className="stat-value">{user?.badges?.length || 0}</Text>
              <Text className="stat-label">获得徽章</Text>
            </View>
            <View className="stat-item">
              <Text className="stat-value">{user?.inspiration_value || 0}</Text>
              <Text className="stat-label">灵感值</Text>
            </View>
          </View>
        </View>

        <View className="map-section">
          <MapCanvas
            pois={mockPOIs}
            onPOIClick={handlePOIClick}
            onAudioPointsChange={handleAudioPointsChange}
            customMapUrl={useCustomMap && customMapUrl ? customMapUrl : undefined}
            customMapBounds={useCustomMap ? mapConfig.customMapBounds : undefined}
          />
        </View>
        <View className="map-toggle">
          <button
            className={`toggle-btn ${useCustomMap ? 'active' : ''}`}
            onClick={() => setUseCustomMap(!useCustomMap)}
          >
            {useCustomMap ? '🖼️ 手绘地图' : '🗺️ 标准地图'}
          </button>
        </View>
      </View>

      <View className="tab-bar">
        <View className="tab-item active">
          <Text className="tab-icon">🗺️</Text>
          <Text className="tab-label">地图</Text>
        </View>
        <View className="tab-item" onClick={() => Taro.navigateTo({ url: '/pages/audio/index' })}>
          <Text className={`tab-icon ${audioPoints.length > 0 ? 'pulse' : ''}`}>🎵</Text>
          <Text className="tab-label">声音</Text>
        </View>
        <View className="tab-item" onClick={() => Taro.navigateTo({ url: '/pages/pigeon/index' })}>
          <Text className="tab-icon">🕊️</Text>
          <Text className="tab-label">飞鸽</Text>
        </View>
        <View className="tab-item" onClick={() => Taro.navigateTo({ url: '/pages/shop/index' })}>
          <Text className="tab-icon">🏪</Text>
          <Text className="tab-label">商店</Text>
        </View>
        <View className="tab-item" onClick={() => Taro.navigateTo({ url: '/pages/profile/index' })}>
          <Text className="tab-icon">👤</Text>
          <Text className="tab-label">我的</Text>
        </View>
      </View>

      <AudioPopup
        visible={popupVisible}
        pointNames={audioPoints}
        onClose={() => setPopupVisible(false)}
      />
    </View>
  )
}

export default Index