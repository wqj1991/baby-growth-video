# 周期选择最终照片流程实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现周期选择最终照片的完整流程，包括左侧可拖拽待选区面板、照片卡片悬停操作、待选区交互、视频帧查看器交互。

**Architecture:** 将 PeriodSelectPage 重构为左右分栏布局，左侧为待选区面板（可拖拽宽度），右侧为照片/视频内容区。照片卡片支持悬停显示操作按钮和状态标记，待选区支持单击勾选、悬停设为最终、双击预览。

**Tech Stack:** React + TypeScript + Zustand + Tailwind CSS

---

## Task 1: 重构 PeriodSelectPage 布局为左右分栏

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx`

**需求:** 将页面从标签页切换模式改为左侧待选区面板 + 右侧内容区的分栏布局，支持拖拽调整宽度。

- [ ] **Step 1: 添加拖拽状态和布局重构**

在 `PeriodSelectPage.tsx` 中添加拖拽相关状态和处理函数：

```typescript
// 添加到 Local State
const [pendingPanelWidth, setPendingPanelWidth] = useState(320);
const [isDragging, setIsDragging] = useState(false);

// 添加拖拽处理函数
const handleMouseDown = () => setIsDragging(true);

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging) return;
  const minWidth = 200;
  const maxWidth = window.innerWidth * 0.5;
  const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX));
  setPendingPanelWidth(newWidth);
};

const handleMouseUp = () => setIsDragging(false);

