# 待选区重新设计实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将待选区移到最左侧，切换周期后自动选中待选区，分离"在待选区中"和"被选中用于拼图"两个状态

**Architecture:** 通过新增 `is_multi_selected` 字段分离状态，修改 Tab 顺序和周期切换行为，调整待选区交互逻辑

**Tech Stack:** React, TypeScript, Zustand, Tauri

---

## 文件结构

| 文件 | 职责 | 修改类型 |
|------|------|----------|
| `src/types/index.ts` | 定义数据类型 | 修改（新增字段） |
| `src/pages/PeriodSelectPage.tsx` | 周期详情页主组件 | 修改（Tab顺序、事件处理） |
| `src/components/PendingSelectionPanel.tsx` | 待选区面板 | 修改（选中状态判断） |
| `src/components/PhotoCard.tsx` | 照片卡片 | 修改（状态徽章） |

---

## Task 1: 类型定义 - 添加 is_multi_selected 字段

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 在 Photo 接口中添加 is_multi_selected 字段**

```typescript
// Photo 接口（约第41-54行）
export interface Photo {
  id: number;
  period_id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  width: number;
  height: number;
  taken_at?: string;
  description?: string;
  is_selected: boolean;
  is_multi_selected: boolean;  // 新增
  is_final: boolean;
  created_at: string;
}
```

- [ ] **Step 2: 在 VideoFrame 接口中添加 is_multi_selected 字段**

```typescript
// VideoFrame 接口（约第71-80行）
export interface VideoFrame {
  id: number;
  video_id: number;
  period_id: number;
  file_path: string;
  time_seconds: number;
  is_selected: boolean;
  is_multi_selected: boolean;  // 新增
  is_final: boolean;
  created_at: string;
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add is_multi_selected field to Photo and VideoFrame"
```

---

## Task 2: PeriodSelectPage - Tab 顺序调整

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx:609-634`

- [ ] **Step 1: 修改 Tab 按钮顺序为「待选区 | 全部照片 | 视频」**

原代码（约第609-634行）:
```tsx
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
  <button
    onClick={() => { setSelectedTab('pending'); handleCloseContextMenu(); }}
    className={`tab-item-v2 ${selectedTab === 'pending' ? 'active' : ''}`}
  >
    <Plus className="w-4 h-4" />
    待选区
    <span className="tab-count-v2 stash">{selectedItems.length}</span>
  </button>
</div>
```

修改为:
```tsx
<div className="tab-bar-v2">
  <button
    onClick={() => { setSelectedTab('pending'); handleCloseContextMenu(); }}
    className={`tab-item-v2 ${selectedTab === 'pending' ? 'active' : ''}`}
  >
    <Plus className="w-4 h-4" />
    待选区
    <span className="tab-count-v2 stash">{selectedItems.length}</span>
  </button>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "feat: move pending tab to first position"
```

---

## Task 3: PeriodSelectPage - 周期切换自动切换到待选区

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx:231-248`

- [ ] **Step 1: 在 loadPeriodMedia 函数末尾添加 setSelectedTab('pending')**

原代码（约第231-248行）:
```typescript
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

    const pendingPhotos: SelectableItem[] = photos
      .filter(p => p.is_selected)
      .map(p => ({ type: 'photo' as const, item: p }));
    if (pendingPhotos.length > 0) setSelectedItems(pendingPhotos);
  } catch (error) { console.error('加载周期媒体失败:', error); }
};
```

修改为:
```typescript
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

    const pendingPhotos: SelectableItem[] = photos
      .filter(p => p.is_selected)
      .map(p => ({ type: 'photo' as const, item: p }));
    if (pendingPhotos.length > 0) setSelectedItems(pendingPhotos);
    
    setSelectedTab('pending');
  } catch (error) { console.error('加载周期媒体失败:', error); }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "feat: auto switch to pending tab on period change"
```

---

