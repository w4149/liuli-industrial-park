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

export interface RidgeBeastPersonality {
  type: '龙' | '凤' | '狮子' | '天马' | '海马' | '狻猊' | '狎鱼' | '獬豸' | '斗牛' | '行什';
  traits: string[];
  description: string;
  customized_image: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  stock: number;
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
