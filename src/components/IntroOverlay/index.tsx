import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import './index.scss'

interface IntroOverlayProps {
  /** sessionStorage 标记 key，同一浏览器会话内只显示一次 */
  sessionKey: string
  /** 逐行淡入的文案 */
  lines: string[]
}

// 会话内首次进入页面时的引导浮层：文案逐行淡入上浮，点击任意处关闭
// （sessionStorage 关闭浏览器后自动清空，下次访问重新显示）
const IntroOverlay: React.FC<IntroOverlayProps> = ({ sessionKey, lines }) => {
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem(sessionKey) } catch { return false }
  })
  useEffect(() => {
    if (!show) return
    try { sessionStorage.setItem(sessionKey, '1') } catch { /* ignore */ }
  }, [show, sessionKey])

  if (!show) return null
  return (
    <View className='intro-mask' onClick={() => setShow(false)}>
      <View className='intro-body'>
        {lines.map((line, i) => (
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
          style={{ animationDelay: `${0.4 + lines.length * 1.5}s` }}
        >
          轻触任意处继续
        </Text>
      </View>
    </View>
  )
}

export default IntroOverlay