## Task 4: PeriodSelectPage - 修改 handleTogglePhotoSelect 逻辑

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx:294-304`

- [ ] **Step 1: 修改 handleTogglePhotoSelect，放入待选区时不设置 is_multi_selected**

原代码（约第294-304行）:
```typescript
const handleTogglePhotoSelect = async (photo: Photo) => {
  try {
    const updated = await updatePhoto({ ...photo, is_selected: !photo.is_selected });
    setCurrentPhotos(currentPhotos.map(p => p.id === updated.id ? updated : p));
    if (updated.is_selected) {
      addToSelectedItems({ type: 'photo', item: updated });
    } else {
      removeFromSelectedItems({ type: 'photo', item: updated });
    }
  } catch (error) { console.error('更新照片失败:', error); }
};
```

修改为:
```typescript
const handleTogglePhotoSelect = async (photo: Photo) => {
  try {
    const newSelected = !photo.is_selected;
    const updated = await updatePhoto({ ...photo, is_selected: newSelected });
    const localUpdated = { ...updated, is_multi_selected: newSelected ? photo.is_multi_selected : false };
    setCurrentPhotos(currentPhotos.map(p => p.id === updated.id ? localUpdated : p));
    if (newSelected) {
      addToSelectedItems({ type: 'photo', item: localUpdated });
    } else {
      removeFromSelectedItems({ type: 'photo', item: localUpdated });
    }
  } catch (error) { console.error('更新照片失败:', error); }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "feat: don't auto select for collage when adding to stash"
```

---

## Task 5: PeriodSelectPage - 修改 handleToggleFrameSelect 逻辑

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx:354-364`

- [ ] **Step 1: 修改 handleToggleFrameSelect，放入待选区时不设置 is_multi_selected**

原代码（约第354-364行）:
```typescript
const handleToggleFrameSelect = async (frame: VideoFrame) => {
  try {
    const updated = await updateVideoFrame({ ...frame, is_selected: !frame.is_selected });
    setCurrentVideoFrames(currentVideoFrames.map(f => f.id === updated.id ? updated : f));
    if (updated.is_selected) {
      addToSelectedItems({ type: 'frame', item: updated });
    } else {
      removeFromSelectedItems({ type: 'frame', item: updated });
    }
  } catch (error) { console.error('更新视频帧失败:', error); }
};
```

修改为:
```typescript
const handleToggleFrameSelect = async (frame: VideoFrame) => {
  try {
    const newSelected = !frame.is_selected;
    const updated = await updateVideoFrame({ ...frame, is_selected: newSelected });
    const localUpdated = { ...updated, is_multi_selected: newSelected ? frame.is_multi_selected : false };
    setCurrentVideoFrames(currentVideoFrames.map(f => f.id === updated.id ? localUpdated : f));
    if (newSelected) {
      addToSelectedItems({ type: 'frame', item: localUpdated });
    } else {
      removeFromSelectedItems({ type: 'frame', item: localUpdated });
    }
  } catch (error) { console.error('更新视频帧失败:', error); }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "feat: don't auto select video frames for collage when adding to stash"
```

---

## Task 6: PeriodSelectPage - 修改 handleToggleMultiSelect 逻辑

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx:422-428`

- [ ] **Step 1: 修改 handleToggleMultiSelect，操作 is_multi_selected 而非 is_selected**

原代码（约第422-428行）:
```typescript
const handleToggleMultiSelect = (item: SelectableItem) => {
  if (item.type === 'photo') {
    handleTogglePhotoSelect(item.item as Photo);
  } else {
    handleToggleFrameSelect(item.item as VideoFrame);
  }
};
```

修改为:
```typescript
const handleToggleMultiSelect = (item: SelectableItem) => {
  if (item.type === 'photo') {
    const photo = item.item as Photo;
    const updated = { ...photo, is_multi_selected: !photo.is_multi_selected };
    setCurrentPhotos(currentPhotos.map(p => p.id === photo.id ? updated : p));
    setSelectedItems(selectedItems.map(i => 
      i.type === 'photo' && i.item.id === photo.id 
        ? { type: 'photo' as const, item: updated } 
        : i
    ));
  } else {
    const frame = item.item as VideoFrame;
    const updated = { ...frame, is_multi_selected: !frame.is_multi_selected };
    setCurrentVideoFrames(currentVideoFrames.map(f => f.id === frame.id ? updated : f));
    setSelectedItems(selectedItems.map(i => 
      i.type === 'frame' && i.item.id === frame.id 
        ? { type: 'frame' as const, item: updated } 
        : i
    ));
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "feat: toggle is_multi_selected instead of is_selected in stash"
```

---

## Task 7: PendingSelectionPanel - 修改选中状态判断

**Files:**
- Modify: `src/components/PendingSelectionPanel.tsx`

- [ ] **Step 1: 修改 isItemSelected 函数，检查 is_multi_selected**

原代码（约第48-50行）:
```typescript
const isItemSelected = (item: SelectableItem): boolean => {
  return item.item.is_selected;
};
```

修改为:
```typescript
const isItemSelected = (item: SelectableItem): boolean => {
  return item.item.is_multi_selected;
};
```

- [ ] **Step 2: 修改 multiSelectedCount 计算，检查 is_multi_selected**

原代码（约第25-28行）:
```typescript
const multiSelectedCount = selectedItems.filter((item) => {
  if (item.type === 'photo') return item.item.is_selected;
  return item.item.is_selected;
}).length;
```

修改为:
```typescript
const multiSelectedCount = selectedItems.filter((item) => {
  if (item.type === 'photo') return item.item.is_multi_selected;
  return item.item.is_multi_selected;
}).length;
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PendingSelectionPanel.tsx
git commit -m "feat: use is_multi_selected for collage selection in stash panel"
```

---

## Task 8: PeriodSelectPage - 修改 handleEnterCollage 逻辑

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx:446-453`

- [ ] **Step 1: 修改 handleEnterCollage，过滤 is_multi_selected 而非 is_selected**

原代码（约第446-453行）:
```typescript
const handleEnterCollage = () => {
  const count = selectedItems.filter(i => i.item.is_selected).length;
  const layoutMap: Record<number, string> = { 2: '2up', 3: '3up-main', 4: '4grid' };
  setCollageLayout(layoutMap[count] || '4grid');
  setCollagePhotoOrder(selectedItems.filter(i => i.item.is_selected).map((_, i) => i));
  setCollageMode(true);
};
```

修改为:
```typescript
const handleEnterCollage = () => {
  const count = selectedItems.filter(i => i.item.is_multi_selected).length;
  const layoutMap: Record<number, string> = { 2: '2up', 3: '3up-main', 4: '4grid' };
  setCollageLayout(layoutMap[count] || '4grid');
  setCollagePhotoOrder(selectedItems.filter(i => i.item.is_multi_selected).map((_, i) => i));
  setCollageMode(true);
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "feat: use is_multi_selected for collage entry"
```

---

## Task 9: PeriodSelectPage - 修改 loadPeriodMedia 中待选照片加载逻辑

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx:243-246`

- [ ] **Step 1: 修改待选照片加载，初始化 is_multi_selected 为 false**

原代码（约第243-246行）:
```typescript
const pendingPhotos: SelectableItem[] = photos
  .filter(p => p.is_selected)
  .map(p => ({ type: 'photo' as const, item: p }));
```

修改为:
```typescript
const pendingPhotos: SelectableItem[] = photos
  .filter(p => p.is_selected)
  .map(p => ({ type: 'photo' as const, item: { ...p, is_multi_selected: false } }));
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "fix: initialize is_multi_selected to false when loading pending photos"
```

---

## Task 10: 验证构建

**Files:**
- 所有修改的文件

- [ ] **Step 1: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 2: 运行构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 总结提交**

```bash
git log --oneline -10
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Tab 顺序调整（Task 2）
- ✅ 周期切换自动切换 tab（Task 3）
- ✅ 状态分离 - 新增 is_multi_selected（Task 1）
- ✅ 放入待选区不自动选中（Task 4, 5）
- ✅ 待选区手动多选（Task 6, 7）
- ✅ 拼图功能保留（Task 8）
- ✅ 从待选区移除时清除状态（Task 4, 5）

**2. Placeholder scan:** 无 TBD、TODO 或不完整部分

**3. Type consistency:** is_multi_selected 在所有任务中保持一致