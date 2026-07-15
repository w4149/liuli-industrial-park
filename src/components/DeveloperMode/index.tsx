import React, { useState, useEffect, useRef } from 'react'
import { View, Text, Input } from '@tarojs/components'
import AMapLoader from '@amap/amap-jsapi-loader'
import { supabaseClient } from '@/utils/supabase/client'
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
  const [isLocating, setIsLocating] = useState(false)
  const [geolocationReady, setGeolocationReady] = useState(false)
  const [locationError, setLocationError] = useState<string>('')
  const geolocationRef = useRef<any>(null)
  const citySearchRef = useRef<any>(null)

  useEffect(() => {
    loadCalibrationPoints()
    initGeolocation()
  }, [])

  const loadCalibrationPoints = async () => {
    try {
      const { data, error } = await supabaseClient.from('calibration_points').select('*')
      if (error) {
        console.warn('Failed to load from Supabase, falling back to localStorage:', error)
        const saved = localStorage.getItem('liuli_calibration_points')
        if (saved) {
          try {
            setCalibrationPoints(JSON.parse(saved))
          } catch {
            setCalibrationPoints([])
          }
        }
      } else if (data && data.length > 0) {
        const points = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          lng: p.lng,
          lat: p.lat,
          timestamp: p.timestamp || Date.now(),
        }))
        setCalibrationPoints(points)
        localStorage.setItem('liuli_calibration_points', JSON.stringify(points))
      } else {
        const saved = localStorage.getItem('liuli_calibration_points')
        if (saved) {
          try {
            setCalibrationPoints(JSON.parse(saved))
          } catch {
            setCalibrationPoints([])
          }
        }
      }
    } catch (e) {
      console.warn('Supabase load error:', e)
      const saved = localStorage.getItem('liuli_calibration_points')
      if (saved) {
        try {
          setCalibrationPoints(JSON.parse(saved))
        } catch {
          setCalibrationPoints([])
        }
      }
    }
  }

  const initGeolocation = () => {
    const amapKey = process.env.AMAP_WEB_KEY || '320106c641e5603dcde8b521a58ee0c0'
    const securityJsCode = process.env.AMAP_SECRET_KEY || ''

    if (securityJsCode) {
      ;(window as any)._AMapSecurityConfig = {
        securityJsCode,
      }
    }

    AMapLoader.load({
      key: amapKey,
      version: '2.0',
      plugins: ['AMap.Geolocation', 'AMap.CitySearch'],
    })
      .then((AMap: any) => {
        geolocationRef.current = new AMap.Geolocation({
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 300000,
          convert: true,
          showButton: false,
          showMarker: false,
          showCircle: false,
          panToLocation: false,
        })
        citySearchRef.current = new AMap.CitySearch()
        setGeolocationReady(true)
        getLocation()
      })
      .catch((error: any) => {
        console.error('AMap Geolocation init error:', error)
        fallbackGeolocation()
      })
  }

  const getLocation = () => {
    setLocationError('')
    if (!geolocationRef.current) {
      fallbackGeolocation()
      return
    }

    setIsLocating(true)
    geolocationRef.current.getCurrentPosition((status: string, result: any) => {
      setIsLocating(false)
      if (status === 'complete' && result.position) {
        setCurrentLng(result.position.lng)
        setCurrentLat(result.position.lat)
        setLocationError('')
      } else {
        console.warn('AMap geolocation failed, trying fallback:', result)
        fallbackGeolocation()
      }
    })
  }

  const fallbackGeolocation = () => {
    if (navigator.geolocation) {
      setIsLocating(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsLocating(false)
          const lng = position.coords.longitude
          const lat = position.coords.latitude
          const converted = wgs84ToGcj02(lng, lat)
          setCurrentLng(converted.lng)
          setCurrentLat(converted.lat)
          setLocationError('')
        },
        (err) => {
          setIsLocating(false)
          console.warn('Browser geolocation error:', err)
          ipFallbackLocation()
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    } else {
      ipFallbackLocation()
    }
  }

  const ipFallbackLocation = () => {
    if (!citySearchRef.current) {
      setLocationError('⚠️ 无法获取定位，请检查网络连接')
      return
    }

    citySearchRef.current.getLocalCity((status: string, result: any) => {
      if (status === 'complete' && result.city && result.bounds) {
        const center = result.bounds.getCenter()
        setCurrentLng(center.lng)
        setCurrentLat(center.lat)
        setLocationError('📍 IP定位（精度约城市级别）')
        console.log('IP-based location:', center)
      } else {
        console.warn('AMap CitySearch failed:', result)
        setLocationError('⚠️ 无法获取定位，请检查网络连接')
      }
    })
  }

  const wgs84ToGcj02 = (lng: number, lat: number) => {
    const PI = Math.PI
    const a = 6378245.0
    const ee = 0.00669342162296594323

    const transformLat = (x: number, y: number) => {
      let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
      ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
      ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
      ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
      return ret
    }

    const transformLng = (x: number, y: number) => {
      let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
      ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
      ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
      ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
      return ret
    }

    const dLat = transformLat(lng - 105.0, lat - 35.0)
    const dLng = transformLng(lng - 105.0, lat - 35.0)
    const radLat = lat / 180.0 * PI
    let magic = Math.sin(radLat)
    magic = 1 - ee * magic * magic
    const sqrtMagic = Math.sqrt(magic)
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI)
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI)

    return {
      lng: lng + dLng,
      lat: lat + dLat,
    }
  }

  const handleAuthenticate = () => {
    if (password === 'wjj147258') {
      setIsAuthenticated(true)
      setPasswordError('')
    } else {
      setPasswordError('密码错误，请重试')
    }
  }

  const handleUploadLocation = async () => {
    if (!locationName.trim()) {
      setUploadStatus('请输入位置名称')
      return
    }
    if (!currentLng || !currentLat) {
      setUploadStatus('正在获取定位，请稍候')
      return
    }

    setUploadStatus('📍 正在获取最新定位...')
    
    const getLatestLocation = () => {
      return new Promise<void>((resolve) => {
        if (geolocationRef.current) {
          geolocationRef.current.getCurrentPosition((status: string, result: any) => {
            if (status === 'complete' && result.position) {
              setCurrentLng(result.position.lng)
              setCurrentLat(result.position.lat)
            }
            resolve()
          })
        } else if (navigator.geolocation) {
          let resolved = false
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true
              resolve()
            }
          }, 3000)
          
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (!resolved) {
                resolved = true
                clearTimeout(timer)
                const lng = position.coords.longitude
                const lat = position.coords.latitude
                const converted = wgs84ToGcj02(lng, lat)
                setCurrentLng(converted.lng)
                setCurrentLat(converted.lat)
              }
              resolve()
            },
            () => {
              if (!resolved) {
                resolved = true
                clearTimeout(timer)
              }
              resolve()
            },
            { enableHighAccuracy: true, timeout: 3000 }
          )
        } else {
          resolve()
        }
      })
    }

    await getLatestLocation()

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

    try {
      const env = (window as any).__ENV__ || {}
      const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL || ''
      const supabaseKey = env.SUPABASE_KEY || process.env.SUPABASE_KEY || ''
      
      if (!supabaseUrl || !supabaseKey) {
        setUploadStatus('⚠️ 环境变量未配置，仅本地保存')
      } else {
        console.log('Starting Supabase upload...')
        console.log('Supabase URL:', supabaseUrl)
        console.log('Data to upload:', newPoint)
        
        const response = await fetch(`${supabaseUrl}/rest/v1/calibration_points`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(newPoint),
        })
        
        console.log('Response status:', response.status)
        console.log('Response ok:', response.ok)
        
        if (response.status >= 200 && response.status < 300) {
          setUploadStatus('✅ 上传成功（已同步到云端）')
          try {
            const text = await response.text()
            console.log('Response text:', text)
            if (text) {
              try {
                const result = JSON.parse(text)
                console.log('Supabase upload success (JSON):', result)
              } catch (e) {
                console.log('Supabase upload success (non-JSON response):', text)
              }
            } else {
              console.log('Supabase upload success (empty response)')
            }
          } catch (e) {
            console.log('Supabase upload success (response processing error):', e)
          }
        } else {
          let errorData: any = { message: response.statusText }
          try {
            const text = await response.text()
            console.log('Error response text:', text)
            if (text) {
              try {
                errorData = JSON.parse(text)
              } catch (e) {
                errorData = { message: text }
              }
            }
          } catch (e) {
            errorData = { message: response.statusText }
          }
          console.error('Supabase upload failed:', errorData, 'status:', response.status)
          setUploadStatus(`⚠️ 云端同步失败: ${errorData.message || errorData.details || response.status}`)
        }
      }
    } catch (error: any) {
      console.error('Supabase upload error (catch block):', error)
      setUploadStatus(`⚠️ 云端同步失败: ${error.message || '网络错误'}`)
    }

    setLocationName('')
    setTimeout(() => setUploadStatus(''), 3000)
  }

  const handleDeletePoint = async (id: string) => {
    const updatedPoints = calibrationPoints.filter((p) => p.id !== id)
    setCalibrationPoints(updatedPoints)
    localStorage.setItem('liuli_calibration_points', JSON.stringify(updatedPoints))

    try {
      await supabaseClient.from('calibration_points').delete('id', id)
    } catch (error) {
      console.warn('Failed to delete from Supabase:', error)
    }
  }

  const handleRefreshLocation = () => {
    setUploadStatus('📍 正在获取定位...')
    setLocationError('')
    if (!geolocationRef.current) {
      setUploadStatus('⚠️ 定位服务初始化中，请稍后重试')
      setTimeout(() => setUploadStatus(''), 2000)
      return
    }

    geolocationRef.current.getCurrentPosition((status: string, result: any) => {
      if (status === 'complete' && result.position) {
        setCurrentLng(result.position.lng)
        setCurrentLat(result.position.lat)
        setLocationError('')
        setUploadStatus('✅ 定位已更新')
        setTimeout(() => setUploadStatus(''), 2000)
      } else {
        console.warn('AMap geolocation failed, trying fallback:', result)
        fallbackRefreshLocation()
      }
    })
  }

  const fallbackRefreshLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lng = position.coords.longitude
          const lat = position.coords.latitude
          const converted = wgs84ToGcj02(lng, lat)
          setCurrentLng(converted.lng)
          setCurrentLat(converted.lat)
          setLocationError('')
          setUploadStatus('✅ 定位已更新')
          setTimeout(() => setUploadStatus(''), 2000)
        },
        (err) => {
          console.warn('Browser geolocation error:', err)
          const errorMessages: Record<number, string> = {
            1: '🚫 位置权限被拒绝，请在浏览器设置中允许位置访问',
            2: '🔇 位置信息不可用',
            3: '⏰ 定位请求超时，请检查网络或稍后重试',
          }
          setLocationError(errorMessages[err.code] || '⚠️ 获取定位失败')
          setUploadStatus('⚠️ 获取定位失败')
          setTimeout(() => setUploadStatus(''), 2000)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    } else {
      setUploadStatus('⚠️ 获取定位失败')
      setTimeout(() => setUploadStatus(''), 2000)
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
              <Text className="location-value">
                {isLocating ? '定位中...' : (currentLng?.toFixed(6) || '获取中...')}
              </Text>
            </View>
            <View className="location-item">
              <Text className="location-label">纬度</Text>
              <Text className="location-value">
                {isLocating ? '定位中...' : (currentLat?.toFixed(6) || '获取中...')}
              </Text>
            </View>
          </View>
          {!geolocationReady && (
            <Text className="status-text" style={{ color: '#999', fontSize: '12px', marginBottom: '10px' }}>
              ⏳ 定位服务初始化中...
            </Text>
          )}
          {locationError && (
            <Text className="status-text" style={{ color: '#ff6b6b', fontSize: '12px', marginBottom: '10px' }}>
              {locationError}
            </Text>
          )}
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