# 图片虚拟滚动方案 Spec

> 生成时间: 2026-06-29
> 项目: 宝宝成长视频制作工具
> 目标: 解决大规模照片列表 DOM 性能问题

---

## 1. 问题描述

当前 `PeriodSelectPage` 在加载一个周期的大量照片（500+ 张）时，`photo-grid` 区域通过 `currentPhotos.map()` 一次性将所有照片渲染到 DOM。即使有 base64 分批加载，500 个 `<img>` DOM 节点本身就足以导致：

- 首次渲染卡顿（React 渲染 500 个组件）
- 滚动掉帧（每个节点有事件监听、布局计算）
- 内存占用高（每个 DOM 节点 + 渲染树维护成本）

## 2. 方案决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 图片来源 | 保持 base64 + `loadedImages` 缓存 | 不动 Rust，最小改动 |
| 滚动库 | `react-window` FixedSizeGrid | 成熟稳定，社区支持好 |
| 列数策略 | 动态列数 + 固定行高 | 响应式适配窗口缩放 |
| 行高度 | 180px | 与现有 photo-card 视觉一致 |
| 列宽 | 180px | 正方形缩略图卡片 |
| 间距 | 16px (gap-4) | 维持现有 Tailwind class |

## 3. 改动范围

### 3.1 新增依赖
```
pnpm add react-window
pnpm add -D @types/react-window
```

### 3.2 新增 Hook: `src/hooks/usePhotoGridColumns.ts`

```ts
import { useState, useCallback, useRef } from 'react';

/**
 * 监听容器宽度，动态计算网格列数
 * @param itemWidth 每个项目的宽度（像素，包含间距）
 * @param minColumns 最小列数（默认 2）
 * @param maxColumns 最大列数（默认 8）
 */
export function usePhotoGridColumns(
  itemWidth: number = 180,
  minColumns: number = 2,
  maxColumns: number = 8
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [columns, setColumns] = useState(minColumns);

  const updateDimensions = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = rect.width;
    setContainerWidth(width);
    const cols = Math.max(minColumns, Math.min(maxColumns, Math.floor(width / itemWidth)));
    setColumns(cols);
  }, [itemWidth, minColumns, maxColumns]);

  useEffect(() => {
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    const el = containerRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [updateDimensions]);

  return { containerRef, columns, rows: Math.ceil(currentPhotos.length / columns) };
}
```

### 3.3 重构 `PeriodSelectPage.tsx`

#### 3.3.1 替换 photo-grid 渲染区域

将第 829-865 行的 `photo-grid` div 替换为 `FixedSizeGrid`：

```tsx
import { FixedSizeGrid as Grid } from 'react-window';
import PhotoCardLazy from '../components/PhotoCardLazy';

// 在 Photos Tab 渲染区域:
<div ref={gridContainerRef} className="h-full overflow-hidden">
  <Grid
    columnCount={columns}
    rowCount={rows}
    width="100%"
    height={contentAreaHeight}
    columnWidth={itemWidth}
    rowHeight={itemHeight}
    itemData={currentPhotos}
  >
    {RowRenderer}
  </Grid>
</div>
```

#### 3.3.2 Row Renderer

```tsx
const itemData = photos; // 传递给 rowRenderer

const RowRenderer = ({ columnIndex, rowIndex, style }) => {
  const startIndex = rowIndex * columns + columnIndex;
  const photo = photos[startIndex];
  if (!photo) return null;

  return (
    <div style={style}>
      <PhotoCard photo={photo} imageUrl={loadedImages[photo.id]} />
    </div>
  );
};
```

#### 3.3.3 PhotoCard 组件提取

将现有的 photo-item 渲染逻辑提取为独立组件 `PhotoCard.tsx`：

```tsx
interface PhotoCardProps {
  photo: Photo;
  imageUrl: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

const PhotoCard = ({ photo, imageUrl, onContextMenu, onDoubleClick }: PhotoCardProps) => (
  <div
    className={`photo-item ${photo.is_selected ? 'selected' : ''} ${photo.is_final ? 'final' : ''}`}
    onContextMenu={onContextMenu}
    onDoubleClick={onDoubleClick}
  >
    <img
      src={imageUrl || ''}
      alt={photo.file_name}
      className="w-full h-full object-cover"
      loading="lazy"
    />
    {/* badge、文件名等 */}
  </div>
);
```

### 3.4 待选区（pending tab）改造

待选区同样需要虚拟滚动。由于 `selectedItems` 最多 ~10 个（用户手动添加的候选），目前无需优化。但如果未来待选区支持批量添加，则同样接入虚拟滚动。

---

## 4. 性能预期

| 指标 | 改造前 | 改造后 |
|------|--------|--------|
| 500 张照片 DOM 节点数 | 500 | ~20（视口内） |
| 首次渲染时间 | 800ms+ | < 50ms |
| 滚动 FPS | 30-40（有掉帧） | 60 |
| 内存 | 每个节点 ~2KB | ~20 × 2KB |
| 代码变更量 | — | ~50 行新增，~60 行修改 |

## 5. 已知限制 & 后续优化空间

1. **base64 仍然在内存中**：当前方案只优化 DOM，不优化图片加载。未来可考虑引入 Blob URL 替换 base64。
2. **图片未解码**：每张 base64 仍需浏览器 decode → 渲染。未来可加缩略图预生成（Rust 端 resize + JPEG 压缩）。
3. **固定行高**：`react-window` FixedSizeGrid 假设所有行等高。如果用户照片纵横比差异极大，可能需要 VariableSizeGrid（性能牺牲 10-15%）。

## 6. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| `react-window` 与现有 Tailwind class 冲突 | 中 | 确保 `style` prop 不被覆盖 |
| 右键菜单定位偏移 | 低 | 用 `event.currentTarget.getBoundingClientRect()` 替代全局鼠标位置 |
| 窗口 resize 导致列数变化、滚动跳动 | 低 | debounce ResizeObserver 回调 100ms |

---

## 7. 验收标准

- [ ] 500 张照片周期内，首次渲染 < 100ms
- [ ] 滚动过程中 FPS ≥ 55（Chrome DevTools throttling 模拟）
- [ ] 窗口 resize 后列数自适应，无闪烁
- [ ] 右键菜单正常工作
- [ ] 双击预览正常工作
- [ ] 切换周期后虚拟列表正确重置
- [ ] 待选区功能不受影响
- [ ] 现有 CSS class（`photo-item selected final`）继续生效
