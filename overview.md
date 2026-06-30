# 拼图替换照片来源改为待选区

## 变更总结

**需求**: 拼图工作区替换区域照片时，可选来源从「当前周期全部照片」改为「待选区」

**改动范围**: 2 个文件

| 文件 | 变更 |
|------|------|
| `src/components/CollageWorkspace.tsx` | `allPhotos: Photo[]` → `pendingItems: SelectableItem[]`；替换面板改为从待选区选图 |
| `src/pages/PeriodSelectPage.tsx` | 传参 `allPhotos={currentPhotos}` → `pendingItems={selectedItems}` |

**关键逻辑**:
- 替换项已在拼图中 → 直接调整 photoOrder 顺序
- 替换项不在拼图中 → 先 `addToSelectedItems`（标记 multi_selected），再更新 photoOrder
- 已用于拼图的项目在替换面板中标记「已用」+ 半透明
- 待选区为空时显示友好提示

**验证**: TypeScript 零错误 · Vite 构建通过
