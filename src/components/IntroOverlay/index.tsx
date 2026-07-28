import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import './index.scss'

interface IntroOverlayProps {
  /** sessionStorage 计数 key（会话模式）：第 N 次进入显示第 N 套文案，超出后不再显示 */
  sessionKey?: string
  /** 单套文案（等价于 linesList 只有一套） */
  lines?: string[]
  /** 多套文案：按进入次数依次显示（第 1 次 linesList[0]，第 2 次 linesList[1]…） */
  linesList?: string[][]
  /** 受控模式：由父组件控制挂载，关闭时回调（不读写 sessionStorage） */
  onClose?: () => void
}

// 引导浮层：文案逐行淡入上浮（间隔 1.5s），点击任意处关闭
// 会话模式：sessionStorage 计数（关闭浏览器后清空），按进入次数轮换文案
// 受控模式：不传 sessionKey，父组件条件渲染 + onClose 回调
const IntroOverlay: React.FC<IntroOverlayProps> = ({ sessionKey, lines, linesList, onClose }) => {
  const [activeLines] = useState<string[] | null>(() => {
    const list = linesList ?? (lines ? [lines] : [])
    if (list.length === 0) return null
    if (!sessionKey) return list[0] // 受控模式
    try {
      const count = parseInt(sessionStorage.getItem(sessionKey) || '0', 10) || 0
      return count < list.length ? list[count] : null
    } catch { return null }
  })
  const [dismissed, setDismissed] = useState(false)

  // 会话模式：显示后进入次数 +1
  useEffect(() => {
    if (!activeLines || !sessionKey) return
    try {
      const count = parseInt(sessionStorage.getItem(sessionKey) || '0', 10) || 0
      sessionStorage.setItem(sessionKey, String(count + 1))
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!activeLines || dismissed) return null

  const handleClose = () => {
    setDismissed(true)
    onClose?.()
  }

  return (
    <View className='intro-mask' onClick={handleClose}>
      <View className='intro-body'>
        {activeLines.map((line, i) => (
          <Text
            key={`${i}-${line}`}
            className='intro-line'
            style={{ animationDelay: `${0.4 + i * 1.5}s` }}
          >
            {line}
          </Text>
        ))}
        <Text
          className='intro-hint'
          style={{ animationDelay: `${0.4 + activeLines.length * 1.5}s` }}
        >
          轻触任意处继续
        </Text>
      </View>
    </View>
  )
}

export default IntroOverlay
