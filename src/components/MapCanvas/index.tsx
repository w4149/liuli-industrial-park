import React, { useRef, useEffect, useState } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
import { POI } from '@/types'
import { supabaseClient } from '@/utils/supabase/client'

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
  const geolocationRef = useRef<any>(null)
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
  const watchPositionRef = useRef<number | null>(null)
  const triggerCircleRefs = useRef<Map<string, any>>(new Map())
  const triggerMarkerRefs = useRef<Map<string, any>>(new Map())
  const lastTriggeredZoneRef = useRef<string | null>(null)

  useEffect(() => {
    loadCalibrationPoints()
  }, [])

  const loadCalibrationPoints = async () => {
    try {
      const env = (window as any).__ENV__ || {}
      const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL || ''
      if (!supabaseUrl) {
        console.warn('SUPABASE_URL is not configured, skipping Supabase load')
        const saved = localStorage.getItem('liuli_calibration_points')
        if (saved) {
          try {
            setCalibrationPoints(JSON.parse(saved))
          } catch (e) {
            console.warn('Failed to parse calibration points:', e)
          }
        }
        return
      }
      const { data, error } = await supabaseClient.from('calibration_points').select('*')
      if (error) {
        console.warn('Failed to load from Supabase, falling back to localStorage:', error)
        const saved = localStorage.getItem('liuli_calibration_points')
        if (saved) {
          try {
            setCalibrationPoints(JSON.parse(saved))
          } catch (e) {
            console.warn('Failed to parse calibration points:', e)
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
          } catch (e) {
            console.warn('Failed to parse calibration points:', e)
          }
        }
      }
    } catch (e) {
      console.warn('Supabase load error:', e)
      const saved = localStorage.getItem('liuli_calibration_points')
      if (saved) {
        try {
          setCalibrationPoints(JSON.parse(saved))
        } catch (e) {
          console.warn('Failed to parse calibration points:', e)
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
            
            setCustomMapLoaded(true)
          }
          img.onerror = () => {
            console.warn('Custom map image load failed')
            setCustomMapLoaded(true)
          }
          img.src = customMapUrl
        } else {
          setCustomMapLoaded(true)
        }

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

        geolocationRef.current = new AMap.Geolocation({
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 300000,
          convert: true,
          showButton: false,
          showMarker: false,
          showCircle: false,
          panToLocation: false,
        })

        map.on('complete', () => {
          setTimeout(() => {
            setMapLoaded(true)
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
  }, [pois, onPOIClick, customMapUrl, customMapBounds])

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
      return Math.max(5, Math.floor(currentAccuracy / 2))
    }
    return 10
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

  const startWatchingPosition = () => {
    if (watchPositionRef.current) {
      navigator.geolocation.clearWatch(watchPositionRef.current)
    }

    watchPositionRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const wgs84Lng = position.coords.longitude
        const wgs84Lat = position.coords.latitude
        const accuracy = position.coords.accuracy

        const gcj02 = wgs84ToGcj02(wgs84Lng, wgs84Lat)
        const currentLng = gcj02.lng
        const currentLat = gcj02.lat

        setCurrentAccuracy(accuracy)

        const triggerRadius = getTriggerRadius()

        console.log('[MapCanvas] Position update:', {
          wgs84: { lng: wgs84Lng.toFixed(6), lat: wgs84Lat.toFixed(6) },
          gcj02: { lng: currentLng.toFixed(6), lat: currentLat.toFixed(6) },
          accuracy,
          triggerRadius,
          calibrationPointsCount: calibrationPoints.length,
        })

        let foundZone = null
        for (const point of calibrationPoints) {
          const distance = calculateDistance(currentLat, currentLng, point.lat, point.lng)
          console.log(`[MapCanvas] Distance to '${point.name}': ${distance.toFixed(1)}m (triggerRadius: ${triggerRadius}m)`)
          if (distance <= triggerRadius) {
            foundZone = point
            break
          }
        }

        if (foundZone) {
          console.log(`[MapCanvas] Entering zone: ${foundZone.name}`)
          if (foundZone.name !== currentZoneName) {
            setCurrentZoneName(foundZone.name)
            setShowTriggerText(true)
            setIsInZone(true)
            lastTriggeredZoneRef.current = foundZone.name
          }
        } else if (currentZoneName) {
          const leaveThreshold = triggerRadius + 5
          let isStillInAnyZone = false
          for (const point of calibrationPoints) {
            const distance = calculateDistance(currentLat, currentLng, point.lat, point.lng)
            if (distance <= leaveThreshold) {
              isStillInAnyZone = true
              break
            }
          }
          if (!isStillInAnyZone) {
            console.log(`[MapCanvas] Leaving zone: ${currentZoneName}`)
            setCurrentZoneName('')
            setShowTriggerText(false)
            setIsInZone(false)
            lastTriggeredZoneRef.current = null
          }
        }
      },
      (error) => {
        console.warn('Watch position error:', error)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000,
      }
    )
  }

  useEffect(() => {
    return () => {
      if (watchPositionRef.current) {
        navigator.geolocation.clearWatch(watchPositionRef.current)
        watchPositionRef.current = null
      }
    }
  }, [])

  const handleLocationSuccess = (lng: number, lat: number) => {
    const map = mapRef.current
    if (!map) return

    setIsLocating(false)
    setLocationStatus('success')

    const userPos = [lng, lat]

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

    const userMarker = new (window as any).AMap.Marker({
      position: userPos,
      title: '我的位置',
      zIndex: 1000,
    })
    userMarker.setContent('<div style="width:24px;height:24px;border-radius:50%;background:#ff6464;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><div style="width:8px;height:8px;border-radius:50%;background:#fff;"></div></div>')
    map.add(userMarker)
    userMarkerRef.current = userMarker

    startWatchingPosition()
  }

  const handleLocate = () => {
    const map = mapRef.current
    if (!map) return

    setIsLocating(true)
    setLocationStatus('locating')

    if (userMarkerRef.current) {
      map.remove(userMarkerRef.current)
      userMarkerRef.current = null
    }

    const failCallback = (error: any) => {
      console.error('Location error:', error)
      setIsLocating(false)
      setLocationStatus('failed')
      
      const env = (window as any).__ENV__ || {}
      if (!env.AMAP_SECRET_KEY && !process.env.AMAP_SECRET_KEY) {
        console.warn('⚠️ AMAP_SECRET_KEY is not configured. Geolocation may fail in production.')
      }
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
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 300000,
            }
          )
        } else {
          reject({ source: 'native', error: new Error('Geolocation API not supported') })
        }
      })
    }

    const tryTaroGeolocation = () => {
      return new Promise<{ lng: number; lat: number }>((resolve, reject) => {
        try {
          Taro.getLocation({
            type: 'gcj02',
            success: (res) => {
              resolve({
                lng: res.longitude,
                lat: res.latitude,
              })
            },
            fail: (error) => {
              reject({ source: 'taro', error })
            },
          })
        } catch (e) {
          reject({ source: 'taro', error: e })
        }
      })
    }

    const tryAmapGeolocation = () => {
      return new Promise<{ lng: number; lat: number }>((resolve, reject) => {
        const geolocation = geolocationRef.current
        if (!geolocation) {
          reject({ source: 'amap', error: new Error('AMap Geolocation not initialized') })
          return
        }

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
    }

    tryNativeGeolocation()
      .then(({ lng, lat }) => handleLocationSuccess(lng, lat))
      .catch((nativeError) => {
        console.warn('Native geolocation failed, trying Taro...', nativeError)
        return tryTaroGeolocation()
      })
      .then(({ lng, lat }) => handleLocationSuccess(lng, lat))
      .catch((taroError) => {
        console.warn('Taro geolocation failed, trying AMap...', taroError)
        return tryAmapGeolocation()
      })
      .then(({ lng, lat }) => handleLocationSuccess(lng, lat))
      .catch(failCallback)
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