import React, { useRef, useEffect, useState } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
import { POI } from '@/types'
import { supabaseClient } from '@/utils/supabase/client'
import marketAudioSrc from '@/assets/audio/danni-song.m4a'
import chimneyAudioSrc from '@/assets/audio/longze-chimney.mp3'
import pondAudioSrc from '@/assets/audio/xingyu-pond.m4a'
import bedroomAudioSrc from '@/assets/audio/fifi-Jasmine1.m4a'

interface MapCanvasProps {
  pois: POI[]
  onPOIClick?: (poi: POI) => void
  customMapUrl?: string
  customMapBounds?: {
    sw: [number, number]
    ne: [number, number]
  }
}

const MapCanvas: React.FC<MapCanvasProps> = ({ pois, onPOIClick, customMapUrl, customMapBounds }) => {
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
  const triggerCircleRefs = useRef<Map<string, any>>(new Map())
  const triggerMarkerRefs = useRef<Map<string, any>>(new Map())
  const lastTriggeredZoneRef = useRef<string | null>(null)
  const calibrationPointsRef = useRef<{ id: string; name: string; lng: number; lat: number; timestamp: number }[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentZoneNameRef = useRef<string>('')
  const hasInitialPanRef = useRef(false)
  const zoneAudioRef = useRef<HTMLAudioElement | null>(null)
  const zoneLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zoneAudioFadeRef = useRef<number | null>(null)
  const zoneAudioPlayingRef = useRef<string | null>(null)

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
            if (onPOIClick) {
              onPOIClick(poi)
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
            handleLocate()
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
  }, [pois, onPOIClick])

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

  const getTriggerRadius = () => {
    if (currentAccuracy !== null) {
      return Math.max(15, Math.floor(currentAccuracy * 1.5))
    }
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

  // ===== 区域音频管理 =====
  // 校准点名称 → 音频路径映射
  const zoneAudioMap: Record<string, string> = {
    '卧室': bedroomAudioSrc,
    '市集': marketAudioSrc,
    '烟囱': chimneyAudioSrc,
    '水池': pondAudioSrc,
  }

  const startZoneAudio = (pointName: string) => {
    const audioSrc = zoneAudioMap[pointName]
    if (!audioSrc) return

    // 停止已有音频
    stopZoneAudioImmediate()

    const audio = new Audio(audioSrc)
    audio.loop = true
    audio.volume = 0.8
    zoneAudioRef.current = audio
    zoneAudioPlayingRef.current = pointName

    audio.play().catch(error => {
      console.warn('Zone audio play failed (may require user interaction):', error)
      // 保留 audio 元素，下次定位更新时会重新尝试
    })
    console.log(`🎵 开始播放区域音频: ${pointName}`)
  }

  const stopZoneAudioImmediate = () => {
    // 清除离开计时器
    if (zoneLeaveTimerRef.current) {
      clearTimeout(zoneLeaveTimerRef.current)
      zoneLeaveTimerRef.current = null
    }
    // 清除淡出动画
    if (zoneAudioFadeRef.current) {
      cancelAnimationFrame(zoneAudioFadeRef.current)
      zoneAudioFadeRef.current = null
    }
    // 立即停止音频
    if (zoneAudioRef.current) {
      zoneAudioRef.current.pause()
      zoneAudioRef.current.currentTime = 0
      zoneAudioRef.current = null
    }
    zoneAudioPlayingRef.current = null
  }

  const fadeOutAndStopZoneAudio = () => {
    const audio = zoneAudioRef.current
    if (!audio) {
      stopZoneAudioImmediate()
      return
    }

    const duration = 500
    const startVolume = audio.volume
    const startTime = Date.now()

    const fade = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      audio.volume = Math.max(0, startVolume * (1 - progress))

      if (progress < 1) {
        zoneAudioFadeRef.current = requestAnimationFrame(fade)
      } else {
        audio.pause()
        audio.currentTime = 0
        audio.volume = startVolume
        zoneAudioRef.current = null
        zoneAudioPlayingRef.current = null
        zoneAudioFadeRef.current = null
        console.log('🔇 区域音频已淡出停止')
      }
    }
    fade()
  }

  const handleZoneAudioEnter = (pointName: string) => {
    const audioSrc = zoneAudioMap[pointName]
    if (!audioSrc) return

    // 清除离开计时器（用户返回范围内）
    if (zoneLeaveTimerRef.current) {
      clearTimeout(zoneLeaveTimerRef.current)
      zoneLeaveTimerRef.current = null
      console.log(`🔄 用户返回区域 ${pointName}，取消离开计时器`)
    }

    // 如果当前已在播放该区域的音频，不做任何操作
    if (zoneAudioPlayingRef.current === pointName && zoneAudioRef.current) return

    // 从头开始播放
    startZoneAudio(pointName)
  }

  const handleZoneAudioLeave = (pointName: string) => {
    const audioSrc = zoneAudioMap[pointName]
    if (!audioSrc) return

    // 音频继续播放，启动10s倒计时
    console.log(`⏰ 离开区域 ${pointName}，10秒后停止音频...`)

    if (zoneLeaveTimerRef.current) {
      clearTimeout(zoneLeaveTimerRef.current)
    }

    zoneLeaveTimerRef.current = setTimeout(() => {
      fadeOutAndStopZoneAudio()
      zoneLeaveTimerRef.current = null
    }, 10000)
  }
  // ===== 区域音频管理结束 =====

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
        hasInitialPanRef.current = true
      }
    }

    if (lastPositionRef.current && userMarkerRef.current) {
      const distance = calculateDistance(lastPositionRef.current.lat, lastPositionRef.current.lng, targetLat, targetLng)
      if (distance > 5) {
        startInterpolation(lastPositionRef.current.lng, lastPositionRef.current.lat, targetLng, targetLat)
      } else {
        updateMarkerPosition(targetLng, targetLat)
      }
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

    setDebugInfo({
      watchRunning: !watchFailedRef.current,
      pointsCount: points.length,
      triggerRadius,
      nearestPoint,
      nearestDistance: nearestDistance === Infinity ? null : Math.round(nearestDistance),
      lastUpdate: Date.now(),
    })

    if (foundZone) {
      if (foundZone.name !== currentZoneNameRef.current) {
        const prevZone = currentZoneNameRef.current
        // 如果之前在其他有音频的区域，取消该区域的离开计时并停止音频
        if (prevZone && zoneAudioMap[prevZone]) {
          if (zoneLeaveTimerRef.current) {
            clearTimeout(zoneLeaveTimerRef.current)
            zoneLeaveTimerRef.current = null
          }
          if (zoneAudioPlayingRef.current === prevZone) {
            stopZoneAudioImmediate()
          }
        }
        setCurrentZoneName(foundZone.name)
        setShowTriggerText(true)
        setIsInZone(true)
        lastTriggeredZoneRef.current = foundZone.name
        // 区域音频区域不播放提示音，音频本身即为提示
        if (!zoneAudioMap[foundZone.name]) {
          playTriggerSound()
        }
        // 进入区域触发音频播放
        handleZoneAudioEnter(foundZone.name)
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
        const leftZone = currentZoneNameRef.current
        setCurrentZoneName('')
        setShowTriggerText(false)
        setIsInZone(false)
        lastTriggeredZoneRef.current = null
        stopAudio()
        // 处理区域音频离开逻辑
        if (zoneAudioMap[leftZone]) {
          handleZoneAudioLeave(leftZone)
        }
      }
    }
  }

  // ===== 持续监听定位策略 =====
  // 核心：native watchPosition + polling 并行运行，互为备份

  const stopAllWatchers = () => {
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
    if (nativeFallbackRef.current) {
      clearInterval(nativeFallbackRef.current)
      nativeFallbackRef.current = null
    }
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current)
      healthCheckRef.current = null
    }
  }

  // 独立追踪 watcher 的更新时间（与 polling 分开）
  const lastWatcherUpdateRef = useRef<number>(0)

  // 心跳检测：监控 watcher 是否真正在工作
  // 如果 watcher 30s 无更新，即使 polling 还在跑，也重启 watcher
  const startHealthCheck = () => {
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current)
    }
    lastWatcherUpdateRef.current = Date.now()

    healthCheckRef.current = window.setInterval(() => {
      const watcherSilent = Date.now() - lastWatcherUpdateRef.current
      if (watcherSilent > 30000 && nativeWatchIdRef.current !== null) {
        console.warn(`⚠️ Watcher 静默 ${Math.floor(watcherSilent / 1000)}s，重启 watcher`)
        setDebugInfo(prev => ({ ...prev, loadStatus: 'watcher restart' }))
        // 只重启 watcher，不清除 polling
        if (nativeWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(nativeWatchIdRef.current)
          nativeWatchIdRef.current = null
        }
        startNativeWatch()
        lastWatcherUpdateRef.current = Date.now()
      }
    }, 10000)
  }

  // Native watchPosition — 主力定位
  const startNativeWatch = () => {
    if (!('geolocation' in navigator)) return false

    if (nativeWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(nativeWatchIdRef.current)
    }

    let consecutiveErrors = 0

    nativeWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        consecutiveErrors = 0
        watchFailedRef.current = false
        lastWatcherUpdateRef.current = Date.now()
        setDebugInfo(prev => ({ ...prev, loadStatus: 'native watch ✓', watchRunning: true }))
        handlePositionUpdate(position)
      },
      (error) => {
        consecutiveErrors++
        console.warn(`Native watch error (#${consecutiveErrors}):`, error.code, error.message)
        // 不在这里停止 watcher —— watchPosition 可能会自行恢复
        // 如果持续失败，心跳检测会处理重启
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,    // 宽松超时，不急于报错
        maximumAge: 3000,  // 允许3s缓存
      }
    )

    setDebugInfo(prev => ({ ...prev, loadStatus: 'native watch started', watchRunning: true }))
    return true
  }

  // Polling 保底层 — 始终与 watcher 并行运行
  const startPollingBackup = () => {
    if (nativeFallbackRef.current) {
      clearInterval(nativeFallbackRef.current)
    }

    nativeFallbackRef.current = window.setInterval(() => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            watchFailedRef.current = false
            // 只在 watcher 无近期更新时，显示 polling 状态
            const watcherSilent = Date.now() - lastWatcherUpdateRef.current
            if (watcherSilent > 8000) {
              setDebugInfo(prev => ({ ...prev, loadStatus: 'polling backup ✓' }))
            }
            handlePositionUpdate(position)
          },
          () => { /* 静默失败，watcher 可能在工作 */ },
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 3000,
          }
        )
      }
    }, 5000)  // 5s 间隔，平衡更新频率与电量
  }

  // AMap watch — 异步增强（如果可用则提供 GCJ02 直出）
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
              // AMap watch 不可靠，清除它，依赖 native watch + polling
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
    stopAllWatchers()
    setDebugInfo(prev => ({ ...prev, watchRunning: true, loadStatus: 'starting all' }))

    // 1. 启动 native watchPosition（主力）
    startNativeWatch()

    // 2. 启动 polling 保底层（始终运行）
    startPollingBackup()

    // 3. 异步尝试 AMap watch（增强，不依赖）
    tryStartAmapWatch()

    // 4. 启动心跳检测（监控 watcher 健康度）
    startHealthCheck()
  }

  const setupVisibilityHandler = () => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 页面回到前台，重新激活定位')
        if (nativeWatchIdRef.current === null && amapWatchIdRef.current === null && !nativeFallbackRef.current && !amapIntervalRef.current) {
          startWatchingPosition()
        } else {
          // 已有 watcher，做一次即时定位刷新
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                handlePositionUpdate(position)
                setDebugInfo(prev => ({ ...prev, loadStatus: 'foreground refresh ✓' }))
              },
              () => { /* 静默失败 */ },
              { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            )
          }
        }
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
      // 清理区域音频
      stopZoneAudioImmediate()
      if (zoneAudioFadeRef.current) {
        cancelAnimationFrame(zoneAudioFadeRef.current)
        zoneAudioFadeRef.current = null
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

    // 仅在 watcher 未运行时才启动（避免重复重启已有的 watcher）
    if (nativeWatchIdRef.current === null && amapWatchIdRef.current === null && !nativeFallbackRef.current && !amapIntervalRef.current) {
      startWatchingPosition()
    }
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

    // 策略2：没有缓存位置，暂停 watcher → 单次定位 → 恢复 watcher
    console.log('📍 无缓存位置，执行单次定位...')
    stopAllWatchers()

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
              timeout: 8000,
              maximumAge: 5000,  // 接受5s缓存，避免强制 GPS 刷新
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
            timeout: 8000,
            maximumAge: 5000,
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
      ref={mapContainerRef}
      style={{ width: '100%', height: '400px', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}
    >
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