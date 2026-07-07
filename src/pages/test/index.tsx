import React from 'react'
import { View, Text } from '@tarojs/components'
import './index.scss'

const Test: React.FC = () => {
  return (
    <View className="test-page">
      <Text className="test-title">测试页面</Text>
      <Text className="test-text">手机端测试成功！</Text>
      <Text className="test-info">当前时间：{new Date().toLocaleString()}</Text>
    </View>
  )
}

export default Test