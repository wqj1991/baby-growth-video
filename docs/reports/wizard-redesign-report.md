# 新建项目向导页 — 现代大气 UI 重构

## 概述

对"宝宝成长视频"应用的 **新建成长视频项目** 全流程向导页面进行了现代大气风格的深度重构。基于截图所示的设计问题，逐一优化了每个组件的视觉层次、交互反馈和空间节奏。

### 变更文件
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/components/WizardSidebar.tsx` | 完全重写 | 玻璃拟态侧边栏 |
| `src/pages/CreateProjectPage.tsx` | 重构 | 主容器 + 顶/底栏 |
| `src/pages/create-project/Step2ProjectInfo.tsx` | 完全重写 | 截图核心页面 |
| `src/pages/create-project/Step1SelectBaby.tsx` | 重构 | 宝宝选择 |
| `src/pages/create-project/Step3SelectFolder.tsx` | 重构 | 文件夹扫描 |
| `src/pages/create-project/Step4GeneratePeriods.tsx` | 重构 | 周期生成 |
| `src/pages/create-project/Step5Complete.tsx` | 重构 | 完成页 |
| `src/index.css` | 追加 | 向导专用样式 |

### 构建状态
- TypeScript 类型检查 ✅
- Vite 生产构建 ✅ (CSS 60KB + JS 295.74KB)

### 设计亮点
1. **玻璃拟态导航** — 左侧步骤栏使用 glass-strong 背景，gradient 连接线
2. **卡片化表单** — 每个字段独立成卡片，Apple-style 底部边框输入框
3. **Emoji 芯片按钮** — 周期天数预设采用 4 列宫格 + 选中态渐变
4. **设计师级 Toggle** — 特殊日期开关替代原生 checkbox
5. **统一页面标题区** — 所有步骤页面的标题部分结构一致
6. **交错入场动画** — stagger-N 延迟 + fadeInUp 动画
