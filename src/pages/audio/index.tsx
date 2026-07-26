import React, { useState, useEffect, useRef, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import { AudioMarker } from '@/types'
import { haversineDistance, wgs84ToGcj02 } from '@/utils'
import marketAudioSrc from '@/assets/audio/danni-song.m4a'
import chimneyAudioSrc from '@/assets/audio/longze-chimney.mp3'
import pondAudioSrc from '@/assets/audio/xingyu-pond.m4a'
import bedroomAudioSrc from '@/assets/audio/fifi-Jasmine1.m4a'
import './index.scss'

// 校准点名称 → 官方音频路径
const zoneAudioMap: Record<string, string> = {
  '卧室': bedroomAudioSrc,
  '市集': marketAudioSrc,
  '烟囱': chimneyAudioSrc,
  '水池': pondAudioSrc,
}

// 官方音频显示名
const officialAudioNames: Record<string, string> = {
  '卧室': '卧室絮语',
  '市集': '市集喧声',
  '烟囱': '烟囱回响',
  '水池': '水池涟漪',
}

// 每个区域的气泡底色
const zoneColors: Record<string, string> = {
  '卧室': '#764ba2',
  '市集': '#f5a623',
  '烟囱': '#e2574c',
  '水池': '#4a90d9',
}

// 颜色变亮
const lightenColor = (hex: string, amount: number): string => {
  const h = hex.replace('#', '')
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + amount)
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + amount)
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + amount)
  return `rgb(${r},${g},${b})`
}

interface Bubble {
  id: string
  name: string
  url: string
  color: string
  isUser: boolean
  nickname?: string
  size: number
  left: number
  top: number
  delay: number
}

const MAX_DURATION = 60

// 音频触发距离（米），与地图触发圈半径保持一致
const TRIGGER_DISTANCE = 20

const AudioGarden: React.FC = () => {
  const { triggeredAudioPoints, user, currentPosition } = useUserStore()
  const [markers, setMarkers] = useState<AudioMarker[]>([])
  const [burstIds, setBurstIds] = useState<string[]>([])
  const [poppedIds, setPoppedIds] = useState<string[]>([])

  // 播放状态
  const [playingName, setPlayingName] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioElRef = useRef<HTMLAudioElement | null>(null)

  // 留下声音面板
  const [showLeavePanel, setShowLeavePanel] = useState(false)
  const [leaveStep, setLeaveStep] = useState<'choose' | 'recording' | 'confirm'>('choose')
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [pendingDuration, setPendingDuration] = useState(0)
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [audioName, setAudioName] = useState('')
  const [uploading, setUploading] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const points = triggeredAudioPoints || []

  // 直接进入花园页时地图可能尚未提供定位，主动获取一次用于触发判定（转 GCJ02 与地图同源）
  const [fallbackPos, setFallbackPos] = useState<{ lng: number; lat: number } | null>(null)
  useEffect(() => {
    if (currentPosition) return
    let cancelled = false
    getLocation().then((loc) => {
      if (loc && !cancelled) {
        setFallbackPos(wgs84ToGcj02(loc.lng, loc.lat))
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 当前用于触发判定的位置（优先地图实时位置）
  const triggerPos = currentPosition || fallbackPos

  // 音频与上传坐标绑定：仅当前位置进入触发距离内的用户音频才可见可播放
  const visibleMarkers = triggerPos
    ? markers.filter((m) => {
        if (!m.coordinate || typeof m.coordinate.lng !== 'number' || typeof m.coordinate.lat !== 'number') return false
        // 标记存的是原始 WGS84 坐标，转 GCJ02 后与当前位置比距离
        const gcj = wgs84ToGcj02(m.coordinate.lng, m.coordinate.lat)
        return haversineDistance(triggerPos.lat, triggerPos.lng, gcj.lat, gcj.lng) <= TRIGGER_DISTANCE
      })
    : []

  // 加载全部用户声音标记（自由上传的标记 zone_name 为空，不能按触发点查询）
  const loadMarkers = useCallback(async () => {
    try {
      const results = await api.audio.getAllMarkers()
      setMarkers(results)
    } catch (e) {
      console.warn('加载声音标记失败:', e)
    }
  }, [])

  useEffect(() => {
    loadMarkers()
  }, [loadMarkers])

  // 清理音频
  useEffect(() => {
    return () => {
      if (audioElRef.current) {
        audioElRef.current.pause()
        audioElRef.current = null
      }
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  // 地图预览：当 gps 变化时，在预览容器中创建 OpenStreetMap iframe
  useEffect(() => {
    if (!gps) return
    const container = document.getElementById('ag-map-preview')
    if (!container) return

    // 清除旧内容
    container.innerHTML = ''

    const delta = 0.003 // ~300m 范围
    const bbox = `${gps.lng - delta},${gps.lat - delta},${gps.lng + delta},${gps.lat + delta}`
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${gps.lat},${gps.lng}`

    const iframe = document.createElement('iframe')
    iframe.src = src
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.style.borderRadius = '12px'
    iframe.loading = 'lazy'
    container.appendChild(iframe)
  }, [gps])

  // 构建气泡列表（官方音频 + 用户录音）
  const buildBubbles = (): Bubble[] => {
    const list: Bubble[] = []
    points.forEach((pointName) => {
      const color = zoneColors[pointName] || '#667eea'
      // 官方音频气泡
      const officialUrl = zoneAudioMap[pointName]
      if (officialUrl) {
        list.push({
          id: `official-${pointName}`,
          name: officialAudioNames[pointName] || pointName,
          url: officialUrl,
          color,
          isUser: false,
          size: 60 + Math.round(Math.random() * 40),
          left: 8 + Math.random() * 70,
          top: 8 + Math.random() * 55,
          delay: Math.random() * 2,
        })
      }
    })
    // 用户录音气泡：仅展示当前位置可触发（距离内）的音频
    visibleMarkers.forEach((m) => {
      list.push({
        id: m.id,
        name: m.audio_name,
        url: m.audio_url,
        color: zoneColors[m.zone_name] || '#667eea',
        isUser: true,
        nickname: m.user_nickname,
        size: 60 + Math.round(Math.random() * 40),
        left: 8 + Math.random() * 70,
        top: 8 + Math.random() * 55,
        delay: Math.random() * 2,
      })
    })
    return list.filter(b => !poppedIds.includes(b.id))
  }

  const bubblesRef = useRef<Bubble[]>([])
  // 仅在依赖变化时重建气泡布局，避免每次渲染随机跳动
  const bubblesKey = `${points.join(',')}|${visibleMarkers.map(m => m.id).join(',')}|${poppedIds.join(',')}`
  const lastKeyRef = useRef('')
  if (lastKeyRef.current !== bubblesKey) {
    bubblesRef.current = buildBubbles()
    lastKeyRef.current = bubblesKey
  }
  const bubbles = bubblesRef.current

  const playAudio = (url: string, name: string) => {
    if (audioElRef.current) {
      audioElRef.current.pause()
    }
    const audio = new Audio(url)
    audioElRef.current = audio
    setPlayingName(name)
    setIsPaused(false)
    setProgress(0)
    audio.ontimeupdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration)
    }
    audio.onended = () => {
      setPlayingName(null)
      setProgress(0)
    }
    audio.play().catch(err => {
      console.warn('播放失败:', err)
      Taro.showToast({ title: '播放失败', icon: 'none' })
    })
  }

  const handleBubbleClick = (bubble: Bubble) => {
    // 破裂动画
    setBurstIds(prev => [...prev, bubble.id])
    playAudio(bubble.url, bubble.name)
    setTimeout(() => {
      setPoppedIds(prev => [...prev, bubble.id])
      setBurstIds(prev => prev.filter(id => id !== bubble.id))
    }, 550)
  }

  const handlePauseResume = () => {
    const audio = audioElRef.current
    if (!audio) return
    if (isPaused) {
      audio.play()
      setIsPaused(false)
    } else {
      audio.pause()
      setIsPaused(true)
    }
  }

  const handleStop = () => {
    const audio = audioElRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setPlayingName(null)
    setIsPaused(false)
    setProgress(0)
    // 停止后已破裂的气泡重新出现
    setPoppedIds([])
  }

  // ===== 留下声音 =====
  // 任何位置都可以上传，不再限制在特定音频触发区域内
  const openLeavePanel = () => {
    setShowLeavePanel(true)
    setLeaveStep('choose')
    setPendingBlob(null)
    setPendingDuration(0)
    setGps(null)
    setAudioName('')
  }

  const closeLeavePanel = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    setShowLeavePanel(false)
  }

  // 录音兼容性预检
  const checkRecordingSupport = (): { supported: boolean; message?: string } => {
    if (!window.isSecureContext) {
      return { supported: false, message: '需要 HTTPS 安全连接才能录音，请通过 HTTPS 访问本页' }
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { supported: false, message: '当前浏览器不支持录音功能' }
    }
    if (typeof window.MediaRecorder === 'undefined') {
      return { supported: false, message: '当前浏览器不支持 MediaRecorder，请尝试使用 Chrome 或 Safari 14.3+' }
    }
    return { supported: true }
  }

  const startRecording = async () => {
    // 兼容性预检
    const check = checkRecordingSupport()
    if (!check.supported) {
      Taro.showToast({ title: check.message || '不支持录音', icon: 'none', duration: 3000 })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recordChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' })
        setPendingBlob(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setLeaveStep('recording')
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds(prev => {
          if (prev + 1 >= MAX_DURATION) {
            stopRecording()
            return MAX_DURATION
          }
          return prev + 1
        })
      }, 1000)
    } catch (err: any) {
      console.warn('录音失败:', err)
      const name = err?.name || ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        Taro.showToast({ title: '录音权限被拒绝，请在浏览器设置中允许麦克风访问', icon: 'none', duration: 3000 })
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        Taro.showToast({ title: '未找到麦克风设备', icon: 'none', duration: 3000 })
      } else if (name === 'NotReadableError') {
        Taro.showToast({ title: '麦克风被其他应用占用，请关闭后重试', icon: 'none', duration: 3000 })
      } else {
        Taro.showToast({ title: `录音失败：${err?.message || '未知错误'}`, icon: 'none', duration: 3000 })
      }
    }
  }

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setPendingDuration(recordSeconds || 1)
    proceedToConfirm()
  }

  const handleChooseFile = () => {
    fileInputRef.current?.click()
  }

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const tmp = new Audio(url)
    tmp.onloadedmetadata = () => {
      if (tmp.duration > MAX_DURATION) {
        Taro.showToast({ title: '音频不能超过 60 秒', icon: 'none' })
        URL.revokeObjectURL(url)
        return
      }
      setPendingBlob(file)
      setPendingDuration(Math.round(tmp.duration))
      URL.revokeObjectURL(url)
      proceedToConfirm()
    }
  }

  // IP 定位兜底（不依赖 GPS/HTTPS，通过 IP 地址获取大致位置）
  const getIpLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return null
      const data = await res.json()
      if (data.latitude && data.longitude) {
        return { lat: data.latitude, lng: data.longitude }
      }
      return null
    } catch (e) {
      console.warn('IP定位失败:', e)
      return null
    }
  }

  // 获取定位（带重试 + IP 兜底）
  const getLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        // 浏览器不支持，直接用 IP 定位
        getIpLocation().then(resolve)
        return
      }

      let attempt = 0
      const tryGet = () => {
        attempt++
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          async (err) => {
            console.warn(`定位失败(第${attempt}次):`, err.message, err.code)
            if (attempt < 2) {
              // 重试一次
              setTimeout(tryGet, 1000)
            } else {
              // 两次都失败，用 IP 定位兜底
              const ipLoc = await getIpLocation()
              resolve(ipLoc)
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 }
        )
      }
      tryGet()
    })
  }

  // 获取当前定位后进入确认步骤
  const proceedToConfirm = async () => {
    Taro.showLoading({ title: '获取定位中...' })
    const loc = await getLocation()
    Taro.hideLoading()
    if (loc) {
      setGps(loc)
      setLeaveStep('confirm')
    } else {
      // 所有定位方式都失败
      Taro.showToast({ title: '定位失败，请检查网络或权限后重试', icon: 'none', duration: 3000 })
      setLeaveStep('confirm')
    }
  }

  const handleUpload = async () => {
    if (!pendingBlob) return
    if (!audioName.trim()) {
      Taro.showToast({ title: '请给声音取个名字', icon: 'none' })
      return
    }
    if (!gps) {
      Taro.showToast({ title: '定位未获取，请返回重试', icon: 'none' })
      return
    }
    setUploading(true)
    try {
      const ext = pendingBlob.type.includes('webm') ? 'webm' : 'audio'
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1000)}.${ext}`
      const file = pendingBlob instanceof File
        ? pendingBlob
        : new File([pendingBlob], fileName, { type: pendingBlob.type })
      const audioUrl = await api.audio.uploadAudio(file, fileName)
      await api.audio.createMarker({
        user_id: user?.id || 'guest',
        user_nickname: user?.nickname || '访客',
        zone_name: '',
        coordinate: gps,
        audio_url: audioUrl,
        audio_name: audioName.trim(),
        duration: pendingDuration,
      })
      Taro.showToast({ title: '声音已留下', icon: 'success' })
      setShowLeavePanel(false)
      await loadMarkers()
      // 通知地图刷新声音定位标记
      Taro.eventCenter.trigger('audioMarkersUpdated')
    } catch (err) {
      console.warn('上传失败:', err)
      Taro.showToast({ title: '上传失败，请重试', icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <View className='audio-garden'>
      <View className='ag-header'>
        <View className='ag-back' onClick={() => Taro.navigateBack()}>
          <Text>‹</Text>
        </View>
        <Text className='ag-title'>声音花园</Text>
      </View>
      <View className='ag-subtitle'>
        <Text>
          {points.length > 0
            ? `附近声音：${points.join('、')}`
            : visibleMarkers.length > 0
              ? '附近有旅人留下的声音'
              : '当前位置暂无可触发的声音'}
        </Text>
      </View>

      {/* 气泡区域 */}
      <View className='ag-bubble-area'>
        {bubbles.map((b) => {
          const isBursting = burstIds.includes(b.id)
          return (
            <View
              key={b.id}
              className={`ag-bubble ${isBursting ? 'burst' : ''}`}
              style={{
                width: `${b.size}px`,
                height: `${b.size}px`,
                left: `${b.left}%`,
                top: `${b.top}%`,
                background: `radial-gradient(circle at 40% 35%, ${lightenColor(b.color, 30)}, ${b.color} 70%)`,
                animationDelay: `${b.delay}s`,
              }}
              onClick={() => handleBubbleClick(b)}
            >
              <View className='bubble-inner'>
                {b.isUser && <Text className='ag-bubble-user'>🎤</Text>}
                <Text className='ag-bubble-name'>{b.name}</Text>
                {b.isUser && <Text className='ag-bubble-nick'>{b.nickname}</Text>}
              </View>
              <View className='bubble-sheen' />
              {isBursting && (
                <>
                  <View className='burst-ring' />
                  {Array.from({ length: 10 }).map((_, i) => {
                    const angle = (i * 36) * Math.PI / 180
                    const dist = 30 + (i % 3) * 18
                    const px = Math.cos(angle) * dist
                    const py = Math.sin(angle) * dist
                    const sz = 5 + (i % 3) * 3
                    return (
                      <View
                        key={`p${i}`}
                        className='burst-particle'
                        style={{
                          width: `${sz}px`,
                          height: `${sz}px`,
                          background: b.color,
                          opacity: 0.9,
                          animationDelay: `${i * 0.02}s`,
                          '--px': `${px}px`,
                          '--py': `${py}px`,
                        } as React.CSSProperties}
                      />
                    )
                  })}
                </>
              )}
            </View>
          )
        })}
        {bubbles.length === 0 && (
          <View className='ag-empty'>
            <Text>暂无声音气泡</Text>
          </View>
        )}
      </View>

      {/* 播放控制栏 */}
      {playingName && (
        <View className='ag-player'>
          <View className='ag-player-info'>
            <Text className='ag-player-name'>🎧 {playingName}</Text>
            <View className='ag-progress'>
              <View className='ag-progress-fill' style={{ width: `${progress * 100}%` }} />
            </View>
          </View>
          <View className='ag-player-btn' onClick={handlePauseResume}>
            <Text>{isPaused ? '▶' : '⏸'}</Text>
          </View>
          <View className='ag-player-btn stop' onClick={handleStop}>
            <Text>⏹</Text>
          </View>
        </View>
      )}

      {/* 留下声音按钮 */}
      <View className='ag-leave-btn' onClick={openLeavePanel}>
        <Text>＋ 留下声音</Text>
      </View>

      {/* 隐藏的文件选择 */}
      <input
        ref={fileInputRef}
        type='file'
        accept='audio/*'
        style={{ display: 'none' }}
        onChange={onFileSelected}
      />

      {/* 留下声音面板 */}
      {showLeavePanel && (
        <View className='ag-panel-mask' onClick={closeLeavePanel}>
          <View className='ag-panel' onClick={(e) => e.stopPropagation()}>
            {leaveStep === 'choose' && (
              <View className='ag-panel-body'>
                <Text className='ag-panel-title'>留下你的声音</Text>
                <View className='ag-choice' onClick={startRecording}>
                  <Text className='ag-choice-icon'>🎙️</Text>
                  <Text>录音（最长 60 秒）</Text>
                </View>
                <View className='ag-choice' onClick={handleChooseFile}>
                  <Text className='ag-choice-icon'>📁</Text>
                  <Text>选择音频文件</Text>
                </View>
              </View>
            )}
            {leaveStep === 'recording' && (
              <View className='ag-panel-body'>
                <Text className='ag-panel-title'>录音中...</Text>
                <View className='ag-record-wave'>
                  <View className='wave-bar' />
                  <View className='wave-bar' />
                  <View className='wave-bar' />
                  <View className='wave-bar' />
                  <View className='wave-bar' />
                </View>
                <Text className='ag-record-time'>
                  {formatTime(recordSeconds)} / {formatTime(MAX_DURATION)}
                </Text>
                <View className='ag-panel-btn' onClick={stopRecording}>
                  <Text>停止录音</Text>
                </View>
              </View>
            )}
            {leaveStep === 'confirm' && (
              <View className='ag-panel-body'>
                <Text className='ag-panel-title'>在此处留下声音？</Text>
                {gps && (
                  <View className='ag-map-preview' id='ag-map-preview' />
                )}
                <Text className='ag-panel-loc'>
                  当前位置：{gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : '❌ 未获取'}
                </Text>
                {!gps && (
                  <View className='ag-panel-btn' onClick={async () => {
                    Taro.showLoading({ title: '重新定位中...' })
                    const loc = await getLocation()
                    Taro.hideLoading()
                    if (loc) {
                      setGps(loc)
                      Taro.showToast({ title: '定位成功', icon: 'success' })
                    } else {
                      Taro.showToast({ title: '定位仍失败，请检查网络/权限', icon: 'none', duration: 3000 })
                    }
                  }}>
                    <Text>🔄 重试定位</Text>
                  </View>
                )}
                <input
                  className='ag-name-input'
                  placeholder='给这段声音取个名字'
                  value={audioName}
                  onChange={(e) => setAudioName(e.target.value)}
                />
                <View
                  className={`ag-panel-btn primary ${(!gps || uploading) ? 'disabled' : ''}`}
                  onClick={handleUpload}
                >
                  <Text>{uploading ? '上传中...' : (!gps ? '需先获取定位' : '确认留下')}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}

export default AudioGarden
