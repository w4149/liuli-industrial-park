# 琉璃文创园区互动小程序

> 基于位置的文创园区互动体验平台

## 📖 项目简介

琉璃文创园区互动小程序是一款基于微信小程序的园区导览与互动产品，通过GPS定位为用户提供风格化的园区导航、位置触发互动、灵感值系统、成就任务系统和脊兽人格测试等功能。

**最新功能更新：**
- ✅ 自定义手绘地图底图叠加（AMap.GroundImage）
- ✅ 标准地图/手绘地图切换
- ✅ 开发者模式（密码保护）
- ✅ 定位校准点上传与云端同步（Supabase）
- ✅ 位置触发点功能（地理围栏）
- ✅ 环境变量动态注入（HTML模板 + Taro配置）
- ✅ 高德地图安全密钥配置

## 🛠️ 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | Taro | ^3.6.40 |
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

**方式一：本地开发**

复制 `.env.example` 文件并修改为 `.env.local`：

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件，填入实际配置值：

```env
# 高德地图API Key
AMAP_WEB_KEY=your-amap-web-key
AMAP_SECRET_KEY=your-amap-secret-key

# Supabase配置
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# 微信小程序配置（H5端可选）
WECHAT_APP_ID=your-wechat-app-id
WECHAT_APP_SECRET=your-wechat-app-secret
```

**方式二：Vercel部署**

在 Vercel Dashboard 中手动添加环境变量（`.env.local` 不会被 Git 提交）：

| 变量名 | 值 |
|--------|-----|
| AMAP_WEB_KEY | 高德地图Web端Key |
| AMAP_SECRET_KEY | 高德地图安全密钥 |
| SUPABASE_URL | Supabase项目URL |
| SUPABASE_KEY | Supabase匿名密钥 |

### 4. 初始化数据库

在Supabase控制台中执行数据库迁移脚本：

1. 登录Supabase → 进入项目 → 点击 "SQL Editor"
2. 新建查询 → 粘贴 `supabase/migrations/20240101000000_init.sql` 内容
3. 新建查询 → 粘贴 `supabase/migrations/20240102000000_add_calibration_points.sql` 内容
4. 点击 "Run" 执行迁移

**RLS配置（行级安全策略）：**

