import Taro from '@tarojs/taro'
import { api } from '@/services/api'

// 自定义咒语（开发者模式[咒语设置]维护，躲猫猫页面消费）
// 云端 hide_seek_spells 表是唯一权威来源，本地仅作缓存；
// 每轮重置只清使用次数与玩家状态，咒语本身跨轮次保留
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

// 从云端拉取咒语并刷新本地缓存；网络失败时保留现有缓存不动
export const refreshCustomSpellsFromCloud = async (): Promise<CustomSpell[]> => {
  try {
    const rows = await api.hideSeek.getSpells()
    const list: CustomSpell[] = rows.map((r) => ({
      id: r.id,
      spell: r.spell,
      type: r.type as CustomSpell['type'],
      ...(r.beast ? { beast: r.beast } : {}),
      ...(r.minutes ? { minutes: r.minutes } : {}),
    }))
    saveCustomSpells(list)
    return list
  } catch {
    return getCustomSpells()
  }
}
