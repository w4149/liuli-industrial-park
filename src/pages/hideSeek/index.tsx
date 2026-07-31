import React, { useRef, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Image } from '@tarojs/components'
import AMapLoader from '@amap/amap-jsapi-loader'
import { BEAST_PROFILES, IMMORTAL_INFO } from '@/data/ridgeBeasts'
import { ALL_BEASTS, BEAST_LIKES, beastLikes, beastLikedBy, beastDislikedBy, beastDislikes } from '@/data/beastRelations'
import { getCustomSpells, refreshCustomSpellsFromCloud } from '@/data/customSpells'
import { HideSeekPresence, HideSeekDuel, HideSeekTask } from '@/types'
import { api } from '@/services/api'
import { wgs84ToGcj02 } from '@/utils'
import { mapConfig } from '@/config/map'
import './index.scss'

const SYNC_INTERVAL = 30 * 1000 // 位置每 30 秒同步一次
const DUEL_POLL_INTERVAL = 10 * 1000 // 对决事件每 10 秒轮询一次
const DUEL_WINDOW = 20 * 60 * 1000 // 续命重置窗口：20 分钟内必须被喜欢的脊兽续命
const INITIAL_WINDOW = 20 * 60 * 1000 // 入局/重置后重新入局的初始窗口 20 分钟
const PROBE_WARN_WINDOW = 60 * 1000 // 被探查后 1 分钟伪装窗口
const PROBE_REVEAL_DURATION = 5 * 60 * 1000 // 探查现形持续 5 分钟
const TASK_WRONG_PENALTY_MS = 10 * 1000 // 答错任务扣除对决时间 10 秒

const USER_KEY_STORAGE = 'hide_seek_user_key'
const IDENTITY_STORAGE = 'hide_seek_identity'
const NICKNAME_STORAGE = 'hide_seek_nickname'
const GAMEOVER_STORAGE = 'hide_seek_gameover'
const DEADLINE_STORAGE = 'hide_seek_duel_deadline'
const DUEL_SINCE_STORAGE = 'hide_seek_duel_since'
const PROBE_STORAGE = 'hide_seek_probe'
const PROBE_SINCE_STORAGE = 'hide_seek_probe_since'
const ROUND_APPLIED_STORAGE = 'hide_seek_round_applied' // 本机已应用的轮次重置时间

const EPOCH_ISO = '1970-01-01T00:00:00.000Z'
// 状态标记行（借对决表广播，非脊兽 attacker_beast 会被对决判定跳过）
const STATUS_OUT = 'OUT' // 出局（target_spell=自己身份咒语）
const STATUS_REVIVE = 'REVIVE' // 在场/复活（target_spell=自己身份咒语）
const STATUS_PROBE = 'PROBE' // 探查（target_spell=目标昵称）
const STATUS_SPELL_USED = 'SPELL_USED' // 全局咒语使用标记（target_spell=咒语文本）
const STATUS_ROUND_RESET = 'ROUND_RESET' // 开发者重置新一轮（target_spell=ROUND）
const ROUND_TARGET = 'ROUND'

// 身份咒语 → 身份脊兽
const IDENTITY_MAP: Record<string, string> = {
  雅梦: '凤',
  嘉俊: '天马',
}
const DISGUISE_SPELL = '飞龙在天' // 内置变身咒语 → 龙（仅被探查时被动使用）
const REVIVE_SPELL = 'wjj' // 复活咒语

// 身份咒语 → 身份脊兽（内置优先，其次开发者模式新增的自定义身份咒语）
const resolveIdentity = (spell: string): string => {
  if (IDENTITY_MAP[spell]) return IDENTITY_MAP[spell]
  const custom = getCustomSpells().find((c) => c.type === 'identity' && c.spell === spell)
  return custom && custom.beast ? custom.beast : ''
}

// 变身咒语 → 伪装脊兽（内置飞龙在天 + 自定义变身咒语）
const resolveDisguise = (spell: string): string => {
  if (spell === DISGUISE_SPELL) return '龙'
  const custom = getCustomSpells().find((c) => c.type === 'disguise' && c.spell === spell)
  return custom && custom.beast ? custom.beast : ''
}

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

// 图标档案：十兽取自 BEAST_PROFILES，骑凤仙人（隐藏彩蛋）取自 IMMORTAL_INFO
const BEAST_ICON_MAP: Record<string, any> = {
  ...(BEAST_PROFILES as Record<string, any>),
  骑凤仙人: {
    emoji: IMMORTAL_INFO.emoji,
    image: IMMORTAL_INFO.image,
    glaze: { gradient: 'linear-gradient(160deg, #C9A86A 0%, #8A6D3B 100%)' },
  },
}

