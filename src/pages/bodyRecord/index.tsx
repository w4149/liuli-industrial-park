import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import { BODY_WORDS, BODY_PARTS, ColorWordLink } from '@/types'
import { BODY_SILHOUETTE, detectBodyPart, getPartLabel } from '@/config/bodyParts'
import IntroOverlay from '@/components/IntroOverlay'
import './index.scss'

// ─── 类型 ────────────────────────────────────────
interface BrushStroke {
  id: string
  points: { x: number; y: number }[]
  color: string
  word: string
  partKey: string | null
}

const SVG_NS = 'http://www.w3.org/2000/svg'

// 特定部位小故事的进场式动画文案（保存成功后播放，之后再进入庆祝动画）
const HAND_STORY_LINES = [
  '小时候练兰花指',
  '老师说我的手像“鸡爪”，',
  '拿棍子敲手的骨头，',
  '直到大家都成为',
  '一模一样的“花”。',
]
const KNEE_STORY_LINES = [
  '练习压膝盖很像荡秋千，',
  '一个人将双手交握在',
  '另一个人的膝盖上，',
  '双脚离开地。',
  '荡秋千的时候挺快乐的，',
  '当我成为秋千就不一样了。',
]
const HAND_PARTS = ['leftHand', 'rightHand']
const KNEE_PARTS = ['leftKnee', 'rightKnee']

// Fisher-Yates 洗牌
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 屏幕坐标 → SVG viewBox 坐标
// preserveAspectRatio 默认 xMidYMid meet：按短边缩放并居中，需修正 letterbox 偏移
const toSvg = (cx: number, cy: number, r: DOMRect) => {
  const s = Math.min(r.width / 200, r.height / 420)
  return {
    x: (cx - r.left - (r.width - 200 * s) / 2) / s,
    y: (cy - r.top - (r.height - 420 * s) / 2) / s,
  }
}

// 向 SVG group 中直接添加笔触圆点（DOM 操作，不走 React）
function addDotToSvg(group: SVGGElement, x: number, y: number, color: string, pressure: number) {
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  const baseR = 4 * pressure

  // 核心
  const c1 = document.createElementNS(SVG_NS, 'circle')
  c1.setAttribute('cx', x.toFixed(1))
  c1.setAttribute('cy', y.toFixed(1))
  c1.setAttribute('r', baseR.toFixed(1))
  c1.setAttribute('fill', color)
  c1.setAttribute('opacity', '0.82')
  group.appendChild(c1)

  // 晕染
  const c2 = document.createElementNS(SVG_NS, 'circle')
  c2.setAttribute('cx', x.toFixed(1))
  c2.setAttribute('cy', y.toFixed(1))
  c2.setAttribute('r', (baseR * 2.5).toFixed(1))
  c2.setAttribute('fill', `rgba(${r},${g},${b},0.10)`)
  group.appendChild(c2)

  // 墨点飞溅
  if (Math.random() < 0.35) {
    const c3 = document.createElementNS(SVG_NS, 'circle')
    c3.setAttribute('cx', (x + (Math.random() - 0.5) * 6).toFixed(1))
    c3.setAttribute('cy', (y + (Math.random() - 0.5) * 6).toFixed(1))
    c3.setAttribute('r', (baseR * 0.3).toFixed(1))
    c3.setAttribute('fill', color)
    c3.setAttribute('opacity', '0.2')
    group.appendChild(c3)
  }
}

// 把已完成的笔触渲染为 SVG HTML（用于持久化显示）
function strokeToSvgHtml(s: BrushStroke): string {
  let html = ''
  const r = parseInt(s.color.slice(1, 3), 16)
  const g = parseInt(s.color.slice(3, 5), 16)
  const b = parseInt(s.color.slice(5, 7), 16)
  for (const p of s.points) {
    const baseR = 4
    html += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${baseR}" fill="${s.color}" opacity="0.82"/>`
    html += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(baseR * 2.5).toFixed(1)}" fill="rgba(${r},${g},${b},0.10)"/>`
  }
  return html
}

