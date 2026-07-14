# 琉璃文创园区互动小程序 - 产品需求书

## 一、项目概述

### 1.1 项目背景

本产品是一款基于位置的文创园区导览与互动小程序，旨在通过GPS定位为用户提供风格化的园区导航、位置触发互动、灵感值系统、成就任务系统和脊兽人格测试等功能，提升游客在琉璃文创园区的游览体验。

### 1.2 产品定位

- **目标用户**：琉璃文创园区游客、文化爱好者、创意人群
- **核心价值**：提供沉浸式、互动式的园区游览体验
- **产品形态**：微信小程序 + H5网页

### 1.3 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | Taro | ^3.6.33 |
| 前端 | React | ^18.2.0 |
| 语言 | TypeScript | ^5.0.0 |
| 状态管理 | Zustand | ^4.5.4 |
| 地图 | 高德地图JSAPI 2.0 | - |
| 数据库 | Supabase | ^2.38.0 |
| 部署 | Vercel | - |

---

## 二、功能需求

### 2.1 地图导航模块

#### 2.1.1 地图展示

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| MAP-001 | 集成高德地图JSAPI 2.0，展示园区地图 | P0 |
| MAP-002 | 支持标准地图与手绘地图切换 | P1 |
| MAP-003 | 手绘地图通过AMap.GroundImage叠加到指定地理边界 | P1 |
| MAP-004 | 地图支持缩放、拖拽操作 | P0 |
| MAP-005 | 显示用户当前定位（蓝色标记） | P0 |

#### 2.1.2 POI点位展示

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| MAP-006 | 在地图上标记园区内所有POI点位 | P0 |
| MAP-007 | 不同类型POI使用不同颜色标记：展品(蓝色)、互动点(绿色)、地标(紫色)、商店(橙色) | P1 |
| MAP-008 | 点击POI点位显示详情弹窗 | P0 |
| MAP-009 | 支持POI点位筛选（按类型筛选） | P2 |

#### 2.1.3 定位服务

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| MAP-010 | 使用Taro.getLocation获取高精度定位（gcj02坐标系） | P0 |
| MAP-011 | 浏览器环境下使用navigator.geolocation作为回退方案 | P1 |
| MAP-012 | 定位超时时间10秒 | P1 |
| MAP-013 | 定位成功后自动将地图中心移动到用户位置 | P0 |

### 2.2 POI点位管理

#### 2.2.1 POI数据结构

```typescript
interface POI {
  id: string;                          // 唯一标识
  name: string;                        // 点位名称
  type: 'exhibit' | 'interactive' | 'landmark' | 'shop';  // 点位类型
  coordinate: { lat: number; lng: number };  // 地理坐标
  beacon_uuid: string | null;          // iBeacon信标UUID（预留）
  radius: number;                      // 触发半径（米）
  description: string;                 // 点位描述
  interactions: Interaction[];          // 互动配置
  created_at: string;                  // 创建时间
}

interface Interaction {
  id: string;                          // 互动唯一标识
  poi_id: string;                      // 关联POI ID
  type: 'guide' | 'achievement' | 'hidden';  // 互动类型
  content: string;                     // 互动内容（文本或问题）
  trigger_condition: 'enter' | 'stay' | 'exit';  // 触发条件
  reward?: { type: 'inspiration'; value: number };  // 奖励配置
}
```

#### 2.2.2 POI互动触发

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| POI-001 | 用户进入POI触发半径时，触发enter类型互动 | P0 |
| POI-002 | 用户在POI范围内停留时，触发stay类型互动（答题） | P1 |
| POI-003 | 用户离开POI触发半径时，触发exit类型互动 | P2 |
| POI-004 | 答题正确后发放灵感值奖励 | P0 |
| POI-005 | 隐藏彩蛋互动需满足特定条件才能触发 | P2 |

### 2.3 用户认证模块

#### 2.3.1 登录方式

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| AUTH-001 | 微信小程序授权登录（获取openid、昵称、头像） | P0 |
| AUTH-002 | 首次登录自动创建用户档案 | P0 |
| AUTH-003 | H5端支持游客模式（mock用户） | P1 |
| AUTH-004 | 用户数据自动同步到Supabase数据库 | P0 |

#### 2.3.2 用户数据结构

