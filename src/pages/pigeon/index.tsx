import React, { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import { PigeonLetter } from '@/types'
import { processStampImage } from '@/utils/imageProcess'
import IntroOverlay from '@/components/IntroOverlay'
import './index.scss'

// 默认信鸽颜色（未选图时的占位色）
const DEFAULT_PIGEON_COLOR = '#667eea'

const TRACK_COUNT = 5

// 前三次进入的引导文案（浏览器会话内按次数轮换，超过三次不再显示）
const INTRO_LINES_LIST = [
  [
    '你要靠得足够近，把身体贴上烟囱。',
    '向上看，尽可能把下巴抬高。',
    '这是烟囱的视角。',
    '抱住，环抱住。',
    '或许你会看到一小片天，',
    '或许你会听到一些小鸟，',
    '或许你会想到某些人和事情，',
    '或许，想要写信给TA。',
  ],
  [
    '全身的血液都在倒流，',
    '脸越来越红，',
    '脚越来越白，',
    '慢慢失去知觉。',
    '嗯，我太想长高了。',
  ],
  [
    '全身的体重倒过来，',
    '看到的世界都变形了。',
    '下来的时候需要站很久',
    '才能知道脚踩在了地上，',
    '直到传来星星点点的刺感，',
    '每走一步都在不断加多，',
    '像在放鞭炮。',
  ],
]

const Pigeon: React.FC = () => {
  const { user } = useUserStore()
  const [letters, setLetters] = useState<PigeonLetter[]>([])
  const [drafts, setDrafts] = useState<PigeonLetter[]>([])
  const [selectedLetter, setSelectedLetter] = useState<PigeonLetter | null>(null)

  const [showCompose, setShowCompose] = useState(false)
  const [sender, setSender] = useState('')
  const [receiver, setReceiver] = useState('')
  const [content, setContent] = useState('')
  // 处理后的邮票：像素化 Blob + 从原图提取的主色（用作信鸽颜色）
  const [processedStamp, setProcessedStamp] = useState<{
    blob: Blob
    color: string
    previewUrl: string
  } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [sending, setSending] = useState(false)
  // 当前被点击暂停的信鸽 id（点击后该信鸽停止滚动，便于查看）
  const [pausedLetterId, setPausedLetterId] = useState<string | null>(null)

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
    } else {
      setSender(user?.nickname || '')
      setReceiver('')
      setContent('')
    }
    // 每次打开写信面板都清空已处理的邮票，让用户重新选择图片
    setProcessedStamp(null)
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
      let stampUrl = ''
      if (processedStamp) {
        // 草稿也走 Storage 上传，避免 dataURL 太长被数据库截断
        const fileName = `draft-${Date.now()}-${Math.round(Math.random() * 1000)}.jpg`
        const stampFile = new File(
          [processedStamp.blob],
          fileName,
          { type: 'image/jpeg' }
        )
        stampUrl = await api.pigeon.uploadStamp(stampFile, fileName)
      }
      await api.pigeon.saveDraft({
        sender_name: sender.trim(),
        receiver_name: receiver.trim(),
        content: content.trim(),
        stamp_url: stampUrl,
        color: processedStamp?.color || DEFAULT_PIGEON_COLOR,
      })
      Taro.showToast({ title: '已存为草稿', icon: 'success' })
      setShowCompose(false)
      await loadData()
    } catch (e) {
      console.warn('保存草稿失败:', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  // 点击发送 → 需要先选择图片作为邮票，图片会先被像素化压缩并提取主色
  const handleSendClick = () => {
    if (!validateFields()) return
    stampInputRef.current?.click()
  }

  const onStampSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessing(true)
    Taro.showLoading({ title: '图像处理中...' })
    try {
      // 像素化压缩 + 提取主色（信鸽颜色）
      const result = await processStampImage(file, 12)
      setProcessedStamp(result)
      Taro.hideLoading()
      Taro.showToast({ title: '图片已处理，可发送', icon: 'none', duration: 1500 })
    } catch (err) {
      Taro.hideLoading()
      console.warn('图像处理失败:', err)
      Taro.showToast({ title: '图像处理失败', icon: 'none' })
    } finally {
      setProcessing(false)
      if (stampInputRef.current) stampInputRef.current.value = ''
    }
  }

  // 实际发送：使用已处理的邮票 Blob 上传
  const handleSendNow = async () => {
    if (!processedStamp) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }
    setSending(true)
    Taro.showLoading({ title: '寄出中...' })
    try {
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1000)}.jpg`
      // 上传像素化后的 Blob（包装为 File 以符合 API 签名）
      const stampFile = new File(
        [processedStamp.blob],
        fileName,
        { type: 'image/jpeg' }
      )
      const stampUrl = await api.pigeon.uploadStamp(stampFile, fileName)
      await api.pigeon.createLetter({
        sender_name: sender.trim(),
        receiver_name: receiver.trim(),
        content: content.trim(),
        stamp_url: stampUrl,
        color: processedStamp.color,
        is_draft: false,
      })
      Taro.hideLoading()
      Taro.showToast({ title: '信鸽已放飞', icon: 'success' })
      setShowCompose(false)
      setProcessedStamp(null)
      await loadData()
    } catch (err) {
      Taro.hideLoading()
      console.warn('发送失败:', err)
      Taro.showToast({ title: '发送失败，请重试', icon: 'none' })
    } finally {
      setSending(false)
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
          // 弹幕整体减慢：25s ~ 40s 一屏，便于用户点击查看
          const duration = 25 + (index % 6) * 3
          const delay = -(index * 4) % duration
          const isPaused = pausedLetterId === letter.id
          return (
            // 外层 wrapper 只负责水平飞行动画
            <View
              key={letter.id}
              className='pg-pigeon-track'
              style={{
                top: `${8 + track * 15}%`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
                animationPlayState: isPaused ? 'paused' : 'running',
              }}
            >
              {/* 内层信鸽：负责暂停时的缩放 + 点击交互 */}
              <View
                className={`pg-pigeon ${isPaused ? 'pg-pigeon-paused' : ''}`}
                onClick={() => {
                  if (isPaused) {
                    // 再次点击同一只信鸽：展开信件并恢复滚动
                    setSelectedLetter(letter)
                    setPausedLetterId(null)
                  } else {
                    // 第一次点击：暂停该信鸽，便于查看
                    setPausedLetterId(letter.id)
                  }
                }}
              >
                <View className='pg-pigeon-body' style={{ background: letter.color }}>
                  <Text className='pg-pigeon-icon'>🕊️</Text>
                </View>
                <Text className='pg-pigeon-label'>{letter.receiver_name}</Text>
              </View>
            </View>
          )
        })}
      </View>

      {/* 写信按钮 */}
      <View className='pg-compose-btn' onClick={() => openCompose()}>
        <Text>✉️ 写信</Text>
      </View>

      {/* 进入引导（会话内前三次，文案轮换） */}
      <IntroOverlay sessionKey='pigeon_intro_shown' linesList={INTRO_LINES_LIST} />

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

            {processedStamp ? (
              <View className='pg-stamp-preview'>
                <View
                  className='pg-stamp-image'
                  style={{ backgroundImage: `url(${processedStamp.previewUrl})` }}
                />
                <View className='pg-stamp-info'>
                  <Text className='pg-stamp-label'>信鸽颜色（已自动提取）</Text>
                  <View
                    className='pg-stamp-color'
                    style={{ background: processedStamp.color }}
                  />
                </View>
              </View>
            ) : (
              <Text className='pg-stamp-hint'>点击“选择图片并发送”后，图片会被像素化压缩，信鸽颜色将从图片主色自动提取</Text>
            )}

            <View className='pg-panel-actions'>
              <View className='pg-panel-btn' onClick={handleSaveDraft}>
                <Text>存为草稿</Text>
              </View>
              <View
                className={`pg-panel-btn primary ${(sending || processing) ? 'disabled' : ''}`}
                onClick={processedStamp ? handleSendNow : handleSendClick}
              >
                <Text>{processedStamp ? '🕊️ 发送信鸽' : '📷 选择图片并发送'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default Pigeon
