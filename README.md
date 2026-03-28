# Gemini Batch Image Tool

基于 Gemini 的批量生图工具，支持 MiniMax 翻译 + Gemini 生图双 API 协作。

## 功能特性

### 三种输入模式

1. **主题词生成** — 输入关键词，MiniMax 扩展为英文 Prompt，Gemini 生成图片
2. **参考图生成** — 上传参考图 + 描述，MiniMax 分析后生成变体 Prompt
3. **直接粘贴** — 直接粘贴已有的 Prompt 批量生成

### 核心流程

```
输入 → MiniMax 翻译 → 翻译结果预览（可编辑）→ 确认 → Gemini 生成 → 保存到本地
```

### 功能列表

- [x] 三种输入模式（主题词 / 参考图 / 直接粘贴）
- [x] MiniMax 翻译 + Gemini 生图双 API
- [x] 翻译结果预览 + 二次编辑
- [x] 文件保存到本地指定目录（File System Access API）
- [x] 浏览器下载降级方案
- [x] 中英双语界面
- [x] LLM 调用统计（次数 / Token / 预估费用）
- [x] 历史记录（LocalStorage）
- [x] 失败任务重试
- [x] 实时生成日志面板
- [x] 草稿持久化（刷新页面不丢失）
- [x] 参考图 IndexedDB 存储
- [x] 本地存储空间显示 + 一键清理
- [x] 多币种价格换算（人民币/新币/美元）

## 技术栈

- React 18 + Vite
- Tailwind CSS
- LocalStorage + IndexedDB
- File System Access API

## 目录结构

```
gemini-batch-image/
├── src/
│   ├── components/
│   │   ├── BatchGenerate/   # 批量生图主页面
│   │   ├── History/        # 历史记录
│   │   ├── Settings/       # 设置页
│   │   ├── Header.jsx
│   │   ├── ImagePreview.jsx
│   │   ├── ProgressBar.jsx
│   │   ├── UsageStats.jsx  # LLM 统计面板
│   │   ├── GenerationLog.jsx # 生成日志
│   │   └── StorageInfo.jsx  # 存储信息
│   ├── services/
│   │   ├── minimax.js      # MiniMax 翻译
│   │   ├── gemini.js       # Gemini 生图
│   │   ├── storage.js      # 文件保存
│   │   ├── db.js          # IndexedDB
│   │   └── exchangeRate.js # 汇率服务
│   ├── i18n/               # 中英双语
│   ├── context/             # 全局状态
│   └── utils/               # 工具函数
└── docs/
    └── plans/               # 设计文档
```

## 版本历史

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

## 使用说明

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

在设置页面填写：
- **MiniMax Key** — 用于翻译（模型：MiniMax-M2.7-highspeed）
- **Gemini Key** — 用于生图（模型：gemini-3.1-flash-image-preview）

### 3. 选择保存路径

使用 Chrome/Edge 浏览器选择本地文件夹，图片将直接保存到该目录。

### 4. 选择货币类型

在设置页面选择费用显示的货币类型（人民币/新币/美元），系统会根据实时汇率自动换算。

### 5. 开始使用

```bash
npm run dev
```

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

> 注：实际费用会根据你选择的货币类型和实时汇率自动换算显示。

## License

MIT
