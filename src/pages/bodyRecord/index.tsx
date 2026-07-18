import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import { BODY_WORDS, BODY_PARTS, ColorWordLink } from '@/types'
import { BODY_SILHOUETTE, detectBodyPart, getPartLabel } from '@/config/bodyParts'
import './index.scss'

// ─── 类型 ────────────────────────────────────────
interface BrushPoint { x: number; y: number; pressure: number }
interface BrushStroke {
  id: string
  points: BrushPoint[]
  color: string
  word: string
  partKey: string | null
}

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
const toSvgCoords = (clientX: number, clientY: number, rect: DOMRect) => ({
  x: ((clientX - rect.left) / rect.width) * 200,
  y: ((clientY - rect.top) / rect.height) * 420,
})

// 生成笔触晕染 SVG
function strokeToSvgHtml(stroke: BrushStroke): string {
  const { points, color } = stroke
  if (points.length === 0) return ''
  let html = ''
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)

  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const baseR = 4 * p.pressure
    // 核心笔触
    html += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${baseR.toFixed(1)}" fill="${color}" opacity="0.82"/>`
    // 晕染层
    html += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(baseR * 2.5).toFixed(1)}" fill="rgba(${r},${g},${b},0.10)"/>`
    // 墨点飞溅
    if (i % 3 === 0) {
      for (let s = 0; s < 2; s++) {
        const ox = (Math.random() - 0.5) * 6
        const oy = (Math.random() - 0.5) * 6
        const sr = baseR * (0.2 + Math.random() * 0.4)
        html += `<circle cx="${(p.x + ox).toFixed(1)}" cy="${(p.y + oy).toFixed(1)}" r="${sr.toFixed(1)}" fill="${color}" opacity="${(0.15 + Math.random() * 0.2).toFixed(2)}"/>`
      }
    }
  }
  // 主笔迹线
  if (points.length > 1) {
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`
    html += `<path d="${d}" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.55"/>`
  }
  return html
}

