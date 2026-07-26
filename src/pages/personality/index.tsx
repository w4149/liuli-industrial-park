import React, { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import RidgeBeastTest from '@/components/RidgeBeastTest'
import { RidgeBeastPersonality } from '@/types'
import { BEAST_PROFILES, DIM_LABELS, IMMORTAL_INFO, BEAST_TEST_INSPIRATION_REWARD, BEAST_TEST_BADGE_ID } from '@/data/ridgeBeasts'
import { api } from '@/services/api'
import { useUserStore } from '@/store/useUserStore'
import './index.scss'

const STORAGE_KEY = 'ridge_beast_result'
const REWARDED_KEY = 'ridge_beast_rewarded'
const IMMORTAL_REWARDED_KEY = 'ridge_beast_immortal_rewarded'
const CONFIDENCE_BLUR = 0.15 // 置信度低于此值时提示"介于两兽之间"

const DIM_ORDER = ['V', 'J', 'R', 'C'] as const

const Personality: React.FC = () => {
  const { user, updateInspirationValue } = useUserStore()
  const [personality, setPersonality] = useState<RidgeBeastPersonality | null>(null)
  const [testing, setTesting] = useState(false)

  // 优先读本地存档，其次读用户档案
  useEffect(() => {
    try {
      const saved = Taro.getStorageSync(STORAGE_KEY)
      if (saved && saved.type) {
        setPersonality(saved as RidgeBeastPersonality)
        return
      }
    } catch { /* ignore */ }
    if (user?.ridge_beast_personality) {
      setPersonality(user.ridge_beast_personality)
    }
  }, [])

  const grantRewards = async (result: RidgeBeastPersonality) => {
    const rewards: string[] = []

    // 首测奖励：灵感值 + 识兽者徽章
    const rewarded = Taro.getStorageSync(REWARDED_KEY)
    if (!rewarded) {
      Taro.setStorageSync(REWARDED_KEY, '1')
      rewards.push(`灵感值 +${BEAST_TEST_INSPIRATION_REWARD}`)
      rewards.push('徽章「识兽者」')
      if (user) {
        updateInspirationValue((user.inspiration_value || 0) + BEAST_TEST_INSPIRATION_REWARD)
        api.user.addInspiration(user.id, BEAST_TEST_INSPIRATION_REWARD)
        api.achievement.awardBadge(user.id, BEAST_TEST_BADGE_ID)
      }
    }

    // 骑凤仙人隐藏彩蛋
    if (result.is_immortal && !Taro.getStorageSync(IMMORTAL_REWARDED_KEY)) {
      Taro.setStorageSync(IMMORTAL_REWARDED_KEY, '1')
      rewards.push(`隐藏徽章「${IMMORTAL_INFO.name}」`)
      if (user) {
        api.achievement.awardBadge(user.id, IMMORTAL_INFO.badgeId)
      }
    }

    if (rewards.length > 0) {
      Taro.showToast({ title: `获得：${rewards.join('、')}`, icon: 'none', duration: 3000 })
    }
  }

  const handleComplete = (result: RidgeBeastPersonality) => {
    setPersonality(result)
    setTesting(false)
    Taro.setStorageSync(STORAGE_KEY, result)
    if (user) {
      api.user.savePersonality(user.id, result)
    }
    grantRewards(result)
  }

  const handleRetest = () => {
    Taro.showModal({
      title: '重新测试',
      content: '重测后将覆盖当前的脊兽人格档案，确定吗？',
      success: (res) => {
        if (res.confirm) setTesting(true)
      },
    })
  }

  const handleShare = () => {
    if (!personality) return
    const profile = BEAST_PROFILES[personality.type]
    const text = `我在琉璃园区测出了我的脊兽人格：${profile.type}·${profile.alias}（${profile.glaze.name}）——「${profile.kilnWord}」快来测测你是屋脊上的哪尊脊兽！`
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: '分享文案已复制', icon: 'success' }),
    })
  }

  const handleBack = () => {
    if (testing) {
      setTesting(false)
      return
    }
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/index/index' }),
    })
  }

  if (testing || !personality) {
    return (
      <View className="personality-page">
        <View className="header">
          <Text className="header-back-btn" onClick={handleBack}>←</Text>
          <Text className="title">脊兽人格测试</Text>
        </View>
        <View className="test-container">
          <RidgeBeastTest onComplete={handleComplete} />
        </View>
      </View>
    )
  }

  const profile = BEAST_PROFILES[personality.type]
  const secondary = personality.secondary_type ? BEAST_PROFILES[personality.secondary_type] : null
  const partner = BEAST_PROFILES[profile.partner]
  const isBlurry = typeof personality.confidence === 'number' && personality.confidence < CONFIDENCE_BLUR

  return (
    <View className="personality-page">
      <View className="header">
        <Text className="header-back-btn" onClick={handleBack}>←</Text>
        <Text className="title">我的脊兽人格</Text>
      </View>

      <View className="result-container">
        {/* 釉色主卡 */}
        <View className="glaze-card" style={{ background: profile.glaze.gradient, color: profile.glaze.textColor }}>
          <Text className="glaze-name">{profile.glaze.name}</Text>
          <View className="beast-figure">
            {personality.customized_image || profile.image ? (
              <Image className="beast-image" src={personality.customized_image || profile.image} mode="aspectFit" />
            ) : (
              <Text className="beast-emoji">{profile.emoji}</Text>
            )}
          </View>
          <Text className="beast-name">{profile.type}</Text>
          <Text className="beast-alias">{profile.alias}</Text>
          <Text className="beast-position">{profile.positionLabel}</Text>
          <View className="traits-row">
            {personality.traits.map((trait, index) => (
              <Text key={index} className="glaze-trait">{trait}</Text>
            ))}
          </View>
          {isBlurry && secondary && (
            <Text className="blurry-tip">你介于「{profile.type}」与「{secondary.type}」之间，更偏{profile.type}一些</Text>
          )}
        </View>

        {/* 骑凤仙人彩蛋 */}
        {personality.is_immortal && (
          <View className="immortal-card">
            <Text className="immortal-emoji">{IMMORTAL_INFO.emoji}</Text>
            <View className="immortal-info">
              <Text className="immortal-title">隐藏彩蛋 · {IMMORTAL_INFO.name}</Text>
              <Text className="immortal-desc">{IMMORTAL_INFO.description}</Text>
            </View>
          </View>
        )}

        {/* 古建职能 */}
        <View className="detail-card">
          <Text className="detail-label">屋脊职能</Text>
          <Text className="detail-text">{profile.duty}</Text>
        </View>

        {/* 性格解读 */}
        <View className="detail-card">
          <Text className="detail-label">性格解读</Text>
          <Text className="detail-text">{personality.description}</Text>
          <Text className="shadow-text">⚠ 阴影面：{profile.shadow}</Text>
        </View>

        {/* 四维得分 */}
        {personality.scores && (
          <View className="detail-card">
            <Text className="detail-label">四维画像</Text>
            {DIM_ORDER.map((dim) => {
              const value = personality.scores![dim]
              const meta = DIM_LABELS[dim]
              return (
                <View key={dim} className="dim-row">
                  <Text className="dim-side left">{meta.negative}</Text>
                  <View className="dim-track">
                    <View className="dim-center-line" />
                    <View
                      className="dim-fill"
                      style={{
                        left: value >= 0 ? '50%' : `${50 + value * 50}%`,
                        width: `${Math.abs(value) * 50}%`,
                        background: profile.glaze.color,
                      }}
                    />
                  </View>
                  <Text className="dim-side right">{meta.positive}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* 副脊兽与相生搭档 */}
        <View className="relation-row">
          {secondary && (
            <View className="relation-card">
              <Text className="relation-label">副脊兽</Text>
              <Text className="relation-emoji">{secondary.emoji}</Text>
              <Text className="relation-name">{secondary.type}·{secondary.alias}</Text>
            </View>
          )}
          <View className="relation-card">
            <Text className="relation-label">相生搭档</Text>
            <Text className="relation-emoji">{partner.emoji}</Text>
            <Text className="relation-name">{partner.type}·{partner.alias}</Text>
          </View>
        </View>

        {/* 窑语金句 */}
        <View className="kiln-word-card" style={{ borderColor: profile.glaze.color }}>
          <Text className="kiln-word" style={{ color: profile.glaze.colorDark }}>「{profile.kilnWord}」</Text>
          <Text className="kiln-word-source">—— 窑语 · {profile.type}</Text>
        </View>

        <button className="share-btn" onClick={handleShare}>分享我的脊兽人格</button>
        <button className="retry-btn" onClick={handleRetest}>再测一次</button>
      </View>
    </View>
  )
}

export default Personality
