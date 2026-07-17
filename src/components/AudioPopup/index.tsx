import React, { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import './index.scss'

interface AudioPopupProps {
  visible: boolean
  pointNames: string[]
  onClose?: () => void
}

const AudioPopup: React.FC<AudioPopupProps> = ({ visible, pointNames, onClose }) => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      // 5 秒后自动收起
      const timer = setTimeout(() => {
        setShow(false)
        if (onClose) onClose()
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [visible, pointNames])

  if (!show) return null

  const handleView = () => {
    setShow(false)
    if (onClose) onClose()
    Taro.navigateTo({ url: '/pages/audio/index' })
  }

  const handleClose = () => {
    setShow(false)
    if (onClose) onClose()
  }

  return (
    <View className={`audio-popup ${show ? 'show' : ''}`}>
      <View className='audio-popup-content'>
        <View className='audio-popup-icon'>
          <Text>🎵</Text>
        </View>
        <View className='audio-popup-info'>
          <Text className='audio-popup-title'>有声音讯息可查看</Text>
          <Text className='audio-popup-subtitle'>{pointNames.join('、')}</Text>
        </View>
        <View className='audio-popup-actions'>
          <View className='audio-popup-btn view-btn' onClick={handleView}>
            <Text>查看</Text>
          </View>
          <View className='audio-popup-close' onClick={handleClose}>
            <Text>×</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default AudioPopup
