import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import RidgeBeastTest from '@/components/RidgeBeastTest'
import { RidgeBeastPersonality } from '@/types'
import './index.scss'

const Personality: React.FC = () => {
  const [personality, setPersonality] = useState<RidgeBeastPersonality | null>(null)

  const handleComplete = (result: RidgeBeastPersonality) => {
    setPersonality(result)
  }

  if (!personality) {
    return (
      <View className="personality-page">
        <View className="header">
          <Text className="title">脊兽人格测试</Text>
        </View>
        <View className="test-container">
          <RidgeBeastTest onComplete={handleComplete} />
        </View>
      </View>
    )
  }

  return (
    <View className="personality-page">
      <View className="header">
        <Text className="title">测试结果</Text>
      </View>
      <View className="result-container">
        <View className="result-card">
          <View className="beast-icon-large">
            <span>{personality.type}</span>
          </View>
          <Text className="result-title">你的脊兽人格是</Text>
          <Text className="beast-type">{personality.type}</Text>
          <View className="traits-list">
            {personality.traits.map((trait, index) => (
              <span key={index} className="trait-tag">{trait}</span>
            ))}
          </View>
          <Text className="result-desc">{personality.description}</Text>
          <button className="share-btn">分享我的脊兽人格</button>
          <button className="retry-btn" onClick={() => setPersonality(null)}>
            再测一次
          </button>
        </View>
      </View>
    </View>
  )
}

export default Personality
