import Taro from '@tarojs/taro'

// 自定义咒语（开发者模式[咒语设置]维护，躲猫猫页面消费）
// 每轮重置时一并清空，新一轮需重新添加
export interface CustomSpell {
  id: string
  spell: string
  // disguise: 变身咒语（被探查时伪装成 beast，仅被动使用）
  // identity: 身份咒语（对应脊兽 beast）
  // renew: 续命咒语（倒计时增加 minutes 分钟）
  // probe: 探查咒语（指定在场玩家现形 5 分钟）
  type: 'disguise' | 'identity' | 'renew' | 'probe'
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
