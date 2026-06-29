# AI 过渡帧生成 — 实施交付文档

> 日期: 2026-06-29
> 状态: Phase 1 + Phase 2 完成

## 实施范围

本次实施覆盖了架构设计文档中的 **Phase 1（设置基础设施）** 和 **Phase 2（AI Provider 核心）**：

### Phase 1: 设置基础设施 ✅

| 组件 | 文件 | 状态 |
|------|------|------|
| settings 表 | `src-tauri/src/db.rs` | ✅ 已添加 key-value 表 |
| Settings CRUD | `src-tauri/src/db.rs` | ✅ get_setting/set_setting/get_all_settings/get_ai_settings |
| Tauri commands | `src-tauri/src/main.rs` | ✅ save_settings/get_settings/get_ai_settings/test_ai_connection |
| Settings 页面 | `src/pages/SettingsPage.tsx` | ✅ 三 Tab 布局，真实后端连接 |
| 侧边栏入口 | `src/components/Layout.tsx` | ✅ 设置按钮已激活 |
| 路由 | `src/App.tsx` | ✅ /settings 路由 |
| Frontend types | `src/types.ts` | ✅ 完整类型定义 |
| Zustand store | `src/store/index.ts` | ✅ aiSettings + setAiSettings + isAiConfigured() |
| Tauri wrappers | `src/utils/tauriCommands.ts` | ✅ getSettings/saveSettings/testAiConnection/getAiSettings |

### Phase 2: AI Provider 核心 ✅

| 组件 | 文件 | 状态 |
|------|------|------|
| Provider trait | `src-tauri/src/ai.rs` | ✅ AiImageProvider trait |
| SiliconFlow impl | `src-tauri/src/ai.rs` | ✅ 生成图片 + 连接测试 |
| Provider factory | `src-tauri/src/ai.rs` | ✅ create_provider() |
| 风格预设 | `src-tauri/src/ai.rs` | ✅ 4 种预设 + 自定义 prompt |
| 连接测试 UI | `src/pages/SettingsPage.tsx` | ✅ 状态机 idle→testing→success/error |
| VideoGeneratePage | `src/pages/VideoGeneratePage.tsx` | ✅ AI toggle 连接真实 store |
| Cargo 依赖 | `src-tauri/Cargo.toml` | ✅ reqwest 0.12 (json + rustls-tls + blocking) |

## 新增/修改文件清单

### Rust 后端
| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src-tauri/Cargo.toml` | 修改 | 新增 reqwest 依赖 |
| `src-tauri/src/db.rs` | 修改 | 新增 settings 表 + 6 个方法 + AiSettings 结构体 |
| `src-tauri/src/ai.rs` | **新增** | Provider trait、SiliconFlow、工厂函数、prompt 构建 |
| `src-tauri/src/main.rs` | 修改 | 新增 mod ai、4 个 Tauri commands |

### 前端
| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/types.ts` | **新增** | 全部类型定义（Baby/Period/VideoConfig/AiSettings 等） |
| `src/store/index.ts` | 修改 | 新增 aiSettings 状态 + isAiConfigured() 导出函数 |
| `src/utils/tauriCommands.ts` | 修改 | 新增 4 个设置相关 Tauri invoke 封装 |
| `src/pages/SettingsPage.tsx` | 修改 | 连接真实后端（替代 localStorage）|
| `src/pages/VideoGeneratePage.tsx` | 修改 | 连接 Zustand store（替代 localStorage）|
| `src/components/Layout.tsx` | 已修改 | 设置按钮激活 |
| `src/App.tsx` | 已修改 | /settings 路由 |
| `src/index.css` | 已修改 | Settings 页面样式 |

## 编译验证

- **Rust**: `cargo check` — 0 errors, 5 warnings (未使用项，Phase 3 会用到)
- **Frontend**: `vite build` — 成功，1410 modules, 3.66s
- **TypeScript**: 新增代码 0 类型错误（项目原有 is_multi_selected 问题独立存在）

## 数据流

```
SettingsPage (React) → saveSettings() → Tauri invoke → db.set_setting()
                          ↓
                    SQLite settings 表
                          ↓
VideoGeneratePage → useAppStore → aiSettings.enabled → AI toggle UI
                          ↓
                    testAiConnection() → ai::test_connection_async()
                          ↓
                    SiliconFlow API → 返回 success/error
```

## 待实施: Phase 3 — 视频管道集成

Phase 3 需要将 AI 过渡帧生成集成到 FFmpeg 视频管道中：
- 将 `generate_growth_video` 改为 async Tauri command
- 实现 AI 过渡帧生成逻辑（遍历照片对 → 调用 provider.generate_image()）
- 修改 FFmpeg filter_complex 命令构建
- 实现降级策略（AI 失败回退标准转场）
- Tauri event 真实进度推送

## 待实施: Phase 4 — 前端完善

- 进度条改为监听 Tauri event
- AI 过渡帧生成进度展示
- 降级提示 UI