```typescript
interface User {
  id: string;                          // 用户唯一标识
  openid: string;                      // 微信openid
  nickname: string;                    // 用户昵称
  avatar: string;                      // 用户头像URL
  inspiration_value: number;           // 灵感值（默认0）
  badges: string[];                    // 获得的徽章ID列表
  spatial_profile: SpatialProfile;     // 空间档案
  ridge_beast_personality: RidgeBeastPersonality | null;  // 脊兽人格测试结果
  created_at: string;                  // 创建时间
  updated_at: string;                  // 更新时间
}

interface SpatialProfile {
  total_visit_duration: number;        // 总停留时长（秒）
  most_visited_pois: string[];         // 最常访问的POI列表
  route_pattern: 'explorer' | 'efficient' | 'lingerer';  // 探索风格
  discovered_hidden_details: number;    // 发现的隐藏彩蛋数量
  inspiration_adoptions: number;       // 灵感采纳数量
}
```

### 2.4 灵感值系统

#### 2.4.1 灵感留言板

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| INSP-001 | 用户可在灵感留言板POI发布灵感留言 | P0 |
| INSP-002 | 留言包含内容、作者ID、POI ID | P0 |
| INSP-003 | 其他用户可点赞留言 | P1 |
| INSP-004 | 其他用户可采纳留言（获得灵感值奖励） | P0 |
| INSP-005 | 采纳留言可获得10灵感值 | P0 |
| INSP-006 | 留言按时间倒序展示 | P1 |

#### 2.4.2 灵感值数据结构

```typescript
interface InspirationMessage {
  id: string;                          // 留言唯一标识
  author_id: string;                   // 作者用户ID
  poi_id: string;                      // 关联POI ID
  content: string;                     // 留言内容
  likes: number;                       // 点赞数
  adoptions: number;                   // 采纳数
  created_at: string;                  // 创建时间
}
```

### 2.5 成就徽章系统

#### 2.5.1 徽章数据结构

```typescript
interface Badge {
  id: string;                          // 徽章唯一标识
  name: string;                        // 徽章名称
  description: string;                 // 徽章描述
  pixel_image: string;                 // 像素风格图标（emoji或base64）
  condition: AchievementCondition;     // 获取条件
  rarity: 'common' | 'rare' | 'legendary';  // 稀有度
}

interface AchievementCondition {
  type: 'quiz' | 'visit' | 'collect';  // 条件类型
  target: string;                      // 目标对象
  value: number;                       // 目标值
}
```

#### 2.5.2 徽章获取

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| BADGE-001 | 用户完成条件后自动获得对应徽章 | P0 |
| BADGE-002 | 徽章稀有度分为普通/稀有/传说三个等级 | P1 |
| BADGE-003 | 徽章获得后展示在用户个人中心 | P0 |
| BADGE-004 | 支持查看徽章获取条件和进度 | P2 |

### 2.6 脊兽人格测试

#### 2.6.1 测试功能

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| BEAST-001 | 提供10道选择题的人格测试 | P0 |
| BEAST-002 | 根据答题结果匹配10种脊兽人格之一 | P0 |
| BEAST-003 | 展示人格特质、描述和定制图片 | P0 |
| BEAST-004 | 测试结果保存到用户档案 | P0 |
| BEAST-005 | 支持重新测试 | P1 |

#### 2.6.2 脊兽类型

| 脊兽名称 | 特质 |
|----------|------|
| 龙 | 威严、智慧、领导力 |
| 凤 | 优雅、艺术、创造力 |
| 狮子 | 勇敢、力量、守护 |
| 天马 | 自由、奔放、梦想 |
| 海马 | 神秘、深邃、智慧 |
| 狻猊 | 威严、庄重、宁静 |
| 狎鱼 | 灵动、活泼、机敏 |
| 獬豸 | 正义、公正、智慧 |
| 斗牛 | 勇猛、坚韧、毅力 |
| 行什 | 神秘、独特、探索 |

#### 2.6.3 数据结构

```typescript
interface RidgeBeastPersonality {
  type: '龙' | '凤' | '狮子' | '天马' | '海马' | '狻猊' | '狎鱼' | '獬豸' | '斗牛' | '行什';
  traits: string[];                    // 人格特质列表
  description: string;                 // 人格描述
  customized_image: string;            // 定制图片URL
}
```

### 2.7 文创商店

#### 2.7.1 商品数据结构

```typescript
interface ShopItem {
  id: string;                          // 商品唯一标识
  name: string;                        // 商品名称
  description: string;                 // 商品描述
  price: number;                       // 价格（灵感值）
  image: string;                       // 商品图片URL
  stock: number;                       // 库存数量
}
```

