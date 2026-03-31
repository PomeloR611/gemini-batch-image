# Gemini Batch Image Tool

基于 Gemini 的批量生图工具，支持 MiniMax 翻译 + Gemini 生图双 API 协作。支持 Docker 容器化部署，局域网多用户共享使用。

## 功能特性

### 三种输入模式

1. **主题词生成** — 输入关键词，MiniMax 扩展为英文 Prompt，Gemini 生成图片
2. **参考图生成** — 上传参考图 + 描述，MiniMax 分析后生成变体 Prompt
3. **直接粘贴** — 直接粘贴已有的 Prompt 批量生成

### 核心流程

```
登录 → 输入 → MiniMax 翻译 → 翻译结果预览（可编辑）→ 确认 → Gemini 生成 → 保存
```

### 功能列表

- [x] 三种输入模式（主题词 / 参考图 / 直接粘贴）
- [x] MiniMax 翻译 + Gemini 生图双 API
- [x] 翻译结果预览 + 二次编辑
- [x] 中英双语界面
- [x] LLM 调用统计（次数 / Token / 预估费用）
- [x] 历史记录
- [x] 失败任务重试
- [x] 实时生成日志面板
- [x] 草稿持久化（刷新页面不丢失）
- [x] 参考图 IndexedDB 存储
- [x] 本地存储空间显示 + 一键清理
- [x] 多币种价格换算（人民币/新币/美元）
- [x] **登录码认证 + MAC 地址绑定**（一码一机）
- [x] **API 流量服务端代理**（前端不持有 API Key）
- [x] **管理员后台**（登录码管理 / 用户管理 / API Key 配置）
- [x] **权限隔离**（非管理员不可见模型配置）
- [x] **Docker 容器化部署**（局域网共享使用）

## 技术栈

### 前端
- React 18 + Vite 5
- Tailwind CSS 3.4
- LocalStorage + IndexedDB

### 后端
- Node.js 20 + Express
- SQLite (better-sqlite3)
- express-session
- AES-256-CBC 加密存储 API Key

### 部署
- Docker (单容器，`--network=host`)
- 多阶段构建（前端编译 + 后端运行）

## 目录结构

```
gemini-batch-image/
├── src/                        # 前端源码
│   ├── components/
│   │   ├── BatchGenerate/      # 批量生图主页面
│   │   ├── AdminPanel/         # 管理员后台
│   │   ├── History/            # 历史记录
│   │   ├── Settings/           # 用户设置
│   │   ├── LoginPage.jsx       # 登录页
│   │   ├── Header.jsx
│   │   ├── ImagePreview.jsx
│   │   ├── ProgressBar.jsx
│   │   ├── UsageStats.jsx
│   │   ├── GenerationLog.jsx
│   │   └── StorageInfo.jsx
│   ├── services/
│   │   ├── auth.js             # 认证 API
│   │   ├── minimax.js          # MiniMax 代理调用
│   │   ├── gemini.js           # Gemini 代理调用
│   │   ├── storage.js          # 文件保存
│   │   ├── db.js               # IndexedDB
│   │   └── exchangeRate.js     # 汇率服务
│   ├── i18n/                   # 中英双语
│   ├── context/                # 全局状态
│   └── utils/                  # 工具函数
├── server/                     # 后端源码
│   ├── index.js                # Express 入口
│   ├── routes/
│   │   ├── auth.js             # 认证路由（登录/登出/会话）
│   │   ├── proxy.js            # API 代理（MiniMax/Gemini）
│   │   └── admin.js            # 管理后台 API
│   ├── middleware/
│   │   └── auth.js             # 认证/鉴权中间件
│   └── services/
│       ├── db.js               # SQLite 初始化
│       ├── arp.js              # ARP MAC 地址解析
│       └── crypto.js           # API Key 加解密
├── Dockerfile                  # 容器构建
├── .dockerignore
└── docs/                       # 设计文档
```

## 架构说明

```
局域网用户浏览器
    │
    ▼
Docker 容器 (--network=host, port 3000)
├── Express 后端
│   ├── 认证中间件（Session 校验）
│   ├── /api/auth/*    ← 登录码验证 + MAC 绑定
│   ├── /api/proxy/*   ← 代理 MiniMax/Gemini 请求（注入 API Key）
│   ├── /api/admin/*   ← 管理后台接口（仅管理员）
│   └── 静态文件服务    ← React 编译产物
└── SQLite 数据库（volume 挂载持久化）
```

