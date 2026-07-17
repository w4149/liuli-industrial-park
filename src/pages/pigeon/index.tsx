import React, { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import { PigeonLetter } from '@/types'
import './index.scss'

// 信鸽可选颜色调色板
const COLOR_PALETTE = [
  '#e2574c', '#f5a623', '#f8d347', '#7ed321',
  '#4a90d9', '#667eea', '#a78bfa', '#e56cd6',
  '#50e3c2', '#b8956a', '#ff8a80', '#90a4ae',
]

const TRACK_COUNT = 5

const Pigeon: React.FC = () => {
  const { user } = useUserStore()
  const [letters, setLetters] = useState<PigeonLetter[]>([])
  const [drafts, setDrafts] = useState<PigeonLetter[]>([])
  const [selectedLetter, setSelectedLetter] = useState<PigeonLetter | null>(null)

  const [showCompose, setShowCompose] = useState(false)
  const [sender, setSender] = useState('')
  const [receiver, setReceiver] = useState('')
  const [content, setContent] = useState('')
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[5])
  const [sending, setSending] = useState(false)

  const stampInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = async () => {
    try {
      const [all, dfs] = await Promise.all([
        api.pigeon.getAllLetters(),
        api.pigeon.getDrafts(),
      ])
      setLetters(all)
      setDrafts(dfs)
    } catch (e) {
      console.warn('加载信件失败:', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCompose = (draft?: PigeonLetter) => {
    if (draft) {
      setSender(draft.sender_name)
      setReceiver(draft.receiver_name)
      setContent(draft.content)
      setSelectedColor(draft.color || COLOR_PALETTE[5])
    } else {
      setSender(user?.nickname || '')
      setReceiver('')
      setContent('')
      setSelectedColor(COLOR_PALETTE[5])
    }
    setShowCompose(true)
  }

  const validateFields = (): boolean => {
    if (!sender.trim() || !receiver.trim() || !content.trim()) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return false
    }
    return true
  }

  const handleSaveDraft = async () => {
    if (!validateFields()) return
    try {
      await api.pigeon.saveDraft({
        sender_name: sender.trim(),
        receiver_name: receiver.trim(),
        content: content.trim(),
        stamp_url: '',
        color: selectedColor,
      })
      Taro.showToast({ title: '已存为草稿', icon: 'success' })
      setShowCompose(false)
      await loadData()
    } catch (e) {
      console.warn('保存草稿失败:', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  // 点击发送 → 需要先拍摄鸟照片作为邮票
  const handleSendClick = () => {
    if (!validateFields()) return
    stampInputRef.current?.click()
  }

  const onStampSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSending(true)
    Taro.showLoading({ title: '寄出中...' })
    try {
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1000)}.jpg`
      const stampUrl = await api.pigeon.uploadStamp(file, fileName)
      await api.pigeon.createLetter({
        sender_name: sender.trim(),
        receiver_name: receiver.trim(),
        content: content.trim(),
        stamp_url: stampUrl,
        color: selectedColor,
        is_draft: false,
      })
      Taro.hideLoading()
      Taro.showToast({ title: '信鸽已放飞', icon: 'success' })
      setShowCompose(false)
      await loadData()
    } catch (err) {
      Taro.hideLoading()
      console.warn('发送失败:', err)
      Taro.showToast({ title: '发送失败，请重试', icon: 'none' })
    } finally {
      setSending(false)
      if (stampInputRef.current) stampInputRef.current.value = ''
    }
  }

  return (
    <View className='pigeon-page'>
      <View className='pg-header'>
        <View className='pg-back' onClick={() => Taro.navigateBack()}>
          <Text>‹</Text>
        </View>
        <Text className='pg-title'>飞鸽传书</Text>
      </View>

      {/* 信鸽弹幕区 */}
      <View className='pg-danmaku'>
        {letters.length === 0 && (
          <View className='pg-empty'>
            <Text>还没有信鸽飞过，快写下第一封信吧</Text>
          </View>
        )}
        {letters.map((letter, index) => {
          const track = index % TRACK_COUNT
          const duration = 10 + (index % 5) * 2
          const delay = -(index * 2.5) % duration
          return (
            <View
              key={letter.id}
              className='pg-pigeon'
              style={{
                top: `${8 + track * 15}%`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              }}
              onClick={() => setSelectedLetter(letter)}
            >
              <View className='pg-pigeon-body' style={{ background: letter.color }}>
                <Text className='pg-pigeon-icon'>🕊️</Text>
              </View>
              <Text className='pg-pigeon-label'>{letter.receiver_name}</Text>
            </View>
          )
        })}
      </View>

      {/* 写信按钮 */}
      <View className='pg-compose-btn' onClick={() => openCompose()}>
        <Text>✉️ 写信</Text>
      </View>

      {/* 隐藏的邮票拍照输入 */}
      <input
        ref={stampInputRef}
        type='file'
        accept='image/*'
        capture='environment'
        style={{ display: 'none' }}
        onChange={onStampSelected}
      />

      {/* 信件展开弹窗 */}
      {selectedLetter && (
        <View className='pg-letter-mask' onClick={() => setSelectedLetter(null)}>
          <View className='pg-letter' onClick={(e) => e.stopPropagation()}>
            <View className='pg-letter-paper'>
              <Text className='pg-letter-to'>亲爱的 {selectedLetter.receiver_name}：</Text>
              <Text className='pg-letter-content'>{selectedLetter.content}</Text>
              <Text className='pg-letter-from'>—— {selectedLetter.sender_name}</Text>
              {selectedLetter.stamp_url ? (
                <View
                  className='pg-letter-stamp'
                  style={{ backgroundImage: `url(${selectedLetter.stamp_url})` }}
                />
              ) : null}
            </View>
            <View className='pg-letter-close' onClick={() => setSelectedLetter(null)}>
              <Text>关闭</Text>
            </View>
          </View>
        </View>
      )}

      {/* 写信面板 */}
      {showCompose && (
        <View className='pg-panel-mask' onClick={() => setShowCompose(false)}>
          <View className='pg-panel' onClick={(e) => e.stopPropagation()}>
            <Text className='pg-panel-title'>写一封信</Text>

            {drafts.length > 0 && (
              <View className='pg-draft-list'>
                <Text className='pg-draft-title'>草稿箱</Text>
                <View className='pg-draft-items'>
                  {drafts.map((d) => (
                    <View key={d.id} className='pg-draft-item' onClick={() => openCompose(d)}>
                      <View className='pg-draft-dot' style={{ background: d.color }} />
                      <Text className='pg-draft-text'>发往 {d.receiver_name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <input
              className='pg-input'
              placeholder='写信人'
              value={sender}
              onChange={(e) => setSender(e.target.value)}
            />
            <input
              className='pg-input'
              placeholder='收信人'
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
            />
            <textarea
              className='pg-textarea'
              placeholder='想说的话...'
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            <Text className='pg-color-title'>选择信鸽颜色</Text>
            <View className='pg-color-palette'>
              {COLOR_PALETTE.map((c) => (
                <View
                  key={c}
                  className={`pg-color-dot ${selectedColor === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setSelectedColor(c)}
                />
              ))}
            </View>

            <View className='pg-panel-actions'>
              <View className='pg-panel-btn' onClick={handleSaveDraft}>
                <Text>存为草稿</Text>
              </View>
              <View
                className={`pg-panel-btn primary ${sending ? 'disabled' : ''}`}
                onClick={handleSendClick}
              >
                <Text>📷 拍鸟邮票并发送</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default Pigeon
