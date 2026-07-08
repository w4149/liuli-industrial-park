# 琉璃文创园区互动小程序

> 基于位置的文创园区互动体验平台

## 📖 项目简介

琉璃文创园区互动小程序是一款基于微信小程序的园区导览与互动产品，通过GPS定位为用户提供风格化的园区导航、位置触发互动、灵感值系统、成就任务系统和脊兽人格测试等功能。

## 🛠️ 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | Taro | ^3.6.33 |
| 前端 | React | ^18.2.0 |
| 语言 | TypeScript | ^5.0.0 |
| 状态管理 | Zustand | ^4.5.4 |
| 地图 | 高德地图JSAPI 2.0 | - |
| 数据库 | Supabase | ^2.38.0 |
| 部署 | Vercel | - |
| CDN | Cloudflare | - |

## 📋 环境要求

- Node.js >= 14.0.0（推荐16.x或18.x）
- npm >= 6.0.0

> **提示**：项目包含 `.nvmrc` 文件，建议使用 `nvm use` 自动切换Node版本

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/w4149/liuli-industrial-park.git
cd liuli-industrial-park
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 文件并修改为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入实际配置值：

```env
# 高德地图API Key
AMAP_WEB_KEY=your-amap-web-key
AMAP_SECRET_KEY=your-amap-secret-key

# Supabase配置
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# 微信小程序配置（H5端可选）
WECHAT_APP_ID=your-wechat-app-id
WECHAT_APP_SECRET=your-wechat-app-secret
```

### 4. 初始化数据库

在Supabase控制台中执行数据库迁移脚本：

1. 登录Supabase → 进入项目 → 点击 "SQL Editor"
2. 新建查询 → 粘贴 `supabase/migrations/20240101000000_init.sql` 内容
3. 点击 "Run" 执行迁移

### 5. 启动开发服务器

```bash
# H5开发模式（默认端口：10088）
npm run dev:h5

# 微信小程序开发模式
npm run dev:weapp
```

#### 访问地址

- **本地访问**：`http://localhost:10088`
- **局域网访问**：`http://你的IP地址:10088`（用于手机测试）

#### 移动端测试

1. 确保电脑和手机连接同一Wi-Fi网络
2. 在电脑上运行 `ipconfig`（Windows）或 `ifconfig`（macOS/Linux）获取IP地址
3. 在手机浏览器中访问 `http://电脑IP:10088`
4. **注意**：定位功能需要HTTPS环境，开发环境使用localhost或127.0.0.1

### 6. 构建生产版本

```bash
# H5构建
npm run build:h5

# 微信小程序构建
npm run build:weapp
```

## 📁 目录结构

```
liuli-industrial-park/
├── config/                    # Taro配置文件
│   ├── index.js              # 主配置（含Webpack优化、别名配置）
│   ├── dev.js                # 开发环境配置
│   └── prod.js               # 生产环境配置
├── src/
│   ├── components/           # 公共组件
│   │   ├── BadgeDisplay/     # 徽章展示组件
│   │   ├── InspirationBoard/ # 灵感留言板组件
│   │   ├── MapCanvas/        # 地图渲染组件
│   │   ├── POICard/          # POI卡片组件
│   │   ├── QuizModal/        # 答题弹窗组件
│   │   └── RidgeBeastTest/   # 脊兽人格测试组件
│   ├── data/                 # 模拟数据
│   │   └── mockPois.ts       # POI模拟数据
│   ├── pages/                # 页面组件
│   │   ├── index/            # 首页（地图导航）
│   │   ├── test/             # 测试页面
│   │   ├── shop/             # 文创商店
│   │   ├── profile/          # 用户个人中心
│   │   └── personality/      # 脊兽人格报告
│   ├── services/             # 业务服务层
│   │   ├── api/              # API接口封装
│   │   ├── interaction/      # 互动系统服务
│   │   ├── location/         # 定位服务
│   │   └── profile/          # 用户档案服务
│   ├── store/                # 状态管理
│   │   └── useUserStore.ts   # 用户状态（Zustand）
│   ├── types/                # TypeScript类型定义
│   │   └── index.ts          # 全局类型定义
│   ├── utils/                # 工具函数
│   │   └── index.ts          # 通用工具
│   ├── app.config.ts         # 小程序配置（路由、权限）
│   ├── app.scss              # 全局样式
│   ├── app.tsx               # 应用入口
│   ├── index.html            # H5入口HTML
│   └── main.tsx              # H5入口文件
├── supabase/                 # Supabase数据库迁移
│   └── migrations/
│       └── 20240101000000_init.sql
├── vercel.json               # Vercel部署配置
├── taro.config.ts            # Taro CLI配置
├── tsconfig.json             # TypeScript配置
└── package.json              # 项目依赖配置
```

## 🗺️ 核心功能模块

### 1. 定位服务
- GPS实时定位
- 高德地图集成
- 定位权限管理
- 安全上下文检测

### 2. 地图导航
- 园区自定义地图渲染
- POI点位标记
- 位置触发互动
- 导航路线规划

### 3. 灵感值系统
- 灵感留言发布
- 灵感采纳奖励
- 灵感值兑换文创
- 创意工坊互动

