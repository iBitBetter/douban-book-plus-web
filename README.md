# Douban eBook ++ Web — 豆瓣读书增强（Web 版）

> 一键从书名 / 豆瓣链接直达你的电子书平台。Web 版本，无需安装浏览器插件。

由 [Douban eBook ++](../douban-book-plus) Chrome 扩展改造而来，保留全部 7 平台智能解析能力，新增豆瓣链接自动识别与明暗主题。

---

## ✨ 功能特性

| 平台 | 解析方式 | 状态 |
|------|---------|------|
| 微信读书 | 书名 → bookDetail 直链 | ✅ 直达 |
| 豆瓣阅读 | 书名 → reader/ebook 直链 | ✅ 直达 |
| 得到 | 书名 → ebook/reader 直链 | ✅ 直达 |
| 多看阅读 | 书名 → reader/app.html 直链 | ✅ 直达 |
| 网易蜗牛读书 | 书名 → share/book 直链 | ✅ 直达 |
| Z-Library | 多镜像探活 + ISBN 搜索 | ✅ 直达 |
| Anna's Archive | ISBN / 书名搜索 | 🔗 搜索 |

**相比原插件的新增能力：**
- 📎 粘贴豆瓣链接自动提取书名 / ISBN / 作者
- 🌗 浅色 / 深色 / 跟随系统三态主题切换
- 💎 玻璃拟态（glass morphism）Premium 界面
- ⚡ 7 平台并行解析，骨架屏加载动画
- 🔧 镜像与搜索地址可视化配置（localStorage 持久化）

---

## 🏗️ 架构

原插件依赖 Chrome 扩展的 Service Worker 跨域特权代理各平台 API。Web 版无法直接跨域，因此采用 **Node.js 后端代理 + 静态前端** 架构，复用原项目全部解析算法：

```
浏览器前端 (public/)
    │  用户输入书名 / ISBN / 豆瓣链接
    │
    ├──▶ POST /api/parse-douban   解析豆瓣页面，提取书名/ISBN/作者
    ├──▶ POST /api/search         并行解析 5 个 API 平台
    └──▶ POST /api/probe-zlib     探测 Z-Library 镜像可用性
                │
                ▼
        Node.js 后端代理 (server.js)
         ├── lib/resolvers.js     5 平台 API 解析（weread/duokan/dedao/doubanread/woniu）
         ├── lib/matcher.js       书名 + 作者智能匹配（2-gram Jaccard 相似度）
         ├── lib/weread-encode.js 微信读书 bookId → web URL ID 编码（MD5）
         └── lib/mirror-probe.js  Z-Library 镜像顺序探活
                │
                ▼
        各电子书平台 API
```

**与原插件的对应关系：**

| 原插件文件 | Web 版对应 | 说明 |
|-----------|-----------|------|
| `content.js` | `public/js/app.js` + `public/index.html` | UI 与交互逻辑 |
| `background.js` | `server.js` + `lib/*.js` | API 代理与解析（Service Worker → Express） |
| `options.html/js` | `public/settings.html` + `public/js/settings.js` | 镜像配置页 |
| `utils/weread-encode.js` | `lib/weread-encode.js` | 微信读书编码算法（原样保留） |
| `chrome.storage.sync` | `localStorage` (DBPlus.storage) | 配置持久化 |
| `chrome.runtime.sendMessage` | `fetch('/api/...')` | 前后端通信 |

---

## 🚀 安装与运行

### 环境要求
- Node.js ≥ 18（内置 `fetch` / `AbortController`）

### 启动

```bash
cd douban-book-plus-web
npm install
npm start
```

启动后访问 **http://localhost:3000**

### 使用

1. **搜索框**输入以下任意一种：
   - 豆瓣书籍链接：`https://book.douban.com/subject/2567698/`
   - 书名：`三体`
   - ISBN：`9787536692930`
2. 点击「搜索」→ 7 个平台卡片并行加载
3. 卡片标记 **直达** = 已智能匹配到详情页；**搜索** = 跳转搜索页
4. Z-Library 卡片会异步探测镜像（约 3 秒），可用后变「直达」
5. 点击「镜像设置」配置自定义 Z-Library 镜像与 Anna's Archive 地址

