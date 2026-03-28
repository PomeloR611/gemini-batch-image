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

## 技术栈

- React 18 + Vite
- Tailwind CSS
- LocalStorage
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
│   │   └── UsageStats.jsx  # LLM 统计面板
│   ├── services/
│   │   ├── minimax.js      # MiniMax 翻译
│   │   ├── gemini.js       # Gemini 生图
│   │   └── storage.js      # 文件保存
│   ├── i18n/               # 中英双语
│   ├── context/             # 全局状态
│   └── utils/               # 工具函数
└── docs/
    └── plans/               # 设计文档
```

## 版本历史

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

### 4. 开始使用

```bash
npm run dev
```

## 价格估算

| 服务 | 单价 |
|------|------|
| MiniMax | ¥0.1/千 Token |
| Gemini | ¥0.01/千 Token（折算）|

## License

MIT