// ─── 组件 ────────────────────────────────────────
const BodyRecord: React.FC = () => {
  const { user } = useUserStore()
  const [link, setLink] = useState<ColorWordLink | null>(null)
  const [strokes, setStrokes] = useState<BrushStroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<BrushStroke | null>(null)
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [showStory, setShowStory] = useState(false)
  const [storyText, setStoryText] = useState('')
  const [storyPart, setStoryPart] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shuffledWords] = useState(() => shuffle(BODY_WORDS))
  const canvasRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)
  const svgRectRef = useRef<DOMRect | null>(null)

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

  // 缓存 SVG 的 getBoundingClientRect
  const refreshSvgRect = useCallback(() => {
    const el = canvasRef.current
    if (!el) return null
    // 在 Taro H5 中 ref 指向原生 DOM 节点
    const svgEl = el.querySelector?.('svg') || (el as any).querySelector?.('svg')
    if (svgEl) {
      svgRectRef.current = svgEl.getBoundingClientRect()
    }
    return svgRectRef.current
  }, [])

  // 开始绘画
  const handlePointerDown = useCallback(
    (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      if (!activeWord) {
        Taro.showToast({ title: '请先选择一个感受词', icon: 'none' })
        return
      }
      const rect = refreshSvgRect()
      if (!rect) return
      isDrawing.current = true

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const { x, y } = toSvgCoords(clientX, clientY, rect)

      setCurrentStroke({
        id: `s-${Date.now()}`,
        points: [{ x, y, pressure: 0.8 + Math.random() * 0.4 }],
        color: getWordHex(activeWord),
        word: activeWord,
        partKey: null,
      })
    },
    [activeWord, link, refreshSvgRect],
  )

  // 移动绘画
  const handlePointerMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      if (!isDrawing.current || !currentStroke) return
      const rect = svgRectRef.current
      if (!rect) return

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const { x, y } = toSvgCoords(clientX, clientY, rect)

      const lastPt = currentStroke.points[currentStroke.points.length - 1]
      const dist = Math.sqrt((x - lastPt.x) ** 2 + (y - lastPt.y) ** 2)
      if (dist < 1.5) return

      setCurrentStroke((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          points: [...prev.points, { x, y, pressure: 0.7 + Math.random() * 0.6 }],
        }
      })
    },
    [currentStroke],
  )

  // 结束绘画 → 检测部位
  const handlePointerUp = useCallback(() => {
    if (!isDrawing.current || !currentStroke) return
    isDrawing.current = false

    const pts = currentStroke.points
    if (pts.length === 0) {
      setCurrentStroke(null)
      return
    }

    // 使用笔触的**最后一个点**（用户停笔位置）来检测部位
    // 同时采样中间点，取出现最多的区域
    const sampleIndices = [0, Math.floor(pts.length / 2), pts.length - 1]
    const zoneCounts: Record<string, number> = {}
    for (const idx of sampleIndices) {
      const p = pts[idx]
      const zone = detectBodyPart(p.x, p.y)
      if (zone) zoneCounts[zone] = (zoneCounts[zone] || 0) + 1
    }
    // 取出现最多的区域
    let partKey: string | null = null
    let maxCount = 0
    for (const [zone, count] of Object.entries(zoneCounts)) {
      if (count > maxCount) { maxCount = count; partKey = zone }
    }

    console.log('[bodyRecord] stroke end, pts=', pts.length, 'partKey=', partKey,
      'lastPt=', pts[pts.length - 1])

    const finalStroke = { ...currentStroke, partKey }
    setStrokes((prev) => [...prev, finalStroke])
    setCurrentStroke(null)
  }, [currentStroke])

  // 原生 DOM 事件绑定（支持鼠标 + 触摸）
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const nativeEl = el as unknown as HTMLElement

    const onDown = (e: Event) => handlePointerDown(e as MouseEvent | TouchEvent)
    const onMove = (e: Event) => handlePointerMove(e as MouseEvent | TouchEvent)
    const onUp = () => handlePointerUp()

    nativeEl.addEventListener('mousedown', onDown)
    nativeEl.addEventListener('mousemove', onMove)
    nativeEl.addEventListener('mouseup', onUp)
    nativeEl.addEventListener('mouseleave', onUp)
    nativeEl.addEventListener('touchstart', onDown, { passive: false })
    nativeEl.addEventListener('touchmove', onMove, { passive: false })
    nativeEl.addEventListener('touchend', onUp)

    return () => {
      nativeEl.removeEventListener('mousedown', onDown)
      nativeEl.removeEventListener('mousemove', onMove)
      nativeEl.removeEventListener('mouseup', onUp)
      nativeEl.removeEventListener('mouseleave', onUp)
      nativeEl.removeEventListener('touchstart', onDown)
      nativeEl.removeEventListener('touchmove', onMove)
      nativeEl.removeEventListener('touchend', onUp)
    }
  }, [handlePointerDown, handlePointerMove, handlePointerUp])

  const handleUndo = () => setStrokes((prev) => prev.slice(0, -1))
  const handleClear = () => setStrokes([])

  // 从笔触构建 bodyMap
  const bodyMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of strokes) {
      if (s.partKey) map[s.partKey] = s.color
    }
    return map
  }, [strokes])

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
      const record = await api.bodyRecord.create({
        user_id: userId,
        body_map: bodyMap,
        first_part: detectedParts[0]?.key || null,
      })
      if (storyText.trim()) {
        const partHex = bodyMap[storyPart] || Object.values(bodyMap)[0]
        const word = BODY_WORDS.find((w) => (link as any)[`word_${w}`] === partHex) || ''
        await api.bodyStory.create({
          user_id: userId, body_part: storyPart, color: partHex,
          word, story: storyText.trim(), body_record_id: record.id,
        })
      }
      Taro.showToast({ title: '已保存', icon: 'success' })
      setShowStory(false)
      setStoryText('')
      setStrokes([])
    } catch (err) {
      console.warn('提交失败:', err)
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  // SVG HTML
  const strokesHtml = useMemo(() => {
    const all = currentStroke ? [...strokes, currentStroke] : strokes
    const inner = all.map(strokeToSvgHtml).join('')
    return `<svg viewBox="0 0 200 420" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="body-clip"><path d="${BODY_SILHOUETTE}" /></clipPath></defs>
  <path d="${BODY_SILHOUETTE}" fill="#f5f2ec" stroke="#d5d0c8" stroke-width="1" />
  <g clip-path="url(#body-clip)">${inner}</g>
  <path d="${BODY_SILHOUETTE}" fill="none" stroke="#8a8578" stroke-width="1.5" />
</svg>`
  }, [strokes, currentStroke])

  const handleBack = () => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/index/index' }) })
  }

  if (!link) {
    return <View className='body-record-page'><Text>加载中...</Text></View>
  }

  return (
    <View className='body-record-page'>
      <View className='br-header'>
        <Text className='br-back' onClick={handleBack}>←</Text>
        <Text className='br-title'>身体涂色</Text>
        <Text className='br-subtitle'>选择感受词，在身体上涂抹你的感受</Text>
      </View>

      {/* 画布：占满大部分屏幕 */}
      <View className='br-canvas'>
        <View
          className='br-svg-canvas'
          ref={canvasRef}
          dangerouslySetInnerHTML={{ __html: strokesHtml }}
        />
      </View>

      {/* 已检测部位标签 */}
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

      {/* 词语选择栏 */}
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
      </View>

      {/* 操作按钮 */}
      <View className='br-actions'>
        <View className='br-action-btn' onClick={handleUndo}><Text>↩ 撤销</Text></View>
        <View className='br-action-btn' onClick={handleClear}><Text>✕ 清空</Text></View>
        <View
          className={`br-action-btn primary ${strokes.length === 0 ? 'disabled' : ''}`}
          onClick={handleSubmit}
        >
          <Text>✨ 保存并分享</Text>
        </View>
      </View>

      {/* 故事弹窗 */}
      {showStory && (
        <View className='br-modal-mask' onClick={() => setShowStory(false)}>
          <View className='br-modal' onClick={(e) => e.stopPropagation()}>
            <Text className='br-modal-title'>请分享一个关于你的身体的小故事</Text>
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
