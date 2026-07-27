import React, { useRef, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import AMapLoader from '@amap/amap-jsapi-loader'
import { BEAST_PROFILES } from '@/data/ridgeBeasts'
import { HideSeekPresence } from '@/types'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import { wgs84ToGcj02 } from '@/utils'
import { mapConfig } from '@/config/map'
import './index.scss'

const SYNC_INTERVAL = 60 * 1000 // 位置每 1 分钟同步一次（类似微信共享定位）
const USER_KEY_STORAGE = 'hide_seek_user_key'

// 设备级玩家标识：不依赖登录态，首次进入生成并持久化
const getUserKey = (): string => {
  try {
    let key = Taro.getStorageSync(USER_KEY_STORAGE)
    if (!key) {
      key = `hs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      Taro.setStorageSync(USER_KEY_STORAGE, key)
    }
    return key
  } catch {
    return `hs-${Date.now().toString(36)}`
  }
}

// 防止昵称注入 HTML
const escapeHtml = (str: string) => str.replace(/[<>&"']/g, '')

// 玩家标记 HTML：脊兽小图标 + 昵称牌
const buildMarkerHtml = (beastType: string, nickname: string, isSelf: boolean) => {
  const profile = beastType && BEAST_PROFILES[beastType] ? BEAST_PROFILES[beastType] : null
  const inner = profile
    ? (profile.image
      ? `<img src="${profile.image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
      : `<span style="font-size:19px;line-height:1;">${profile.emoji}</span>`)
    : '<span style="font-size:19px;line-height:1;">🐾</span>'
  const bg = profile ? profile.glaze.gradient : 'linear-gradient(135deg,#94a3b8,#64748b)'
  const border = isSelf ? '3px solid #ffd700' : '3px solid #fff'
  const name = escapeHtml(nickname || '神秘访客')
  return `<div style="display:flex;flex-direction:column;align-items:center;">
    <div style="width:36px;height:36px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.35);overflow:hidden;">${inner}</div>
    <div style="margin-top:2px;background:rgba(0,0,0,0.55);color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;white-space:nowrap;">${isSelf ? '我 · ' : ''}${name}</div>
  </div>`
}

const HideSeek: React.FC = () => {
  const { user } = useUserStore()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const initializedRef = useRef(false)
  const watchIdRef = useRef<number | null>(null)
  const syncTimerRef = useRef<number | null>(null)
  const tickTimerRef = useRef<number | null>(null)
  const myPosRef = useRef<{ lng: number; lat: number } | null>(null)
  const myMarkerRef = useRef<any>(null)
  const otherMarkersRef = useRef<Map<string, any>>(new Map())
  const hasPannedRef = useRef(false)
  const lastSyncRef = useRef<number>(0)
  const userKeyRef = useRef<string>(getUserKey())

  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [nextSyncIn, setNextSyncIn] = useState(60)
  const [locStatus, setLocStatus] = useState<'locating' | 'ok' | 'failed'>('locating')

  // 自己的身份信息（昵称 + 脊兽）
  const getIdentity = () => {
    let beastType = ''
    try {
      const saved = Taro.getStorageSync('ridge_beast_result')
      if (saved && saved.type) beastType = saved.type
    } catch { /* ignore */ }
    return {
      nickname: user?.nickname || '神秘访客',
      beast_type: beastType,
    }
  }

  // 上报自己位置 + 拉取其他玩家并刷新标记
  const syncPresence = async () => {
    lastSyncRef.current = Date.now()
    const pos = myPosRef.current
    const identity = getIdentity()

    if (pos) {
      await api.hideSeek.upsertPresence({
        user_key: userKeyRef.current,
        nickname: identity.nickname,
        beast_type: identity.beast_type,
        lng: pos.lng,
        lat: pos.lat,
      })
    }

    const list = await api.hideSeek.getActivePresences()
    const others = list.filter((p) => p.user_key !== userKeyRef.current)
    setOnlineCount(others.length + (pos ? 1 : 0))
    renderOtherMarkers(others)
  }

  const renderOtherMarkers = (others: HideSeekPresence[]) => {
    const map = mapRef.current
    const AMap = (window as any).AMap
    if (!map || !AMap) return

    const alive = new Set(others.map((p) => p.user_key))
    // 移除已下线玩家
    otherMarkersRef.current.forEach((marker, key) => {
      if (!alive.has(key)) {
        map.remove(marker)
        otherMarkersRef.current.delete(key)
      }
    })
    // 新增/更新在线玩家
    others.forEach((p) => {
      const existing = otherMarkersRef.current.get(p.user_key)
      if (existing) {
        existing.setPosition([p.lng, p.lat])
        existing.setContent(buildMarkerHtml(p.beast_type, p.nickname, false))
      } else {
        const marker = new AMap.Marker({
          position: [p.lng, p.lat],
          anchor: 'top-center',
          zIndex: 900,
        })
        marker.setContent(buildMarkerHtml(p.beast_type, p.nickname, false))
        map.add(marker)
        otherMarkersRef.current.set(p.user_key, marker)
      }
    })
  }

  const updateMyMarker = (lng: number, lat: number) => {
    const map = mapRef.current
    const AMap = (window as any).AMap
    if (!map || !AMap) return
    const identity = getIdentity()
    if (myMarkerRef.current) {
      myMarkerRef.current.setPosition([lng, lat])
    } else {
      const marker = new AMap.Marker({
        position: [lng, lat],
        anchor: 'top-center',
        zIndex: 1000,
      })
      marker.setContent(buildMarkerHtml(identity.beast_type, identity.nickname, true))
      map.add(marker)
      myMarkerRef.current = marker
    }
    if (!hasPannedRef.current) {
      hasPannedRef.current = true
      map.setZoomAndCenter(17, [lng, lat])
    }
  }

  const startWatching = () => {
    if (!('geolocation' in navigator)) {
      setLocStatus('failed')
      return
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const gcj02 = wgs84ToGcj02(position.coords.longitude, position.coords.latitude)
        const firstFix = !myPosRef.current
        myPosRef.current = gcj02
        setLocStatus('ok')
        updateMyMarker(gcj02.lng, gcj02.lat)
        // 拿到首个定位后立即同步一次，不用等心跳
        if (firstFix) syncPresence()
      },
      (error) => {
        console.warn('HideSeek watch error:', error.code, error.message)
        if (!myPosRef.current) setLocStatus('failed')
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 },
    )
  }

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container || initializedRef.current) return
    initializedRef.current = true

    const env = (window as any).__ENV__ || {}
    const amapKey = env.AMAP_WEB_KEY || process.env.AMAP_WEB_KEY || '320106c641e5603dcde8b521a58ee0c0'
    const securityJsCode = env.AMAP_SECRET_KEY || process.env.AMAP_SECRET_KEY || ''
    if (securityJsCode) {
      ;(window as any)._AMapSecurityConfig = { securityJsCode }
    }

    AMapLoader.load({
      key: amapKey,
      version: '2.0',
      plugins: [],
    })
      .then(async (AMap: any) => {
        // 页面转场动画期间容器尺寸为 0，此时建图会得到 0×0 画布且 complete 永不触发，
        // 先等容器有实际尺寸再初始化地图
        await new Promise<void>((resolve) => {
          let tries = 0
          const check = () => {
            if ((container.offsetWidth > 0 && container.offsetHeight > 0) || tries >= 50) {
              resolve()
            } else {
              tries += 1
              setTimeout(check, 100)
            }
          }
          check()
        })
        if (!initializedRef.current) return // 等待期间页面已卸载

        const map = new AMap.Map(container, {
          zoom: mapConfig.zoom,
          center: mapConfig.center,
          resizeEnable: true,
        })
        mapRef.current = map

        let readyFired = false
        const onReady = () => {
          if (readyFired || !initializedRef.current) return
          readyFired = true
          setMapReady(true)
          startWatching()
          // 先展示一次已有玩家（自己的位置到达后会再同步）
          syncPresence()
          // 每分钟心跳：上报自己 + 刷新他人
          syncTimerRef.current = window.setInterval(syncPresence, SYNC_INTERVAL)
        }
        map.on('complete', onReady)
        // 兜底：complete 偶发不触发时，3 秒后校正尺寸并强制就绪
        window.setTimeout(() => {
          if (mapRef.current === map) {
            try { map.resize() } catch { /* ignore */ }
            onReady()
          }
        }, 3000)
      })
      .catch((error: any) => {
        console.error('HideSeek AMap load error:', error)
        setMapError('地图加载失败，请检查网络后重试')
      })

    // 下次刷新倒计时
    tickTimerRef.current = window.setInterval(() => {
      if (lastSyncRef.current) {
        const remain = Math.max(0, Math.ceil((SYNC_INTERVAL - (Date.now() - lastSyncRef.current)) / 1000))
        setNextSyncIn(remain)
      }
    }, 1000)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current)
        syncTimerRef.current = null
      }
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current)
        tickTimerRef.current = null
      }
      // 退场：从共享位置表移除自己
      api.hideSeek.removePresence(userKeyRef.current)
      try {
        otherMarkersRef.current.clear()
        myMarkerRef.current = null
        if (mapRef.current) {
          mapRef.current.destroy()
          mapRef.current = null
        }
      } catch (e) {
        console.warn('HideSeek map cleanup error:', e)
      }
      initializedRef.current = false
    }
  }, [])

  const handleBack = () => {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/index/index' }),
    })
  }

  const handleRefresh = () => {
    syncPresence()
    Taro.showToast({ title: '已刷新', icon: 'none', duration: 800 })
  }

  return (
    <View className="hide-seek-page">
      <View className="hs-header">
        <Text className="hs-back-btn" onClick={handleBack}>←</Text>
        <Text className="hs-title">脊兽躲猫猫</Text>
        <Text className="hs-refresh-btn" onClick={handleRefresh}>⟳</Text>
      </View>

      <View className="hs-map-wrapper">
        <div ref={mapContainerRef} className="hs-map-container" />
        {!mapReady && !mapError && (
          <View className="hs-map-tip">🗺️ 加载地图中...</View>
        )}
        {mapError && (
          <View className="hs-map-tip error">{mapError}</View>
        )}
        {mapReady && locStatus === 'locating' && (
          <View className="hs-loc-tip">📍 正在获取你的位置...</View>
        )}
        {mapReady && locStatus === 'failed' && (
          <View className="hs-loc-tip error">⚠️ 定位失败，其他玩家看不到你</View>
        )}
      </View>

      <View className="hs-status-bar">
        <View className="hs-status-item">
          <Text className="hs-status-value">{onlineCount}</Text>
          <Text className="hs-status-label">在线玩家</Text>
        </View>
        <View className="hs-status-item">
          <Text className="hs-status-value">{nextSyncIn}s</Text>
          <Text className="hs-status-label">下次位置更新</Text>
        </View>
      </View>

      <View className="hs-hint-card">
        <Text className="hs-hint-title">🙈 玩法说明</Text>
        <Text className="hs-hint-text">进入本页即开始共享位置，地图上会显示此刻同样在玩的伙伴——每人以自己的脊兽小图标出现（未做脊兽测试则显示 🐾）。位置每 1 分钟更新一次，离开页面即停止共享。</Text>
      </View>
    </View>
  )
}

export default HideSeek