// ─── 程序化创建 SVG（createElementNS 确保正确命名空间，兼容所有移动端）──
function createBodySvg(): { svg: SVGSVGElement; group: SVGGElement } {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 200 420')
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

  // defs + clipPath
  const defs = document.createElementNS(SVG_NS, 'defs')
  const clipPath = document.createElementNS(SVG_NS, 'clipPath')
  clipPath.setAttribute('id', 'body-clip')
  const clipP = document.createElementNS(SVG_NS, 'path')
  clipP.setAttribute('d', BODY_SILHOUETTE)
  clipPath.appendChild(clipP)
  defs.appendChild(clipPath)
  svg.appendChild(defs)

  // 底色轮廓
  const bg = document.createElementNS(SVG_NS, 'path')
  bg.setAttribute('d', BODY_SILHOUETTE)
  bg.setAttribute('fill', '#f5f2ec')
  bg.setAttribute('stroke', '#d5d0c8')
  bg.setAttribute('stroke-width', '1')
  svg.appendChild(bg)

  // 笔触组（带 clipPath）
  const g = document.createElementNS(SVG_NS, 'g')
  g.setAttribute('id', 'stroke-group')
  g.setAttribute('clip-path', 'url(#body-clip)')
  svg.appendChild(g)

  // 轮廓线（在最上层）
  const outline = document.createElementNS(SVG_NS, 'path')
  outline.setAttribute('d', BODY_SILHOUETTE)
  outline.setAttribute('fill', 'none')
  outline.setAttribute('stroke', '#8a8578')
  outline.setAttribute('stroke-width', '1.5')
  svg.appendChild(outline)

  return { svg, group: g }
}

