import React, { useState, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import { BODY_WORDS, BodyWord, ColorWordLink } from '@/types'
import './index.scss'

const ColorLink: React.FC = () => {
  const { user } = useUserStore()
  // 每个词语对应的颜色 hex
  const [wordColors, setWordColors] = useState<Record<string, string>>({})
  // 当前选中的词语（等待分配颜色）
  const [activeWord, setActiveWord] = useState<BodyWord | null>(null)
  // 当前从色轮选取的颜色
  const [currentHex, setCurrentHex] = useState('#e2574c')
  const [saving, setSaving] = useState(false)
  const pickerRef = useRef<HTMLInputElement>(null)

  const allDone = BODY_WORDS.every((w) => !!wordColors[w])

  // 点击色轮 → 触发隐藏的颜色选择器
  const handleWheelClick = () => {
    if (!activeWord) {
      Taro.showToast({ title: '请先点击下方的词语', icon: 'none' })
      return
    }
    pickerRef.current?.click()
  }

  // 颜色选择器变化
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value
    setCurrentHex(hex)
    if (activeWord) {
      setWordColors((prev) => ({ ...prev, [activeWord]: hex }))
    }
  }

  // 点击词语
  const handleWordClick = (word: BodyWord) => {
    setActiveWord(word === activeWord ? null : word)
  }

  // 重置
  const handleReset = () => {
    setWordColors({})
    setActiveWord(null)
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

      {/* 色轮 */}
      <View className='cl-wheel-section'>
        <View className='cl-wheel-wrapper'>
          <View className='cl-wheel' onClick={handleWheelClick} />
          <View className='cl-picker-wrapper'>
            <input
              ref={pickerRef}
              className='cl-picker'
              type='color'
              value={currentHex}
              onChange={handleColorChange}
            />
          </View>
        </View>
        {activeWord && (
          <Text className='cl-active-hint'>
            点击色轮为「{activeWord}」选色
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
