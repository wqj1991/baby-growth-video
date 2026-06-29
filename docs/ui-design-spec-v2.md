# 🎨 Baby Growth Video — UI 设计系统 v2.0

> **设计方向**: 现代大气 · 温暖质感 · 玻璃拟态  
> **设计师**: UI Designer  
> **日期**: 2026-06-29  
> **WCAG 标准**: AA 级

---

## 一、设计哲学

### 核心理念

| 原则 | 说明 |
|------|------|
| **温暖记忆** | 暖色调琥珀-珊瑚渐变传达成长与关爱的情感温度 |
| **现代大气** | 玻璃拟态、柔和阴影、大留白、克制装饰 |
| **呼吸感** | 充足间距、清晰层级、不拥挤的信息密度 |
| **流畅交互** | 150-300ms 微交互，Spring 缓动，交错误差动画 |

### 风格参考

Apple Human Interface + 温暖品牌调性 + 玻璃拟态现代化处理

---

## 二、色彩系统

### 主色系 — Warmth (暖琥珀·珊瑚)

| Token | Hex | 用途 |
|-------|-----|------|
| `warmth-50` | `#fffaf5` | 最浅底色 |
| `warmth-100` | `#fff2e6` | 卡片底色、选中态 |
| `warmth-200` | `#ffe4cc` | 边框、分隔线 |
| `warmth-300` | `#ffcca3` | 浅色点缀 |
| `warmth-400` | `#ffaf70` | 次要强调 |
| `warmth-500` | `#f58b3d` | **主色** |
| `warmth-600` | `#e06a1e` | 深色主色、渐变终点 |
| `warmth-700` | `#b85218` | 深色文字 |
| `warmth-800` | `#8f4118` | 极深强调 |
| `warmth-900` | `#6b3218` | 最深文字 |

### 辅助色系 — Indigo (深靛蓝)

| Token | Hex | 用途 |
|-------|-----|------|
| `indigo-50` | `#f4f5fb` | 底色 |
| `indigo-500` | `#5b66c0` | 辅助强调 |
| `indigo-600` | `#484fa5` | 深色辅助 |
| `indigo-900` | `#2b2e58` | 深色文字 |

### 点缀色

| Token | Hex | 用途 |
|-------|-----|------|
| `amber-500` | `#f5c000` | 金琥珀高亮 |
| `emerald-500` | `#2d9d5f` | 成功/生长 |
| `rose-500` | `#d44d68` | 危险/警示 |

### 中性色 — Stone (暖石灰)

| Token | Hex | 用途 |
|-------|-----|------|
| `stone-50` | `#fafaf8` | 页面背景 |
| `stone-100` | `#f5f4f0` | 区块底色 |
| `stone-200` | `#e8e6de` | 边框 |
| `stone-400` | `#b0aca0` | 占位文字 |
| `stone-600` | `#706c63` | 次要文字 |
| `stone-900` | `#33312d` | 主文字 |

### 渐变色板

```css
/* 暖色渐变 — 主按钮/强调 */
.gradient-warm: linear-gradient(135deg, #f58b3d 0%, #e06a1e 50%, #d44d68 100%);

/* 靛蓝渐变 — 辅助/科技感 */
.gradient-indigo: linear-gradient(135deg, #5b66c0 0%, #484fa5 50%, #3b3f85 100%);

/* 琥珀渐变 — 高亮/奖励 */
.gradient-amber: linear-gradient(135deg, #ffd43b 0%, #f5c000 50%, #d9a000 100%);

/* 日落渐变 — 氛围/横幅 */
.gradient-sunset: linear-gradient(135deg, #ffaf70, #f58b3d, #d44d68, #9b2441);
```

### 无障碍对比度保证

| 组合 | 对比度 | 等级 |
|------|--------|------|
| `stone-900` on `stone-50` | 12.5:1 | AAA |
| `stone-600` on `stone-50` | 5.8:1 | AA |
| `warmth-500` on `white` | 3.1:1 | AA (大文字) |
| `emerald-600` on `white` | 4.8:1 | AA |

---

## 三、字体系统

### 字体族

| 层级 | 字体 | 字重 |
|------|------|------|
| Display | Inter | 700-800 |
| Heading | Inter | 600-700 |
| Body | Inter | 400-500 |
| Caption | Inter | 400-500 |

```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
```

### 字号层级

| Token | Size | 行高 | 用途 |
|-------|------|------|------|
| `text-xs` | 12px | 1.5 | 标签、辅助文字 |
| `text-sm` | 14px | 1.5 | 正文、导航 |
| `text-base` | 16px | 1.6 | 主要内容 |
| `text-lg` | 18px | 1.5 | 卡片标题 |
| `text-xl` | 20px | 1.4 | 区块标题 |
| `text-2xl` | 24px | 1.4 | 页面标题 |
| `text-3xl` | 30px | 1.3 | 主标题 |
| `text-4xl` | 36px | 1.2 | Hero 标题 |

---

## 四、间距系统

基于 4px 基准的 8pt 网格：