#### 2.7.2 购买功能

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| SHOP-001 | 展示所有商品列表 | P0 |
| SHOP-002 | 使用灵感值购买商品 | P0 |
| SHOP-003 | 购买前检查灵感值是否足够 | P0 |
| SHOP-004 | 购买后扣减灵感值和库存 | P0 |
| SHOP-005 | 库存为0时显示"已售罄" | P1 |
| SHOP-006 | 购买成功显示提示 | P0 |

### 2.8 个人中心

#### 2.8.1 用户信息展示

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| PROFILE-001 | 展示用户头像、昵称、ID | P0 |
| PROFILE-002 | 展示灵感值数量 | P0 |
| PROFILE-003 | 展示脊兽人格测试结果 | P0 |
| PROFILE-004 | 展示空间档案（停留时长、探索风格、发现宝藏、灵感采纳） | P1 |
| PROFILE-005 | 展示获得的徽章列表 | P0 |

#### 2.8.2 功能入口

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| PROFILE-006 | 脊兽人格测试入口 | P0 |
| PROFILE-007 | 生成空间报告入口 | P2 |
| PROFILE-008 | 隐私设置入口 | P2 |
| PROFILE-009 | 开发者模式入口 | P2 |

### 2.9 开发者模式

#### 2.9.1 安全验证

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| DEV-001 | 输入密码"wjj147258"才能进入开发者模式 | P0 |
| DEV-002 | 密码错误显示提示 | P1 |

#### 2.9.2 定位上传功能

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| DEV-003 | 实时显示当前经纬度 | P0 |
| DEV-004 | 支持刷新获取最新定位 | P0 |
| DEV-005 | 输入位置名称并上传定位点 | P0 |
| DEV-006 | 定位点保存到localStorage | P0 |
| DEV-007 | 展示已保存的定位点列表 | P1 |
| DEV-008 | 支持删除已保存的定位点 | P1 |

#### 2.9.3 定位点数据结构

```typescript
interface CalibrationPoint {
  id: string;                          // 定位点唯一标识
  name: string;                        // 位置名称
  lng: number;                         // 经度
  lat: number;                         // 纬度
  timestamp: number;                   // 保存时间戳
}
```

---

## 三、页面结构

### 3.1 页面列表

| 页面路径 | 页面名称 | 功能描述 |
|----------|----------|----------|
| `/pages/index/index` | 首页（地图导航） | 地图展示、POI标记、定位、地图切换 |
| `/pages/test/index` | 测试页 | 功能测试入口 |
| `/pages/shop/index` | 文创商店 | 商品列表、灵感值购买 |
| `/pages/profile/index` | 个人中心 | 用户信息、徽章、空间档案、功能入口 |
| `/pages/personality/index` | 脊兽人格报告 | 人格测试结果展示 |

### 3.2 TabBar配置

| 顺序 | 页面 | 图标 | 标签 |
|------|------|------|------|
| 1 | 首页（地图） | 🗺️ | 地图 |
| 2 | 文创商店 | 🏪 | 商店 |
| 3 | 个人中心 | 👤 | 我的 |

---

## 四、数据存储设计

### 4.1 Supabase表结构

#### 4.1.1 users表

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  openid VARCHAR(255) UNIQUE NOT NULL,
  nickname VARCHAR(255),
  avatar VARCHAR(500),
  inspiration_value INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT '{}',
  spatial_profile JSONB DEFAULT '{}',
  ridge_beast_personality JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.1.2 pois表