### 4. 成就任务系统
- 答题获得徽章
- 像素风格徽章展示
- 成就进度追踪
- 稀有度分级（普通/稀有/传说）

### 5. 空间档案
- 停留时间分析
- 访问模式识别
- 隐藏细节发现
- 路线特点分析

### 6. 脊兽人格测试
- 基于空间行为数据
- 补充答题测试
- 10种脊兽人格类型
- 个性化脊兽定制

## 📊 数据模型

### 核心实体

| 实体 | 说明 |
|------|------|
| User | 用户信息（昵称、头像、灵感值、徽章） |
| POI | 园区点位（坐标、类型、互动配置） |
| Interaction | 互动事件（触发条件、奖励） |
| InspirationMessage | 灵感留言（内容、点赞、采纳数） |
| Badge | 徽章（像素图、获取条件、稀有度） |
| SpatialProfile | 空间档案（停留时长、访问模式） |
| RidgeBeastPersonality | 脊兽人格（类型、特质、定制图） |

## 🔧 关键配置说明

### Webpack优化（config/index.js）
- 代码分割：自动拆分vendor和业务代码
- 路径别名：`@` 指向 `src/` 目录
- 公共路径：`/`
- 构建产物：`dist/` 目录

### 响应式适配
- 设计稿宽度：750px
- 设备像素比：640/750/828
- 使用大写 `PX` 避免Taro的px转换

### 高德地图API Key配置（src/index.html）
高德地图JSAPI通过script标签直接引入，Key目前硬编码在 `src/index.html` 中：

```html
<script src="https://webapi.amap.com/maps?v=2.0&key=你的Key"></script>
```

> **建议**：生产环境使用环境变量动态注入Key，避免泄露敏感信息

### 微信小程序权限（src/app.config.ts）
- `scope.userLocation`：位置信息权限
- `scope.userInfo`：用户信息权限
- 后台定位模式

## 🚀 部署流程

### Vercel部署

1. 确保项目已托管在GitHub
2. 在Vercel中导入项目
3. 配置环境变量（见.env示例）
4. 构建命令：`npm run build:h5`
5. 输出目录：`dist`

### Cloudflare加速（国内访问优化）

1. 注册Cloudflare账号
2. 添加域名并设置DNS记录
3. 修改域名Nameservers指向Cloudflare
4. 配置SSL/TLS为Full模式
5. 开启Auto Minify和缓存

### 微信小程序发布

1. 构建小程序：`npm run build:weapp`
2. 打开微信开发者工具
3. 导入 `dist` 目录
4. 配置AppID
5. 上传代码并提交审核

## 🐛 常见问题

### Q1: 页面白屏？
- 检查浏览器控制台错误
- 确认CSS/JS资源是否404
- 检查路由配置是否正确
- 查看 [white-screen-troubleshooting.skill](.trae/skills/white-screen-troubleshooting.skill)

### Q2: 定位功能不工作？
- 确保使用HTTPS或localhost
- 检查定位权限是否已授权
- 在室外测试（室内GPS信号弱）
- 查看 [mobile-location-troubleshooting.skill](.trae/skills/mobile-location-troubleshooting.skill)

### Q3: 构建体积过大？
- Webpack已配置代码分割
- 使用Bundle Analyzer分析体积
- 考虑按需加载非核心模块

### Q4: 国内访问Vercel慢？
- 配置Cloudflare CDN加速
- 参考 [cloudflare-cdn-setup.skill](.trae/skills/cloudflare-cdn-setup.skill)

### Q5: Supabase连接失败？
- 检查环境变量配置
- 确认Supabase项目区域
- 检查网络连接

## 🌐 部署地址

- **Vercel官方地址**：https://liuli-industrial-park.vercel.app
- **Cloudflare加速地址**：配置自定义域名后可用

## 📚 知识库资源

项目已生成以下SKILL文件，存储在 `.trae/skills/` 目录：

> **说明**：SKILL文件是Trae IDE的知识库文件，包含开发过程中的解决方案和最佳实践，便于快速检索和复用。

| SKILL文件 | 用途 |
|-----------|------|
| `taro-project-setup.skill` | Taro项目初始化与配置 |
| `vercel-deployment.skill` | Vercel部署配置 |
| `amap-api-integration.skill` | 高德地图API集成 |
| `white-screen-troubleshooting.skill` | 页面白屏问题排查 |
| `mobile-location-troubleshooting.skill` | 移动端定位问题排查 |
| `cloudflare-cdn-setup.skill` | Cloudflare CDN加速配置 |
| `supabase-integration.skill` | Supabase数据库集成 |
| `taro-navigation.skill` | Taro页面路由与导航 |

## 📝 开发注意事项

1. **样式规范**：使用SCSS，组件样式使用CSS Modules
2. **路由规范**：使用Taro路由API，避免直接操作`window.location`
3. **API封装**：统一在 `services/api/` 中封装接口
4. **状态管理**：全局状态使用Zustand，局部状态使用React Hooks
5. **类型定义**：所有接口和数据结构在 `types/index.ts` 中定义

## 📄 License

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！
