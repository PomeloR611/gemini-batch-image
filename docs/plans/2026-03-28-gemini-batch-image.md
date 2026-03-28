# Gemini Batch Image Tool Implementation Plan

**Goal:** 构建一个基于 Gemini 的批量生图工具，支持三种输入模式

**Tech Stack:** React 18, Vite, Tailwind CSS, LocalStorage, File System Access API

---

## 实现任务清单

### Task 1: 项目初始化
- `package.json` + Vite/Tailwind 配置文件
- `index.html` + `src/main.jsx` + `src/index.css`
- 运行 `npm install` 安装依赖

### Task 2: i18n 和 Context
- `src/i18n/zh.json` + `src/i18n/en.json` + `src/i18n/index.js`
- `src/context/AppContext.jsx`（全局状态：Keys、路径、语言、历史）
- `src/App.jsx` 三 Tab 布局框架

### Task 3: 基础组件
- `src/components/Header.jsx`
- `src/components/Settings/index.jsx`（API Key 配置 + 目录选择）

### Task 4: API 服务层
- `src/utils/helpers.js`（工具函数）
- `src/services/minimax.js`（MiniMax 翻译）
- `src/services/gemini.js`（Gemini 生图）
- `src/services/storage.js`（文件保存 + 历史记录）

### Task 5: 批量生图组件
- `src/components/BatchGenerate/ModeSelector.jsx`
- `src/components/BatchGenerate/KeywordMode.jsx`
- `src/components/BatchGenerate/ReferenceMode.jsx`
- `src/components/BatchGenerate/DirectPromptMode.jsx`
- `src/components/ImagePreview.jsx`
- `src/components/ProgressBar.jsx`
- `src/components/BatchGenerate/index.jsx`（主页面）

### Task 6: 历史记录组件
- `src/components/History/index.jsx`

### Task 7: 验证和测试
- 启动项目 `npm run dev`
- 验证三模式流程
- 验证 API Key 保存
- 验证文件保存到本地目录

---

## 核心逻辑说明

**翻译 Prompt（MiniMax）**：
- 主题词模式：MiniMax 将关键词扩展为英文生图 Prompt
- 参考图模式：MiniMax 分析图片 + 描述，生成目标 Prompt
- 直接粘贴：跳过翻译，直接用 Prompt 生图

**生图（Gemini）**：
- 模型：`gemini-3.1-flash-image-preview`
- `responseModalities` 设为 IMAGE，返回 base64 图片

**文件保存**：
- 使用 File System Access API `showDirectoryPicker()` 获取目录句柄
- 每张图片保存为 `gemini_[timestamp]_[index].png`
- 降级方案：浏览器默认下载