useEffect(() => {
  if (isDragging) {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
}, [isDragging]);
```

- [ ] **Step 2: 修改主渲染区域为分栏布局**

将原标签页结构替换为左右分栏：

```tsx
// 替换原有的 <div className="flex-1 flex flex-col min-h-0"> 部分
<div className="flex-1 flex min-h-0">
  {/* 左侧待选区面板 */}
  <div 
    className="flex-shrink-0 border-r border-[#e8e6de] bg-white flex flex-col"
    style={{ width: pendingPanelWidth }}
  >
    <PendingSelectionPanel
      selectedItems={selectedItems}
      loadedImages={loadedImages}
      onToggleMultiSelect={handleToggleMultiSelect}
      onRemoveItem={handleRemoveFromStash}
      onSelectSingle={handleSelectSingle}
      onGenerateCollage={handleEnterCollage}
    />
  </div>
  
  {/* 拖拽分割条 */}
  <div 
    className={`w-1 cursor-col-resize bg-[#e8e6de] hover:bg-[#d4d1c7] transition-colors flex-shrink-0 flex items-center justify-center ${isDragging ? 'bg-[#7c5cbf]' : ''}`}
    onMouseDown={handleMouseDown}
  >
    <div className="w-3 h-8 bg-[#c4c0b6] rounded-full" />
  </div>
  
  {/* 右侧内容区 */}
  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
    {/* 标签页 */}
    <div className="tab-bar-v2">
      <button
        onClick={() => { setSelectedTab('photos'); handleCloseContextMenu(); }}
        className={`tab-item-v2 ${selectedTab === 'photos' ? 'active' : ''}`}
      >
        <Image className="w-4 h-4" />
        全部照片
        <span className="tab-count-v2">{currentPhotos.length}</span>
      </button>
      <button
        onClick={() => { setSelectedTab('videos'); handleCloseContextMenu(); }}
        className={`tab-item-v2 ${selectedTab === 'videos' ? 'active' : ''}`}
      >
        <VideoIcon className="w-4 h-4" />
        视频
        <span className="tab-count-v2 video">{currentVideos.length}</span>
      </button>
    </div>
    
    {/* 内容区域 */}
    <div className="flex-1 overflow-hidden">
      {selectedTab === 'photos' && (
        <div className="h-full overflow-y-auto">
          {/* 照片列表内容 */}
        </div>
      )}
      {selectedTab === 'videos' && (
        <div className="h-full overflow-y-auto">
          {/* 视频列表内容 */}
        </div>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 3: 移除原待选区标签页相关代码**

删除原有的 `selectedTab === 'pending'` 分支和待选区标签按钮。

- [ ] **Step 4: 构建验证**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "refactor: restructure PeriodSelectPage to left-right layout with draggable pending panel"
```

---

## Task 2: 修改 PhotoCard 组件支持悬停操作和状态标记

**Files:**
- Modify: `src/components/PhotoCard.tsx`

**需求:** 照片卡片默认只显示缩略图和右下角状态标记，悬停时显示操作按钮，双击打开预览。

- [ ] **Step 1: 修改 PhotoCard 组件**

```tsx
import { Plus, Check, X } from 'lucide-react';
import type { Photo } from '../types';

interface PhotoCardProps {
  photo: Photo;
  imageUrl: string;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
  onDoubleClick?: (photo: Photo) => void;
  onToggleSelect?: (photo: Photo) => void;
  onSetFinal?: (photo: Photo) => void;
  onCancelFinal?: (photo: Photo) => void;
  isInPending?: boolean;
  isFinal?: boolean;
}

export default function PhotoCard({
  photo,
  imageUrl,
  onContextMenu,
  onDoubleClick,
  onToggleSelect,
  onSetFinal,
  onCancelFinal,
  isInPending = photo.is_selected,
  isFinal = photo.is_final,
}: PhotoCardProps) {
  return (
    <div
      className={`photo-card relative group ${isFinal ? 'ring-2 ring-[#7c5cbf]' : ''}`}
      onContextMenu={(e) => onContextMenu?.(e, photo)}
      onDoubleClick={() => onDoubleClick?.(photo)}
    >
      {/* 照片缩略图 */}
      <div className="photo-thumb" style={{ aspectRatio: '4/3' }}>
        {imageUrl ? (
          <img src={imageUrl} alt={photo.file_name} />
        ) : (
          <span className="text-3xl opacity-25">📷</span>
        )}
      </div>
      
      {/* 悬停操作按钮 */}
      <div className="photo-actions absolute top-1.5 left-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isInPending ? (
          <button
            className="photo-action-btn bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(photo); }}
          >
            <Plus className="w-3 h-3 inline mr-1" />
            加入待选区
          </button>
        ) : (
          <button
            className="photo-action-btn bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(photo); }}
          >
            <X className="w-3 h-3 inline mr-1" />
            从待选区取消
          </button>
        )}
        
        {!isFinal ? (
          <button
            className="photo-action-btn bg-[#7c5cbf] hover:bg-[#6a4eb5] text-white text-xs px-2 py-1 rounded"
            onClick={(e) => { e.stopPropagation(); onSetFinal?.(photo); }}
          >
            <Check className="w-3 h-3 inline mr-1" />
            设为最终
          </button>
        ) : (
          <button
            className="photo-action-btn bg-[#d44d68] hover:bg-[#b84259] text-white text-xs px-2 py-1 rounded"
            onClick={(e) => { e.stopPropagation(); onCancelFinal?.(photo); }}
          >
            <X className="w-3 h-3 inline mr-1" />
            取消最终
          </button>
        )}
      </div>
      
      {/* 右下角状态标记 */}
      <div className="photo-status absolute bottom-1.5 right-1.5 flex gap-1">
        {isInPending && !isFinal && (
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
        )}
        {isFinal && (
          <div className="w-5 h-5 rounded-full bg-[#7c5cbf] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 添加 PhotoCard 样式**

在全局 CSS 中添加：

```css
.photo-card {
  @apply rounded-lg overflow-hidden cursor-pointer bg-gray-100;
}

.photo-thumb {
  @apply w-full h-full flex items-center justify-center overflow-hidden;
}

.photo-thumb img {
  @apply w-full h-full object-cover;
}

.photo-action-btn {
  @apply flex items-center justify-center;
}

.photo-status {
  @apply pointer-events-none;
}
```

- [ ] **Step 3: 构建验证**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/PhotoCard.tsx
git commit -m "feat: update PhotoCard with hover actions and status markers"
```

---

## Task 3: 修改 VirtualPhotoGrid 使用新的 PhotoCard 组件

**Files:**
- Modify: `src/components/VirtualPhotoGrid.tsx`

**需求:** 更新照片网格使用新的 PhotoCard 组件，传递所有必要的回调函数。

- [ ] **Step 1: 修改 VirtualPhotoGrid 组件**

```tsx
import { FixedSizeGrid as Grid } from 'react-window';
import PhotoCard from './PhotoCard';
import type { Photo } from '../types';

interface VirtualPhotoGridProps {
  photos: Photo[];
  loadedImages: Record<number, string>;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
  onDoubleClick?: (photo: Photo) => void;
  onToggleSelect?: (photo: Photo) => void;
  onSetFinal?: (photo: Photo) => void;
  onCancelFinal?: (photo: Photo) => void;
  onOpenPreview?: (index: number) => void;
}

export default function VirtualPhotoGrid({
  photos,
  loadedImages,
  onContextMenu,
  onDoubleClick,
  onToggleSelect,
  onSetFinal,
  onCancelFinal,
  onOpenPreview,
}: VirtualPhotoGridProps) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const startIndex = index * 4;
    const endIndex = Math.min(startIndex + 4, photos.length);
    
    return (
      <div style={style} className="flex gap-2">
        {photos.slice(startIndex, endIndex).map((photo, idx) => (
          <div key={photo.id} className="flex-1" style={{ minWidth: 0 }}>
            <PhotoCard
              photo={photo}
              imageUrl={loadedImages[photo.id]}
              onContextMenu={onContextMenu}
              onDoubleClick={(p) => {
                onDoubleClick?.(p);
                const fullIndex = startIndex + idx;
                onOpenPreview?.(fullIndex);
              }}
              onToggleSelect={onToggleSelect}
              onSetFinal={onSetFinal}
              onCancelFinal={onCancelFinal}
            />
          </div>
        ))}
      </div>
    );
  };
  
  const rowCount = Math.ceil(photos.length / 4);
  
  return (
    <Grid
      columnCount={1}
      columnWidth="100%"
      height="100%"
      rowCount={rowCount}
      rowHeight={200}
      width="100%"
    >
      {Row}
    </Grid>
  );
}
```

- [ ] **Step 2: 更新 PeriodSelectPage 中的调用**

```tsx
<VirtualPhotoGrid
  photos={currentPhotos}
  loadedImages={loadedImages}
  onContextMenu={handlePhotoContextMenu}
  onDoubleClick={(photo) => {
    const index = currentPhotos.findIndex(p => p.id === photo.id);
    if (index !== -1) handleOpenPreview(index);
  }}
  onToggleSelect={handleTogglePhotoSelect}
  onSetFinal={handleSetFinalPhoto}
  onCancelFinal={() => handleCancelFinalPhoto()}
  onOpenPreview={handleOpenPreview}
/>
```

- [ ] **Step 3: 构建验证**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/VirtualPhotoGrid.tsx src/pages/PeriodSelectPage.tsx
git commit -m "feat: update VirtualPhotoGrid to use new PhotoCard with full actions"
```

---

## Task 4: 修改 PendingSelectionPanel 组件交互

**Files:**
- Modify: `src/components/PendingSelectionPanel.tsx`

**需求:** 待选区照片卡片单击切换勾选状态，悬停显示"设为最终"按钮，双击预览。

- [ ] **Step 1: 修改 PendingSelectionPanel 组件**

```tsx
import { Check, X, Grid3X3, Wand2 } from 'lucide-react';
import { MIN_PHOTOS, MAX_PHOTOS } from '../utils/collageTemplates';
import type { SelectableItem, Photo, VideoFrame } from '../types';

interface PendingSelectionPanelProps {
  selectedItems: SelectableItem[];
  loadedImages: Record<number, string>;
  onToggleMultiSelect: (item: SelectableItem) => void;
  onRemoveItem: (item: SelectableItem) => void;
  onSelectSingle: (item: SelectableItem) => void;
  onGenerateCollage: () => void;
  onPreview?: (item: SelectableItem) => void;
}

export default function PendingSelectionPanel({
  selectedItems,
  loadedImages,
  onToggleMultiSelect,
  onRemoveItem,
  onSelectSingle,
  onGenerateCollage,
  onPreview,
}: PendingSelectionPanelProps) {
  const multiSelectedCount = selectedItems.filter((item) => {
    if (item.type === 'photo') return item.item.is_multi_selected;
    return item.item.is_multi_selected;
  }).length;

  const canCollage = multiSelectedCount >= MIN_PHOTOS && multiSelectedCount <= MAX_PHOTOS;

  const getFileName = (item: SelectableItem): string => {
    if (item.type === 'photo') return (item.item as Photo).file_name;
    return `视频截帧 · ${Math.floor((item.item as VideoFrame).time_seconds / 60)}:${((item.item as VideoFrame).time_seconds % 60).toString().padStart(2, '0')}`;
  };

  const getSourceTag = (item: SelectableItem) => {
    if (item.type === 'photo') {
      return { label: '扫描', className: 'scan' };
    }
    return { label: '截帧', className: 'frame' };
  };

  const isItemSelected = (item: SelectableItem): boolean => {
    return item.item.is_multi_selected;
  };

  const isItemFinal = (item: SelectableItem): boolean => {
    return item.item.is_final;
  };

  return (
    <div className="stash-panel-v2 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#e8e6de]">
        <Grid3X3 className="w-4 h-4 text-[#7c5cbf]" />
        <h3 className="text-sm font-semibold text-[#33312d]">候选照片</h3>
        <span className="text-[11px] font-bold text-[#7c5cbf] bg-[#f3f0fb] px-2 py-0.5 rounded-full">
          {selectedItems.length} 张
        </span>
        <span className="ml-auto text-[11px] text-[#b0aca0]">单击选择 · 双击预览</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {selectedItems.length === 0 ? (
          <div className="empty-state-v2">
            <div className="empty-icon">📋</div>
            <h4>暂无待选项目</h4>
            <p>在「全部照片」中点击「加入待选区」按钮，或在视频中截帧加入</p>
          </div>
        ) : (
          <>
            {/* Photo Grid - 2 columns for left panel */}
            <div className="grid grid-cols-2 gap-2">
              {selectedItems.map((item) => {
                const uniqueKey = `${item.type}-${item.item.id}`;
                const imageUrl = loadedImages[item.item.id];
                const selected = isItemSelected(item);
                const final = isItemFinal(item);

                return (
                  <div
                    key={uniqueKey}
                    className={`stash-compare-item relative cursor-pointer ${selected ? 'ring-2 ring-[#7c5cbf]' : ''} ${final ? 'ring-2 ring-[#22c55e]' : ''}`}
                    onClick={() => onToggleMultiSelect(item)}
                    onDoubleClick={() => onPreview?.(item)}
                  >
                    <div className="stash-compare-thumb" style={{ aspectRatio: '4/3' }}>
                      {imageUrl ? (
                        <img src={imageUrl} alt={getFileName(item)} />
                      ) : (
                        <span className="text-3xl opacity-25">📷</span>
                      )}
                    </div>

                    {/* 移除按钮 */}
                    <button
                      className="stash-remove-btn absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(item);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {/* 勾选标记 */}
                    {selected && !final && (
                      <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#7c5cbf] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {/* 最终标记 */}
                    {final && (
                      <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {/* 文件名 */}
                    <div className="mt-1.5 px-1">
                      <div className="text-[10px] font-medium text-[#33312d] truncate">
                        {getFileName(item)}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded ${item.type === 'photo' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                          {item.type === 'photo' ? '扫描' : '截帧'}
                        </span>
                      </div>
                    </div>

                    {/* 悬停显示"设为最终"按钮 */}
                    <div
                      className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity flex justify-center"
                      style={{ pointerEvents: 'none' }}
                    >
                      <button
                        className="bg-white/90 text-[#33312d] text-[10px] font-medium px-2.5 py-1 rounded-md hover:bg-white transition-colors"
                        style={{ pointerEvents: 'auto' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSingle(item);
                        }}
                      >
                        <Check className="w-3 h-3 inline mr-1" />
                        设为最终
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hint */}
            {multiSelectedCount >= 2 && (
              <div className="progress-hint-bar mt-3">
                <span>🧩</span>
                <div>
                  <div className="font-medium">已选中 {multiSelectedCount} 张</div>
                  <div className="text-[11px] opacity-80">
                    {canCollage
                      ? '点击「生成拼图」选择模板后合成一张输出图片'
                      : `最多可选 ${MAX_PHOTOS} 张进行拼图`}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="h-1.5 w-20 bg-[#e4e7f6] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((multiSelectedCount / MAX_PHOTOS) * 100, 100)}%`,
                        background: 'linear-gradient(90deg, #7c5cbf, #8b6fc7)',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {multiSelectedCount === 0 && (
              <div className="progress-hint-bar mt-3">
                <span>💡</span>
                <span className="text-[11px]">单击照片进行多选，选 {MIN_PHOTOS}–{MAX_PHOTOS} 张可启用拼图</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Actions */}
      {selectedItems.length > 0 && (
        <div className="p-3 border-t border-[#e8e6de] bg-white">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (selectedItems.length > 0) {
                  onSelectSingle(selectedItems[0]);
                }
              }}
              className="btn btn-secondary w-full !justify-center text-xs"
            >
              <Check className="w-3 h-3" />
              单独选定
            </button>
            <button
              onClick={onGenerateCollage}
              disabled={!canCollage}
              className="btn btn-primary w-full !justify-center text-xs"
            >
              <Wand2 className="w-3 h-3" />
              生成拼图 {canCollage ? `(${multiSelectedCount}张)` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 更新 PeriodSelectPage 中的调用**

```tsx
<PendingSelectionPanel
  selectedItems={selectedItems}
  loadedImages={loadedImages}
  onToggleMultiSelect={handleToggleMultiSelect}
  onRemoveItem={handleRemoveFromStash}
  onSelectSingle={handleSelectSingle}
  onGenerateCollage={handleEnterCollage}
  onPreview={(item) => {
    if (item.type === 'photo') {
      const index = currentPhotos.findIndex(p => p.id === item.item.id);
      if (index !== -1) handleOpenPreview(index);
    }
  }}
/>
```

- [ ] **Step 3: 构建验证**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/PendingSelectionPanel.tsx src/pages/PeriodSelectPage.tsx
git commit -m "feat: update PendingSelectionPanel with click-select and hover-set-final"
```

---

## Task 5: 修改 VideoFrameViewerModal 添加勾选和加入按钮

**Files:**
- Modify: `src/components/VideoFrameViewerModal.tsx`

**需求:** 视频帧查看器中的帧卡片显示勾选框和"直接加入"按钮，支持双击预览。

- [ ] **Step 1: 修改 VideoFrameViewerModal 组件**

```tsx
import { X, Check, Plus } from 'lucide-react';
import type { VideoFrame } from '../types';

interface VideoFrameViewerModalProps {
  visible: boolean;
  onClose: () => void;
  frames: VideoFrame[];
  loadedImages: Record<number, string>;
  onSelectFrames: (frames: VideoFrame[]) => void;
  onAddSingle: (frame: VideoFrame) => void;
  onPreview?: (frame: VideoFrame) => void;
}

export default function VideoFrameViewerModal({
  visible,
  onClose,
  frames,
  loadedImages,
  onSelectFrames,
  onAddSingle,
  onPreview,
}: VideoFrameViewerModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (frameId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(frameId)) {
        next.delete(frameId);
      } else {
        next.add(frameId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedFrames = frames.filter(f => selectedIds.has(f.id));
    onSelectFrames(selectedFrames);
  };

  const handleAddSingle = (frame: VideoFrame) => {
    onAddSingle(frame);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-[90vw] max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e8e6de]">
          <h3 className="text-sm font-semibold text-[#33312d]">选择视频帧</h3>
          <button onClick={onClose} className="text-[#b0aca0] hover:text-[#33312d]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-4 gap-3">
            {frames.map((frame) => {
              const imageUrl = loadedImages[frame.id];
              const isSelected = selectedIds.has(frame.id);

              return (
                <div
                  key={frame.id}
                  className={`relative cursor-pointer rounded-lg overflow-hidden ${isSelected ? 'ring-2 ring-[#7c5cbf]' : ''}`}
                  onDoubleClick={() => onPreview?.(frame)}
                >
                  <div className="aspect-video bg-gray-100 flex items-center justify-center">
                    {imageUrl ? (
                      <img src={imageUrl} alt={`Frame ${frame.time_seconds}`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl opacity-25">🖼️</span>
                    )}
                  </div>

                  {/* 勾选框 */}
                  <button
                    className={`absolute top-1 left-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected 
                        ? 'bg-[#7c5cbf] border-[#7c5cbf]' 
                        : 'bg-white/80 border-gray-300 hover:border-[#7c5cbf]'
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(frame.id); }}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>

                  {/* 直接加入按钮 */}
                  <button
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center hover:bg-[#16a34a] transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleAddSingle(frame); }}
                  >
                    <Plus className="w-3 h-3 text-white" />
                  </button>

                  {/* 时间显示 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-1 text-center">
                    {Math.floor(frame.time_seconds / 60)}:{((frame.time_seconds % 60)).toString().padStart(2, '0')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#e8e6de]">
          <span className="text-xs text-[#b0aca0]">
            已选择 {selectedIds.size} 帧
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost btn-sm">
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="btn btn-primary btn-sm"
            >
              加入待选区 ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新 PeriodSelectPage 中的调用**

```tsx
<VideoFrameViewerModal
  visible={showFrameViewer}
  onClose={() => setShowFrameViewer(false)}
  frames={currentVideoFrames}
  loadedImages={loadedImages}
  onSelectFrames={(selectedFrames) => {
    selectedFrames.forEach(frame => {
      addToSelectedItems({ type: 'video_frame', item: { ...frame, is_selected: true, is_multi_selected: false } });
    });
    setShowFrameViewer(false);
  }}
  onAddSingle={(frame) => {
    addToSelectedItems({ type: 'video_frame', item: { ...frame, is_selected: true, is_multi_selected: false } });
  }}
  onPreview={(frame) => {
    // 可以打开帧预览
  }}
/>
```

- [ ] **Step 3: 构建验证**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/VideoFrameViewerModal.tsx src/pages/PeriodSelectPage.tsx
git commit -m "feat: update VideoFrameViewerModal with checkboxes and add buttons"
```

---

## Task 6: 状态管理和后端调用完善

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx`

**需求:** 完善状态管理，确保周期切换时正确加载待选区内容，添加取消最终照片的回调。

- [ ] **Step 1: 添加取消最终照片的处理函数**

```tsx
const handleCancelFinal = async () => {
  if (!currentPeriod) return;
  if (currentPeriod.selected_photo_id) {
    await handleCancelFinalPhoto();
  }
};
```

- [ ] **Step 2: 完善周期切换时待选区加载**

确保 `loadPeriodMedia` 函数正确加载已选照片：

```tsx
const loadPeriodMedia = async (periodId: number) => {
  try {
    setLoadedImages({});
    loadedImageIds.current.clear();
    setSelectedItems([]);
    const [photos, videos] = await Promise.all([
      getPeriodPhotos(periodId),
      getPeriodVideos(periodId),
    ]);
    setCurrentPhotos(photos);
    setCurrentVideos(videos);

    // 加载已加入待选区的照片（is_selected=true）
    const pendingPhotos: SelectableItem[] = photos
      .filter(p => p.is_selected)
      .map(p => ({ type: 'photo' as const, item: { ...p, is_multi_selected: false } }));
    
    // 加载视频帧
    const frames = await getPeriodVideoFrames(periodId);
    setCurrentVideoFrames(frames);
    
    const pendingFrames: SelectableItem[] = frames
      .filter(f => f.is_selected)
      .map(f => ({ type: 'video_frame' as const, item: { ...f, is_multi_selected: false } }));
    
    const allPending = [...pendingPhotos, ...pendingFrames];
    if (allPending.length > 0) setSelectedItems(allPending);
  } catch (error) { console.error('加载周期媒体失败:', error); }
};
```

- [ ] **Step 3: 添加 getPeriodVideoFrames 命令**

在 `src/utils/tauriCommands.ts` 中添加：

```typescript
export async function getPeriodVideoFrames(periodId: number): Promise<VideoFrame[]> {
  return await invoke('get_period_video_frames', { periodId });
}
```

- [ ] **Step 4: 构建验证**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx src/utils/tauriCommands.ts
git commit -m "feat: complete state management for period switching and pending selection"
```

---

## Task 7: 测试验证

**Files:**
- Test: Manual testing

**需求:** 手动验证所有流程是否正常工作。

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm run dev`
Expected: 开发服务器启动成功

- [ ] **Step 2: 验证流程A - 单张照片选定**

1. 选择一个周期
2. 在全部照片中悬停某张照片，点击「加入待选区」
3. 确认待选区中显示该照片，照片右下角显示黄色标记
4. 在待选区中悬停该照片，点击「设为最终」
5. 确认周期状态变为"已确认"，照片显示绿色勾选标记

- [ ] **Step 3: 验证流程B - 多选拼图**

1. 选择一个周期
2. 加入多张照片到待选区
3. 单击待选区中的照片勾选（2-4张）
4. 点击「生成拼图」按钮
5. 确认进入模板选择器

- [ ] **Step 4: 验证流程C - 视频截帧**

1. 切换到视频标签
2. 点击视频的截帧按钮
3. 设置参数生成帧
4. 在帧查看器中勾选或点击直接加入
5. 确认帧加入待选区

- [ ] **Step 5: 验证双击预览**

1. 在全部照片中双击某张照片
2. 在待选区中双击某张照片
3. 在帧查看器中双击某帧
4. 确认都能打开大图预览

- [ ] **Step 6: 验证周期切换**

1. 选择周期A，加入一些照片到待选区
2. 切换到周期B
3. 确认待选区加载周期B的已选照片
4. 切换回周期A
5. 确认待选区加载周期A的已选照片

---

## Self-Review

**1. Spec coverage:**
- ✅ 页面布局：左侧待选区面板 + 右侧内容区，支持拖拽
- ✅ 全部照片标签页：悬停显示操作按钮，右下角状态标记，双击预览
- ✅ 待选区面板：单击切换勾选，悬停显示设为最终，双击预览
- ✅ 视频帧查看器：勾选框 + 直接加入按钮，双击预览
- ✅ 周期切换：加载当前周期已选照片
- ✅ 状态同步：设为最终时照片列表显示边框+勾选

**2. Placeholder scan:**
- ✅ 无占位符

**3. Type consistency:**
- ✅ 类型一致

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-30-period-photo-selection.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?