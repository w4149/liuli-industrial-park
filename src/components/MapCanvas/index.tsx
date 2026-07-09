import React, { useRef, useEffect, useState } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
import { POI } from '@/types'

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

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container || initializedRef.current) return

    initializedRef.current = true

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
      plugins: ['AMap.Geolocation'],
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

  const handleLocate = () => {
    const map = mapRef.current
    const geolocation = geolocationRef.current
    if (!map || !geolocation) return

    setIsLocating(true)
    setLocationStatus('locating')

    if (userMarkerRef.current) {
      map.remove(userMarkerRef.current)
      userMarkerRef.current = null
    }

    geolocation.getCurrentPosition((status: string, result: any) => {
      setIsLocating(false)
      if (status === 'complete' && result.position) {
        setLocationStatus('success')
        
        const userPos = [result.position.lng, result.position.lat]

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
      } else {
        setLocationStatus('failed')
      }
    })
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

      {locationStatus === 'failed' && !isLocating && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '10px 20px', borderRadius: '20px', zIndex: 100, textAlign: 'center', fontSize: '14px' }}>
          <div>⚠️ 定位失败，请重试</div>
          <button
            onClick={handleLocate}
            style={{ marginTop: '10px', background: '#667eea', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '15px', fontSize: '14px', cursor: 'pointer' }}
          >
            重试定位
          </button>
        </div>
      )}

      {mapLoaded && locationStatus === 'idle' && (
        <button
          onClick={handleLocate}
          style={{ position: 'absolute', bottom: '20px', right: '20px', background: '#667eea', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '20px', fontSize: '14px', cursor: 'pointer', zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
        >
          📍 定位
        </button>
      )}
    </div>
  )
}

export default MapCanvas