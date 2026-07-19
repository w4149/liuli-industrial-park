import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import { BODY_WORDS, BODY_PARTS, ColorWordLink } from '@/types'
import { BODY_SILHOUETTE, detectBodyPart, getPartLabel } from '@/config/bodyParts'
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
const toSvg = (cx: number, cy: number, r: DOMRect) => ({
  x: ((cx - r.left) / r.width) * 200,
  y: ((cy - r.top) / r.height) * 420,
})

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

// 初始 SVG（只包含轮廓和 clipPath，不变）
const INITIAL_SVG = `<svg viewBox="0 0 200 420" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="body-clip"><path d="${BODY_SILHOUETTE}" /></clipPath></defs>
  <path d="${BODY_SILHOUETTE}" fill="#f5f2ec" stroke="#d5d0c8" stroke-width="1"/>
  <g id="stroke-group" clip-path="url(#body-clip)"></g>
  <path d="${BODY_SILHOUETTE}" fill="none" stroke="#8a8578" stroke-width="1.5"/>
</svg>`

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

  const canvasRef = useRef<HTMLDivElement>(null)
  const strokeGroupRef = useRef<SVGGElement | null>(null)
  const svgRectRef = useRef<DOMRect | null>(null)
  const isDrawing = useRef(false)
  const currentPoints = useRef<{ x: number; y: number }[]>([])
  const currentColor = useRef('')
  const currentWord = useRef('')

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
    if (!link) return '#ccc'
    return (link as any)[`word_${word}`] || '#ccc'
  }

  // 初始化：获取 stroke group 引用
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const svgEl = (el as unknown as HTMLElement).querySelector?.('svg')
      || (el as any)?.firstElementChild
    if (svgEl) {
      strokeGroupRef.current = svgEl.querySelector('#stroke-group') || svgEl.childNodes[2] as SVGGElement
      svgRectRef.current = svgEl.getBoundingClientRect()
    }
  }, [])

  // 获取 SVG rect（确保缓存有效）
  const getRect = (): DOMRect | null => {
    if (!svgRectRef.current || svgRectRef.current.width === 0) {
      const el = canvasRef.current
      if (!el) return null
      const svgEl = (el as unknown as HTMLElement).querySelector?.('svg')
      if (svgEl) svgRectRef.current = svgEl.getBoundingClientRect()
    }
    return svgRectRef.current
  }

  // ── 绘画事件处理（直接 DOM 操作）──
  const onDown = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    if (!activeWord) {
      Taro.showToast({ title: '请先选择一个感受词', icon: 'none' })
      return
    }
    const rect = getRect()
    if (!rect) return
    isDrawing.current = true

    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY
    const { x, y } = toSvg(cx, cy, rect)

    currentPoints.current = [{ x, y }]
    currentColor.current = getWordHex(activeWord)
    currentWord.current = activeWord

    // 直接向 SVG DOM 添加圆点
    const group = strokeGroupRef.current
    if (group) addDotToSvg(group, x, y, currentColor.current, 0.9)
  }, [activeWord, link])

  const onMove = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    if (!isDrawing.current) return
    const rect = svgRectRef.current
    if (!rect) return

    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY
    const { x, y } = toSvg(cx, cy, rect)

    // 最小距离过滤
    const last = currentPoints.current[currentPoints.current.length - 1]
    if (last && Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2) < 1.5) return

    currentPoints.current.push({ x, y })

    // 直接 DOM 操作添加圆点
    const group = strokeGroupRef.current
    if (group) addDotToSvg(group, x, y, currentColor.current, 0.7 + Math.random() * 0.6)
  }, [])

  const onUp = useCallback(() => {
    if (!isDrawing.current) return
    isDrawing.current = false

    const pts = currentPoints.current
    if (pts.length === 0) return

    // 多点采样检测部位
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
  }, [])

  // 绑定原生事件
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const n = el as unknown as HTMLElement
    n.addEventListener('mousedown', onDown)
    n.addEventListener('mousemove', onMove)
    n.addEventListener('mouseup', onUp)
    n.addEventListener('mouseleave', onUp)
    n.addEventListener('touchstart', onDown, { passive: false })
    n.addEventListener('touchmove', onMove, { passive: false })
    n.addEventListener('touchend', onUp)
    return () => {
      n.removeEventListener('mousedown', onDown)
      n.removeEventListener('mousemove', onMove)
      n.removeEventListener('mouseup', onUp)
      n.removeEventListener('mouseleave', onUp)
      n.removeEventListener('touchstart', onDown)
      n.removeEventListener('touchmove', onMove)
      n.removeEventListener('touchend', onUp)
    }
  }, [onDown, onMove, onUp])

  // 窗口 resize 时更新 rect
  useEffect(() => {
    const onResize = () => { svgRectRef.current = null; getRect() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
      setShowStory(false)
      setStoryText('')
      setStrokes([])
      redrawStrokes([])
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
        <View
          className='br-svg-canvas'
          ref={canvasRef}
          dangerouslySetInnerHTML={{ __html: INITIAL_SVG }}
        />
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
    </View>
  )
}

export default BodyRecord
