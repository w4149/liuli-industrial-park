import React, { useRef, useEffect, useState } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
import { POI } from '@/types'
import { supabaseClient } from '@/utils/supabase/client'
import { useUserStore } from '@/store/useUserStore'
import marketAudioSrc from '@/assets/audio/danni-song.m4a'
import chimneyAudioSrc from '@/assets/audio/longze-chimney.mp3'
import pondAudioSrc from '@/assets/audio/xingyu-pond.m4a'
import bedroomAudioSrc from '@/assets/audio/fifi-Jasmine1.m4a'

interface MapCanvasProps {
  pois: POI[]
  onPOIClick?: (poi: POI) => void
  onAudioPointsChange?: (pointNames: string[]) => void
  customMapUrl?: string
  customMapBounds?: {
    sw: [number, number]
    ne: [number, number]
  }
}

const MapCanvas: React.FC<MapCanvasProps> = ({ pois, onPOIClick, onAudioPointsChange, customMapUrl, customMapBounds }) => {
  // 使用 selector 只订阅稳定的 setter，避免 triggeredAudioPoints 变化导致本组件重渲染
  const setTriggeredAudioPoints = useUserStore((s) => s.setTriggeredAudioPoints)
  // 用 ref 持有回调，保证初始化 effect 无需依赖它们（避免地图被反复销毁重建）
  const onPOIClickRef = useRef(onPOIClick)
  onPOIClickRef.current = onPOIClick
  const onAudioPointsChangeRef = useRef(onAudioPointsChange)
  onAudioPointsChangeRef.current = onAudioPointsChange
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const groundImageRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const initializedRef = useRef(false)
  const aMapRef = useRef<any>(null)

  const [mapLoaded, setMapLoaded] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationStatus, setLocationStatus] = useState<string>('idle')
  const [mapError, setMapError] = useState<string | null>(null)
  const [customMapLoaded, setCustomMapLoaded] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualLng, setManualLng] = useState('116.3978')
  const [manualLat, setManualLat] = useState('39.9085')
  const [calibrationPoints, setCalibrationPoints] = useState<{ id: string; name: string; lng: number; lat: number; timestamp: number }[]>([])
  const [isInZone, setIsInZone] = useState(false)
  const [showTriggerText, setShowTriggerText] = useState(false)
  const [currentZoneName, setCurrentZoneName] = useState('')
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null)
  const [currentCoords, setCurrentCoords] = useState<{ lng: string; lat: string } | null>(null)
  const kalmanRef = useRef<{ lng: number; lat: number; variance: number } | null>(null)
  const [debugInfo, setDebugInfo] = useState<{
    watchRunning: boolean
    pointsCount: number
    triggerRadius: number
    nearestPoint: string | null
    nearestDistance: number | null
    lastUpdate: number | null
    lastUpdateSeconds: number
    loadStatus: string
    supabaseUrl: string
  }>({
    watchRunning: false,
    pointsCount: 0,
    triggerRadius: 0,
    nearestPoint: null,
    nearestDistance: null,
    lastUpdate: null,
    lastUpdateSeconds: 0,
    loadStatus: 'loading',
    supabaseUrl: '',
  })
  const amapIntervalRef = useRef<number | null>(null)
  const nativeFallbackRef = useRef<number | null>(null)
  const interpolationRef = useRef<number | null>(null)
  const lastPositionRef = useRef<{ lng: number; lat: number } | null>(null)
  const targetPositionRef = useRef<{ lng: number; lat: number } | null>(null)
  const watchFailedRef = useRef(false)
  // 持续监听 watchPosition 的 watchId（核心定位策略）
  const nativeWatchIdRef = useRef<number | null>(null)
  const amapWatchIdRef = useRef<number | null>(null)
  const visibilityHandlerRef = useRef<(() => void) | null>(null)
  // 心跳检测：发现 watcher 静默失效时自动重启
  const healthCheckRef = useRef<number | null>(null)
  const lastPositionTimeRef = useRef<number>(0)
  // 追踪连续更新间隔，用于检测后台返回后的突发更新
  const prevUpdateTimeRef = useRef<number>(0)
  const triggerCircleRefs = useRef<Map<string, any>>(new Map())
  const triggerMarkerRefs = useRef<Map<string, any>>(new Map())
  const lastTriggeredZoneRef = useRef<string | null>(null)
  const calibrationPointsRef = useRef<{ id: string; name: string; lng: number; lat: number; timestamp: number }[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentZoneNameRef = useRef<string>('')
  const hasInitialPanRef = useRef(false)
  const lastAudioPointsRef = useRef<string[]>([])

  useEffect(() => {
    loadCalibrationPoints()
  }, [])

  useEffect(() => {
    calibrationPointsRef.current = calibrationPoints
  }, [calibrationPoints])

  useEffect(() => {
    currentZoneNameRef.current = currentZoneName
  }, [currentZoneName])

  useEffect(() => {
    const timer = setInterval(() => {
      setDebugInfo(prev => {
        if (prev.lastUpdate) {
          const seconds = Math.floor((Date.now() - prev.lastUpdate) / 1000)
          return { ...prev, lastUpdateSeconds: seconds }
        }
        return prev
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const loadCalibrationPoints = async () => {
    try {
      const env = (window as any).__ENV__ || {}
      const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL || ''
      
      setDebugInfo(prev => ({ ...prev, supabaseUrl: supabaseUrl ? 'configured' : 'not set', loadStatus: 'checking' }))
      
      if (!supabaseUrl) {
        setDebugInfo(prev => ({ ...prev, loadStatus: 'no url' }))
        const saved = localStorage.getItem('liuli_calibration_points')
        if (saved) {
          try {
            const points = JSON.parse(saved)
            setCalibrationPoints(points)
            setDebugInfo(prev => ({ ...prev, loadStatus: 'localStorage', pointsCount: points.length }))
          } catch (e) {
            setDebugInfo(prev => ({ ...prev, loadStatus: 'parse error' }))
          }
        } else {
          setDebugInfo(prev => ({ ...prev, loadStatus: 'no data' }))
        }
        return
      }
      const { data, error } = await supabaseClient.from('calibration_points').select('*')
      if (error) {
        setDebugInfo(prev => ({ ...prev, loadStatus: 'supabase error' }))
        const saved = localStorage.getItem('liuli_calibration_points')
        if (saved) {
          try {
            const points = JSON.parse(saved)
            setCalibrationPoints(points)
            setDebugInfo(prev => ({ ...prev, loadStatus: 'fallback', pointsCount: points.length }))
          } catch (e) {
            setDebugInfo(prev => ({ ...prev, loadStatus: 'fallback error' }))
          }
        } else {
          setDebugInfo(prev => ({ ...prev, loadStatus: 'no fallback' }))
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
        setDebugInfo(prev => ({ ...prev, loadStatus: 'success', pointsCount: points.length }))
      } else {
        setDebugInfo(prev => ({ ...prev, loadStatus: 'empty data' }))
        const saved = localStorage.getItem('liuli_calibration_points')
        if (saved) {
          try {
            const points = JSON.parse(saved)
            setCalibrationPoints(points)
            setDebugInfo(prev => ({ ...prev, loadStatus: 'localStorage', pointsCount: points.length }))
          } catch (e) {
            setDebugInfo(prev => ({ ...prev, loadStatus: 'localStorage error' }))
          }
        } else {
          setDebugInfo(prev => ({ ...prev, loadStatus: 'no data at all' }))
        }
      }
    } catch (e) {
      setDebugInfo(prev => ({ ...prev, loadStatus: 'catch error' }))
      const saved = localStorage.getItem('liuli_calibration_points')
      if (saved) {
        try {
          const points = JSON.parse(saved)
          setCalibrationPoints(points)
          setDebugInfo(prev => ({ ...prev, loadStatus: 'catch fallback', pointsCount: points.length }))
        } catch (e) {
          setDebugInfo(prev => ({ ...prev, loadStatus: 'catch error' }))
        }
      }
    }
  }

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container || initializedRef.current) return

    initializedRef.current = true

    const env = (window as any).__ENV__ || {}
    const amapKey = env.AMAP_WEB_KEY || process.env.AMAP_WEB_KEY || '320106c641e5603dcde8b521a58ee0c0'
    const securityJsCode = env.AMAP_SECRET_KEY || process.env.AMAP_SECRET_KEY || ''

    if (securityJsCode) {
      ;(window as any)._AMapSecurityConfig = {
        securityJsCode,
      }
    }

    const loadMapScript = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        const existingScript = document.getElementById('amap-loader')
        if (existingScript) {
          resolve()
          return
        }

        const script = document.createElement('script')
        script.id = 'amap-loader'
        script.src = 'https://webapi.amap.com/loader.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('AMap loader script failed to load'))
        document.head.appendChild(script)
      })
    }

    loadMapScript()
      .then(() => {
        return AMapLoader.load({
          key: amapKey,
          version: '2.0',
          plugins: ['AMap.Geolocation'],
        })
      })
      .then((AMap: any) => {
        aMapRef.current = AMap

        const map = new AMap.Map(container, {
          zoom: 17,
          center: [116.3978, 39.9085],
          resizeEnable: true,
          defaultCursor: 'pointer',
        })
        mapRef.current = map

        setCustomMapLoaded(true)

        const poiColors: Record<string, string> = {
          exhibit: '#667eea',
          interactive: '#f093fb',
          landmark: '#4facfe',
          shop: '#43e97b',
        }

        const poiIcons: Record<string, string> = {
          exhibit: '展',
          interactive: '互',
          landmark: '标',
          shop: '店',
        }

        pois.forEach((poi) => {
          const marker = new AMap.Marker({
            position: [poi.coordinate.lng, poi.coordinate.lat],
            title: poi.name,
          })

          marker.setContent(`<div style="width:30px;height:30px;border-radius:50%;background:${poiColors[poi.type] || '#999'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.2);">${poiIcons[poi.type] || '●'}</div>`)

          marker.on('click', () => {
            if (onPOIClickRef.current) {
              onPOIClickRef.current(poi)
            }
          })

          map.add(marker)

          if (poi.radius && poi.radius > 0) {
            const circle = new AMap.Circle({
              center: [poi.coordinate.lng, poi.coordinate.lat],
              radius: poi.radius,
              strokeColor: poiColors[poi.type] || '#999',
              strokeOpacity: 0.5,
              strokeWeight: 2,
              fillColor: poiColors[poi.type] || '#999',
              fillOpacity: 0.1,
            })
            map.add(circle)
          }
        })

        map.on('complete', () => {
          setTimeout(() => {
            setMapLoaded(true)
            // 只启动持续监听，不立即 handleLocate（避免竞态杀死 watcher）
            // 首次位置由 watcher/polling 自然触发，handlePositionUpdate 处理居中
            startWatchingPosition()
          }, 500)
        })
      })
      .catch((error: any) => {
        console.error('AMap Loader error:', error)
        setMapError('地图加载失败，请检查网络或API密钥配置')
      })

    return () => {
      try {
        if (userMarkerRef.current && mapRef.current) {
          mapRef.current.remove(userMarkerRef.current)
          userMarkerRef.current = null
        }
        if (groundImageRef.current && mapRef.current) {
          mapRef.current.remove(groundImageRef.current)
          groundImageRef.current = null
        }
        if (mapRef.current) {
          mapRef.current.destroy()
          mapRef.current = null
        }
      } catch (e) {
        console.warn('Map cleanup error:', e)
      }
      setMapLoaded(false)
      setLocationStatus('idle')
      initializedRef.current = false
    }
  }, [])

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

    let dLat = transformLat(lng - 105.0, lat - 35.0)
    let dLng = transformLng(lng - 105.0, lat - 35.0)
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

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // 触发圈半径固定为 20 米（此前随 GPS 精度动态缩放，会导致圈忽大忽小）
  const getTriggerRadius = () => {
    return 20
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const playTriggerSound = () => {
    stopAudio()
    
    const audioPath = '/audio/trigger.mp3'
    
    try {
      audioRef.current = new Audio(audioPath)
      audioRef.current.volume = 0.5
      audioRef.current.play().catch(error => {
        console.warn('Audio playback failed:', error)
        playFallbackSound()
      })
    } catch (error) {
      console.warn('Audio playback failed:', error)
      playFallbackSound()
    }
  }

  const playFallbackSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.frequency.setValueAtTime(880, ctx.currentTime)
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.4)
    } catch (error) {
      console.warn('Fallback audio playback failed:', error)
    }
  }

  // ===== 区域音频映射（保留用于判断区域是否有音频，播放改由声音花园页面处理）=====
  // 校准点名称 → 音频路径映射
  const zoneAudioMap: Record<string, string> = {
    '卧室': bedroomAudioSrc,
    '市集': marketAudioSrc,
    '烟囱': chimneyAudioSrc,
    '水池': pondAudioSrc,
  }
  // ===== 区域音频映射结束 =====

  const kalmanFilter = (lng: number, lat: number, accuracy: number) => {
    const R = accuracy * accuracy

    if (!kalmanRef.current) {
      kalmanRef.current = { lng, lat, variance: R }
      return { lng, lat }
    }

    const k = kalmanRef.current
    const varianceDelta = 0.5

    k.variance += varianceDelta

    const kalmanGain = k.variance / (k.variance + R)
    k.lng += kalmanGain * (lng - k.lng)
    k.lat += kalmanGain * (lat - k.lat)
    k.variance *= (1 - kalmanGain)

    return { lng: k.lng, lat: k.lat }
  }

  const drawTriggerZone = () => {
    const map = mapRef.current
    const AMap = aMapRef.current
    if (!map || !AMap) return

    triggerCircleRefs.current.forEach((circle) => {
      map.remove(circle)
    })
    triggerCircleRefs.current.clear()

    triggerMarkerRefs.current.forEach((marker) => {
      map.remove(marker)
    })
    triggerMarkerRefs.current.clear()

    const colors = ['#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#667eea', '#fc6c85']
    const radius = getTriggerRadius()

    calibrationPoints.forEach((point, index) => {
      const color = colors[index % colors.length]

      const circle = new AMap.Circle({
        center: [point.lng, point.lat],
        radius: radius,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.15,
        zIndex: 50,
      })
      map.add(circle)
      triggerCircleRefs.current.set(point.id, circle)

      const marker = new AMap.Marker({
        position: [point.lng, point.lat],
        title: point.name,
        zIndex: 51,
      })
      const firstChar = point.name.charAt(0)
      marker.setContent(`<div style="width:22px;height:22px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.2);">${firstChar}</div>`)
      map.add(marker)
      triggerMarkerRefs.current.set(point.id, marker)
    })
  }

  useEffect(() => {
    if (mapLoaded && calibrationPoints.length > 0) {
      drawTriggerZone()
    }
  }, [mapLoaded, calibrationPoints])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !aMapRef.current) return

    const map = mapRef.current
    const AMap = aMapRef.current

    if (groundImageRef.current) {
      map.remove(groundImageRef.current)
      groundImageRef.current = null
    }

    if (customMapUrl && customMapBounds) {
      const img = new Image()
      img.onload = () => {
        const groundImage = new AMap.GroundImage(customMapUrl, [
          new AMap.LngLat(customMapBounds.sw[0], customMapBounds.sw[1]),
          new AMap.LngLat(customMapBounds.ne[0], customMapBounds.ne[1]),
        ], {
          opacity: 1,
          zooms: [15, 20],
        })
        map.add(groundImage)
        groundImageRef.current = groundImage

        const bounds = new AMap.Bounds(
          new AMap.LngLat(customMapBounds.sw[0], customMapBounds.sw[1]),
          new AMap.LngLat(customMapBounds.ne[0], customMapBounds.ne[1])
        )
        map.setBounds(bounds, true, [50, 50, 50, 50])
      }
      img.onerror = () => {
        console.warn('Custom map image load failed')
      }
      img.src = customMapUrl
    }
  }, [customMapUrl, customMapBounds, mapLoaded])

  const updateMarkerPosition = (lng: number, lat: number) => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition([lng, lat])
    }
    setCurrentCoords({ lng: lng.toFixed(6), lat: lat.toFixed(6) })
  }

  const startInterpolation = (startLng: number, startLat: number, endLng: number, endLat: number) => {
    if (interpolationRef.current) {
      clearInterval(interpolationRef.current)
    }

    // 自适应插值：根据距离决定动画时长
    const distance = calculateDistance(startLat, startLng, endLat, endLng)
    let duration: number
    if (distance < 3) {
      // <3m 直接跳转，无动画
      updateMarkerPosition(endLng, endLat)
      return
    } else if (distance < 15) {
      duration = 250  // 3-15m 快速跟手
    } else if (distance < 50) {
      duration = 500  // 15-50m 中速平滑
    } else {
      duration = 800  // >50m 慢速过渡
    }

    const steps = Math.max(10, Math.floor(duration / 16))  // ~60fps
    const stepDuration = duration / steps
    let step = 0

    interpolationRef.current = window.setInterval(() => {
      step++
      const progress = Math.min(step / steps, 1)
      // ease-out-cubic: 快速启动，平滑停止
      const eased = 1 - Math.pow(1 - progress, 3)

      const currentLng = startLng + (endLng - startLng) * eased
      const currentLat = startLat + (endLat - startLat) * eased

      updateMarkerPosition(currentLng, currentLat)

      if (step >= steps) {
        if (interpolationRef.current) {
          clearInterval(interpolationRef.current)
          interpolationRef.current = null
        }
      }
    }, stepDuration)
  }

  const handlePositionUpdate = (position: GeolocationPosition, isGCJ02: boolean = false) => {
    lastPositionTimeRef.current = Date.now()  // 记录更新时间，用于心跳检测
    let lng = position.coords.longitude
    let lat = position.coords.latitude
    const accuracy = position.coords.accuracy

    if (!isGCJ02) {
      const gcj02 = wgs84ToGcj02(lng, lat)
      lng = gcj02.lng
      lat = gcj02.lat
    }

    const filtered = kalmanFilter(lng, lat, accuracy)
    const targetLng = filtered.lng
    const targetLat = filtered.lat

    setLocationStatus('success')
    setCurrentAccuracy(accuracy)

    if (!userMarkerRef.current && mapRef.current) {
      const userMarker = new (window as any).AMap.Marker({
        position: [targetLng, targetLat],
        title: '我的位置',
        zIndex: 1000,
      })
      userMarker.setContent('<div style="width:24px;height:24px;border-radius:50%;background:#ff6464;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><div style="width:8px;height:8px;border-radius:50%;background:#fff;"></div></div>')
      mapRef.current.add(userMarker)
      userMarkerRef.current = userMarker

      if (!hasInitialPanRef.current) {
        mapRef.current.panTo([targetLng, targetLat])
        mapRef.current.setZoom(18)
        hasInitialPanRef.current = true
      }
    }

    if (lastPositionRef.current && userMarkerRef.current) {
      const distance = calculateDistance(lastPositionRef.current.lat, lastPositionRef.current.lng, targetLat, targetLng)
      const now = Date.now()
      const timeSinceLastUpdate = now - prevUpdateTimeRef.current

      if (distance > 5) {
        // 检测是否为后台返回后的"突发更新"（间隔 >2s 且距离较远）
        if (timeSinceLastUpdate > 2000 && distance > 30) {
          // 后台返回：直接瞬移到新位置 + 重新居中地图
          console.log(`📍 后台返回大跳跃 ${distance.toFixed(0)}m，瞬移`)
          updateMarkerPosition(targetLng, targetLat)
          mapRef.current?.panTo([targetLng, targetLat])
        } else {
          startInterpolation(lastPositionRef.current.lng, lastPositionRef.current.lat, targetLng, targetLat)
        }
      } else {
        updateMarkerPosition(targetLng, targetLat)
      }
      prevUpdateTimeRef.current = now
    } else {
      updateMarkerPosition(targetLng, targetLat)
    }

    lastPositionRef.current = { lng: targetLng, lat: targetLat }

    const triggerRadius = getTriggerRadius()
    const points = calibrationPointsRef.current

    let nearestPoint = null
    let nearestDistance = Infinity
    let foundZone = null

    for (const point of points) {
      const distance = calculateDistance(targetLat, targetLng, point.lat, point.lng)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestPoint = point.name
      }
      if (distance <= triggerRadius) {
        foundZone = point
        break
      }
    }

    setDebugInfo(prev => ({
      ...prev,
      watchRunning: !watchFailedRef.current,
      pointsCount: points.length,
      triggerRadius,
      nearestPoint,
      nearestDistance: nearestDistance === Infinity ? null : Math.round(nearestDistance),
      lastUpdate: Date.now(),
    }))

    if (foundZone) {
      if (foundZone.name !== currentZoneNameRef.current) {
        setCurrentZoneName(foundZone.name)
        setShowTriggerText(true)
        setIsInZone(true)
        lastTriggeredZoneRef.current = foundZone.name
        playTriggerSound()
      }
    } else if (currentZoneNameRef.current) {
      const leaveThreshold = triggerRadius + 5
      let isStillInAnyZone = false
      for (const point of points) {
        const distance = calculateDistance(targetLat, targetLng, point.lat, point.lng)
        if (distance <= leaveThreshold) {
          isStillInAnyZone = true
          break
        }
      }
      if (!isStillInAnyZone) {
        setCurrentZoneName('')
        setShowTriggerText(false)
        setIsInZone(false)
        lastTriggeredZoneRef.current = null
        stopAudio()
      }
    }

    // 收集当前位置触发范围内且绑定了音频的所有点位名称，通知 Store 和父组件
    const audioPoints: string[] = []
    for (const point of points) {
      const distance = calculateDistance(targetLat, targetLng, point.lat, point.lng)
      if (distance <= triggerRadius && zoneAudioMap[point.name]) {
        audioPoints.push(point.name)
      }
    }
    const prevAudioPoints = lastAudioPointsRef.current
    const changed =
      audioPoints.length !== prevAudioPoints.length ||
      audioPoints.some((p, i) => p !== prevAudioPoints[i])
    if (changed) {
      lastAudioPointsRef.current = audioPoints
      setTriggeredAudioPoints(audioPoints)
      if (onAudioPointsChangeRef.current) {
        onAudioPointsChangeRef.current(audioPoints)
      }
    }
  }

  // ===== 持续监听定位策略 =====
  // 核心：native watchPosition（主力）+ polling（永不摧毁的保底）

  // 独立追踪 watcher 和 polling 的更新时间
  const lastWatcherUpdateRef = useRef<number>(0)
  const lastPollingUpdateRef = useRef<number>(0)

  // stopWatchers：只停止 watcher 相关，不动 polling
  const stopWatchers = () => {
    if (nativeWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(nativeWatchIdRef.current)
      nativeWatchIdRef.current = null
    }
    if (amapWatchIdRef.current !== null) {
      try { navigator.geolocation.clearWatch(amapWatchIdRef.current) } catch (e) { /* ignore */ }
      amapWatchIdRef.current = null
    }
    if (amapIntervalRef.current) {
      clearInterval(amapIntervalRef.current)
      amapIntervalRef.current = null
    }
  }

  // stopAllWatchers：完全停止（仅用于组件卸载清理）
  const stopAllWatchers = () => {
    stopWatchers()
    if (nativeFallbackRef.current) {
      clearInterval(nativeFallbackRef.current)
      nativeFallbackRef.current = null
    }
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current)
      healthCheckRef.current = null
    }
  }

  // 心跳检测：三重保障
  const startHealthCheck = () => {
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current)
    }
    lastWatcherUpdateRef.current = Date.now()
    lastPollingUpdateRef.current = Date.now()

    healthCheckRef.current = window.setInterval(() => {
      const now = Date.now()
      const watcherSilent = now - lastWatcherUpdateRef.current
      const pollingSilent = now - lastPollingUpdateRef.current

      // 情况1：watcher 静默 >30s → 重启 watcher
      if (watcherSilent > 30000) {
        console.warn(`⚠️ Watcher 静默 ${Math.floor(watcherSilent / 1000)}s，重启`)
        setDebugInfo(prev => ({ ...prev, loadStatus: 'watcher restart' }))
        stopWatchers()
        startNativeWatch()
        lastWatcherUpdateRef.current = now
      }

      // 情况2：polling 也静默 >45s → 重启 polling
      if (pollingSilent > 45000) {
        console.warn(`⚠️ Polling 静默 ${Math.floor(pollingSilent / 1000)}s，重启`)
        setDebugInfo(prev => ({ ...prev, loadStatus: 'polling restart' }))
        startPollingBackup()
        lastPollingUpdateRef.current = now
      }
    }, 10000)
  }

  // Native watchPosition — 主力定位
  const startNativeWatch = () => {
    if (!('geolocation' in navigator)) return false

    if (nativeWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(nativeWatchIdRef.current)
    }

    nativeWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        watchFailedRef.current = false
        lastWatcherUpdateRef.current = Date.now()
        setDebugInfo(prev => ({ ...prev, loadStatus: 'native watch ✓', watchRunning: true }))
        handlePositionUpdate(position)
      },
      (error) => {
        console.warn(`Native watch error:`, error.code, error.message)
        // 不主动清除 — 心跳检测会处理
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 3000,
      }
    )

    setDebugInfo(prev => ({ ...prev, loadStatus: 'native watch started', watchRunning: true }))
    return true
  }

  // Polling 保底层 — 永不摧毁，始终运行
  const startPollingBackup = () => {
    if (nativeFallbackRef.current) {
      clearInterval(nativeFallbackRef.current)
    }

    nativeFallbackRef.current = window.setInterval(() => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            watchFailedRef.current = false
            lastPollingUpdateRef.current = Date.now()
            const watcherSilent = Date.now() - lastWatcherUpdateRef.current
            if (watcherSilent > 8000) {
              setDebugInfo(prev => ({ ...prev, loadStatus: 'polling ✓' }))
            }
            handlePositionUpdate(position)
          },
          () => { /* 静默失败 */ },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 3000,
          }
        )
      }
    }, 5000)
  }

  // AMap watch — 异步增强
  const tryStartAmapWatch = () => {
    const AMap = (window as any).AMap
    if (!AMap) return

    AMap.plugin('AMap.Geolocation', () => {
      try {
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 3000,
          convert: true,
          showButton: false,
          showMarker: false,
          showCircle: false,
          panToLocation: false,
        })

        let amapFailCount = 0

        amapWatchIdRef.current = geolocation.watchPosition((status: string, result: any) => {
          if (status === 'complete' && result.position) {
            amapFailCount = 0
            lastWatcherUpdateRef.current = Date.now()
            setDebugInfo(prev => ({ ...prev, loadStatus: 'amap watch ✓' }))

            const position = {
              coords: {
                longitude: result.position.lng,
                latitude: result.position.lat,
                accuracy: result.accuracy || 10,
              }
            }
            handlePositionUpdate(position as unknown as GeolocationPosition, true)
          } else {
            amapFailCount++
            if (amapFailCount >= 5) {
              console.warn('AMap watch unreliable, disabling')
              if (amapWatchIdRef.current !== null) {
                try { navigator.geolocation.clearWatch(amapWatchIdRef.current) } catch (e) { /* ignore */ }
                amapWatchIdRef.current = null
              }
            }
          }
        })
      } catch (e) {
        console.warn('AMap watch setup failed:', e)
      }
    })
  }

  // 启动全部定位机制：watch + polling 并行
  const startWatchingPosition = () => {
    // 只停 watcher，不停 polling（polling 永不摧毁）
    stopWatchers()
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current)
      healthCheckRef.current = null
    }
    setDebugInfo(prev => ({ ...prev, watchRunning: true, loadStatus: 'starting all' }))

    // 1. 启动 native watchPosition（主力）
    startNativeWatch()

    // 2. 启动 polling 保底层（如果已在跑则重置间隔）
    startPollingBackup()

    // 3. 异步尝试 AMap watch
    tryStartAmapWatch()

    // 4. 启动心跳检测
    startHealthCheck()
  }

  const setupVisibilityHandler = () => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 页面回到前台，强制重启所有定位')
        // 后台期间浏览器可能已静默杀死 watchPosition
        // ref 中的 watchId 可能是过期的，必须完整重启
        startWatchingPosition()
      }
    }

    document.addEventListener('visibilitychange', handler)
    visibilityHandlerRef.current = handler
  }
  // ===== 持续监听定位策略结束 =====

  useEffect(() => {
    // 设置页面可见性监听
    setupVisibilityHandler()

    return () => {
      // 清除所有定位监听
      stopAllWatchers()
      if (interpolationRef.current) {
        clearInterval(interpolationRef.current)
        interpolationRef.current = null
      }
      // 清除 visibility 监听
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current)
        visibilityHandlerRef.current = null
      }
    }
  }, [])

  const handleLocationSuccess = (lng: number, lat: number, source: string = 'native') => {
    const map = mapRef.current
    if (!map) return

    setIsLocating(false)
    setLocationStatus('success')

    let gcj02Lng = lng
    let gcj02Lat = lat
    if (source === 'native') {
      const gcj02 = wgs84ToGcj02(lng, lat)
      gcj02Lng = gcj02.lng
      gcj02Lat = gcj02.lat
    }

    const userPos = [gcj02Lng, gcj02Lat]

    setCurrentCoords({ lng: gcj02Lng.toFixed(6), lat: gcj02Lat.toFixed(6) })

    if (customMapBounds) {
      const bounds = new (window as any).AMap.Bounds(
        new (window as any).AMap.LngLat(customMapBounds.sw[0], customMapBounds.sw[1]),
        new (window as any).AMap.LngLat(customMapBounds.ne[0], customMapBounds.ne[1])
      )
      bounds.extend(new (window as any).AMap.LngLat(userPos[0], userPos[1]))
      map.setBounds(bounds, true, [50, 50, 50, 50])
    } else {
      map.setCenter(userPos, true)
      map.setZoom(18)
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(userPos)
    } else {
      const userMarker = new (window as any).AMap.Marker({
        position: userPos,
        title: '我的位置',
        zIndex: 1000,
      })
      userMarker.setContent('<div style="width:24px;height:24px;border-radius:50%;background:#ff6464;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><div style="width:8px;height:8px;border-radius:50%;background:#fff;"></div></div>')
      map.add(userMarker)
      userMarkerRef.current = userMarker
    }

    const points = calibrationPointsRef.current
    const triggerRadius = getTriggerRadius()
    let nearestPoint = null
    let nearestDistance = Infinity
    let foundZone = null

    for (const point of points) {
      const distance = calculateDistance(gcj02Lat, gcj02Lng, point.lat, point.lng)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestPoint = point.name
      }
      if (distance <= triggerRadius) {
        foundZone = point
        break
      }
    }

    setDebugInfo(prev => ({
      ...prev,
      triggerRadius,
      nearestPoint,
      nearestDistance: nearestDistance === Infinity ? null : Math.round(nearestDistance),
      pointsCount: points.length,
    }))

    if (foundZone) {
      setCurrentZoneName(foundZone.name)
      setShowTriggerText(true)
      setIsInZone(true)
      lastTriggeredZoneRef.current = foundZone.name
    }

    lastPositionRef.current = { lng: gcj02Lng, lat: gcj02Lat }

    // handleLocate 中已 stopAllWatchers，定位完成后必须重启持续监听
    startWatchingPosition()
  }

  const handleLocate = () => {
    const map = mapRef.current
    if (!map) return

    setIsLocating(true)
    setLocationStatus('locating')

    // 策略1：如果 watcher 已有近期位置（<15s），直接使用，无冲突
    const recentPosition = lastPositionRef.current
    const timeSinceUpdate = Date.now() - lastPositionTimeRef.current
    if (recentPosition && timeSinceUpdate < 15000) {
      console.log('✅ 使用 watcher 缓存位置，无需重新定位')
      handleLocationSuccess(recentPosition.lng, recentPosition.lat, 'amap')
      setIsLocating(false)
      return
    }

    // 策略2：没有缓存位置，暂停 watcher → 单次定位 → 恢复（polling 不中断）
    console.log('📍 无缓存位置，执行单次定位...')
    stopWatchers()
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current)
      healthCheckRef.current = null
    }

    if (userMarkerRef.current) {
      map.remove(userMarkerRef.current)
      userMarkerRef.current = null
    }

    const failCallback = (error: any) => {
      console.error('Location error:', error)
      setIsLocating(false)
      setLocationStatus('failed')
      // 即使失败也恢复 watcher
      startWatchingPosition()
    }

    const tryNativeGeolocation = () => {
      return new Promise<{ lng: number; lat: number }>((resolve, reject) => {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lng: position.coords.longitude,
                lat: position.coords.latitude,
              })
            },
            (error) => {
              reject({ source: 'native', error })
            },
            {
              enableHighAccuracy: true,
              timeout: 12000,
              maximumAge: 10000,  // 接受10s缓存，提高成功率
            }
          )
        } else {
          reject({ source: 'native', error: new Error('Geolocation API not supported') })
        }
      })
    }

    const tryAmapGeolocation = () => {
      return new Promise<{ lng: number; lat: number }>((resolve, reject) => {
        const AMap = (window as any).AMap
        if (!AMap) {
          reject({ source: 'amap', error: new Error('AMap not loaded') })
          return
        }
        AMap.plugin('AMap.Geolocation', () => {
          const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 10000,
            convert: true,
          })
          geolocation.getCurrentPosition((status: string, result: any) => {
            if (status === 'complete' && result.position) {
              resolve({
                lng: result.position.lng,
                lat: result.position.lat,
              })
            } else {
              reject({ source: 'amap', error: new Error(`AMap geolocation failed: ${status}`) })
            }
          })
        })
      })
    }

    // 先尝试 AMap（自带 GCJ02），失败再试 native
    const doLocate = async () => {
      // 等待浏览器释放旧的 geolocation 通道
      await new Promise<void>(r => setTimeout(r, 500))

      try {
        const { lng, lat } = await tryAmapGeolocation()
        handleLocationSuccess(lng, lat, 'amap')
        setIsLocating(false)
        return
      } catch (amapError) {
        console.warn('AMap locate failed, trying native...', amapError)
      }

      try {
        const { lng, lat } = await tryNativeGeolocation()
        handleLocationSuccess(lng, lat, 'native')
        setIsLocating(false)
        return
      } catch (nativeError) {
        console.warn('All locate methods failed:', nativeError)
        failCallback(nativeError)
      }
    }
    doLocate()
  }

  if (mapError) {
    return (
      <div style={{ width: '100%', height: '400px', borderRadius: '16px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#999' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🗺️</div>
          <div>{mapError}</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>请检查环境变量配置</div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ width: '100%', height: '400px', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}
    >
      {/* AMap 专属容器：由高德地图直接操作 DOM，不放置任何 React 子节点，
          避免 React 协调与 AMap 的 DOM 操作冲突导致 removeChild/insertBefore 报错白屏 */}
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
      />
      {!mapLoaded && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '10px 20px', borderRadius: '20px', zIndex: 100 }}>
          🗺️ 加载地图中...
        </div>
      )}

      {isLocating && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '10px 20px', borderRadius: '20px', zIndex: 100 }}>
          📍 定位中...
        </div>
      )}

      {locationStatus === 'failed' && !isLocating && !showManualInput && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '10px 20px', borderRadius: '20px', zIndex: 100, textAlign: 'center', fontSize: '14px' }}>
          <div>⚠️ 定位失败，请重试</div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleLocate}
              style={{ background: '#667eea', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '15px', fontSize: '14px', cursor: 'pointer' }}
            >
              重试定位
            </button>
            <button
              onClick={() => setShowManualInput(true)}
              style={{ background: '#f093fb', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '15px', fontSize: '14px', cursor: 'pointer' }}
            >
              手动定位
            </button>
          </div>
        </div>
      )}

      {mapLoaded && locationStatus !== 'failed' && !showManualInput && (
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowManualInput(true)}
            style={{ background: '#f093fb', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '20px', fontSize: '14px', cursor: 'pointer', zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            📝 手动定位
          </button>
          <button
            onClick={handleLocate}
            style={{ background: '#667eea', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '20px', fontSize: '14px', cursor: 'pointer', zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            📍 {locationStatus === 'success' ? '重新定位' : '定位'}
          </button>
        </div>
      )}

      {currentCoords && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(255,255,255,0.8)', color: '#666', padding: '4px 8px', borderRadius: '6px', zIndex: 150, fontSize: '10px', fontFamily: 'monospace', pointerEvents: 'none' }}>
          {currentCoords.lng}, {currentCoords.lat}
        </div>
      )}

      {mapLoaded && (
        <div style={{ position: 'absolute', bottom: '80px', left: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '6px 10px', borderRadius: '8px', zIndex: 150, fontSize: '10px', pointerEvents: 'none' }}>
          <div>📍 点: {debugInfo.pointsCount}</div>
          <div>🔴 半径: {debugInfo.triggerRadius}m</div>
          <div>📏 最近: {debugInfo.nearestPoint || '-'} ({debugInfo.nearestDistance || '-'}m)</div>
          <div>⏱️ {debugInfo.watchRunning ? '运行中' : '已停止'}</div>
          <div>🔄 上次更新: {debugInfo.lastUpdateSeconds}s</div>
          <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px' }}>
            <div>📦 状态: {debugInfo.loadStatus}</div>
            <div>🔗 URL: {debugInfo.supabaseUrl}</div>
          </div>
        </div>
      )}

      {showTriggerText && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(240,147,251,0.9)', color: '#fff', padding: '15px 30px', borderRadius: '20px', zIndex: 200, textAlign: 'center', fontSize: '18px', fontWeight: 'bold', boxShadow: '0 4px 20px rgba(240,147,251,0.5)', animation: 'pulse 1.5s ease-in-out infinite' }}>
          🎯 {currentZoneName}
        </div>
      )}

      {showManualInput && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255,255,255,0.95)', padding: '20px', borderRadius: '20px', zIndex: 200, textAlign: 'center', minWidth: '280px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#333' }}>📍 手动定位</div>
          <div style={{ marginBottom: '10px', textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#666', marginBottom: '5px' }}>经度 (Lng)</label>
            <input
              type="text"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
              placeholder="116.3978"
            />
          </div>
          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#666', marginBottom: '5px' }}>纬度 (Lat)</label>
            <input
              type="text"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
              placeholder="39.9085"
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => setShowManualInput(false)}
              style={{ background: '#999', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '15px', fontSize: '14px', cursor: 'pointer' }}
            >
              取消
            </button>
            <button
              onClick={() => {
                const lng = parseFloat(manualLng)
                const lat = parseFloat(manualLat)
                if (!isNaN(lng) && !isNaN(lat)) {
                  if (userMarkerRef.current && mapRef.current) {
                    mapRef.current.remove(userMarkerRef.current)
                    userMarkerRef.current = null
                  }
                  handleLocationSuccess(lng, lat)
                  setShowManualInput(false)
                } else {
                  alert('请输入有效的经纬度')
                }
              }}
              style={{ background: '#667eea', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '15px', fontSize: '14px', cursor: 'pointer' }}
            >
              确定定位
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapCanvas