import React, { useRef, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import AMapLoader from '@amap/amap-jsapi-loader'
import { BEAST_PROFILES } from '@/data/ridgeBeasts'
import { ALL_BEASTS, BEAST_LIKES, beastLikes, beastDislikes } from '@/data/beastRelations'
import { HideSeekPresence, HideSeekDuel } from '@/types'
import { api } from '@/services/api'
import { wgs84ToGcj02 } from '@/utils'
import { mapConfig } from '@/config/map'
import './index.scss'

const SYNC_INTERVAL = 60 * 1000 // 位置每 1 分钟同步一次
const DUEL_POLL_INTERVAL = 10 * 1000 // 对决事件每 10 秒轮询一次
const DUEL_WINDOW = 10 * 60 * 1000 // 10 分钟内必须被喜欢的脊兽续命
const DISGUISE_DURATION = 5 * 60 * 1000 // 变身咒语持续 5 分钟

const USER_KEY_STORAGE = 'hide_seek_user_key'
const IDENTITY_STORAGE = 'hide_seek_identity'
const NICKNAME_STORAGE = 'hide_seek_nickname'
const GAMEOVER_STORAGE = 'hide_seek_gameover'
const DEADLINE_STORAGE = 'hide_seek_duel_deadline'
const DISGUISE_STORAGE = 'hide_seek_disguise'
const DUEL_SINCE_STORAGE = 'hide_seek_duel_since'
const USED_SPELLS_STORAGE = 'hide_seek_used_spells'

const EPOCH_ISO = '1970-01-01T00:00:00.000Z'
// 状态标记行（借对决表广播自己的出局/复活，供对手判断「尚未出局」）
const STATUS_OUT = 'OUT'
const STATUS_REVIVE = 'REVIVE'

// 身份咒语 → 身份脊兽
const IDENTITY_MAP: Record<string, string> = {
  雅梦: '凤',
  嘉俊: '天马',
}
const DISGUISE_SPELL = '飞龙在天' // 变身咒语 → 龙
const REVIVE_SPELL = 'wjj' // 复活咒语

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

const formatMmSs = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

const HideSeek: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const initializedRef = useRef(false)
  const watchIdRef = useRef<number | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const syncTimerRef = useRef<number | null>(null)
  const tickTimerRef = useRef<number | null>(null)
  const duelPollTimerRef = useRef<number | null>(null)
  const myPosRef = useRef<{ lng: number; lat: number } | null>(null)
  const myMarkerRef = useRef<any>(null)
  const otherMarkersRef = useRef<Map<string, any>>(new Map())
  const hasPannedRef = useRef(false)
  const lastSyncRef = useRef<number>(0)
  const userKeyRef = useRef<string>(getUserKey())
  const mapReadyRef = useRef(false)

  // 游戏状态（ref 供定时器读取，state 供渲染）
  const identityRef = useRef<string>('')
  const nicknameRef = useRef<string>('')
  const gameOverRef = useRef<string>('')
  const disguiseRef = useRef<{ beast: string; expires: number } | null>(null)
  const deadlineRef = useRef<number>(0)
  const duelSinceRef = useRef<string>('')
  const duelPollingRef = useRef(false)
  // 已使用过的咒语（变身 / 对决中念过的身份咒语，均只能用一次）
  const usedSpellsRef = useRef<{ disguise: string[]; duel: string[] }>({ disguise: [], duel: [] })

  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [nextSyncIn, setNextSyncIn] = useState(60)
  const [locStatus, setLocStatus] = useState<'locating' | 'ok' | 'failed'>('locating')
  const [identity, setIdentity] = useState('')
  const [nickname, setNickname] = useState('')
  const [gameOver, setGameOver] = useState('') // '' | 'attack' | 'timeout'
  const [duelLeftMs, setDuelLeftMs] = useState(DUEL_WINDOW)
  const [disguiseLeftMs, setDisguiseLeftMs] = useState(0)
  const [activeModal, setActiveModal] = useState('') // '' | 'relations' | 'spell' | 'duel' | 'identity'
  const [gateInput, setGateInput] = useState('')
  const [gateNickInput, setGateNickInput] = useState('')
  const [spellInput, setSpellInput] = useState('')
  const [duelInput, setDuelInput] = useState('')
  const [reviveInput, setReviveInput] = useState('')

  // ===== 身份与脊兽 =====

  // 身份脊兽（凤 / 天马）
  const identityBeast = () => IDENTITY_MAP[identityRef.current] || ''

  // 当前对外展示的脊兽（变身期间为龙）
  const currentBeast = () => {
    const d = disguiseRef.current
    if (d && d.expires > Date.now()) return d.beast
    return identityBeast()
  }

  // 地图与广播只露昵称，身份咒语保密
  const getIdentityInfo = () => ({
    nickname: nicknameRef.current || '神秘访客',
    beast_type: currentBeast(),
  })

  // ===== 位置同步（保留原策略）=====

  const syncPresence = async () => {
    if (!identityRef.current || gameOverRef.current) return
    lastSyncRef.current = Date.now()
    const pos = myPosRef.current
    const info = getIdentityInfo()

    if (pos) {
      await api.hideSeek.upsertPresence({
        user_key: userKeyRef.current,
        nickname: info.nickname,
        beast_type: info.beast_type,
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
    otherMarkersRef.current.forEach((marker, key) => {
      if (!alive.has(key)) {
        map.remove(marker)
        otherMarkersRef.current.delete(key)
      }
    })
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

  const refreshMyMarkerContent = () => {
    if (myMarkerRef.current) {
      const info = getIdentityInfo()
      myMarkerRef.current.setContent(buildMarkerHtml(info.beast_type, info.nickname, true))
    }
  }

  const updateMyMarker = (lng: number, lat: number) => {
    const map = mapRef.current
    const AMap = (window as any).AMap
    if (!map || !AMap) return
    const info = getIdentityInfo()
    if (myMarkerRef.current) {
      myMarkerRef.current.setPosition([lng, lat])
    } else {
      const marker = new AMap.Marker({
        position: [lng, lat],
        anchor: 'top-center',
        zIndex: 1000,
      })
      marker.setContent(buildMarkerHtml(info.beast_type, info.nickname, true))
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
    // 位置到达统一处理（watch 与保底轮询共用）
    const onFix = (position: GeolocationPosition) => {
      const gcj02 = wgs84ToGcj02(position.coords.longitude, position.coords.latitude)
      const firstFix = !myPosRef.current
      myPosRef.current = gcj02
      setLocStatus('ok')
      updateMyMarker(gcj02.lng, gcj02.lat)
      if (firstFix) syncPresence()
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      onFix,
      (error) => {
        console.warn('HideSeek watch error:', error.code, error.message)
        if (!myPosRef.current) setLocStatus('failed')
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 },
    )

    // 低精度保底轮询：本项目环境下高精度定位在室内/弱 GPS 时会直接失败，
    // WiFi/基站网络定位才是可靠保底（与首页地图同策略）
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        onFix,
        () => { /* 静默失败，交给下一轮 */ },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
      )
    }, 5000)
  }

  // ===== 对决核心 =====

  const saveDeadline = (ts: number) => {
    deadlineRef.current = ts
    try { Taro.setStorageSync(DEADLINE_STORAGE, ts) } catch { /* ignore */ }
  }

  const saveDuelSince = (iso: string) => {
    duelSinceRef.current = iso
    try { Taro.setStorageSync(DUEL_SINCE_STORAGE, iso) } catch { /* ignore */ }
  }

  const markSpellUsed = (kind: 'disguise' | 'duel', value: string) => {
    const used = usedSpellsRef.current
    if (!used[kind].includes(value)) used[kind].push(value)
    try { Taro.setStorageSync(USED_SPELLS_STORAGE, used) } catch { /* ignore */ }
  }

  // 广播自己的出局/复活状态（落到对决表，target_spell 为自己的身份咒语）
  const broadcastStatus = (status: string) => {
    if (!identityRef.current) return
    api.hideSeek.sendDuel({
      attacker_key: userKeyRef.current,
      attacker_name: nicknameRef.current,
      attacker_beast: status,
      target_spell: identityRef.current,
    })
  }

  const triggerGameOver = (reason: 'attack' | 'timeout') => {
    if (gameOverRef.current) return
    gameOverRef.current = reason
    setGameOver(reason)
    try { Taro.setStorageSync(GAMEOVER_STORAGE, reason) } catch { /* ignore */ }
    broadcastStatus(STATUS_OUT)
    // 停止共享：移除自己在地图和服务端的存在
    api.hideSeek.removePresence(userKeyRef.current)
    if (myMarkerRef.current && mapRef.current) {
      try { mapRef.current.remove(myMarkerRef.current) } catch { /* ignore */ }
      myMarkerRef.current = null
    }
  }

  // 轮询针对我的对决事件
  const pollDuels = async () => {
    if (!identityRef.current || gameOverRef.current || duelPollingRef.current) return
    duelPollingRef.current = true
    try {
      const duels = await api.hideSeek.getDuelsForTarget(identityRef.current, duelSinceRef.current)
      for (const d of duels) {
        if (d.attacker_key === userKeyRef.current) {
          saveDuelSince(d.created_at)
          continue
        }
        saveDuelSince(d.created_at)
        // 跳过状态标记等非脊兽行
        if (!BEAST_LIKES[d.attacker_beast]) continue
        if (beastLikes(d.attacker_beast, identityBeast())) {
          // 喜欢我的脊兽点名 → 续命，重置 10 分钟
          saveDeadline(Date.now() + DUEL_WINDOW)
          Taro.showToast({ title: `${d.attacker_beast}为你续命 +10 分钟`, icon: 'none', duration: 2500 })
        } else {
          // 不喜欢我的脊兽点名 → game over
          triggerGameOver('attack')
          break
        }
      }
    } finally {
      duelPollingRef.current = false
    }
  }

  const startGameLoops = () => {
    // 首次进入：初始化 10 分钟窗口和对决事件游标
    if (!deadlineRef.current) {
      saveDeadline(Date.now() + DUEL_WINDOW)
    }
    if (!duelSinceRef.current) {
      saveDuelSince(new Date().toISOString())
    }
    // 离开期间超时 → 直接 game over
    if (deadlineRef.current <= Date.now()) {
      triggerGameOver('timeout')
      return
    }
    syncPresence()
    if (syncTimerRef.current) clearInterval(syncTimerRef.current)
    syncTimerRef.current = window.setInterval(syncPresence, SYNC_INTERVAL)
    pollDuels()
    if (duelPollTimerRef.current) clearInterval(duelPollTimerRef.current)
    duelPollTimerRef.current = window.setInterval(pollDuels, DUEL_POLL_INTERVAL)
  }

  // ===== 交互 =====

  const handleGateConfirm = () => {
    const nick = gateNickInput.trim()
    const input = gateInput.trim()
    if (!nick) {
      Taro.showToast({ title: '请先起个昵称', icon: 'none' })
      return
    }
    if (!IDENTITY_MAP[input]) {
      Taro.showToast({ title: '身份咒语不对', icon: 'none' })
      return
    }
    nicknameRef.current = nick
    setNickname(nick)
    identityRef.current = input
    setIdentity(input)
    // 新入局清掉可能残留的 gameover 状态，避免入局即死
    gameOverRef.current = ''
    setGameOver('')
    try {
      Taro.setStorageSync(IDENTITY_STORAGE, input)
      Taro.setStorageSync(NICKNAME_STORAGE, nick)
      Taro.setStorageSync(GAMEOVER_STORAGE, '')
    } catch { /* ignore */ }
    saveDeadline(Date.now() + DUEL_WINDOW)
    saveDuelSince(new Date().toISOString())
    broadcastStatus(STATUS_REVIVE) // 新入局向对手声明自己在场
    setGateInput('')
    setGateNickInput('')
    refreshMyMarkerContent()
    if (mapReadyRef.current) startGameLoops()
  }

  const handleSpellConfirm = () => {
    const input = spellInput.trim()
    setSpellInput('')
    setActiveModal('')
    if (input !== DISGUISE_SPELL) {
      Taro.showToast({ title: '咒语没有生效…', icon: 'none' })
      return
    }
    // 变身咒语只能用一次
    if (usedSpellsRef.current.disguise.includes(input)) {
      Taro.showToast({ title: '这个咒语已用过，失去效力了', icon: 'none', duration: 2000 })
      return
    }
    markSpellUsed('disguise', input)
    const disguise = { beast: '龙', expires: Date.now() + DISGUISE_DURATION }
    disguiseRef.current = disguise
    try { Taro.setStorageSync(DISGUISE_STORAGE, disguise) } catch { /* ignore */ }
    setDisguiseLeftMs(DISGUISE_DURATION)
    refreshMyMarkerContent()
    syncPresence() // 立即广播，让其他人看到我变成龙
    Taro.showToast({ title: '🐉 飞龙在天！变身 5 分钟', icon: 'none', duration: 2500 })
  }

  const handleDuelConfirm = async () => {
    const input = duelInput.trim()
    if (!IDENTITY_MAP[input]) {
      Taro.showToast({ title: '这不是有效的身份咒语', icon: 'none' })
      return
    }
    if (input === identityRef.current) {
      Taro.showToast({ title: '不能对自己发起对决', icon: 'none' })
      return
    }
    // 对决中念过的身份咒语只能用一次
    if (usedSpellsRef.current.duel.includes(input)) {
      Taro.showToast({ title: '这个身份咒语你已经念过了', icon: 'none', duration: 2000 })
      return
    }
    setDuelInput('')
    setActiveModal('')
    // 扫描对方的状态标记，判断对方是否尚未出局
    const history = await api.hideSeek.getDuelsForTarget(input, EPOCH_ISO)
    let targetAlive = true
    history.forEach((d) => {
      if (d.attacker_beast === STATUS_OUT) targetAlive = false
      else if (d.attacker_beast === STATUS_REVIVE) targetAlive = true
    })
    // 对决判定用真实身份脊兽，变身咒语只是形象伪装
    const ok = await api.hideSeek.sendDuel({
      attacker_key: userKeyRef.current,
      attacker_name: nicknameRef.current,
      attacker_beast: identityBeast(),
      target_spell: input,
    })
    if (!ok) {
      Taro.showToast({ title: '发送失败，请重试', icon: 'none', duration: 2000 })
      return
    }
    markSpellUsed('duel', input)
    const targetBeast = IDENTITY_MAP[input]
    if (!beastLikes(identityBeast(), targetBeast)) {
      // 击中自己不喜欢的脊兽：对方出局，若对方尚在场则为自己续命
      if (targetAlive) {
        saveDeadline(Date.now() + DUEL_WINDOW)
        Taro.showToast({ title: `击中「${input}」！为自己续命 +10 分钟`, icon: 'none', duration: 2500 })
      } else {
        Taro.showToast({ title: `「${input}」已出局，无法为自己续命`, icon: 'none', duration: 2500 })
      }
    } else {
      Taro.showToast({ title: `已为「${input}」续命`, icon: 'none', duration: 2000 })
    }
  }

  const handleRevive = () => {
    if (reviveInput.trim() !== REVIVE_SPELL) {
      Taro.showToast({ title: '复活咒语不对', icon: 'none' })
      return
    }
    setReviveInput('')
    gameOverRef.current = ''
    setGameOver('')
    try { Taro.setStorageSync(GAMEOVER_STORAGE, '') } catch { /* ignore */ }
    // 忽略死亡期间的旧对决事件，重开 10 分钟窗口
    saveDuelSince(new Date().toISOString())
    saveDeadline(Date.now() + DUEL_WINDOW)
    broadcastStatus(STATUS_REVIVE) // 向对手声明自己已复活
    Taro.showToast({ title: '✨ 复活成功，继续游戏！', icon: 'none', duration: 2000 })
    if (mapReadyRef.current) startGameLoops()
  }

  const handleBack = () => {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/index/index' }),
    })
  }

  const handleRefresh = () => {
    syncPresence()
    pollDuels()
    Taro.showToast({ title: '已刷新', icon: 'none', duration: 800 })
  }

  // ===== 生命周期 =====

  useEffect(() => {
    // 恢复持久化的游戏状态
    try {
      const savedIdentity = Taro.getStorageSync(IDENTITY_STORAGE)
      const savedNickname = Taro.getStorageSync(NICKNAME_STORAGE)
      // 昵称与身份必须成对，缺一不可则重新走门禁
      if (savedIdentity && IDENTITY_MAP[savedIdentity] && savedNickname) {
        identityRef.current = savedIdentity
        setIdentity(savedIdentity)
        nicknameRef.current = savedNickname
        setNickname(savedNickname)
      }
      const savedGameOver = Taro.getStorageSync(GAMEOVER_STORAGE)
      if (savedGameOver) {
        gameOverRef.current = savedGameOver
        setGameOver(savedGameOver)
      }
      const savedDeadline = Taro.getStorageSync(DEADLINE_STORAGE)
      if (savedDeadline) deadlineRef.current = Number(savedDeadline)
      const savedDisguise = Taro.getStorageSync(DISGUISE_STORAGE)
      if (savedDisguise && savedDisguise.expires > Date.now()) {
        disguiseRef.current = savedDisguise
        setDisguiseLeftMs(savedDisguise.expires - Date.now())
      }
      const savedSince = Taro.getStorageSync(DUEL_SINCE_STORAGE)
      if (savedSince) duelSinceRef.current = savedSince
      const savedUsed = Taro.getStorageSync(USED_SPELLS_STORAGE)
      if (savedUsed && savedUsed.disguise && savedUsed.duel) usedSpellsRef.current = savedUsed
    } catch { /* ignore */ }

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
          mapReadyRef.current = true
          setMapReady(true)
          startWatching()
          if (identityRef.current && !gameOverRef.current) {
            startGameLoops()
          }
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

    // 1 秒节拍：刷新倒计时 / 变身过期 / 超时判定
    tickTimerRef.current = window.setInterval(() => {
      if (lastSyncRef.current) {
        const remain = Math.max(0, Math.ceil((SYNC_INTERVAL - (Date.now() - lastSyncRef.current)) / 1000))
        setNextSyncIn(remain)
      }
      // 变身过期 → 恢复本相并广播
      const d = disguiseRef.current
      if (d) {
        const left = d.expires - Date.now()
        if (left <= 0) {
          disguiseRef.current = null
          try { Taro.setStorageSync(DISGUISE_STORAGE, '') } catch { /* ignore */ }
          setDisguiseLeftMs(0)
          refreshMyMarkerContent()
          syncPresence()
          Taro.showToast({ title: '咒语失效，恢复本相', icon: 'none' })
        } else {
          setDisguiseLeftMs(left)
        }
      }
      // 对决窗口倒计时
      if (identityRef.current && !gameOverRef.current && deadlineRef.current) {
        const left = deadlineRef.current - Date.now()
        setDuelLeftMs(left)
        if (left <= 0) {
          triggerGameOver('timeout')
        }
      }
    }, 1000)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current)
        syncTimerRef.current = null
      }
      if (duelPollTimerRef.current) {
        clearInterval(duelPollTimerRef.current)
        duelPollTimerRef.current = null
      }
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current)
        tickTimerRef.current = null
      }
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
      mapReadyRef.current = false
      initializedRef.current = false
    }
  }, [])

  // ===== 渲染 =====

  const myBeast = currentBeast()
  const myBeastProfile = myBeast ? BEAST_PROFILES[myBeast] : null

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

      {identity && (
        <View className="hs-identity-bar">
          <Text className="hs-identity-name">
            {myBeastProfile ? myBeastProfile.emoji : '🐾'} {nickname} · {myBeast}
          </Text>
          {disguiseLeftMs > 0 && (
            <Text className="hs-disguise-tag">变身 {formatMmSs(disguiseLeftMs)}</Text>
          )}
        </View>
      )}

      <View className="hs-status-bar">
        <View className="hs-status-item">
          <Text className="hs-status-value">{onlineCount}</Text>
          <Text className="hs-status-label">在线玩家</Text>
        </View>
        <View className="hs-status-item">
          <Text className="hs-status-value">{nextSyncIn}s</Text>
          <Text className="hs-status-label">位置更新</Text>
        </View>
        <View className={`hs-status-item ${duelLeftMs < 60 * 1000 ? 'danger' : ''}`}>
          <Text className="hs-status-value">{identity ? formatMmSs(duelLeftMs) : '--'}</Text>
          <Text className="hs-status-label">对决倒计时</Text>
        </View>
      </View>

      <View className="hs-action-bar">
        <View className="hs-action-btn" onClick={() => setActiveModal('relations')}>
          <Text>💞 关系</Text>
        </View>
        <View className="hs-action-btn" onClick={() => setActiveModal('spell')}>
          <Text>✨ 咒语</Text>
        </View>
        <View className="hs-action-btn" onClick={() => setActiveModal('identity')}>
          <Text>🔑 身份咒语</Text>
        </View>
        <View className="hs-action-btn primary" onClick={() => setActiveModal('duel')}>
          <Text>⚔️ 对决</Text>
        </View>
      </View>

      <View className="hs-hint-card">
        <Text className="hs-hint-title">🙈 玩法说明</Text>
        <Text className="hs-hint-text">凭身份咒语入局，地图上以脊兽真身现形，位置每 1 分钟更新。每 10 分钟内必须有「喜欢你的脊兽」在对决中念出你的身份咒语为你续命；若被「不喜欢你的脊兽」点名，立即出局。念动变身咒语可幻化他兽 5 分钟，瞒天过海。</Text>
      </View>

      {/* 身份咒语门禁 */}
      {!identity && (
        <View className="hs-overlay">
          <View className="hs-modal">
            <Text className="hs-modal-title">🏯 报上名号与身份咒语</Text>
            <Text className="hs-modal-desc">昵称会显示在地图上，身份咒语则要好好保密</Text>
            <Input
              className="hs-modal-input"
              value={gateNickInput}
              placeholder="起个昵称（地图上展示）…"
              onInput={(e) => setGateNickInput(e.detail.value)}
            />
            <Input
              className="hs-modal-input"
              value={gateInput}
              placeholder="输入身份咒语…"
              onInput={(e) => setGateInput(e.detail.value)}
            />
            <View className="hs-modal-actions">
              <View className="hs-modal-btn ghost" onClick={handleBack}><Text>返回</Text></View>
              <View className="hs-modal-btn primary" onClick={handleGateConfirm}><Text>入局</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* Game Over 弹窗 */}
      {identity && gameOver && (
        <View className="hs-overlay">
          <View className="hs-modal">
            <Text className="hs-modal-title">💀 Game Over</Text>
            <Text className="hs-modal-desc">
              {gameOver === 'attack'
                ? '你被不喜欢你的脊兽念中了身份咒语！'
                : '10 分钟内没有喜欢你的脊兽为你续命…'}
              {'\n'}请回到休息处休整，或输入复活咒语原地复活。
            </Text>
            <Input
              className="hs-modal-input"
              value={reviveInput}
              placeholder="输入复活咒语…"
              onInput={(e) => setReviveInput(e.detail.value)}
            />
            <View className="hs-modal-actions">
              <View className="hs-modal-btn ghost" onClick={handleBack}><Text>回到休息处</Text></View>
              <View className="hs-modal-btn primary" onClick={handleRevive}><Text>复活</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* 关系图鉴 */}
      {activeModal === 'relations' && (
        <View className="hs-overlay" onClick={() => setActiveModal('')}>
          <View className="hs-modal relations" onClick={(e) => e.stopPropagation()}>
            <Text className="hs-modal-title">💞 脊兽喜爱关系</Text>
            <View className="hs-relations-list">
              {ALL_BEASTS.map((beast) => (
                <View key={beast} className="hs-relation-item">
                  <Text className="hs-relation-name">
                    {BEAST_PROFILES[beast] ? BEAST_PROFILES[beast].emoji : '🧘'} {beast}
                  </Text>
                  <Text className="hs-relation-likes">喜欢：{BEAST_LIKES[beast].join('、')}</Text>
                  <Text className="hs-relation-dislikes">不喜欢：{beastDislikes(beast).join('、')}</Text>
                </View>
              ))}
            </View>
            <View className="hs-modal-actions">
              <View className="hs-modal-btn primary" onClick={() => setActiveModal('')}><Text>知道了</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* 我的身份咒语 */}
      {activeModal === 'identity' && (
        <View className="hs-overlay" onClick={() => setActiveModal('')}>
          <View className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <Text className="hs-modal-title">🔑 我的身份咒语</Text>
            <Text className="hs-modal-desc">咒语一旦泄露，不喜欢你的脊兽就能将你打落屋脊，千万保密！</Text>
            <Text className="hs-spell-reveal">{identity}</Text>
            <View className="hs-modal-actions">
              <View className="hs-modal-btn primary" onClick={() => setActiveModal('')}><Text>收好了</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* 咒语输入 */}
      {activeModal === 'spell' && (
        <View className="hs-overlay" onClick={() => setActiveModal('')}>
          <View className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <Text className="hs-modal-title">✨ 念动咒语</Text>
            <Text className="hs-modal-desc">传说中有咒语能让脊兽幻化真形…</Text>
            <Input
              className="hs-modal-input"
              value={spellInput}
              placeholder="输入咒语…"
              onInput={(e) => setSpellInput(e.detail.value)}
            />
            <View className="hs-modal-actions">
              <View className="hs-modal-btn ghost" onClick={() => { setSpellInput(''); setActiveModal('') }}><Text>取消</Text></View>
              <View className="hs-modal-btn primary" onClick={handleSpellConfirm}><Text>念咒</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* 对决输入 */}
      {activeModal === 'duel' && (
        <View className="hs-overlay" onClick={() => setActiveModal('')}>
          <View className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <Text className="hs-modal-title">⚔️ 发起对决</Text>
            <Text className="hs-modal-desc">念出对方的身份咒语：喜欢 TA 的脊兽为 TA 续命，不喜欢 TA 的脊兽将 TA 打落屋脊</Text>
            <Input
              className="hs-modal-input"
              value={duelInput}
              placeholder="输入对方的身份咒语…"
              onInput={(e) => setDuelInput(e.detail.value)}
            />
            <View className="hs-modal-actions">
              <View className="hs-modal-btn ghost" onClick={() => { setDuelInput(''); setActiveModal('') }}><Text>取消</Text></View>
              <View className="hs-modal-btn primary" onClick={handleDuelConfirm}><Text>出招</Text></View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default HideSeek
