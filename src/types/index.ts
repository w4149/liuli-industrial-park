export interface User {
  id: string;
  openid: string;
  nickname: string;
  avatar: string;
  inspiration_value: number;
  badges: string[];
  spatial_profile: SpatialProfile;
  ridge_beast_personality: RidgeBeastPersonality | null;
  created_at: string;
  updated_at: string;
}

export interface POI {
  id: string;
  name: string;
  type: 'exhibit' | 'interactive' | 'landmark' | 'shop';
  coordinate: { lat: number; lng: number };
  beacon_uuid: string | null;
  radius: number;
  description: string;
  interactions: Interaction[];
  created_at: string;
}

export interface Interaction {
  id: string;
  poi_id: string;
  type: 'guide' | 'achievement' | 'hidden';
  content: string;
  trigger_condition: 'enter' | 'stay' | 'exit';
  reward?: { type: 'inspiration'; value: number };
}

export interface InspirationMessage {
  id: string;
  author_id: string;
  poi_id: string;
  content: string;
  likes: number;
  adoptions: number;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  pixel_image: string;
  condition: AchievementCondition;
  rarity: 'common' | 'rare' | 'legendary';
}

export interface AchievementCondition {
  type: 'quiz' | 'visit' | 'collect';
  target: string;
  value: number;
}

export interface SpatialProfile {
  total_visit_duration: number;
  most_visited_pois: string[];
  route_pattern: 'explorer' | 'efficient' | 'lingerer';
  discovered_hidden_details: number;
  inspiration_adoptions: number;
}

export type RidgeBeastType = '龙' | '凤' | '狮子' | '天马' | '海马' | '狻猊' | '狎鱼' | '獬豸' | '斗牛' | '行什';

export interface RidgeBeastScores {
  V: number; // 视野：广游开拓(+) / 深耕沉潜(-)
  J: number; // 判断：理法明辨(+) / 情美直觉(-)
  R: number; // 站位：台前引领(+) / 幕后守护(-)
  C: number; // 应对：迎击化解(+) / 未雨绸缪(-)
}

export interface RidgeBeastPersonality {
  type: RidgeBeastType;
  traits: string[];
  description: string;
  customized_image: string;
  scores?: RidgeBeastScores; // 四维归一化得分（-1 ~ +1）
  secondary_type?: RidgeBeastType; // 副脊兽（次近原型）
  confidence?: number; // 匹配置信度 0~1（1 - d1/d2）
  is_immortal?: boolean; // 是否触发骑凤仙人隐藏彩蛋
  tested_at?: string; // 最近一次测试时间
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  stock: number;
}

// 脊兽躲猫猫：玩家实时位置（GCJ02）
export interface HideSeekPresence {
  id: string;
  user_key: string;
  nickname: string;
  beast_type: string; // RidgeBeastType 或空字符串（未测试）
  lng: number;
  lat: number;
  updated_at: string;
}