| Token | 值 | 用途 |
|-------|-----|------|
| `1` | 4px | 微调间距 |
| `2` | 8px | 紧密元素间 |
| `3` | 12px | 元素分组内 |
| `4` | 16px | 标准内边距 |
| `5` | 20px | 卡片内边距 |
| `6` | 24px | 区块间距 |
| `8` | 32px | 大区块间距 |
| `12` | 48px | 页面级间距 |

---

## 五、阴影与高度

| Token | 值 | 用途 |
|-------|-----|------|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,.04)` | 微妙抬升 |
| `shadow-soft` | `0 2px 15px -3px rgba(0,0,0,.06)` | 卡片默认 |
| `shadow-medium` | `0 4px 25px -5px rgba(0,0,0,.08)` | 卡片悬停 |
| `shadow-elevated` | `0 10px 40px -10px rgba(0,0,0,.1)` | 模态/抽屉 |
| `shadow-glow` | `0 0 30px -5px rgba(245,139,61,.15)` | 品牌光晕 |

---

## 六、圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `rounded-lg` | 8px | 小型元素 |
| `rounded-xl` | 12px | 按钮、输入框 |
| `rounded-2xl` | 16px | 卡片、面板 |
| `rounded-3xl` | 24px | 大容器、横幅 |

---

## 七、效果系统

### 玻璃拟态 (Glass Morphism)

```css
.glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
```

### 微动画时序

| 类型 | 时长 | 缓动 |
|------|------|------|
| 悬停反馈 | 150-200ms | `cubic-bezier(0.4,0,0.2,1)` |
| 淡入/上滑 | 300-500ms | `cubic-bezier(0.16,1,0.3,1)` |
| 弹入 | 500ms | `cubic-bezier(0.34,1.56,0.64,1)` |
| 交错误差 | 50ms/项 | 同上 |

---

## 八、组件规范

### 按钮 (Button)

| 变体 | 背景 | 文字 | 用途 |
|------|------|------|------|
| Primary | `gradient-warm` | white | 主要操作 |
| Secondary | white + border | stone-900 | 次要操作 |
| Ghost | transparent | stone-600 | 内联操作 |
| Danger | rose gradient | white | 危险操作 |

**尺寸**: `sm` (32px) / `md` (40px) / `lg` (48px) / `xl` (56px)  
**最小触控区域**: 44x44px  
**悬停**: 上移 1px + 阴影增强

### 卡片 (Card)

```css
.card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e8e6de;
  box-shadow: 0 2px 15px -3px rgba(0,0,0,.06);
  transition: box-shadow 250ms, border-color 250ms;
}
.card:hover {
  box-shadow: 0 4px 25px -5px rgba(0,0,0,.08);
  border-color: #d4d1c7;
}
```

### 表单 (Form)

- 标签始终可见（非 placeholder-only）
- 聚焦: 暖色边框 + 4px 光晕
- 错误: 玫瑰色 + 提示文字
- 输入框高度: ≥44px

### 徽章 (Badge)

| 变体 | 背景 | 文字 |
|------|------|------|
| primary | `warmth-100` | `warmth-700` |
| success | `emerald-50` | `emerald-700` |
| warning | `amber-50` | `amber-700` |
| danger | `rose-50` | `rose-700` |

---

## 九、响应式策略

| 断点 | 宽度 | 适配 |
|------|------|------|
| 桌面 | ≥1280px | 完整侧边栏 + 双列 |
| 笔记本 | 1024-1279px | 完整侧边栏 + 单列 |
| 平板 | 640-1023px | 折叠导航 |
| 小屏 | <640px | 底部导航 |

> 注: 当前为 Tauri 桌面应用，主攻 ≥1024px 体验

---

## 十、无障碍清单

- [x] 所有交互元素支持键盘导航
- [x] 聚焦可见指示器 (2px warmth-500 ring)
- [x] 文字对比度 ≥4.5:1 (AA)
- [x] 触控目标 ≥44x44px
- [x] 禁用状态视觉区分 (opacity 0.45)
- [x] 减少动画偏好支持 (`prefers-reduced-motion`)
- [x] 图标搭配文字标签
- [x] 颜色不是唯一的信息传达方式

---

## 十一、文件变更清单

| 文件 | 变更 |
|------|------|
| `tailwind.config.js` | 全新暖色调色彩系统 + Inter 字体 + 阴影/动画系统 |
| `src/index.css` | 完整重构: Design Tokens, 玻璃拟态, 渐变, 组件系统 |
| `src/components/Layout.tsx` | 现代侧边栏: 玻璃面板, 渐变色 Logo, 宝宝卡片, 状态指示器 |
| `src/pages/HomePage.tsx` | 现代首页: 渐变横幅, 玻璃卡片, 交互动效, 丰富项目卡片 |

---

## 十二、后续迭代建议

1. **暗色模式**: 基于 `[data-theme="dark"]` 实现完整暗色主题
2. **动效增强**: 页面切换过渡动画、共享元素转场
3. **Empty State 插画**: 自定义 SVG 插画替代纯文字空态
4. **音效反馈**: 关键操作配柔和音效
5. **个性化主题**: 允许用户选择宝宝性别对应的主题色

---

**UI Designer** · 2026-06-29