### 认证机制

- 管理员生成登录码，分发给用户
- 用户首次登录时，登录码自动绑定当前设备 MAC 地址
- 绑定后仅该设备可使用此登录码，其他设备无法复用
- 管理员可在后台解绑/禁用/删除登录码

### 权限模型

| 能力 | 管理员 | 普通用户 |
|------|--------|----------|
| 批量生图 | ✓ | ✓ |
| 查看/配置 API Key | ✓ | ✗ |
| 管理登录码 | ✓ | ✗ |
| 查看用户列表 | ✓ | ✗ |
| 解绑设备 | ✓ | ✗ |
| 个人设置（语言/货币） | ✓ | ✓ |

## 部署指南

### Docker 部署（推荐）

```bash
# 构建镜像
docker build -t gemini-batch .

# 启动容器
docker run -d \
  --network=host \
  -v ./data:/app/data \
  -e PORT=3000 \
  -e ENCRYPTION_KEY=your-random-secret-key \
  -e ADMIN_CODE=your-initial-admin-code \
  gemini-batch
```

| 参数 | 说明 |
|------|------|
| `--network=host` | 必须。使用宿主机网络，用于 ARP 获取局域网设备真实 MAC |
| `-v ./data:/app/data` | 持久化 SQLite 数据库 |
| `ENCRYPTION_KEY` | API Key 加密密钥 |
| `ADMIN_CODE` | 首次启动时创建的管理员登录码 |
| `PORT` | 服务端口，默认 3000 |

首次启动后：
1. 浏览器访问 `http://<服务器IP>:3000`
2. 使用 `ADMIN_CODE` 设定的登录码登录
3. 进入「管理后台」配置 MiniMax / Gemini API Key
4. 生成登录码分发给其他用户

### 本地开发

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 启动后端（终端 1）
ADMIN_CODE=admin123 ENCRYPTION_KEY=devsecret node server/index.js

# 启动前端（终端 2）
npm run dev
```

- 前端开发服务器：http://localhost:3000（自动代理 /api 到后端）
- 后端服务：http://localhost:3001

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `ENCRYPTION_KEY` | 是 | AES-256 加密密钥，用于加密存储 API Key |
| `ADMIN_CODE` | 首次启动时 | 初始管理员登录码（数据库为空时自动创建） |
| `PORT` | 否 | 服务端口，默认 3001（开发）/ 3000（Docker） |

## 价格估算

### MiniMax 翻译

| 项目 | 单价 |
|------|------|
| Token | ¥0.1/千 Token |

### Gemini 生图（官方 USD 定价）

| 图片分辨率 | 每张图片消耗 Token | 单价（USD） |
|-----------|------------------|--------------|
| 0.5K (512x512) | 747 | $0.045 |
| 1K (1024x1024) | 1,120 | $0.067 |
| 2K (2048x2048) | 1,680 | $0.101 |
| 4K (4096x4096) | 2,520 | $0.151 |

> 费用根据选择的货币类型和实时汇率自动换算显示。

## 版本历史

### v2.0.0 (2026-03-31)

**重大更新 — 服务端架构 + 多用户支持**

- 新增 Express 后端，支持容器化部署
- 新增登录码认证系统，支持 MAC 地址绑定（一码一机）
- 所有模型 API 调用改为服务端代理，前端不再持有 API Key
- 新增管理员后台（登录码管理 / 用户管理 / API Key 配置）
- 新增权限隔离，非管理员不可见模型配置信息
- API Key 使用 AES-256-CBC 加密存储
- 支持 Docker 单容器部署 + `--network=host` 局域网共享
- 前端 Settings 页精简，API Key 配置移至管理后台
- 新增中英双语管理后台翻译

### v1.1.0 (2026-03-28)

**功能增强**
- 实时生成日志面板（左侧滚动日志）
- 草稿持久化（刷新页面不丢失输入内容）
- 参考图 IndexedDB 存储
- 本地存储空间显示 + 一键清理
- 多币种价格换算（人民币/新币/美元）
- 汇率实时获取（Frankfurter API）

### v1.0.0 (2026-03-28)

**初始版本**
- 三种输入模式支持
- MiniMax 翻译 + Gemini 生图双 API
- 翻译结果预览二次编辑
- 本地文件保存
- LLM 调用统计
- 历史记录
- 中英双语界面

## License

MIT
