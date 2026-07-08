import React, { useState, useEffect } from 'react'
import { View, Text, Input } from '@tarojs/components'
import './index.scss'

interface CalibrationPoint {
  id: string
  name: string
  lng: number
  lat: number
  timestamp: number
}

interface DeveloperModeProps {
  onClose: () => void
}

const DeveloperMode: React.FC<DeveloperModeProps> = ({ onClose }) => {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [locationName, setLocationName] = useState('')
  const [currentLng, setCurrentLng] = useState<number | null>(null)
  const [currentLat, setCurrentLat] = useState<number | null>(null)
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([])
  const [uploadStatus, setUploadStatus] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('liuli_calibration_points')
    if (saved) {
      try {
        setCalibrationPoints(JSON.parse(saved))
      } catch {
        setCalibrationPoints([])
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLng(position.coords.longitude)
          setCurrentLat(position.coords.latitude)
        },
        (error) => {
          console.warn('Geolocation error:', error)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }, [])

  const handleAuthenticate = () => {
    if (password === 'wjj147258') {
      setIsAuthenticated(true)
      setPasswordError('')
    } else {
      setPasswordError('密码错误，请重试')
    }
  }

  const handleUploadLocation = () => {
    if (!locationName.trim()) {
      setUploadStatus('请输入位置名称')
      return
    }
    if (!currentLng || !currentLat) {
      setUploadStatus('正在获取定位，请稍候')
      return
    }

    const newPoint: CalibrationPoint = {
      id: Date.now().toString(),
      name: locationName.trim(),
      lng: currentLng,
      lat: currentLat,
      timestamp: Date.now(),
    }

    const updatedPoints = [...calibrationPoints, newPoint]
    setCalibrationPoints(updatedPoints)
    localStorage.setItem('liuli_calibration_points', JSON.stringify(updatedPoints))
    setLocationName('')
    setUploadStatus('✅ 上传成功')
    setTimeout(() => setUploadStatus(''), 2000)
  }

  const handleDeletePoint = (id: string) => {
    const updatedPoints = calibrationPoints.filter((p) => p.id !== id)
    setCalibrationPoints(updatedPoints)
    localStorage.setItem('liuli_calibration_points', JSON.stringify(updatedPoints))
  }

  const handleRefreshLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLng(position.coords.longitude)
          setCurrentLat(position.coords.latitude)
          setUploadStatus('📍 定位已更新')
          setTimeout(() => setUploadStatus(''), 2000)
        },
        (error) => {
          setUploadStatus('⚠️ 获取定位失败')
          setTimeout(() => setUploadStatus(''), 2000)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }

  if (!isAuthenticated) {
    return (
      <View className="dev-mode-container">
        <View className="dev-mode-card">
          <Text className="dev-title">🔧 开发者模式</Text>
          <Text className="dev-desc">请输入密码以访问开发者功能</Text>
          
          <Input
            className="password-input"
            type="password"
            placeholder="请输入密码"
            value={password}
            onInput={(e: any) => setPassword(e.detail.value)}
            onConfirm={handleAuthenticate}
          />

          {passwordError && (
            <Text className="error-text">{passwordError}</Text>
          )}

          <button className="auth-btn" onClick={handleAuthenticate}>
            进入
          </button>

          <button className="cancel-btn" onClick={onClose}>
            取消
          </button>
        </View>
      </View>
    )
  }

  return (
    <View className="dev-mode-container">
      <View className="dev-mode-card">
        <View className="dev-header">
          <Text className="dev-title">🔧 开发者模式</Text>
          <button className="close-btn" onClick={onClose}>×</button>
        </View>

        <View className="section">
          <Text className="section-title">📍 当前定位</Text>
          <View className="location-info">
            <View className="location-item">
              <Text className="location-label">经度</Text>
              <Text className="location-value">{currentLng?.toFixed(6) || '获取中...'}</Text>
            </View>
            <View className="location-item">
              <Text className="location-label">纬度</Text>
              <Text className="location-value">{currentLat?.toFixed(6) || '获取中...'}</Text>
            </View>
          </View>
          <button className="refresh-btn" onClick={handleRefreshLocation}>
            🔄 刷新定位
          </button>
        </View>

        <View className="section">
          <Text className="section-title">📝 上传定位点</Text>
          <Input
            className="name-input"
            placeholder="输入位置名称（如：大门、展厅A）"
            value={locationName}
            onInput={(e: any) => setLocationName(e.detail.value)}
          />
          
          {uploadStatus && (
            <Text className="upload-status">{uploadStatus}</Text>
          )}

          <button className="upload-btn" onClick={handleUploadLocation}>
            📤 上传定位点
          </button>
        </View>

        <View className="section">
          <Text className="section-title">📋 已保存的定位点</Text>
          
          {calibrationPoints.length === 0 ? (
            <Text className="empty-text">暂无定位点，点击上方按钮添加</Text>
          ) : (
            <View className="points-list">
              {calibrationPoints.map((point) => (
                <View key={point.id} className="point-item">
                  <View className="point-info">
                    <Text className="point-name">{point.name}</Text>
                    <Text className="point-coords">
                      {point.lng.toFixed(6)}, {point.lat.toFixed(6)}
                    </Text>
                  </View>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeletePoint(point.id)}
                  >
                    删除
                  </button>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="hint-section">
          <Text className="hint-title">💡 使用提示</Text>
          <Text className="hint-text">1. 在园区内不同位置获取定位点</Text>
          <Text className="hint-text">2. 记录位置名称和经纬度</Text>
          <Text className="hint-text">3. 用于校准手绘地图与真实位置</Text>
        </View>
      </View>
    </View>
  )
}

export default DeveloperMode