// 玩家标记 HTML：脊兽小图标 + 昵称牌
const buildMarkerHtml = (beastType: string, nickname: string, isSelf: boolean) => {
  const profile = beastType && BEAST_ICON_MAP[beastType] ? BEAST_ICON_MAP[beastType] : null
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

const formatHhMm = (iso: string) => {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// 行内脊兽小图标：插画就位用图片，缺图回退 emoji
const BeastIcon: React.FC<{ beast: string; fallback?: string }> = ({ beast, fallback = '🐾' }) => {
  const profile = beast ? BEAST_ICON_MAP[beast] : null
  if (profile && profile.image) {
    return <Image className="hs-beast-icon" src={profile.image} mode="aspectFill" />
  }
  return <Text>{profile ? profile.emoji : fallback}</Text>
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
  const deadlineRef = useRef<number>(0)
  const duelSinceRef = useRef<string>('')
  const duelPollingRef = useRef(false)
  // 被探查状态：warnUntil 前可被动输入变身咒语伪装，之后现形至 revealUntil
  const probeRef = useRef<{ warnUntil: number; revealUntil: number; displayBeast: string } | null>(null)
  const probePhaseRef = useRef<'none' | 'warn' | 'reveal'>('none')
  const probeSinceRef = useRef<string>('')
  // 本轮起点（最近一次 ROUND_RESET 时间），全局咒语使用标记只认本轮之后的
  const roundSinceRef = useRef<string>(EPOCH_ISO)
  // 本机已应用的轮次重置标记，避免同一次重置反复生效
  const roundAppliedRef = useRef<string>('')
  // 已通过校验、等待选择探查目标的探查咒语
  const pendingProbeSpellRef = useRef<string>('')
  // 全局战报：拉取游标 / 防重入 / 身份咒语→昵称映射（战报只报昵称不泄露咒语）
  const feedSinceRef = useRef<string>('')
  const feedPollingRef = useRef(false)
  const spellNickMapRef = useRef<Record<string, string>>({})

  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [nextSyncIn, setNextSyncIn] = useState(30)
  const [locStatus, setLocStatus] = useState<'locating' | 'ok' | 'failed'>('locating')
  const [identity, setIdentity] = useState('')
  const [nickname, setNickname] = useState('')
  const [gameOver, setGameOver] = useState('') // '' | 'attack' | 'timeout'
  const [duelLeftMs, setDuelLeftMs] = useState(INITIAL_WINDOW)
  const [probePhase, setProbePhase] = useState<'none' | 'warn' | 'reveal'>('none')
  const [probeLeftMs, setProbeLeftMs] = useState(0)
  const [othersOnline, setOthersOnline] = useState<HideSeekPresence[]>([])
  const [relationsView, setRelationsView] = useState<'mine' | 'all'>('mine')
  const [feed, setFeed] = useState<{ id: string; time: string; text: string }[]>([])
  const [activeModal, setActiveModal] = useState('') // '' | 'relations' | 'spell' | 'duel' | 'identity' | 'probeAlert' | 'probeTarget' | 'feed' | 'taskList' | 'taskDetail'
  const [gateInput, setGateInput] = useState('')
  const [gateNickInput, setGateNickInput] = useState('')
  const [spellInput, setSpellInput] = useState('')
  const [duelInput, setDuelInput] = useState('')
  const [probeSpellInput, setProbeSpellInput] = useState('')
  const [reviveInput, setReviveInput] = useState('')
  // 任务系统
  const [tasks, setTasks] = useState<HideSeekTask[]>([])
  const [selectedTask, setSelectedTask] = useState<HideSeekTask | null>(null)
  const [taskAnswerInput, setTaskAnswerInput] = useState('')
  const [taskSubmitting, setTaskSubmitting] = useState(false)
  const [taskLoading, setTaskLoading] = useState(false)
  // 答对后揭晓的奖励咒语（仅展示一次，关闭即清空，不持久化）
  const [rewardReveal, setRewardReveal] = useState<{ spell: string; usage: string } | null>(null)

  // ===== 身份与脊兽 =====

  // 身份脊兽（由身份咒语解析）
  const identityBeast = () => resolveIdentity(identityRef.current)

  // 对外展示的脊兽：平时隐匿（空 → 通用图标），仅被探查现形期间展示真实/伪装脊兽
  const exposedBeast = () => {
    const p = probeRef.current
    const now = Date.now()
    if (p && now >= p.warnUntil && now < p.revealUntil) {
      return p.displayBeast || identityBeast()
    }
    return ''
  }

  // 地图与广播只露昵称，脊兽平时不暴露
  const getIdentityInfo = () => ({
    nickname: nicknameRef.current || '神秘访客',
    beast_type: exposedBeast(),
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
    setOthersOnline(others)
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

  const saveProbeSince = (iso: string) => {
    probeSinceRef.current = iso
    try { Taro.setStorageSync(PROBE_SINCE_STORAGE, iso) } catch { /* ignore */ }
  }

  const saveProbe = (p: { warnUntil: number; revealUntil: number; displayBeast: string } | null) => {
    probeRef.current = p
    try { Taro.setStorageSync(PROBE_STORAGE, p || '') } catch { /* ignore */ }
  }

  // ===== 全局咒语单次使用（除身份/复活咒语外，自己或别人用过即失效）=====

  // 取本轮起点：最近一次开发者重置的时间，重置后使用次数重新计算
  const refreshRoundSince = async () => {
    try {
      const rows = await api.hideSeek.getDuelsForTarget(ROUND_TARGET, EPOCH_ISO)
      const resets = rows.filter((r) => r.attacker_beast === STATUS_ROUND_RESET)
      if (resets.length) roundSinceRef.current = resets[resets.length - 1].created_at
    } catch { /* ignore */ }
  }

  const isSpellUsedGlobally = async (spell: string) => {
    const rows = await api.hideSeek.getDuelsForTarget(spell, roundSinceRef.current)
    return rows.some((r) => r.attacker_beast === STATUS_SPELL_USED)
  }

  // 发现新一轮（开发者重置广播）后，本机同步开启新一轮：
  // 清空本局身份与状态、清空全局战报，踢回入局门禁——所有玩家需重新输入昵称和身份咒语；
  // 咒语存云端跨轮次保留，不随重置清空
  const applyRoundResetIfNeeded = () => {
    const round = roundSinceRef.current
    if (round === EPOCH_ISO) return
    // 用时间戳比较：Supabase 返回 +00:00 后缀、本地写入 Z 后缀，字符串比较不可靠
    if (roundAppliedRef.current && new Date(round).getTime() <= new Date(roundAppliedRef.current).getTime()) return
    roundAppliedRef.current = round
    try { Taro.setStorageSync(ROUND_APPLIED_STORAGE, round) } catch { /* ignore */ }
    if (!identityRef.current) return
    // 撤下自己在服务端的在场记录，清掉地图上所有玩家标记（含上一轮被探查现形的形象）
    api.hideSeek.removePresence(userKeyRef.current)
    if (mapRef.current) {
      try {
        if (myMarkerRef.current) mapRef.current.remove(myMarkerRef.current)
        otherMarkersRef.current.forEach((marker) => mapRef.current.remove(marker))
      } catch { /* ignore */ }
    }
    myMarkerRef.current = null
    otherMarkersRef.current.clear()
    setOthersOnline([])
    setOnlineCount(0)
    // 清空本局身份与状态，回到入局门禁重新输入昵称和身份咒语
    identityRef.current = ''
    setIdentity('')
    nicknameRef.current = ''
    setNickname('')
    gameOverRef.current = ''
    setGameOver('')
    deadlineRef.current = 0
    duelSinceRef.current = ''
    probeSinceRef.current = ''
    probeRef.current = null
    probePhaseRef.current = 'none'
    setProbePhase('none')
    setProbeLeftMs(0)
    pendingProbeSpellRef.current = ''
    setActiveModal('')
    try {
      Taro.removeStorageSync(IDENTITY_STORAGE)
      Taro.removeStorageSync(NICKNAME_STORAGE)
      Taro.removeStorageSync(GAMEOVER_STORAGE)
      Taro.removeStorageSync(DEADLINE_STORAGE)
      Taro.removeStorageSync(DUEL_SINCE_STORAGE)
      Taro.removeStorageSync(PROBE_SINCE_STORAGE)
      Taro.removeStorageSync(PROBE_STORAGE)
    } catch { /* ignore */ }
    // 全局战报随新一轮清空，重新入局后只看本轮事件（首拉游标会重算到本轮起点）
    setFeed([])
    feedSinceRef.current = ''
    spellNickMapRef.current = {}
    Taro.showToast({ title: '🔄 新一轮开始！请重新输入昵称和身份咒语入局', icon: 'none', duration: 3000 })
  }

  const markSpellUsedGlobal = (spell: string) => {
    api.hideSeek.sendDuel({
      attacker_key: userKeyRef.current,
      attacker_name: nicknameRef.current,
      attacker_beast: STATUS_SPELL_USED,
      target_spell: spell,
    })
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
        if (!(d.attacker_beast in BEAST_LIKES)) continue
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

  // 轮询针对我的探查事件（探查按昵称点名）
  const pollProbes = async () => {
    if (!identityRef.current || !nicknameRef.current || gameOverRef.current) return
    try {
      const rows = await api.hideSeek.getDuelsForTarget(nicknameRef.current, probeSinceRef.current || EPOCH_ISO)
      for (const r of rows) {
        saveProbeSince(r.created_at)
        if (r.attacker_beast !== STATUS_PROBE) continue
        if (r.attacker_key === userKeyRef.current) continue
        startProbeWarning()
      }
    } catch { /* ignore */ }
  }

  // 轮询全局战报：谁探查了谁 / 谁对谁发起对决 / 谁出局，全场可见
  const pollFeed = async () => {
    if (!identityRef.current || feedPollingRef.current) return
    feedPollingRef.current = true
    try {
      // 首次拉取：本轮开始与最近 1 小时取较晚者
      if (!feedSinceRef.current) {
        const floor = Date.now() - 60 * 60 * 1000
        const round = new Date(roundSinceRef.current).getTime()
        feedSinceRef.current = new Date(Math.max(floor, round)).toISOString()
      }
      const rows = await api.hideSeek.getDuelsSince(feedSinceRef.current)
      if (!rows.length) return
      feedSinceRef.current = rows[rows.length - 1].created_at
      // 先更新身份咒语→昵称映射（来自出局/入局广播），战报只报昵称，绝不展示咒语本身
      spellNickMapRef.current[identityRef.current] = nicknameRef.current
      rows.forEach((r) => {
        if (r.attacker_beast === STATUS_OUT || r.attacker_beast === STATUS_REVIVE) {
          spellNickMapRef.current[r.target_spell] = r.attacker_name
        }
      })
      const items: { id: string; time: string; text: string }[] = []
      rows.forEach((r) => {
        const time = formatHhMm(r.created_at)
        const id = String(r.id)
        if (r.attacker_beast in BEAST_LIKES) {
          const nick = spellNickMapRef.current[r.target_spell] || '神秘玩家'
          items.push({ id, time, text: `⚔️ ${r.attacker_name} 对「${nick}」发起了对决` })
        } else if (r.attacker_beast === STATUS_PROBE) {
          items.push({ id, time, text: `🔮 ${r.attacker_name} 探查了「${r.target_spell}」` })
        } else if (r.attacker_beast === STATUS_OUT) {
          items.push({ id, time, text: `💀 ${r.attacker_name} 出局了` })
        } else if (r.attacker_beast === STATUS_ROUND_RESET) {
          if (r.created_at > roundSinceRef.current) roundSinceRef.current = r.created_at
          items.push({ id, time, text: '🔄 新一轮开始，咒语使用次数已重置' })
        }
      })
      if (items.length) {
        setFeed((prev) => {
          const seen = new Set(prev.map((i) => i.id))
          return [...prev, ...items.filter((i) => !seen.has(i.id))].slice(-50)
        })
      }
      // 战报里出现新的轮次重置 → 本机同步开启新一轮
      applyRoundResetIfNeeded()
    } catch { /* ignore */ } finally {
      feedPollingRef.current = false
    }
  }

  const startGameLoops = () => {
    // 预热云端咒语缓存（异步，失败保留本地缓存）
    refreshCustomSpellsFromCloud()
    // 首次进入：初始化 20 分钟初始窗口和对决事件游标
    if (!deadlineRef.current) {
      saveDeadline(Date.now() + INITIAL_WINDOW)
    }
    if (!duelSinceRef.current) {
      saveDuelSince(new Date().toISOString())
    }
    if (!probeSinceRef.current) {
      saveProbeSince(new Date().toISOString())
    }
    refreshRoundSince().then(applyRoundResetIfNeeded)
    // 离开期间超时 → game over，但轮询不能停：否则收不到轮次重置广播，会永远卡在出局状态
    if (deadlineRef.current <= Date.now()) {
      triggerGameOver('timeout')
    }
    // 出局状态不共享位置；复活/新一轮时会重新调用本函数启动
    if (!gameOverRef.current) {
      syncPresence()
      if (syncTimerRef.current) clearInterval(syncTimerRef.current)
      syncTimerRef.current = window.setInterval(syncPresence, SYNC_INTERVAL)
    }
    pollDuels()
    pollProbes()
    pollFeed()
    if (duelPollTimerRef.current) clearInterval(duelPollTimerRef.current)
    duelPollTimerRef.current = window.setInterval(() => {
      pollDuels()
      pollProbes()
      pollFeed()
    }, DUEL_POLL_INTERVAL)
  }

  // ===== 交互 =====

  const handleGateConfirm = async () => {
    const nick = gateNickInput.trim()
    const input = gateInput.trim()
    if (!nick) {
      Taro.showToast({ title: '请先起个昵称', icon: 'none' })
      return
    }
    // 先拉云端最新咒语，支持开发者刚添加的自定义身份咒语入局
    await refreshCustomSpellsFromCloud()
    if (!resolveIdentity(input)) {
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
    saveDeadline(Date.now() + INITIAL_WINDOW)
    saveDuelSince(new Date().toISOString())
    saveProbeSince(new Date().toISOString())
    saveProbe(null)
    probePhaseRef.current = 'none'
    setProbePhase('none')
    // 入局时将当前时刻记为已应用轮次，入局前的历史重置不再重复生效
    roundAppliedRef.current = new Date().toISOString()
    try { Taro.setStorageSync(ROUND_APPLIED_STORAGE, roundAppliedRef.current) } catch { /* ignore */ }
    broadcastStatus(STATUS_REVIVE) // 新入局向对手声明自己在场
    setGateInput('')
    setGateNickInput('')
    refreshMyMarkerContent()
    if (mapReadyRef.current) startGameLoops()
  }

  const handleSpellConfirm = async () => {
    const input = spellInput.trim()
    if (!input) return
    setSpellInput('')
    // 先拉云端最新咒语，保证别的设备上新增的咒语本机也能念
    await refreshCustomSpellsFromCloud()
    // 变身咒语只能在被探查时被动使用
    if (resolveDisguise(input)) {
      setActiveModal('')
      Taro.showToast({ title: '变身咒语只能在被探查时使用', icon: 'none', duration: 2500 })
      return
    }
    // 主动可念的只有自定义续命 / 探查咒语
    const custom = getCustomSpells().find((c) => c.spell === input && (c.type === 'renew' || c.type === 'probe'))
    if (!custom) {
      setActiveModal('')
      Taro.showToast({ title: '咒语没有生效…', icon: 'none' })
      return
    }
    // 全局单次使用：自己或别人用过即失效
    let used = false
    try { used = await isSpellUsedGlobally(input) } catch { /* 查询失败宽松放行 */ }
    if (used) {
      setActiveModal('')
      Taro.showToast({ title: '这个咒语已被使用过，失去效力了', icon: 'none', duration: 2500 })
      return
    }
    // 续命咒语：倒计时增加 X 分钟
    if (custom.type === 'renew') {
      setActiveModal('')
      markSpellUsedGlobal(input)
      const addMinutes = custom.minutes || 0
      saveDeadline(Math.max(deadlineRef.current, Date.now()) + addMinutes * 60 * 1000)
      Taro.showToast({ title: `⏳ 续命成功 +${addMinutes} 分钟`, icon: 'none', duration: 2500 })
      return
    }
    // 探查咒语：进入目标选择
    if (!othersOnline.length) {
      setActiveModal('')
      Taro.showToast({ title: '当前没有其他在场玩家可探查', icon: 'none', duration: 2000 })
      return
    }
    pendingProbeSpellRef.current = input
    setActiveModal('probeTarget')
  }

  // 选定探查目标 → 广播 PROBE 标记，目标 1 分钟伪装窗口后现形 5 分钟
  const handleProbeTargetConfirm = async (targetNickname: string) => {
    const spell = pendingProbeSpellRef.current
    pendingProbeSpellRef.current = ''
    setActiveModal('')
    const ok = await api.hideSeek.sendDuel({
      attacker_key: userKeyRef.current,
      attacker_name: nicknameRef.current,
      attacker_beast: STATUS_PROBE,
      target_spell: targetNickname,
    })
    if (!ok) {
      Taro.showToast({ title: '探查发动失败，请重试', icon: 'none', duration: 2000 })
      return
    }
    markSpellUsedGlobal(spell)
    Taro.showToast({ title: `🔮 探查已发动，「${targetNickname}」1 分钟后现形`, icon: 'none', duration: 2500 })
  }

  // 被探查：进入 1 分钟伪装警告窗口
  const startProbeWarning = () => {
    if (probeRef.current) return // 已在被探查流程中，忽略重复探查
    const now = Date.now()
    saveProbe({
      warnUntil: now + PROBE_WARN_WINDOW,
      revealUntil: now + PROBE_WARN_WINDOW + PROBE_REVEAL_DURATION,
      displayBeast: '',
    })
    probePhaseRef.current = 'warn'
    setProbePhase('warn')
    setProbeLeftMs(PROBE_WARN_WINDOW)
    setProbeSpellInput('')
    setActiveModal('probeAlert')
  }

  // 被探查时被动念动变身咒语伪装（唯一允许使用变身咒语的入口）
  const handleProbeDisguise = async () => {
    const input = probeSpellInput.trim()
    const p = probeRef.current
    if (!p || Date.now() >= p.warnUntil) {
      setActiveModal('')
      Taro.showToast({ title: '伪装窗口已结束', icon: 'none' })
      return
    }
    // 先拉云端最新咒语，支持用别的设备上新增的变身咒语伪装
    await refreshCustomSpellsFromCloud()
    const beast = resolveDisguise(input)
    if (!beast) {
      Taro.showToast({ title: '这不是有效的变身咒语', icon: 'none' })
      return
    }
    let used = false
    try { used = await isSpellUsedGlobally(input) } catch { /* 查询失败宽松放行 */ }
    if (used) {
      Taro.showToast({ title: '这个咒语已被使用过，失去效力了', icon: 'none', duration: 2500 })
      return
    }
    markSpellUsedGlobal(input)
    saveProbe({ ...p, displayBeast: beast })
    setProbeSpellInput('')
    setActiveModal('')
    Taro.showToast({ title: `🎭 伪装成功，现形时将显示「${beast}」`, icon: 'none', duration: 2500 })
  }

  const handleDuelConfirm = async () => {
    const input = duelInput.trim()
    // 先拉云端最新咒语，支持对方用自定义身份咒语入局的情况
    await refreshCustomSpellsFromCloud()
    const targetBeast = resolveIdentity(input)
    if (!targetBeast) {
      Taro.showToast({ title: '这不是有效的身份咒语', icon: 'none' })
      return
    }
    if (input === identityRef.current) {
      Taro.showToast({ title: '不能对自己发起对决', icon: 'none' })
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
    pollProbes()
    pollFeed()
    Taro.showToast({ title: '已刷新', icon: 'none', duration: 800 })
  }

  // ===== 任务系统 =====

  const loadTasks = async () => {
    const list = await api.task.getAll()
    setTasks(list)
    return list
  }

  const openTaskList = () => {
    setActiveModal('taskList')
    setTaskLoading(true)
    loadTasks().finally(() => setTaskLoading(false))
  }

  const openTaskDetail = (task: HideSeekTask) => {
    setSelectedTask(task)
    setTaskAnswerInput('')
    setActiveModal('taskDetail')
  }

  const handleSubmitAnswer = async () => {
    const task = selectedTask
    if (!task || taskSubmitting) return
    if (task.completed_by_key) {
      Taro.showToast({ title: '该任务奖励已被获得', icon: 'none', duration: 2000 })
      return
    }
    const input = taskAnswerInput.trim()
    if (!input) {
      Taro.showToast({ title: '请输入答案', icon: 'none' })
      return
    }
    // 标准答案支持"或"逻辑：任一命中即算答对（忽略大小写与首尾空格）
    const normalized = input.toLowerCase()
    const correct = (task.answers || []).some((a) => a.trim().toLowerCase() === normalized)
    if (!correct) {
      // 答错扣时 10 秒（仅在场且未出局时扣，扣完可能直接超时出局）
      if (identityRef.current && !gameOverRef.current && deadlineRef.current) {
        saveDeadline(deadlineRef.current - TASK_WRONG_PENALTY_MS)
      }
      setTaskAnswerInput('')
      Taro.showToast({ title: '❌ 答错了，扣除 10 秒对决时间', icon: 'none', duration: 2500 })
      return
    }
    // 答对：向服务端申请独占领取奖励（全场第一个答对者独得）
    setTaskSubmitting(true)
    const winnerName = nicknameRef.current || '神秘访客'
    const result = await api.task.complete(task.id, userKeyRef.current, winnerName)
    setTaskSubmitting(false)
    if (result === 'won') {
      const updated: HideSeekTask = { ...task, completed_by_key: userKeyRef.current, completed_by_name: winnerName }
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
      setSelectedTask(updated)
      setTaskAnswerInput('')
      setActiveModal('')
      // 揭晓奖励咒语（仅此一次，关闭弹窗后不再出现）
      setRewardReveal({ spell: task.reward_spell, usage: task.reward_usage })
    } else if (result === 'taken') {
      Taro.showToast({ title: '答对了，但奖励已被人抢先获得', icon: 'none', duration: 2500 })
      const list = await loadTasks()
      const fresh = list.find((t) => t.id === task.id)
      if (fresh) setSelectedTask(fresh)
    } else {
      Taro.showToast({ title: '网络异常，请稍后重试', icon: 'none', duration: 2000 })
    }
  }

  const closeReward = () => setRewardReveal(null)


  // ===== 生命周期 =====

  useEffect(() => {
    // 恢复持久化的游戏状态
    try {
      const savedIdentity = Taro.getStorageSync(IDENTITY_STORAGE)
      const savedNickname = Taro.getStorageSync(NICKNAME_STORAGE)
      // 昵称与身份必须成对，缺一不可则重新走门禁
      if (savedIdentity && resolveIdentity(savedIdentity) && savedNickname) {
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
      const savedProbe = Taro.getStorageSync(PROBE_STORAGE)
      if (savedProbe && savedProbe.revealUntil > Date.now()) {
        probeRef.current = savedProbe
        const phase = Date.now() < savedProbe.warnUntil ? 'warn' : 'reveal'
        probePhaseRef.current = phase
        setProbePhase(phase)
      }
      const savedSince = Taro.getStorageSync(DUEL_SINCE_STORAGE)
      if (savedSince) duelSinceRef.current = savedSince
      const savedProbeSince = Taro.getStorageSync(PROBE_SINCE_STORAGE)
      if (savedProbeSince) probeSinceRef.current = savedProbeSince
      const savedRoundApplied = Taro.getStorageSync(ROUND_APPLIED_STORAGE)
      if (savedRoundApplied) roundAppliedRef.current = savedRoundApplied
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
          // 出局状态也要启动循环（内部会跳过位置共享），否则收不到轮次重置广播
          if (identityRef.current) {
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

    // 1 秒节拍：刷新倒计时 / 探查相位 / 超时判定
    tickTimerRef.current = window.setInterval(() => {
      if (lastSyncRef.current) {
        const remain = Math.max(0, Math.ceil((SYNC_INTERVAL - (Date.now() - lastSyncRef.current)) / 1000))
        setNextSyncIn(remain)
      }
      // 被探查相位机：警告（可伪装）→ 现形 → 恢复隐匿
      const p = probeRef.current
      if (p) {
        const now = Date.now()
        if (now < p.warnUntil) {
          setProbeLeftMs(p.warnUntil - now)
        } else if (now < p.revealUntil) {
          if (probePhaseRef.current !== 'reveal') {
            probePhaseRef.current = 'reveal'
            setProbePhase('reveal')
            // 未伪装 → 现形为真实脊兽
            if (!p.displayBeast) saveProbe({ ...p, displayBeast: identityBeast() })
            refreshMyMarkerContent()
            syncPresence() // 立即广播现形形象
            setActiveModal((m) => (m === 'probeAlert' ? '' : m))
            Taro.showToast({
              title: p.displayBeast ? '🎭 已按伪装形象现形' : '👁 你已被探查现形！',
              icon: 'none',
              duration: 2500,
            })
          }
          setProbeLeftMs(p.revealUntil - now)
        } else {
          saveProbe(null)
          probePhaseRef.current = 'none'
          setProbePhase('none')
          setProbeLeftMs(0)
          refreshMyMarkerContent()
          syncPresence()
          Taro.showToast({ title: '🐾 现形结束，恢复隐匿', icon: 'none', duration: 2000 })
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

    // 手机锁屏/切后台时浏览器会挂起定时器，回到前台立刻补拉一次：
    // 否则重置广播要等下一轮轮询才生效，体验上就像必须重新进页面
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !identityRef.current) return
      refreshRoundSince().then(applyRoundResetIfNeeded)
      pollFeed()
      pollDuels()
      pollProbes()
      if (!gameOverRef.current) syncPresence()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
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

  const myBeast = identityBeast()
  const likedByMine = myBeast && myBeast in BEAST_LIKES ? beastLikedBy(myBeast as any) : []
  const dislikedByMine = myBeast && myBeast in BEAST_LIKES ? beastDislikedBy(myBeast as any) : []

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
            <BeastIcon beast={myBeast} /> {nickname} · {myBeast}
          </Text>
          {probePhase === 'warn' && (
            <Text className="hs-probe-tag warn" onClick={() => setActiveModal('probeAlert')}>⚠️ 被探查 {formatMmSs(probeLeftMs)}</Text>
          )}
          {probePhase === 'reveal' && (
            <Text className="hs-probe-tag">👁 现形 {formatMmSs(probeLeftMs)}</Text>
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

      {/* 全局战报：最新一条跑马灯，点击看全部 */}
      {feed.length > 0 && (
        <View className="hs-feed-bar" onClick={() => setActiveModal('feed')}>
          <Text className="hs-feed-latest">📢 {feed[feed.length - 1].text}</Text>
          <Text className="hs-feed-more">全部 ›</Text>
        </View>
      )}

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
        <View className="hs-action-btn" onClick={openTaskList}>
          <Text>📋 任务</Text>
        </View>
        <View className="hs-action-btn primary" onClick={() => setActiveModal('duel')}>
          <Text>⚔️ 对决</Text>
        </View>
      </View>

      <View className="hs-hint-card">
        <Text className="hs-hint-title">🙈 玩法说明</Text>
        <Text className="hs-hint-text">凭身份咒语入局，地图上人人隐匿真身（🐾），位置每 30 秒更新。每 10 分钟内必须有「喜欢你的脊兽」在对决中念出你的身份咒语为你续命；若被「不喜欢你的脊兽」点名，立即出局。念动探查咒语可令一名玩家现形 5 分钟；被探查者有 1 分钟机会念动变身咒语伪装自己。除身份与复活咒语外，每个咒语全场只能被使用一次。探查、对决、出局都会全场通报。</Text>
      </View>

      {/* 全局战报弹窗 */}
      {activeModal === 'feed' && (
        <View className="hs-overlay" onClick={() => setActiveModal('')}>
          <View className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <Text className="hs-modal-title">📢 全局战报</Text>
            <View className="hs-feed-list">
              {[...feed].reverse().map((item) => (
                <View key={item.id} className="hs-feed-item">
                  <Text className="hs-feed-time">{item.time}</Text>
                  <Text className="hs-feed-text">{item.text}</Text>
                </View>
              ))}
            </View>
            <View className="hs-modal-actions">
              <View className="hs-modal-btn primary" onClick={() => setActiveModal('')}><Text>知道了</Text></View>
            </View>
          </View>
        </View>
      )}

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

      {/* 关系图鉴：默认简洁视图（与我的关系），右上角总览切换完整关系表 */}
      {activeModal === 'relations' && (
        <View className="hs-overlay" onClick={() => { setActiveModal(''); setRelationsView('mine') }}>
          <View className="hs-modal relations" onClick={(e) => e.stopPropagation()}>
            <View className="hs-relations-header">
              <Text className="hs-modal-title">{relationsView === 'mine' ? '💞 谁喜欢我' : '💞 全部脊兽关系'}</Text>
              <Text
                className="hs-relations-toggle"
                onClick={() => setRelationsView(relationsView === 'mine' ? 'all' : 'mine')}
              >
                {relationsView === 'mine' ? '总览' : '返回'}
              </Text>
            </View>
            {relationsView === 'mine' ? (
              <View className="hs-relations-mine">
                <View className="hs-relation-item">
                  <Text className="hs-relation-name">我的真身：<BeastIcon beast={myBeast} /> {myBeast || '未入局'}</Text>
                  <Text className="hs-relation-likes">😍 喜欢我的（让ta们在对决中输入我的身份咒语为我续命）：{likedByMine.join('、') || '—'}</Text>
                  <Text className="hs-relation-dislikes">😡 不喜欢我的（别让ta们在对决中输入我的身份咒语）：{dislikedByMine.join('、') || '—'}</Text>
                </View>
              </View>
            ) : (
              <View className="hs-relations-list">
                {ALL_BEASTS.map((beast) => (
                  <View key={beast} className="hs-relation-item">
                    <Text className="hs-relation-name">
                      <BeastIcon beast={beast} fallback="🧘" /> {beast}
                    </Text>
                    <Text className="hs-relation-likes">喜欢：{BEAST_LIKES[beast].join('、')}</Text>
                    <Text className="hs-relation-dislikes">不喜欢：{beastDislikes(beast).join('、')}</Text>
                  </View>
                ))}
              </View>
            )}
            <View className="hs-modal-actions">
              <View className="hs-modal-btn primary" onClick={() => { setActiveModal(''); setRelationsView('mine') }}><Text>知道了</Text></View>
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
            <Text className="hs-modal-desc">续命、探查等秘咒在此念动，每个咒语全场只能被使用一次…</Text>
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

      {/* 探查：选择在场玩家作为目标 */}
      {activeModal === 'probeTarget' && (
        <View className="hs-overlay" onClick={() => { pendingProbeSpellRef.current = ''; setActiveModal('') }}>
          <View className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <Text className="hs-modal-title">🔮 选择探查目标</Text>
            <Text className="hs-modal-desc">被探查者有 1 分钟伪装机会，之后将在地图上现形 5 分钟，对所有人可见</Text>
            <View className="hs-probe-targets">
              {othersOnline.map((p) => (
                <View
                  key={p.user_key}
                  className="hs-probe-target"
                  onClick={() => handleProbeTargetConfirm(p.nickname || '神秘访客')}
                >
                  <Text>🐾 {p.nickname || '神秘访客'}</Text>
                </View>
              ))}
            </View>
            <View className="hs-modal-actions">
              <View className="hs-modal-btn ghost" onClick={() => { pendingProbeSpellRef.current = ''; setActiveModal('') }}><Text>取消</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* 被探查警告：1 分钟内可被动念动变身咒语伪装 */}
      {activeModal === 'probeAlert' && probePhase === 'warn' && (
        <View className="hs-overlay">
          <View className="hs-modal">
            <Text className="hs-modal-title">🔮 你被探查了！</Text>
            <Text className="hs-modal-desc">
              {formatMmSs(probeLeftMs)} 后你将在地图上现形 5 分钟。{'\n'}现在念动变身咒语可伪装成其他脊兽，否则将暴露真身！
            </Text>
            <Input
              className="hs-modal-input"
              value={probeSpellInput}
              placeholder="输入变身咒语伪装自己…"
              onInput={(e) => setProbeSpellInput(e.detail.value)}
            />
            <View className="hs-modal-actions">
              <View className="hs-modal-btn ghost" onClick={() => setActiveModal('')}><Text>听天由命</Text></View>
              <View className="hs-modal-btn primary" onClick={handleProbeDisguise}><Text>伪装</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* 任务列表 */}
      {activeModal === 'taskList' && (
        <View className="hs-overlay" onClick={() => setActiveModal('')}>
          <View className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <Text className="hs-modal-title">📋 任务</Text>
            <Text className="hs-modal-desc">答对可独得奖励咒语，全场仅第一个答对者能获得；答错会扣除 10 秒对决时间</Text>
            {tasks.length === 0 ? (
              <Text className="hs-task-empty">{taskLoading ? '任务加载中…' : '暂时还没有任务，敬请期待…'}</Text>
            ) : (
              <View className="hs-task-list">
                {tasks.map((t) => (
                  <View key={t.id} className="hs-task-item" onClick={() => openTaskDetail(t)}>
                    <View className="hs-task-item-main">
                      <Text className="hs-task-name">{t.name}</Text>
                      <Text className="hs-task-reward">🎁 神秘咒语</Text>
                    </View>
                    <Text className={`hs-task-status ${t.completed_by_key ? 'done' : ''}`}>
                      {t.completed_by_key ? '奖励已被获得' : '尚无人完成'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View className="hs-modal-actions">
              <View className="hs-modal-btn primary" onClick={() => setActiveModal('')}><Text>关闭</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* 任务详情 + 答题 */}
      {activeModal === 'taskDetail' && selectedTask && (
        <View className="hs-overlay" onClick={() => setActiveModal('taskList')}>
          <View className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <Text className="hs-modal-title">{selectedTask.name}</Text>
            <Text className="hs-modal-desc">{selectedTask.description || '（暂无任务描述）'}</Text>
            {selectedTask.completed_by_key && (
              <View>
                <Text className="hs-task-done-tip">🎉 该任务奖励已被「{selectedTask.completed_by_name || '神秘访客'}」获得</Text>
                <View className="hs-modal-actions">
                  <View className="hs-modal-btn primary" onClick={() => setActiveModal('taskList')}><Text>返回列表</Text></View>
                </View>
              </View>
            )}
            {!selectedTask.completed_by_key && (
              <View>
                <Input
                  className="hs-modal-input"
                  value={taskAnswerInput}
                  placeholder="输入你的答案…"
                  onInput={(e) => setTaskAnswerInput(e.detail.value)}
                />
                <Text className="hs-task-penalty-tip">⚠️ 提交答案有代价：答错将扣除 10 秒对决时间</Text>
                <View className="hs-modal-actions">
                  <View className="hs-modal-btn ghost" onClick={() => setActiveModal('taskList')}><Text>返回</Text></View>
                  <View className="hs-modal-btn primary" onClick={handleSubmitAnswer}><Text>{taskSubmitting ? '提交中…' : '提交答案'}</Text></View>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 答对后揭晓奖励咒语（仅此一次，关闭后不再出现） */}
      {rewardReveal && (
        <View className="hs-overlay">
          <View className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <Text className="hs-modal-title">🎉 恭喜获得奖励咒语！</Text>
            <Text className="hs-spell-reveal">{rewardReveal.spell}</Text>
            <Text className="hs-modal-desc">
              功能用法：{rewardReveal.usage || '（未填写）'}{'\n'}请务必记住它——关闭本弹窗后，这个咒语将不再出现！
            </Text>
            <View className="hs-modal-actions">
              <View className="hs-modal-btn primary" onClick={closeReward}><Text>我记住了</Text></View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default HideSeek