---

## ☁️ 部署到 Vercel

本项目支持 Vercel 一键部署，前后端同仓库托管：

- **静态前端**：`public/` 目录自动托管（Vercel 约定）
- **API 代理**：`api/` 目录下的 `.js` 文件自动成为 Serverless Functions
- **零配置**：`vercel.json` 已就绪，`lib/` 被两端共享

### 方式一：GitHub 一键导入（推荐）

1. 将本项目推送到 GitHub 仓库
2. 访问 [vercel.com/new](https://vercel.com/new)，导入该仓库
3. Framework Preset 选 **Other**（无需配置 Build Command）
4. 点击 **Deploy**，等待约 30 秒即可上线
5. 后续 `git push` 自动触发部署

### 方式二：Vercel CLI

```bash
npm i -g vercel          # 安装 CLI
cd douban-book-plus-web
vercel                   # 首次部署（按提示登录、确认）
vercel --prod            # 正式环境部署
```

### 部署后

- 访问 `https://你的项目.vercel.app` 即可使用
- API 端点：`https://你的项目.vercel.app/api/search` 等
- Vercel Hobby（免费）计划函数超时 10 秒，足够 7 平台并行解析

> 💡 本地开发继续用 `node server.js`（零依赖），Vercel 部署用 `api/` Serverless Functions，两者共享 `lib/` 解析模块，逻辑完全一致。

---

## 📁 项目结构

```
douban-book-plus-web/
├── server.js                  # 本地开发入口（Node http 模块，零依赖）
├── vercel.json                # Vercel 部署配置
├── package.json
├── api/                       # Vercel Serverless Functions
│   ├── health.js              # GET /api/health
│   ├── parse-douban.js        # POST /api/parse-douban
│   ├── search.js              # POST /api/search
│   └── probe-zlib.js          # POST /api/probe-zlib
├── lib/                       # 后端解析模块（api/ 与 server.js 共享）
│   ├── resolvers.js           # 5 平台 API 解析
│   ├── matcher.js             # 书名/作者智能匹配
│   ├── weread-encode.js       # 微信读书 bookId 编码
│   ├── mirror-probe.js        # Z-Library 镜像探活
│   └── helpers.js             # 共享辅助函数
└── public/                    # 前端静态资源（Vercel 自动托管）
    ├── index.html             # 搜索主页
    ├── settings.html          # 镜像配置页
    ├── css/
    │   ├── main.css           # 主题系统 + 主页样式
    │   └── settings.css       # 设置页样式
    └── js/
        ├── platforms.js       # 平台元数据 + storage 封装
        ├── app.js             # 主页逻辑
        └── settings.js        # 设置页逻辑
```

---

## 🔌 API

| 方法 | 路径 | 入参 | 返回 |
|------|------|------|------|
| POST | `/api/parse-douban` | `{ url }` | `{ title, isbn, author }` |
| POST | `/api/search` | `{ title, isbn, author }` | `{ results: [{platform,name,color,url,found}] }` |
| POST | `/api/probe-zlib` | `{ isbn, title, mirrors }` | `{ url, mirror, alive }` |
| GET | `/api/health` | — | `{ ok: true }` |

---

## 🎨 设计

- **Swiss 瑞士风** + **IKB 克莱因蓝**（#002FA7）品牌色
- 玻璃拟态卡片，`backdrop-filter` 毛玻璃质感
- 三态主题（浅色 / 深色 / 跟随系统），CSS 变量驱动，过渡平滑
- 磁吸悬停、骨架屏、徽章状态机等微交互
- 响应式布局，移动端自适应

---

## 📝 技术栈

- **后端**：Node.js + Express（仅一个依赖）
- **前端**：原生 HTML / CSS / JS，零构建步骤
- **解析算法**：2-gram Jaccard 书名相似度 + 作者交叉匹配
- **图标**：内联 SVG data URI，零网络请求

---

## License

MIT © BitBetter