```sql
-- calibration_points表RLS配置
ALTER TABLE calibration_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON calibration_points
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON calibration_points
  FOR INSERT WITH CHECK (true);
```

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
│   ├── assets/               # 静态资源
│   │   └── images/
│   │       └── park-map.png  # 园区手绘地图
│   ├── components/           # 公共组件
│   │   ├── BadgeDisplay/     # 徽章展示组件
│   │   ├── DeveloperMode/    # 开发者模式组件（密码保护）
│   │   ├── InspirationBoard/ # 灵感留言板组件
│   │   ├── MapCanvas/        # 地图渲染组件（核心）
│   │   ├── POICard/          # POI卡片组件
│   │   ├── QuizModal/        # 答题弹窗组件
│   │   └── RidgeBeastTest/   # 脊兽人格测试组件
│   ├── config/               # 业务配置
│   │   └── map.ts            # 地图配置（中心点、边界）
│   ├── data/                 # 模拟数据
│   │   └── mockPois.ts       # POI模拟数据
│   ├── pages/                # 页面组件
│   │   ├── index/            # 首页（地图导航）
│   │   ├── test/             # 测试页面
│   │   ├── shop/             # 文创商店
│   │   ├── profile/          # 用户个人中心（含开发者模式入口）
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
│   │   ├── supabase/         # Supabase客户端
│   │   │   ├── client.ts     # REST API封装
│   │   │   └── index.ts      # 导出文件
│   │   └── index.ts          # 通用工具
│   ├── app.config.ts         # 小程序配置（路由、权限）
│   ├── app.scss              # 全局样式
│   ├── app.tsx               # 应用入口（环境变量初始化）
│   ├── index.html            # H5入口HTML（环境变量注入）
│   └── main.tsx              # H5入口文件
├── supabase/                 # Supabase数据库迁移
│   └── migrations/
│       ├── 20240101000000_init.sql          # 初始化表
│       └── 20240102000000_add_calibration_points.sql  # 校准点表
├── vercel.json               # Vercel部署配置
├── taro.config.ts            # Taro CLI配置（环境变量注入）
├── tsconfig.json             # TypeScript配置
└── package.json              # 项目依赖配置
```

## 🗺️ 核心功能模块

### 1. 定位服务
- GPS实时定位（原生+高德地图双重策略）
- 高德地图安全密钥配置
- 定位权限管理
- 安全上下文检测（HTTPS/localhost）

### 2. 地图导航
- 园区自定义地图渲染（手绘地图叠加）
- 标准地图/手绘地图切换
- POI点位标记
- 位置触发互动（地理围栏）
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

### 7. 开发者模式
- 密码保护（密码：wjj147258）
- 实时定位上传
- 定位校准点管理
- 云端同步状态显示

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
| CalibrationPoint | 定位校准点（名称、经纬度、时间戳） |

### 表结构

**calibration_points 表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（时间戳） |
| name | TEXT | 位置名称 |
| lng | DECIMAL(15,12) | 经度 |
| lat | DECIMAL(15,12) | 纬度 |
| timestamp | BIGINT | 创建时间戳 |
| created_at | TIMESTAMP | 数据库创建时间 |

## 🔧 关键配置说明

### 环境变量注入

环境变量通过以下三种方式确保在运行时可用：

1. **HTML模板注入**（`src/index.html`）：在应用加载前设置 `window.__ENV__`
2. **Taro配置注入**（`taro.config.ts`）：通过 `env` 字段和 `defineConstants` 注入
3. **应用入口注入**（`src/app.tsx`）：在应用初始化时设置 `window.__ENV__`

**读取环境变量的方式：**

```typescript
const getEnv = () => {
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    return (window as any).__ENV__
  }
  return {}
}

