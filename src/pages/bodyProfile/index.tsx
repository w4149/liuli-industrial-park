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

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const blendColor = (hexCounts: Record<string, number>): string => {
  const entries = Object.entries(hexCounts)
  if (entries.length === 0) return '#e8e4dc'
  const total = entries.reduce((s, [, c]) => s + c, 0)
  let r = 0, g = 0, b = 0
  for (const [hex, count] of entries) {
    const { r: cr, g: cg, b: cb } = hexToRgb(hex)
    const w = count / total
    r += cr * w
    g += cg * w
    b += cb * w
  }
  return rgbToHex(r, g, b)
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

  // 每个部位的混合填充色
  const partFill = useMemo(() => {
    const fills: Record<string, string> = {}
    for (const z of BODY_ZONES) {
      fills[z.key] = blendColor(partHexCounts[z.key] || {})
    }
    return fills
  }, [partHexCounts])

  // 生成 SVG HTML（用区域矩形 + clipPath 渲染）
  const svgHtml = useMemo(() => {
    const defaultFill = '#f5f2ec'
    const zones = BODY_ZONES.map((z) => {
      const fill = partFill[z.key] !== '#e8e4dc' ? partFill[z.key] : defaultFill
      const isSelected = selectedPart === z.key
      const stroke = isSelected ? '#333' : 'none'
      const strokeW = isSelected ? '2' : '0'
      return `<rect x="${z.xMin}" y="${z.yMin}" width="${z.xMax - z.xMin}" height="${z.yMax - z.yMin}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" data-part="${z.key}" />`
    })
    return `<svg viewBox="0 0 200 420" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="profile-clip"><path d="${BODY_SILHOUETTE}" /></clipPath></defs>
  <path d="${BODY_SILHOUETTE}" fill="${defaultFill}" stroke="#d5d0c8" stroke-width="1" />
  <g clip-path="url(#profile-clip)">${zones.join('')}</g>
  <path d="${BODY_SILHOUETTE}" fill="none" stroke="#8a8578" stroke-width="1.5" pointer-events="none" />
</svg>`
  }, [partFill, selectedPart])

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
