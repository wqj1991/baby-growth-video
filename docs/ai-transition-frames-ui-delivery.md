# AI 智能过渡 - UI 设计交付

> 日期: 2026-06-29
> 基于架构设计: docs/ai-transition-frames-design.md

## 交付文件

| 文件 | 说明 | 状态 |
|------|------|------|
| `src/pages/SettingsPage.tsx` | 设置页面（AI模型/过渡风格/通用三标签） | 新建 |
| `src/components/Layout.tsx` | 侧边栏设置按钮激活 + 路由高亮 | 修改 |
| `src/App.tsx` | 新增 `/settings` 路由 | 修改 |
| `src/pages/VideoGeneratePage.tsx` | AI过渡开关 + 配置状态检测 + 预计时长更新 | 修改 |
| `src/index.css` | Settings 组件专属 CSS（range slider、conn indicator 等） | 新增 |

## 设计系统对照

### 遵循的现有设计规范

| 规范 | 应用 |
|------|------|
| **主色调** 暖琥珀·珊瑚 | Tab 选中态、按钮 primary、toggle active、range thumb 均使用 warmth gradient |
| **辅助色** 深靛蓝 | AI 功能专属色（Sparkles 图标、配置提示、进度提示） |
| **玻璃拟态** | 设置页整体继承 Layout 的 glass-strong 侧边栏背景 |
| **字体 Inter** | 全文使用 Inter，monospace 字段用系统等宽字体 |
| **卡片系统** | card / card-header / card-body 类一致使用 |
| **表单系统** | form-group / form-label / form-input / form-select 类一致使用 |
| **按钮系统** | btn / btn-primary / btn-secondary / btn-ghost / btn-sm 类一致使用 |
| **动画** | fadeInScale, --transition-base (250ms), stagger 延迟 |

### UX 规范要点 (ui-ux-pro-max)

| 类别 | 规范 | 应用 |
|------|------|------|
| **Accessibility** | 4.5:1 对比度 | text-stone-900 on white 满足 |
| **Accessibility** | Focus rings | input:focus 橙色 ring, btn:focus-visible |
| **Accessibility** | role="switch" aria-checked | toggle 开关均有 |
| **Accessibility** | aria-label | 图标按钮均有 |
| **Touch** | 44px min | 按钮均超过 44px |
| **Forms** | 可见标签 | 所有 input 有 label + for 属性 |
| **Forms** | 错误反馈 | 连接测试 error/success 状态 |
| **Forms** | Eye toggle | API Key 有 show/hide 按钮 |
| **Animation** | 150-300ms | transition-all duration-200 |
| **Animation** | Reduced motion | 已有 @media prefers-reduced-motion |
| **Style** | SVG icons (Lucide) | 无 emoji 作为结构图标 |
| **Style** | 一致性 | 与项目全局风格完全一致 |

## 关键 UI 设计决策

### 1. 设置页面导航
- **三 Tab 平铺** 而非手风琴：AI模型、过渡风格、通用分三栏
- **Tab 样式** 继承项目 pill 按钮风格（圆角 + 白底 + shadow-soft）
- **原因**: 设置项不超过 10 个，平铺比手风琴认知负担更低

### 2. AI 配置未完成时的降级 UI
- **VideoGeneratePage** 检测 AI 是否配置（apiKey + endpoint + model）
- 未配置 → 显示 **黄色警告条** + "去配置" 按钮跳转设置
- 已配置 → 显示 **toggle 开关** 可直接启用
- **原因**: 不打断用户流程，引导式配置

### 3. API Key 安全性
- **password 输入框** + Eye/EyeOff toggle
- 存储提示文案："仅存储在本地 SQLite 数据库中，不会上传"
- **原因**: 桌面应用场景下用户控制本机安全，password mask 防偷窥

### 4. 连接测试按钮
- 状态机：idle → testing → success/error
- Testing 状态显示 spinner
- Success/Error 用品牌色（emerald/rose）+ 对应图标
- **原因**: 确保用户在保存前已验证配置有效

### 5. 风格预设卡片
- **2 列网格** 展示 4 种预设
- 选中态：warmth border + warmth bg + check 图标
- 每卡片含 emoji 标签 + 截断 prompt 预览
- **原因**: 比 dropdown 更直观，用户可看到 prompt 风格差异

## 编译结果

```
✓ tsc --noEmit: 零错误
✓ pnpm build: 零错误
   CSS: 79.21 kB (gzip: 14.50 kB)
   JS:  333.16 kB (gzip: 94.75 kB)
```

## 后续待办

- [ ] `test_ai_connection` 替换为真实 Tauri 命令（目前 simulate）
- [ ] `save_settings` / `get_settings` 替换为真实 Tauri 命令（目前 localStorage）
- [ ] 视频生成时传递 `ai_enabled` flag 到 Rust 后端
- [ ] Settings 数据迁移到 SQLite settings 表（Phase 1）
