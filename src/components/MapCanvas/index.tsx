import React, { useRef, useEffect, useState } from 'react'
import { POI } from '@/types'

interface MapCanvasProps {
  pois: POI[]
  onPOIClick?: (poi: POI) => void
}

declare const AMap: any

class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('Map component error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: '100%', height: '400px', borderRadius: '16px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#999' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🗺️</div>
            <div>地图加载失败</div>
            <div style={{ fontSize: '12px', marginTop: '5px' }}>请刷新页面重试</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const MapCanvas: React.FC<MapCanvasProps> = ({ pois, onPOIClick }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const initializedRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container || typeof AMap === 'undefined' || initializedRef.current) return

    initializedRef.current = true

    const map = new AMap.Map(container, {
      zoom: 17,
      center: [116.3978, 39.9085],
      resizeEnable: true,
    })
    mapRef.current = map

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
      setMapLoaded(true)
    })

    return () => {
      try {
        if (mapRef.current) {
          mapRef.current.clearMap()
          mapRef.current = null
        }
      } catch (e) {
        console.warn('Map cleanup error:', e)
      }
      initializedRef.current = false
    }
  }, [pois, onPOIClick])

  return (
    <MapErrorBoundary>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '400px', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}
      >
        {!mapLoaded && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '10px 20px', borderRadius: '20px', zIndex: 100 }}>
            🗺️ 加载地图中...
          </div>
        )}
      </div>
    </MapErrorBoundary>
  )
}

export default MapCanvas