// ─── 组件 ────────────────────────────────────────
const BodyRecord: React.FC = () => {
  const { user } = useUserStore()
  const [link, setLink] = useState<ColorWordLink | null>(null)
  const [strokes, setStrokes] = useState<BrushStroke[]>([])
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [showStory, setShowStory] = useState(false)
  const [storyText, setStoryText] = useState('')
  const [storyPart, setStoryPart] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shuffledWords] = useState(() => shuffle(BODY_WORDS))
  // 保存成功后的像素风吹蜡烛庆祝动画
  const [showCelebrate, setShowCelebrate] = useState(false)
  // 手/膝盖小故事的特殊文案动画（播完再进庆祝动画）
  const [storyIntroLines, setStoryIntroLines] = useState<string[] | null>(null)
  const celebrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current)
  }, [])

  // 吹蜡烛庆祝动画，约 4.2s 后自动关闭
  const startCelebrate = () => {
    setShowCelebrate(true)
    if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current)
    celebrateTimerRef.current = setTimeout(() => setShowCelebrate(false), 4200)
  }

  const hostRef = useRef<HTMLDivElement>(null) // Taro View 包裹层
  const svgContainerRef = useRef<HTMLDivElement | null>(null) // 原生 SVG 容器（挂在 document.body 上）
  const strokeGroupRef = useRef<SVGGElement | null>(null)
  const svgElRef = useRef<SVGSVGElement | null>(null)
  const svgRectRef = useRef<DOMRect | null>(null)
  const isDrawing = useRef(false)
  const currentPoints = useRef<{ x: number; y: number }[]>([])
  const currentColor = useRef('')
  const currentWord = useRef('')
  const cleanupRef = useRef<(() => void) | null>(null)

  // 用 ref 追踪 state，避免 effect 重建
  const activeWordRef = useRef<string | null>(null)
  const linkRef = useRef<ColorWordLink | null>(null)
  useEffect(() => { activeWordRef.current = activeWord }, [activeWord])
  useEffect(() => { linkRef.current = link }, [link])

  // 加载选色结果
  useEffect(() => {
    const userId = user?.id || 'guest'
    api.colorWord.getLatest(userId).then((l) => {
      if (!l) {
        Taro.showToast({ title: '请先完成选色游戏', icon: 'none' })
        setTimeout(() => Taro.redirectTo({ url: '/pages/colorLink/index' }), 800)
      } else {
        setLink(l)
      }
    })
  }, [user])

  const getWordHex = (word: string): string => {
    const l = linkRef.current
    if (!l) return '#ccc'
    return (l as any)[`word_${word}`] || '#ccc'
  }

  // ── 创建原生 div 容器 + SVG + 绑定事件（link 加载后执行一次）──
  useEffect(() => {
    // host 元素只在 link 加载后才渲染，link 为空时不启动重试链
    if (!link) return
    // 如果 SVG 已创建过，跳过（防止 link 变化导致重复创建）
    if (svgElRef.current) return

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    // 延迟重试获取 host 元素（移动端渲染较慢）
    const tryCreateSvg = (retries = 0) => {
      // 已取消或已创建（防止多条重试链并发导致重复创建容器）
      if (cancelled || svgElRef.current) return
      // 必须用 ref 取当前页面实例的 host：redirectTo/navigateTo 后 DOM 中可能
      // 同时存在多个历史页面实例（同 id），getElementById 会命中旧实例导致画布挂错页面
      const hostEl = hostRef.current as unknown as HTMLElement | null
      if (!hostEl) {
        if (retries < 10) {
          retryTimer = setTimeout(() => tryCreateSvg(retries + 1), 100)
        } else {
          console.warn('[bodyRecord] svg host ref not ready after 10 retries')
        }
        return
      }

      // 防御：仅清理当前 host 内遗留的重复容器（不可全局清理，会误删页面栈中旧实例的画布）
      hostEl.querySelectorAll('.br-svg-canvas-inner').forEach((n) => {
        if (n.parentNode) n.parentNode.removeChild(n)
      })

      // 创建原生 div 容器 — 直接挂进 host 元素内部 absolute 定位，
      // 随文档流自动对齐（fixed + 手动同步在手机端转场/URL栏伸缩时会错位）
      const container = document.createElement('div')
      container.className = 'br-svg-canvas-inner'
      container.style.position = 'absolute'
      container.style.inset = '0'
      container.style.zIndex = '50'
      container.style.touchAction = 'none'
      container.style.userSelect = 'none'
      container.style.cursor = 'crosshair'

      // 用 createElementNS 创建 SVG（确保正确命名空间，兼容移动端）
      const { svg, group } = createBodySvg()
      container.appendChild(svg)
      hostEl.appendChild(container)

      svgElRef.current = svg
      strokeGroupRef.current = group
      svgContainerRef.current = container

      console.log('[bodyRecord] SVG mounted inside #br-svg-host')

      // 每次落笔时取最新 rect（绘制期间 touchAction:none 不会滚动，笔画内可复用）
      const getRect = (): DOMRect | null => {
        if (!svgRectRef.current || svgRectRef.current.width === 0) {
          svgRectRef.current = svg.getBoundingClientRect()
        }
        return svgRectRef.current
      }

      // ── 事件处理（通过 ref 读取最新 state）──
      const onDown = (e: MouseEvent | TouchEvent) => {
        e.preventDefault()
        const word = activeWordRef.current
        if (!word) {
          Taro.showToast({ title: '请先选择一个感受词', icon: 'none' })
          return
        }
        // 每次落笔重新取 rect（标签区出现等布局变化不触发 resize/scroll）
        svgRectRef.current = svg.getBoundingClientRect()
        const rect = getRect()
        if (!rect) return
        isDrawing.current = true

        const cx = 'touches' in e ? e.touches[0].clientX : e.clientX
        const cy = 'touches' in e ? e.touches[0].clientY : e.clientY
        const { x, y } = toSvg(cx, cy, rect)

        currentPoints.current = [{ x, y }]
        currentColor.current = getWordHex(word)
        currentWord.current = word

        const group = strokeGroupRef.current
        console.log('[bodyRecord] onDown: group=', !!group, 'x=', x.toFixed(1), 'y=', y.toFixed(1))
        if (group) addDotToSvg(group, x, y, currentColor.current, 0.9)
      }

      const onMove = (e: MouseEvent | TouchEvent) => {
        e.preventDefault()
        if (!isDrawing.current) return
        const rect = getRect()
        if (!rect) return

        const cx = 'touches' in e ? e.touches[0].clientX : e.clientX
        const cy = 'touches' in e ? e.touches[0].clientY : e.clientY
        const { x, y } = toSvg(cx, cy, rect)

        const last = currentPoints.current[currentPoints.current.length - 1]
        if (last && Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2) < 1.5) return

        currentPoints.current.push({ x, y })
        const group = strokeGroupRef.current
        if (group) addDotToSvg(group, x, y, currentColor.current, 0.7 + Math.random() * 0.6)
      }

      const onUp = () => {
        if (!isDrawing.current) return
        isDrawing.current = false

        const pts = currentPoints.current
        if (pts.length === 0) return

        const indices = [0, Math.floor(pts.length / 2), pts.length - 1]
        const zoneCounts: Record<string, number> = {}
        for (const i of indices) {
          const z = detectBodyPart(pts[i].x, pts[i].y)
          if (z) zoneCounts[z] = (zoneCounts[z] || 0) + 1
        }
        let partKey: string | null = null
        let maxC = 0
        for (const [z, c] of Object.entries(zoneCounts)) {
          if (c > maxC) { maxC = c; partKey = z }
        }

        console.log('[bodyRecord] stroke pts=', pts.length, 'part=', partKey)

        const stroke: BrushStroke = {
          id: `s-${Date.now()}`,
          points: [...pts],
          color: currentColor.current,
          word: currentWord.current,
          partKey,
        }
        setStrokes((prev) => [...prev, stroke])
        currentPoints.current = []
      }

      // 绑定原生事件
      container.addEventListener('mousedown', onDown)
      container.addEventListener('mousemove', onMove)
      container.addEventListener('mouseup', onUp)
      container.addEventListener('mouseleave', onUp)
      container.addEventListener('touchstart', onDown, { passive: false })
      container.addEventListener('touchmove', onMove, { passive: false })
      container.addEventListener('touchend', onUp)

      // resize / scroll 后缓存的 rect 失效，下次落笔时重新获取
      const onLayoutChange = () => {
        svgRectRef.current = null
      }
      window.addEventListener('resize', onLayoutChange)
      window.addEventListener('scroll', onLayoutChange, true) // capture 阶段，捕获所有滚动

      // 保存 cleanup 引用
      cleanupRef.current = () => {
        container.removeEventListener('mousedown', onDown)
        container.removeEventListener('mousemove', onMove)
        container.removeEventListener('mouseup', onUp)
        container.removeEventListener('mouseleave', onUp)
        container.removeEventListener('touchstart', onDown)
        container.removeEventListener('touchmove', onMove)
        container.removeEventListener('touchend', onUp)
        window.removeEventListener('resize', onLayoutChange)
        window.removeEventListener('scroll', onLayoutChange, true)
        if (container.parentNode) container.parentNode.removeChild(container)
        svgContainerRef.current = null
      }
    }

    tryCreateSvg()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [link]) // ← link 加载后 host 元素才存在于 DOM；svgElRef 守卫防止重复创建

  // 弹窗打开时隐藏 SVG 容器，避免遮挡输入框（兜底：隐藏页面上所有涂色容器）
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.br-svg-canvas-inner').forEach((n) => {
      n.style.display = showStory ? 'none' : ''
    })
  }, [showStory])

  // 页面导航：离开时隐藏 SVG 容器，返回时恢复（Taro H5 页面栈机制）
  useDidHide(() => {
    document.querySelectorAll<HTMLElement>('.br-svg-canvas-inner').forEach((n) => {
      n.style.display = 'none'
    })
  })
  useDidShow(() => {
    // 返回时恢复，但如果故事弹窗正打开则继续隐藏
    document.querySelectorAll<HTMLElement>('.br-svg-canvas-inner').forEach((n) => {
      n.style.display = showStory ? 'none' : ''
    })
  })

  const handleUndo = () => {
    setStrokes((prev) => {
      const next = prev.slice(0, -1)
      // 重绘 SVG 中的笔触
      redrawStrokes(next)
      return next
    })
  }
  const handleClear = () => {
    setStrokes([])
    redrawStrokes([])
  }

  // 重绘所有笔触（撤销/清空后）
  const redrawStrokes = (list: BrushStroke[]) => {
    const group = strokeGroupRef.current
    if (!group) return
    // 清除所有子元素
    while (group.firstChild) group.removeChild(group.firstChild)
    // 重新添加
    for (const s of list) {
      const html = strokeToSvgHtml(s)
      const temp = document.createElementNS(SVG_NS, 'g')
      temp.innerHTML = html
      while (temp.firstChild) group.appendChild(temp.firstChild)
    }
  }

  // 跳转选色页
  const handleRecolor = () => {
    Taro.navigateTo({ url: '/pages/colorLink/index' })
  }

  const handleBack = () => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/index/index' }) })
  }

  // 已检测部位列表
  const detectedParts = useMemo(() => {
    const parts: { key: string; label: string; word: string; hex: string }[] = []
    const seen = new Set<string>()
    for (const s of strokes) {
      if (s.partKey && !seen.has(s.partKey)) {
        seen.add(s.partKey)
        parts.push({ key: s.partKey, label: getPartLabel(s.partKey), word: s.word, hex: s.color })
      }
    }
    return parts
  }, [strokes])

  // bodyMap
  const bodyMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of strokes) { if (s.partKey) map[s.partKey] = s.color }
    return map
  }, [strokes])

  const handleSubmit = () => {
    if (Object.keys(bodyMap).length === 0) {
      Taro.showToast({ title: '请先在身体上涂抹', icon: 'none' })
      return
    }
    setStoryPart(detectedParts[0]?.key || '')
    setShowStory(true)
  }

  const submitStory = async () => {
    if (!link) return
    setSubmitting(true)
    try {
      const userId = user?.id || 'guest'
      await api.bodyRecord.create({
        user_id: userId, body_map: bodyMap,
        first_part: detectedParts[0]?.key || null,
      })
      if (storyText.trim()) {
        const partHex = bodyMap[storyPart] || Object.values(bodyMap)[0]
        const word = BODY_WORDS.find((w) => (link as any)[`word_${w}`] === partHex) || ''
        await api.bodyStory.create({
          user_id: userId, body_part: storyPart, color: partHex,
          word, story: storyText.trim(), body_record_id: null,
        })
      }
      Taro.showToast({ title: '已保存', icon: 'success' })
      // 小故事写的是手/膝盖时，先播对应文案动画，播完再进庆祝动画
      let specialLines: string[] | null = null
      if (storyText.trim()) {
        if (HAND_PARTS.includes(storyPart)) specialLines = HAND_STORY_LINES
        else if (KNEE_PARTS.includes(storyPart)) specialLines = KNEE_STORY_LINES
      }
      setShowStory(false)
      setStoryText('')
      setStrokes([])
      redrawStrokes([])
      if (specialLines) {
        setStoryIntroLines(specialLines)
      } else {
        startCelebrate()
      }
    } catch (err) {
      console.warn('提交失败:', err)
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!link) {
    return <View className='body-record-page'><Text>加载中...</Text></View>
  }

  return (
    <View className='body-record-page'>
      <View className='br-header'>
        <Text className='br-back' onClick={handleBack}>←</Text>
        <Text className='br-title'>身体涂色</Text>
        <Text className='br-subtitle'>选择感受词，在身体上涂抹</Text>
      </View>

      {/* 画布 */}
      <View className='br-canvas'>
        <View className='br-svg-canvas' id='br-svg-host' ref={hostRef} />
      </View>

      {/* 已检测部位 */}
      {detectedParts.length > 0 && (
        <View className='br-tags'>
          {detectedParts.map((p) => (
            <View key={p.key} className='br-tag' style={{ borderColor: p.hex }}>
              <View className='br-tag-dot' style={{ background: p.hex }} />
              <Text className='br-tag-text'>{p.label} · {p.word}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 词语 + 选色按钮 */}
      <View className='br-words'>
        {shuffledWords.map((w) => {
          const hex = getWordHex(w)
          const isActive = activeWord === w
          return (
            <View
              key={w}
              className={`br-word-btn ${isActive ? 'active' : ''}`}
              style={{
                borderColor: isActive ? hex : 'transparent',
                boxShadow: isActive ? `0 0 12px ${hex}55` : 'none',
              }}
              onClick={() => setActiveWord(w === activeWord ? null : w)}
            >
              <View className='br-word-dot' style={{ background: hex }} />
              <Text className='br-word-label'>{w}</Text>
            </View>
          )
        })}
        <View className='br-recolor-btn' onClick={handleRecolor}>
          <Text>🎨 选色</Text>
        </View>
      </View>

      {/* 操作按钮 */}
      <View className='br-actions'>
        <View className='br-action-btn' onClick={handleUndo}><Text>↩ 撤销</Text></View>
        <View className='br-action-btn' onClick={handleClear}><Text>✕ 清空</Text></View>
        <View
          className={`br-action-btn primary ${strokes.length === 0 ? 'disabled' : ''}`}
          onClick={handleSubmit}
        >
          <Text>✨ 保存</Text>
        </View>
      </View>

      {/* 故事弹窗 */}
      {showStory && (
        <View className='br-modal-mask' onClick={() => setShowStory(false)}>
          <View className='br-modal' onClick={(e) => e.stopPropagation()}>
            <Text className='br-modal-title'>分享你的身体小故事</Text>
            <Text className='br-modal-label'>选择部位（默认：{getPartLabel(storyPart)})</Text>
            <select className='br-modal-select' value={storyPart} onChange={(e) => setStoryPart(e.target.value)}>
              {detectedParts.map((p) => (
                <option key={p.key} value={p.key}>{p.label} · {p.word}</option>
              ))}
            </select>
            <textarea
              className='br-modal-textarea'
              placeholder='关于这个部位，你想说些什么...'
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
            />
            <View className='br-modal-actions'>
              <View className='br-modal-btn' onClick={() => setShowStory(false)}><Text>取消</Text></View>
              <View className={`br-modal-btn primary ${submitting ? 'disabled' : ''}`} onClick={submitStory}>
                <Text>{submitting ? '保存中...' : '保存'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 手/膝盖小故事的特殊文案动画（受控，关闭后进入庆祝动画） */}
      {storyIntroLines && (
        <IntroOverlay
          lines={storyIntroLines}
          onClose={() => {
            setStoryIntroLines(null)
            startCelebrate()
          }}
        />
      )}

      {/* 保存成功：像素风吹蜡烛 + 心愿飞天 */}
      {showCelebrate && (
        <View className='br-celebrate' onClick={() => setShowCelebrate(false)}>
          <Text className='br-wish-star'>⭐</Text>
          <View className='br-cake'>
            <View className='br-flame' />
            <View className='br-smoke' />
            <View className='br-candle' />
            <View className='br-cake-top' />
            <View className='br-cake-base' />
          </View>
          <Text className='br-hb-title'>🎂 生日快乐</Text>
          <Text className='br-hb-sub'>心愿已飞向天空</Text>
        </View>
      )}
    </View>
  )
}

export default BodyRecord
