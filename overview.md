# 拼图模板系统 — 前端集成完成

## 完成内容

将拼图能力从硬编码 4 种布局（2-4张）升级为 **36 种模板（2-9张）**，并完成前端全链路集成。

## 变更文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/utils/collageTemplates.ts` | **新增** | 36 个模板的归一化坐标数据 + 类型定义 + 工具函数 |
| `src/store/index.ts` | 修改 | `collageLayout` → `selectedTemplateId` + `selectedTemplate` |
| `src/components/TemplateSelector.tsx` | **新增** | Modal 模板选择器（照片数量匹配、卡片网格、实时预览） |
| `src/components/CollageWorkspace.tsx` | 重写 | 模板驱动渲染（region-based），替换硬编码 CSS 布局 |
| `src/components/PendingSelectionPanel.tsx` | 修改 | 移除 "4张上限"，改为 2-9 张自动适配 |
| `src/pages/PeriodSelectPage.tsx` | 修改 | 集成 TemplateSelector → CollageWorkspace 两段流程 |

## 交互流程

```
待选区 → 勾选 2-9 张
  → 点击「生成拼图」
  → TemplateSelector Modal（按张数自动筛选模板）
  → 选模板 → 确认
  → CollageWorkspace（模板驱动预览 + 间距/顺序调整）
  → 生成拼图（后端待集成）
```

## 模板数据共享

所有模板定义在 `src/utils/collageTemplates.ts`，类型为：
```ts
interface CollageRegion {
  x: number; y: number; w: number; h: number; order: number;
}
interface CollageTemplate {
  id: string; name: string; desc: string; tips: string;
  regions: CollageRegion[];
}
```

前端渲染和后续 Rust 后端合成共享同一套归一化坐标，直接映射到 1080×1080 输出。

## 后续待做

- Rust 后端：基于 `CollageTemplate.regions` 用 image crate 做像素级拼图合成
- 拖拽排序：CollageWorkspace 中照片顺序的拖拽交互
- 实时预览优化：在 TemplateSelector 中使用实际照片缩略图替代色块