```sql
CREATE TABLE pois (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  coordinate JSONB NOT NULL,
  beacon_uuid VARCHAR(100),
  radius INTEGER DEFAULT 0,
  interactions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.1.3 inspiration_messages表

```sql
CREATE TABLE inspiration_messages (
  id VARCHAR(50) PRIMARY KEY,
  author_id VARCHAR(50) NOT NULL,
  poi_id VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  adoptions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.1.4 badges表

```sql
CREATE TABLE badges (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  pixel_image VARCHAR(100),
  condition JSONB,
  rarity VARCHAR(50) DEFAULT 'common',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.1.5 shop_items表

```sql
CREATE TABLE shop_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  image VARCHAR(500),
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 环境变量配置

```env
# 高德地图API配置（JSAPI 2.0）
AMAP_WEB_KEY=your-amap-web-key
AMAP_SECRET_KEY=your-amap-security-js-code

# Supabase数据库配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key

# 微信小程序配置
WECHAT_APP_ID=your-wechat-app-id
WECHAT_APP_SECRET=your-wechat-app-secret
```

---

## 五、API接口设计

### 5.1 认证接口

| 接口路径 | 方法 | 功能描述 |
|----------|------|----------|
| `/api/auth/signIn` | POST | 用户登录/注册 |
| `/api/auth/getUser` | GET | 获取用户信息 |

### 5.2 POI接口

| 接口路径 | 方法 | 功能描述 |
|----------|------|----------|
| `/api/poi/getAll` | GET | 获取所有POI点位 |
| `/api/poi/getById` | GET | 根据ID获取POI详情 |

### 5.3 灵感值接口

| 接口路径 | 方法 | 功能描述 |
|----------|------|----------|
| `/api/inspiration/getMessages` | GET | 获取POI下的灵感留言 |
| `/api/inspiration/createMessage` | POST | 创建灵感留言 |
| `/api/inspiration/likeMessage` | PUT | 点赞留言 |
| `/api/inspiration/adoptMessage` | PUT | 采纳留言 |

### 5.4 成就接口

| 接口路径 | 方法 | 功能描述 |
|----------|------|----------|
| `/api/achievement/getAllBadges` | GET | 获取所有徽章 |
| `/api/achievement/awardBadge` | PUT | 颁发徽章 |

### 5.5 商店接口

| 接口路径 | 方法 | 功能描述 |
|----------|------|----------|
| `/api/shop/getAllItems` | GET | 获取所有商品 |
| `/api/shop/purchaseItem` | POST | 购买商品 |

---

## 六、非功能需求

### 6.1 性能要求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| PERF-001 | 页面加载时间不超过3秒 | P0 |
| PERF-002 | 地图初始化时间不超过2秒 | P0 |
| PERF-003 | 定位获取时间不超过10秒 | P0 |
| PERF-004 | 接口响应时间不超过500ms | P1 |

### 6.2 兼容性要求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| COMPAT-001 | 支持微信小程序基础库2.0+ | P0 |
| COMPAT-002 | 支持H5端主流浏览器（Chrome、Safari、Edge） | P0 |
| COMPAT-003 | 支持移动端iOS 10+、Android 6+ | P0 |

### 6.3 安全要求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| SEC-001 | 敏感信息（如API Key）不硬编码 | P0 |
| SEC-002 | 用户数据存储加密 | P1 |
| SEC-003 | 开发者模式密码保护 | P0 |
| SEC-004 | 接口请求参数校验 | P1 |

### 6.4 可用性要求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| USAB-001 | 无网络时使用本地Mock数据 | P0 |
| USAB-002 | 定位失败时提供错误提示 | P0 |
| USAB-003 | 操作失败时提供重试机制 | P1 |

---

## 七、部署方案

### 7.1 开发环境

```bash
# 安装依赖
npm install

# H5开发模式（默认端口：10088）
npm run dev:h5

# 微信小程序开发模式
npm run dev:weapp
```

### 7.2 生产环境

```bash
# H5构建
npm run build:h5

# 微信小程序构建
npm run build:weapp
```

### 7.3 部署平台

- **H5端**：Vercel（自动部署）
- **微信小程序**：微信公众平台上传代码

---

## 八、项目目录结构

```
src/
├── components/           # 公共组件
│   ├── BadgeDisplay/     # 徽章展示组件
│   ├── DeveloperMode/    # 开发者模式组件
│   ├── InspirationBoard/ # 灵感留言板组件
│   ├── MapCanvas/        # 地图画布组件
│   ├── POICard/          # POI卡片组件
│   ├── QuizModal/        # 答题弹窗组件
│   └── RidgeBeastTest/   # 脊兽人格测试组件
├── pages/                # 页面
│   ├── index/            # 首页（地图导航）
│   ├── test/             # 测试页
│   ├── shop/             # 文创商店
│   ├── profile/          # 用户个人中心
│   └── personality/      # 脊兽人格报告
├── services/             # 业务服务层
│   ├── api/              # API接口封装
│   ├── interaction/      # 互动系统引擎
│   ├── location/         # 定位服务
│   └── profile/          # 用户档案服务
├── store/                # Zustand状态管理
│   └── useUserStore.ts   # 用户状态管理
├── types/                # TypeScript类型定义
│   └── index.ts          # 所有类型定义
├── data/                 # Mock数据
│   └── mockPois.ts       # POI模拟数据
├── config/               # 配置文件
│   └── map.ts            # 地图配置
├── utils/                # 工具函数
│   ├── supabase/         # Supabase客户端
│   │   ├── client.ts     # Supabase客户端配置
│   │   └── index.ts      # Supabase导出
│   └── index.ts          # 通用工具函数
├── app.tsx               # 应用入口
├── app.config.ts         # Taro配置
└── index.html            # H5入口HTML
```

---

## 九、核心业务流程

### 9.1 用户登录流程

```
用户打开小程序
    ↓
微信授权登录（获取openid、昵称、头像）
    ↓
检查Supabase中是否存在该用户
    ↓
├─ 存在 → 返回用户信息
└─ 不存在 → 创建新用户记录
    ↓
加载用户数据（灵感值、徽章、空间档案、脊兽人格）
    ↓
进入首页
```

### 9.2 POI互动流程

```
用户进入园区
    ↓
获取用户定位
    ↓
实时监测用户位置变化
    ↓
检测是否进入POI触发半径
    ↓
├─ enter → 显示导览信息
├─ stay → 弹出答题界面
│           ↓
│       答题正确 → 发放灵感值奖励 → 解锁徽章
│       答题错误 → 提示正确答案
└─ exit → 结束互动
```

### 9.3 灵感值获取流程

```
用户发布灵感留言
    ↓
其他用户查看留言
    ↓
├─ 点赞 → 留言点赞数+1
└─ 采纳 → 留言采纳数+1，作者灵感值+10
```

### 9.4 徽章获取流程

```
用户完成成就条件
    ↓
检查是否已获得该徽章
    ↓
├─ 已获得 → 不重复发放
└─ 未获得 → 添加徽章到用户档案
    ↓
更新徽章列表显示
```

### 9.5 商店购买流程

```
用户进入商店
    ↓
选择商品
    ↓
检查灵感值是否足够
    ↓
├─ 不足 → 提示"灵感值不足"
└─ 足够 → 检查库存
    ↓
├─ 库存为0 → 提示"已售罄"
└─ 有库存 → 扣减灵感值和库存
    ↓
显示购买成功提示
```

---

## 十、里程碑规划

### 第一阶段：基础框架搭建（1周）

| 任务 | 描述 |
|------|------|
| 项目初始化 | Taro项目创建、依赖安装、基础配置 |
| 页面结构 | 创建5个核心页面 |
| 地图集成 | 高德地图JSAPI 2.0集成 |
| 定位服务 | Taro.getLocation封装 |

### 第二阶段：核心功能开发（2周）

| 任务 | 描述 |
|------|------|
| POI点位管理 | POI数据模型、地图标记、详情弹窗 |
| 互动系统引擎 | 位置触发检测、答题互动 |
| 用户认证 | 微信登录、Supabase集成 |
| 状态管理 | Zustand全局状态 |

### 第三阶段：业务功能开发（2周）

| 任务 | 描述 |
|------|------|
| 灵感值系统 | 留言板、点赞、采纳 |
| 成就徽章系统 | 徽章数据、获取条件、展示 |
| 脊兽人格测试 | 测试题、结果匹配、展示 |
| 文创商店 | 商品列表、购买流程 |

### 第四阶段：优化与部署（1周）

| 任务 | 描述 |
|------|------|
| 性能优化 | 加载速度、定位速度 |
| 手绘地图 | 自定义底图配置 |
| 开发者模式 | 密码验证、定位上传 |
| 部署上线 | Vercel部署、小程序发布 |

---

## 十一、风险评估

| 风险编号 | 风险描述 | 影响程度 | 概率 | 应对措施 |
|----------|----------|----------|------|----------|
| RISK-001 | 高德地图API Key失效 | 高 | 中 | 备用Key、监控告警 |
| RISK-002 | 定位精度不足（室内） | 高 | 高 | iBeacon信标（预留）、手动校准 |
| RISK-003 | Supabase服务中断 | 高 | 低 | Mock数据回退、本地缓存 |
| RISK-004 | 微信小程序审核不通过 | 中 | 中 | 提前准备审核材料、功能合规 |
| RISK-005 | 手绘地图与实际位置偏移 | 中 | 高 | 开发者模式定位校准、边界调整 |

---

## 十二、附录

### 12.1 地图边界配置示例

```typescript
customMapBounds: {
  sw: [116.3965, 39.9072],  // 西南角（左下角）
  ne: [116.3995, 39.9098],  // 东北角（右上角）
}
```

### 12.2 开发者模式密码

- **密码**：`wjj147258`

### 12.3 高德地图API密钥获取

- **地址**：https://lbs.amap.com/dev/key/app

### 12.4 Supabase项目配置

- **URL**：`https://kogepquzrobmrnfywotk.supabase.co`（示例）
- **Publishable Key**：在Supabase控制台获取

---

**文档版本**：v1.0  
**创建日期**：2026年7月9日  
**适用项目**：琉璃文创园区互动小程序