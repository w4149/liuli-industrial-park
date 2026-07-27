import Taro from '@tarojs/taro'

// 自定义咒语（开发者模式[咒语设置]维护，躲猫猫页面消费）
// 存储 key 不在躲猫猫重置清单内 —— 重置游戏时自定义咒语保留
export interface CustomSpell {
  id: string
  spell: string
  // disguise: 变身咒语（变成 beast 5 分钟）
  // identity: 身份咒语（对应脊兽 beast）
  // renew: 续命咒语（倒计时增加 minutes 分钟）
  type: 'disguise' | 'identity' | 'renew'
  beast?: string
  minutes?: number
}

export const CUSTOM_SPELLS_STORAGE = 'hide_seek_custom_spells'

export const getCustomSpells = (): CustomSpell[] => {
  try {
    const v = Taro.getStorageSync(CUSTOM_SPELLS_STORAGE)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export const saveCustomSpells = (list: CustomSpell[]) => {
  try {
    Taro.setStorageSync(CUSTOM_SPELLS_STORAGE, list)
  } catch {
    // ignore
  }
}
