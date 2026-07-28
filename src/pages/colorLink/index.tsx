import React, { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import { BODY_WORDS, BodyWord, ColorWordLink } from '@/types'
import './index.scss'

// HSV → hex（色轮取色：h 色相角度，s 饱和度 0-1，v 明度 0-1）
const hsvToHex = (h: number, s: number, v: number): string => {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(5)}${f(3)}${f(1)}`
}

const ColorLink: React.FC = () => {
  const { user } = useUserStore()
  // 每个词语对应的颜色 hex
  const [wordColors, setWordColors] = useState<Record<string, string>>({})
  // 当前选中的词语（等待分配颜色）
  const [activeWord, setActiveWord] = useState<BodyWord | null>(null)
  // 当前从色轮选取的颜色
  const [currentHex, setCurrentHex] = useState('#e2574c')
  // 色轮上的取色标记位置（相对色轮左上角，px）
  const [markerPos, setMarkerPos] = useState<{ x: number; y: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const activeWordRef = useRef<BodyWord | null>(null)
  activeWordRef.current = activeWord

  const allDone = BODY_WORDS.every((w) => !!wordColors[w])

  // 真色轮取色：按下/拖动时根据触点位置计算颜色（角度=色相，半径=饱和度）
  useEffect(() => {
    let tries = 0
    let removeListeners: (() => void) | null = null

    const bind = () => {
      const el = document.getElementById('cl-wheel')
      if (!el) {
        // Taro H5 元素挂载有延迟，重试获取
        if (++tries < 10) setTimeout(bind, 100)
        return
      }

      let dragging = false

      const pick = (clientX: number, clientY: number, isDown: boolean) => {
        if (!activeWordRef.current) {
          if (isDown) Taro.showToast({ title: '请先点击下方的词语', icon: 'none' })
          return
        }
        const rect = el.getBoundingClientRect()
        const R = rect.width / 2
        const dx = clientX - rect.left - R
        const dy = clientY - rect.top - R
        const r = Math.sqrt(dx * dx + dy * dy)
        if (r > R) return // 圆外不取色
        // conic-gradient 从正上方顺时针，与 atan2(dx, -dy) 一致
        const hue = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360
        const sat = Math.min(1, r / R)
        const hex = hsvToHex(hue, sat, 1)
        setCurrentHex(hex)
        setMarkerPos({ x: clientX - rect.left, y: clientY - rect.top })
        const word = activeWordRef.current
        setWordColors((prev) => ({ ...prev, [word]: hex }))
      }

      const onDown = (ev: PointerEvent) => {
        dragging = true
        el.setPointerCapture?.(ev.pointerId)
        pick(ev.clientX, ev.clientY, true)
      }
      const onMove = (ev: PointerEvent) => {
        if (!dragging) return
        ev.preventDefault()
        pick(ev.clientX, ev.clientY, false)
      }
      const onUp = () => { dragging = false }

      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onUp)
      removeListeners = () => {
        el.removeEventListener('pointerdown', onDown)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
        el.removeEventListener('pointercancel', onUp)
      }
    }

    bind()
    return () => removeListeners?.()
  }, [])

  // 点击词语
  const handleWordClick = (word: BodyWord) => {
    setActiveWord(word === activeWord ? null : word)
  }

  // 重置
  const handleReset = () => {
    setWordColors({})
    setActiveWord(null)
    setMarkerPos(null)
  }

  // 保存
  const handleSave = async () => {
    if (!allDone) return
    setSaving(true)
    try {
      const userId = user?.id || 'guest'
      const payload: any = { user_id: userId }
      BODY_WORDS.forEach((w) => {
        payload[`word_${w}`] = wordColors[w]
      })
      console.log('[colorLink] saving with userId:', userId, 'payload:', payload)
      const result = await api.colorWord.save(payload)
      console.log('[colorLink] save result:', result)
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/bodyRecord/index' })
      }, 800)
    } catch (err: any) {
      console.error('[colorLink] save error:', err)
      const msg = err?.message || '未知错误'
      Taro.showToast({ title: `保存失败: ${msg}`, icon: 'none', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  // 返回
  const handleBack = () => {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/index/index' }),
    })
  }

  return (
    <View className='color-link-page'>
      <View className='cl-header'>
        <Text className='cl-back' onClick={handleBack}>←</Text>
        <Text className='cl-title'>选择你的颜色密码</Text>
      </View>
      <Text className='cl-subtitle'>
        为每个感受词在色轮上选一种颜色
      </Text>

      {/* 色轮：点击/拖动直接取色 */}
      <View className='cl-wheel-section'>
        <View className='cl-wheel-wrapper'>
          <View className='cl-wheel' id='cl-wheel'>
            {markerPos && (
              <View
                className='cl-wheel-marker'
                style={{
                  left: `${markerPos.x}px`,
                  top: `${markerPos.y}px`,
                  background: currentHex,
                }}
              />
            )}
          </View>
        </View>
        {activeWord && (
          <Text className='cl-active-hint'>
            在色轮上点击或拖动，为「{activeWord}」选色
          </Text>
        )}
        <Text className='cl-current-color'>
          当前颜色：{currentHex}
        </Text>
      </View>

      {/* 词语列表 */}
      <View className='cl-words'>
        {BODY_WORDS.map((w) => {
          const isActive = activeWord === w
          const assigned = !!wordColors[w]
          return (
            <View
              key={w}
              className={`cl-word-row ${isActive ? 'active' : ''} ${assigned ? 'assigned' : ''}`}
              onClick={() => handleWordClick(w)}
            >
              <Text className='cl-word-text'>{w}</Text>
              {assigned ? (
                <View
                  className='cl-word-color'
                  style={{ background: wordColors[w] }}
                />
              ) : null}
              {assigned && <Text className='cl-word-check'>✓</Text>}
            </View>
          )
        })}
      </View>

      {/* 操作按钮 */}
      <View className='cl-actions'>
        <View className='cl-btn' onClick={handleReset}>
          <Text>↺ 重置</Text>
        </View>
        <View
          className={`cl-btn primary ${!allDone || saving ? 'disabled' : ''}`}
          onClick={handleSave}
        >
          <Text>{saving ? '保存中...' : '💾 保存并继续'}</Text>
        </View>
      </View>
    </View>
  )
}

export default ColorLink
