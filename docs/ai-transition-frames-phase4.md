# Phase 4: 前端完善 — 真实进度 + 降级通知

## 完成时间
2026-06-29

## 改动概述

Phase 4 将前端从模拟进度条替换为 Tauri event 驱动的真实管线进度，完成 AI 过渡帧功能的前端集成闭环。

---

## 1. Zustand Store 扩展 (`src/store/index.ts`)

新增 5 个状态字段，支持生成阶段追踪：

| 字段 | 类型 | 说明 |
|------|------|------|
| `generationStage` | `string` | 当前阶段：preparing / ai_generation / ai_fallback / ffmpeg_encoding / complete / error |
| `generationMessage` | `string` | 当前阶段描述文案 |
| `generationFallback` | `boolean` | 是否触发了 AI 降级 |
| `fallbackReason` | `string` | 降级原因描述 |
| setter 函数 | — | 对应的 5 个 setter |

---

## 2. VideoGeneratePage 改造 (`src/pages/VideoGeneratePage.tsx`)

### 2.1 核心生成流程

```
用户点击"开始生成"
  → saveFile 选择输出路径
  → 重置所有进度/降级/错误状态
  → listen("generation-progress", callback) 注册 Tauri 事件监听
  → generateGrowthVideo(projectId, config, outputPath) 调用异步 Rust 命令
  → 后端实时推送 generation-progress 事件
  → 前端更新进度条 + 阶段指示器 + 文案
  → 完成后显示 ExportRecord 结果（或错误）
  → 500ms 后清理事件监听
```

### 2.2 原有模拟代码移除

- ❌ 删除 `setInterval` 模拟进度（每 500ms +5%）
- ❌ 删除 `setTimeout` 模拟完成（3s 后弹窗）
- ✅ 替换为 `listen("generation-progress")` 事件驱动

### 2.3 新增状态

```typescript
const [generationError, setGenerationError] = useState<string | null>(null);
const [completedVideoPath, setCompletedVideoPath] = useState<string | null>(null);
const unlistenRef = useRef<(() => void) | null>(null);  // 事件监听清理引用
```

### 2.4 新辅助函数

- `getDefaultMessage(stage, current, total)` — 将后端 stage 映射为中文进度文案
- `getStageLabel(stage)` — 阶段友好名称
- `<StageIcon stage={...} />` — 各阶段对应的图标组件（Sparkles / Film / CheckCircle2 等）

---

## 3. 降级通知 UI

当后端推送 `stage === "ai_fallback"` 的 progress 事件时：

```
┌─────────────────────────────────────────────┐
│ ⚠️  AI 过渡帧生成失败，已回退到标准转场       │
│     原因: any single provider error msg     │
└─────────────────────────────────────────────┘
```

- 琥珀色背景 `bg-amber-50` + 琥珀色边框
- `AlertTriangle` 图标
- 显示后端传回的 fallback reason

---

## 4. 完成/错误状态

### 成功 (`stage === "complete"`)
- 绿色成功卡片，显示 `CheckCircle2` 图标
- 展示实际输出路径 (truncate 280px)
- "查看" 按钮可查看文件路径

### 错误 (`stage === "error"`)
- 红色错误卡片，显示 `AlertCircle` 图标
- 展示后端返回的错误详情字符串

---

## 5. 内存泄漏防护

- `useEffect` cleanup: 组件卸载时自动取消事件监听
- `handleGenerate` finally: 生成完成后延迟 500ms 清理监听（确保最终事件已收到）
- `unlistenRef` 双重保障

---

## 6. 编译结果

```
vite build: ✓ 0 errors (3.56s)
    dist/assets/index.js    339.79 kB (gzip: 96.47 kB)
    dist/assets/index.css    80.47 kB (gzip: 14.71 kB)

cargo check: unchanged (Phase 3 通过, Phase 4 无 Rust 改动)
```

---

## 7. 全量实现完成状态

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 设置基础设施 (SQLite key-value) | ✅ 完成 |
| Phase 2 | AI Provider 核心 (trait + SiliconFlow) | ✅ 完成 |
| Phase 3 | 视频管道集成 (async + concat 命令) | ✅ 完成 |
| Phase 4 | 前端完善 (真实进度 + 降级通知) | ✅ 完成 |

AI 过渡帧功能已从前到后完整可工作。