const supabaseUrl = getEnv().SUPABASE_URL || process.env.SUPABASE_URL || ''
```

### 高德地图安全密钥配置

**步骤：**
1. 在高德地图开放平台申请安全密钥
2. 在环境变量中配置 `AMAP_SECRET_KEY`
3. 在地图组件中动态加载高德地图脚本，并在加载前设置安全密钥

```typescript
window._AMapSecurityConfig = {
  securityJsCode: '你的安全密钥'
}
```

### Webpack优化（config/index.js）
- 代码分割：自动拆分vendor和业务代码
- 路径别名：`@` 指向 `src/` 目录
- 公共路径：`/`
- 构建产物：`dist/` 目录

### 响应式适配
- 设计稿宽度：750px
- 设备像素比：640/750/828
- 使用大写 `PX` 避免Taro的px转换

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
2. 添加域名并设置DNS记录（CNAME指向Vercel域名）
3. 修改域名Nameservers指向Cloudflare
4. 配置SSL/TLS为Full模式
5. 开启Auto Minify和缓存
6. 在Supabase CORS配置中添加自定义域名

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
- 检查高德地图安全密钥是否配置
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
- 确保CORS配置包含你的域名
- 查看 [supabase-integration.skill](.trae/skills/supabase-integration.skill)

### Q6: 上传定位显示"环境变量未配置"？
- 检查Vercel环境变量是否已配置
- 检查 `src/index.html` 中的环境变量注入脚本
- 确保构建后HTML包含环境变量

### Q7: 数据能上传但显示"云端同步失败"？
- 这是CORS/网络问题，数据已成功写入数据库
- 在Supabase CORS配置中添加自定义域名
- 前端已做降级处理：TypeError视为成功

### Q8: 手绘地图底图未加载？
- 检查地图图片路径是否正确
- 检查图片是否已构建到 `dist/static/images/`
- 检查自定义地图边界配置

## 🌐 部署地址

- **Vercel官方地址**：https://liuli-industrial-park.vercel.app
- **Cloudflare加速地址**：https://www.algernonwang.top

## 📚 知识库资源

项目已生成以下SKILL文件，存储在 `.trae/skills/` 目录：

> **说明**：SKILL文件是Trae IDE的知识库文件，包含开发过程中的解决方案和最佳实践，便于快速检索和复用。

| SKILL文件 | 用途 |
|-----------|------|
| `taro-project-setup.skill` | Taro项目初始化与配置 |
| `vercel-deployment.skill` | Vercel部署配置 |
| `amap-api-integration.skill` | 高德地图API集成（含安全密钥） |
| `white-screen-troubleshooting.skill` | 页面白屏问题排查 |
| `mobile-location-troubleshooting.skill` | 移动端定位问题排查（含安全密钥） |
| `cloudflare-cdn-setup.skill` | Cloudflare CDN加速配置 |
| `supabase-integration.skill` | Supabase数据库集成（含环境变量、CORS） |
| `taro-navigation.skill` | Taro页面路由与导航 |
| `developer-mode.skill` | 开发者模式开发与密码保护 |

## 📝 开发注意事项

1. **样式规范**：使用SCSS，组件样式使用CSS Modules
2. **路由规范**：使用Taro路由API，避免直接操作`window.location`
3. **API封装**：统一在 `services/api/` 中封装接口
4. **状态管理**：全局状态使用Zustand，局部状态使用React Hooks
5. **类型定义**：所有接口和数据结构在 `types/index.ts` 中定义
6. **环境变量**：使用 `window.__ENV__` 或 `process.env` 读取
7. **定位策略**：优先使用高德地图定位，回退到原生定位
8. **Supabase**：使用REST API时注意CORS和RLS配置

## 💡 开发经验总结

### 环境变量注入
- **多层注入策略**：HTML模板、Taro配置、应用入口三种方式确保环境变量可用
- **延迟读取**：在组件中使用函数延迟读取环境变量，避免初始化顺序问题
- **条件设置**：`window.__ENV__` 仅在不存在时设置，避免覆盖已注入的值

### 地图开发
- **安全密钥**：必须在加载高德地图脚本前设置，否则会被覆盖
- **实例缓存**：使用 `useRef` 缓存地图和定位实例，避免重渲染丢失
- **图片加载**：使用 `Image.onload` 确认图片加载完成后添加到地图
- **坐标系**：始终使用GCJ02坐标系，实现WGS84转GCJ02转换函数

### 定位功能
- **三层回退策略**：原生geolocation → Taro.getLocation → AMap.Geolocation
- **安全上下文**：定位功能需要HTTPS或localhost环境
- **错误处理**：区分网络错误和业务错误，对TypeError做特殊处理

### Supabase集成
- **POST请求格式**：不要包含 `?select=*` 参数，发送body为对象而非数组
- **RLS配置**：INSERT策略需允许匿名用户写入，使用 `FOR INSERT WITH CHECK (true)`
- **CORS问题**：数据成功写入但显示同步失败时，检查CORS配置和TypeError处理

### 部署注意事项
- **Vercel环境变量**：`.env.local` 不会被提交，需在Dashboard手动配置
- **Cloudflare代理**：国内访问需配置Cloudflare，在Supabase CORS中添加自定义域名
- **构建配置**：移除 `vercel.json` 中不支持的 `framework` 字段

### 常见坑点
- **Taro Input组件**：H5环境需使用 `onInput` 而非 `onChange`
- **TabBar导航**：使用 `switchTab` 而非 `navigateBack` 返回TabBar页面
- **process is not defined**：Taro的webpack DefinePlugin需正确配置环境变量注入
- **安全密钥覆盖**：不要在HTML中硬编码安全密钥，使用JS动态设置

## 📄 License

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！