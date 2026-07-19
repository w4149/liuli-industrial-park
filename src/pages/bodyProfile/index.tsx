import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import {
  BODY_WORDS, BODY_COLORS, BODY_PARTS,
  BodyRecord, BodyStory, ColorWordLink,
} from '@/types'
import { BODY_ZONES, BODY_SILHOUETTE, getPartLabel } from '@/config/bodyParts'
import './index.scss'

// hex -> {r,g,b}
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

// 确定性伪随机（保证每次渲染位置一致）
const seededRng = (seed: number) => {
  let s = seed
  return () => {
    s = (s * 16807 + 12345) % 2147483647
    return (s & 0x7fffffff) / 0x7fffffff
  }
}

// Box-Muller 高斯分布
const gaussRand = (rng: () => number) => {
  const u1 = Math.max(0.001, rng())
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// 为某个部位生成散点 SVG
const scatterDotsForPart = (
  partKey: string,
  hexCounts: Record<string, number>,
  link: ColorWordLink,
  isSelected: boolean,
): string => {
  const zone = BODY_ZONES.find((z) => z.key === partKey)
  if (!zone) return ''
  const cx = (zone.xMin + zone.xMax) / 2
  const cy = (zone.yMin + zone.yMax) / 2
  const spreadX = (zone.xMax - zone.xMin) * 0.35
  const spreadY = (zone.yMax - zone.yMin) * 0.35

  let seed = 0
  for (let i = 0; i < partKey.length; i++) seed += partKey.charCodeAt(i) * (i + 1) * 37
  const rng = seededRng(seed)

  let html = ''
  for (const [hex, count] of Object.entries(hexCounts)) {
    const word = hexToWord(hex, link)
    const { r, g, b } = hexToRgb(hex)
    const numDots = Math.max(6, count * 10)
    for (let i = 0; i < numDots; i++) {
      const dx = gaussRand(rng) * spreadX
      const dy = gaussRand(rng) * spreadY
      const x = cx + dx
      const y = cy + dy
      const radius = 3 + rng() * 3
      html += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="rgba(${r},${g},${b},0.8)" data-part="${partKey}" data-word="${word}" />`
    }
  }

  // 选中时加高亮圈
  if (isSelected) {
    html += `<circle cx="${cx}" cy="${cy}" r="${Math.max(spreadX, spreadY) * 1.1}" fill="none" stroke="#333" stroke-width="2" stroke-dasharray="4 3" data-part="${partKey}" />`
  }
  return html
}

const hexToWord = (hex: string, link: ColorWordLink): string => {
  for (const w of BODY_WORDS) {
    if ((link as any)[`word_${w}`] === hex) return w
  }
  return ''
}

const BodyProfile: React.FC = () => {
  const { user } = useUserStore()
  const [link, setLink] = useState<ColorWordLink | null>(null)
  const [records, setRecords] = useState<BodyRecord[]>([])
  const [stories, setStories] = useState<BodyStory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [storyModal, setStoryModal] = useState<{
    part: string
    word: string
    stories: BodyStory[]
  } | null>(null)

  const userId = user?.id || 'guest'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [l, recs, strs] = await Promise.all([
        api.colorWord.getLatest(userId),
        api.bodyRecord.getAll(userId),
        api.bodyStory.getAll(userId),
      ])
      if (!l) {
        Taro.showToast({ title: '请先完成选色游戏', icon: 'none' })
        setTimeout(() => Taro.redirectTo({ url: '/pages/colorLink/index' }), 800)
        return
      }
      setLink(l)
      setRecords(recs)
      setStories(strs)
      setLoading(false)
    }
    load()
  }, [userId])

  // 每个部位的 hex 颜色计数
  const partHexCounts = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const rec of records) {
      for (const [partKey, hex] of Object.entries(rec.body_map || {})) {
        if (!map[partKey]) map[partKey] = {}
        map[partKey][hex] = (map[partKey][hex] || 0) + 1
      }
    }
    return map
  }, [records])

  // 生成 SVG HTML（散点式渲染）
  const svgHtml = useMemo(() => {
    const defaultFill = '#f5f2ec'
    let dotsHtml = ''
    for (const z of BODY_ZONES) {
      const counts = partHexCounts[z.key]
      if (counts && Object.keys(counts).length > 0) {
        dotsHtml += scatterDotsForPart(z.key, counts, link!, selectedPart === z.key)
      }
    }
    return `<svg viewBox="0 0 200 420" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="profile-clip"><path d="${BODY_SILHOUETTE}" /></clipPath></defs>
  <path d="${BODY_SILHOUETTE}" fill="${defaultFill}" stroke="#d5d0c8" stroke-width="1" />
  <g clip-path="url(#profile-clip)">${dotsHtml}</g>
  <path d="${BODY_SILHOUETTE}" fill="none" stroke="#8a8578" stroke-width="1.5" pointer-events="none" />
</svg>`
  }, [partHexCounts, link, selectedPart])

  // SVG 点击事件
  const handleSvgClick = useCallback((e: any) => {
    const target = e.target as SVGElement
    const partKey = target.getAttribute?.('data-part')
    if (!partKey) return
    setSelectedPart((prev) => (prev === partKey ? null : partKey))
  }, [])

  // 原生 DOM 事件绑定
  const svgContainerRef = useCallback((node: any) => {
    if (!node) return
    const el = node as unknown as HTMLElement
    const handler = (e: MouseEvent) => {
      const target = e.target as SVGElement
      const partKey = target.getAttribute?.('data-part')
      if (!partKey) return
      setSelectedPart((prev) => (prev === partKey ? null : partKey))
    }
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [])

  const selectedPartWordDist = useMemo(() => {
    if (!selectedPart || !link) return []
    const hexCounts = partHexCounts[selectedPart] || {}
    const total = Object.values(hexCounts).reduce((s, c) => s + c, 0)
    if (total === 0) return []

    const wordCounts: Record<string, { count: number; hex: string }> = {}
    for (const [hex, count] of Object.entries(hexCounts)) {
      const word = hexToWord(hex, link)
      if (word) {
        if (!wordCounts[word]) wordCounts[word] = { count: 0, hex }
        wordCounts[word].count += count
      }
    }

    return BODY_WORDS.map((w) => {
      const wc = wordCounts[w]
      const count = wc?.count || 0
      const hex = wc?.hex || (link as any)[`word_${w}`] || '#ccc'
      const pct = total > 0 ? count / total : 0
      return { word: w, hex, count, pct }
    }).filter((d) => d.count > 0)
  }, [selectedPart, partHexCounts, link])

  const handleBarClick = async (word: string) => {
    if (!selectedPart) return
    const matched = await api.bodyStory.getByPartAndWord(userId, selectedPart, word)
    if (matched.length === 0) {
      Taro.showToast({ title: '暂无相关故事', icon: 'none' })
      return
    }
    setStoryModal({ part: selectedPart, word, stories: matched })
  }

  const randomStory = useMemo(() => {
    if (!storyModal || storyModal.stories.length === 0) return null
    const idx = Math.floor(Math.random() * storyModal.stories.length)
    return storyModal.stories[idx]
  }, [storyModal])

  const handleBack = () => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/index/index' }) })
  }

  if (loading) {
    return (
      <View className='body-profile-page'>
        <Text>加载中...</Text>
      </View>
    )
  }

  if (records.length === 0) {
    return (
      <View className='body-profile-page'>
        <View className='bp-empty'>
          <Text className='bp-empty-title'>还没有身体记录</Text>
          <Text className='bp-empty-sub'>先去完成一次身体涂色吧</Text>
          <View
            className='bp-empty-btn'
            onClick={() => Taro.redirectTo({ url: '/pages/bodyRecord/index' })}
          >
            <Text>去涂色 →</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className='body-profile-page'>
      <View className='bp-header'>
        <Text className='bp-back' onClick={handleBack}>←</Text>
        <Text className='bp-title'>身体档案</Text>
        <Text className='bp-subtitle'>
          共 {records.length} 次记录 · {stories.length} 个故事
        </Text>
      </View>

      <View className='bp-main'>
        {/* 左侧：流线型人形 */}
        <View className='bp-figure'>
          <View
            className='bp-svg'
            ref={svgContainerRef}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        </View>

        {/* 右侧：柱状图 */}
        <View className='bp-chart'>
          {selectedPart ? (
            <>
              <Text className='bp-chart-title'>
                {getPartLabel(selectedPart)} · 感受分布
              </Text>
              {selectedPartWordDist.length === 0 ? (
                <Text className='bp-chart-empty'>该部位暂无数据</Text>
              ) : (
                <View className='bp-bars'>
                  {selectedPartWordDist.map((d) => (
                    <View
                      key={d.word}
                      className='bp-bar-row'
                      onClick={() => handleBarClick(d.word)}
                    >
                      <View className='bp-bar-legend'>
                        <View className='bp-bar-dot' style={{ background: d.hex }} />
                        <Text className='bp-bar-word'>{d.word}</Text>
                      </View>
                      <View className='bp-bar-track'>
                        <View
                          className='bp-bar-fill'
                          style={{
                            width: `${Math.max(5, d.pct * 100)}%`,
                            background: d.hex,
                          }}
                        />
                      </View>
                      <Text className='bp-bar-pct'>{Math.round(d.pct * 100)}%</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text className='bp-chart-hint'>点击柱形查看小故事</Text>
            </>
          ) : (
            <View className='bp-chart-placeholder'>
              <Text>← 点击身体部位</Text>
              <Text>查看感受分布</Text>
            </View>
          )}
        </View>
      </View>

      {/* 故事弹窗 */}
      {storyModal && randomStory && (
        <View className='bp-modal-mask' onClick={() => setStoryModal(null)}>
          <View className='bp-modal' onClick={(e) => e.stopPropagation()}>
            <Text className='bp-modal-tag'>
              {getPartLabel(storyModal.part)} · {storyModal.word}
            </Text>
            <Text className='bp-modal-story'>{randomStory.story}</Text>
            <Text className='bp-modal-date'>
              {new Date(randomStory.created_at).toLocaleDateString()}
            </Text>
            <View className='bp-modal-actions'>
              <View className='bp-modal-btn' onClick={() => setStoryModal(null)}>
                <Text>关闭</Text>
              </View>
              <View
                className='bp-modal-btn primary'
                onClick={() => {
                  setTimeout(() => {
                    setStoryModal({ ...storyModal })
                  }, 10)
                }}
              >
                <Text>🎲 换一条</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default BodyProfile