// 躲猫猫对决事件：输入对方身份咒语产生一条记录
export interface HideSeekDuel {
  id: string;
  attacker_key: string;
  attacker_name: string;
  attacker_beast: string; // 发起方当时的脊兽（含变身态）
  target_spell: string; // 被点名的身份咒语
  created_at: string;
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

// 用户留下的声音标记
export interface AudioMarker {
  id: string;
  user_id: string;
  user_nickname: string;
  zone_name: string; // 关联校准点名称
  coordinate: { lat: number; lng: number };
  audio_url: string; // Supabase Storage 中的路径
  audio_name: string; // 用户给音频取的名字
  duration: number; // 时长（秒）
  created_at: string;
}

// 飞鸽传书信件
export interface PigeonLetter {
  id: string;
  sender_name: string; // 写信人
  receiver_name: string; // 收信人
  content: string; // 信件内容
  stamp_url: string; // 邮票图片（鸟照片）
  color: string; // 信鸽独特颜色
  is_draft: boolean; // 是否为草稿
  created_at: string;
}

// ===== 身体档案 / 连线游戏 / 身体状态记录 =====

// 七种颜色（连线游戏 + 身体涂色）
export type BodyColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple'

// 七个感受词（由选色游戏建立映射）
export type BodyWord = '疼痛' | '轻松' | '紧张' | '沉重' | '柔软' | '控制' | '不自觉'

// 七个感受词列表
export const BODY_WORDS: BodyWord[] = ['疼痛', '轻松', '紧张', '沉重', '柔软', '控制', '不自觉']

// 选色游戏结果：记录用户为每个感受词选择的颜色（hex）
export interface ColorWordLink {
  id: string
  user_id: string
  word_疼痛: string   // hex color
  word_轻松: string
  word_紧张: string
  word_沉重: string
  word_柔软: string
  word_控制: string
  word_不自觉: string
  created_at: string
}

// 身体状态记录：每次涂色提交的快照
export interface BodyRecord {
  id: string
  user_id: string
  // 键 = 身体部位名，值 = 颜色 hex（如 '#e2574c'）
  body_map: Record<string, string>
  first_part: string | null
  created_at: string
}

// 身体小故事：用户分享的具体叙述
export interface BodyStory {
  id: string
  user_id: string
  body_part: string
  color: string  // hex color
  word: string
  story: string
  body_record_id: string | null
  created_at: string
}

// 身体部位完整列表（24 个）
export const BODY_PARTS: { key: string; label: string }[] = [
  { key: 'head', label: '头' },
  { key: 'neck', label: '脖子' },
  { key: 'shoulder', label: '肩膀' },
  { key: 'chest', label: '胸口' },
  { key: 'belly', label: '肚子' },
  { key: 'spine', label: '脊椎' },
  { key: 'hip', label: '胯' },
  { key: 'leftUpperArm', label: '大臂' },
  { key: 'rightUpperArm', label: '大臂' },
  { key: 'leftElbow', label: '肘关节' },
  { key: 'rightElbow', label: '肘关节' },
  { key: 'leftLowerArm', label: '小臂' },
  { key: 'rightLowerArm', label: '小臂' },
  { key: 'leftWrist', label: '手腕' },
  { key: 'rightWrist', label: '手腕' },
  { key: 'leftHand', label: '手' },
  { key: 'rightHand', label: '手' },
  { key: 'leftFingers', label: '手指' },
  { key: 'rightFingers', label: '手指' },
  { key: 'leftThigh', label: '大腿' },
  { key: 'rightThigh', label: '大腿' },
  { key: 'leftKnee', label: '膝盖' },
  { key: 'rightKnee', label: '膝盖' },
  { key: 'leftCalf', label: '小腿' },
  { key: 'rightCalf', label: '小腿' },
  { key: 'leftAnkle', label: '脚踝' },
  { key: 'rightAnkle', label: '脚踝' },
  { key: 'leftFootBack', label: '脚背' },
  { key: 'rightFootBack', label: '脚背' },
  { key: 'leftFootSole', label: '脚掌' },
  { key: 'rightFootSole', label: '脚掌' },
  { key: 'eye', label: '眼睛' },
  { key: 'ear', label: '耳朵' },
  { key: 'nose', label: '鼻子' },
  { key: 'mouth', label: '嘴' },
]

// 七色配置（颜色 hex + 默认感受词）
export const BODY_COLORS: {
  key: BodyColor
  hex: string
  defaultWord: BodyWord
}[] = [
  { key: 'red', hex: '#e2574c', defaultWord: '疼痛' },
  { key: 'orange', hex: '#f5a623', defaultWord: '轻松' },
  { key: 'yellow', hex: '#f8d347', defaultWord: '紧张' },
  { key: 'green', hex: '#7ed321', defaultWord: '沉重' },
  { key: 'blue', hex: '#4a90d9', defaultWord: '柔软' },
  { key: 'indigo', hex: '#5d5fe8', defaultWord: '控制' },
  { key: 'purple', hex: '#a78bfa', defaultWord: '不自觉' },
]
