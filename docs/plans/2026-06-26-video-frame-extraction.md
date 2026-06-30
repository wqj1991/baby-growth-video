# 视频抽帧功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现视频抽帧完整流程，包括弹窗式设置、双模式抽帧、100帧数量限制，以及视频帧与照片共用待选区。

**Architecture:** 使用统一的 `SelectableItem` 联合类型管理待选区数据，后端提供抽帧和视频帧更新接口，前端通过弹窗组件完成抽帧设置和结果展示。

**Tech Stack:** Rust + Tauri (后端), React + Zustand (前端), TypeScript

---

## 文件结构

### 后端文件
| 文件 | 职责 |
|------|------|
| `src-tauri/src/db.rs` | 数据库操作，新增 `update_video_frame` 和 `get_video_frame_by_id` |
| `src-tauri/src/main.rs` | Tauri 命令注册，新增 `update_video_frame` 命令 |

### 前端文件
| 文件 | 职责 |
|------|------|
| `src/types/index.ts` | 类型定义，新增 `SelectableItem` 联合类型 |
| `src/store/index.ts` | 状态管理，新增 `selectedItems` 状态和相关方法 |
| `src/utils/tauriCommands.ts` | Tauri 命令封装，新增 `updateVideoFrame` |
| `src/pages/PeriodSelectPage.tsx` | 周期选择页面，改造视频卡片和待选区 |
| `src/components/VideoFrameViewerModal.tsx` | 视频帧查看弹窗，更新选择逻辑 |

---

## Task 1: 后端 - 数据库层新增视频帧更新函数

**Files:**
- Modify: `src-tauri/src/db.rs`

- [ ] **Step 1: 新增 `get_video_frame_by_id` 函数**

在 `db.rs` 文件中，找到视频帧相关函数位置，添加：

```rust
pub fn get_video_frame_by_id(&self, id: i64) -> Result<VideoFrame, rusqlite::Error> {
    let mut stmt = self.conn.prepare(
        "SELECT * FROM video_frames WHERE id = ?"
    )?;
    
    let mut rows = stmt.query((id,))?;
    if let Some(row) = rows.next()? {
        Ok(VideoFrame::from_row(&row)?)
    } else {
        Err(rusqlite::Error::QueryReturnedNoRows)
    }
}
```

- [ ] **Step 2: 新增 `update_video_frame` 函数**

在 `get_video_frame_by_id` 函数之后添加：

```rust
pub fn update_video_frame(&self, frame: &VideoFrame) -> Result<VideoFrame, rusqlite::Error> {
    let mut stmt = self.conn.prepare(
        "UPDATE video_frames SET is_selected = ?, is_final = ? WHERE id = ?"
    )?;
    
    stmt.execute((
        frame.is_selected,
        frame.is_final,
        frame.id,
    ))?;
    
    self.get_video_frame_by_id(frame.id)
}
```

- [ ] **Step 3: 编译验证**

Run: `cd src-tauri && cargo check`
Expected: 编译通过，无错误

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db.rs
git commit -m "feat: add update_video_frame and get_video_frame_by_id functions"
```

---

## Task 2: 后端 - 注册视频帧更新 Tauri 命令

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 新增 `update_video_frame` Tauri 命令**

在 `main.rs` 的视频相关命令区域，添加：

```rust
#[tauri::command]
fn update_video_frame(
    frame: db::VideoFrame,
    state: State<AppState>,
) -> Result<db::VideoFrame, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_video_frame(&frame).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: 在 invoke_handler 中注册命令**

在 `invoke_handler` 的 `generate_handler!` 宏中添加 `update_video_frame`：

```rust
.invoke_handler(tauri::generate_handler![
    // ... 其他命令 ...
    update_video_frame,
    // ... 其他命令 ...
])
```

- [ ] **Step 3: 编译验证**

Run: `cd src-tauri && cargo check`
Expected: 编译通过，无错误

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat: register update_video_frame Tauri command"
```

---

## Task 3: 前端 - 新增 SelectableItem 联合类型

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 新增 `SelectableItem` 类型**

在 `types/index.ts` 文件末尾添加：

```typescript
export type SelectableItem = 
  | { type: 'photo'; item: Photo }
  | { type: 'frame'; item: VideoFrame };
```

- [ ] **Step 2: 编译验证**

Run: `pnpm run build`
Expected: 编译通过，无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add SelectableItem union type"
```

---

## Task 4: 前端 - 状态管理新增 selectedItems

**Files:**
- Modify: `src/store/index.ts`

- [ ] **Step 1: 更新类型导入**

更新导入语句，添加 `SelectableItem`：

```typescript
import type { Baby, Project, Period, Photo, Video, VideoFrame, ExportRecord, ScanLog, SelectableItem } from '../types';
```

- [ ] **Step 2: 在 AppState 接口中新增状态定义**

在 `AppState` 接口中添加：

```typescript
selectedItems: SelectableItem[];
setSelectedItems: (items: SelectableItem[]) => void;
addToSelectedItems: (item: SelectableItem) => void;
removeFromSelectedItems: (item: SelectableItem) => void;
```

- [ ] **Step 3: 在 store 创建函数中实现状态**

在 `create<AppState>((set) => ({...}))` 中添加：

```typescript
selectedItems: [],
setSelectedItems: (items) => set({ selectedItems: items }),
addToSelectedItems: (item) => set((state) => {
    const exists = state.selectedItems.some(
        i => i.type === item.type && i.item.id === item.item.id
    );
    if (exists) return state;
    return { selectedItems: [...state.selectedItems, item] };
}),
removeFromSelectedItems: (item) => set((state) => ({
    selectedItems: state.selectedItems.filter(
        i => !(i.type === item.type && i.item.id === item.item.id)
    )
})),
```

- [ ] **Step 4: 编译验证**

Run: `pnpm run build`
Expected: 编译通过，无类型错误

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts
git commit -m "feat: add selectedItems state management"
```

---

## Task 5: 前端 - 新增 updateVideoFrame 命令封装

**Files:**
- Modify: `src/utils/tauriCommands.ts`

- [ ] **Step 1: 新增 `updateVideoFrame` 函数**

在视频相关命令区域，添加：

```typescript
export async function updateVideoFrame(frame: VideoFrame): Promise<VideoFrame> {
    return invoke('update_video_frame', { frame });
}
```

- [ ] **Step 2: 编译验证**

Run: `pnpm run build`
Expected: 编译通过，无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/utils/tauriCommands.ts
git commit -m "feat: add updateVideoFrame command wrapper"
```

---

## Task 6: 前端 - 改造 PeriodSelectPage 视频卡片和抽帧流程

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx`

- [ ] **Step 1: 更新命令导入**

更新导入语句，添加 `updateVideoFrame`：

```typescript
import {
  // ... 其他导入 ...
  updateVideoFrame,
} from '../utils/tauriCommands';
```

- [ ] **Step 2: 更新 store 导入**

从 `useAppStore` 中解构新增的方法：

```typescript
const {
  // ... 其他状态 ...
  selectedItems,
  setSelectedItems,
  addToSelectedItems,
  removeFromSelectedItems,
} = useAppStore();
```

- [ ] **Step 3: 添加抽帧处理函数**

添加 `handleExtractFrames` 和 `handleGenerateFrames` 函数：

```typescript
const handleExtractFrames = (video: Video) => {
    setCurrentVideoForFrames(video);
    setShowFrameSettings(true);
};

const handleGenerateFrames = async (mode: 'count' | 'interval', value: number) => {
    setShowFrameSettings(false);
    setIsExtractingFrames(true);
    
    try {
        let frames: VideoFrame[];
        if (mode === 'count') {
            frames = await generateVideoFrames(currentVideoForFrames!.id, value);
        } else {
            frames = await generateVideoFramesByInterval(currentVideoForFrames!.id, value);
        }
        setCurrentVideoFrames(frames);
        setVideoFrameCounts(prev => ({
            ...prev,
            [currentVideoForFrames!.id]: frames.length
        }));
        setShowFrameViewer(true);
    } catch (error) {
        console.error('抽帧失败:', error);
        alert('抽帧失败，请重试');
    } finally {
        setIsExtractingFrames(false);
    }
};
```

- [ ] **Step 4: 添加视频帧选择处理函数**

添加 `handleToggleFrameSelect` 和相关函数：

```typescript
const handleToggleFrameSelect = async (frame: VideoFrame) => {
    try {
        const updated = await updateVideoFrame({
            ...frame,
            is_selected: !frame.is_selected,
        });
        
        setCurrentVideoFrames(currentVideoFrames.map(f => 
            f.id === updated.id ? updated : f
        ));
        
        if (updated.is_selected) {
            addToSelectedItems({ type: 'frame', item: updated });
        } else {
            removeFromSelectedItems({ type: 'frame', item: updated });
        }
    } catch (error) {
        console.error('更新视频帧失败:', error);
    }
};

const handleSetFinalVideoFrame = async (frame: VideoFrame) => {
    if (!currentPeriod) return;
    
    try {
        await setFinalVideoFrame(currentPeriod.id, frame.id);
        
        setCurrentVideoFrames(currentVideoFrames.map(f => ({
            ...f,
            is_final: f.id === frame.id,
        })));
        
        const updatedPeriods = periods.map(p => 
            p.id === currentPeriod.id 
                ? { ...p, selected_video_frame_id: frame.id }
                : p
        );
        setPeriods(updatedPeriods);
        
        setCurrentPeriod({
            ...currentPeriod,
            selected_video_frame_id: frame.id,
        });
    } catch (error) {
        console.error('设置最终视频帧失败:', error);
    }
};

const handleCancelFinalVideoFrame = async () => {
    if (!currentPeriod) return;
    
    try {
        await cancelFinalVideoFrame(currentPeriod.id);
        
        setCurrentVideoFrames(currentVideoFrames.map(f => ({
            ...f,
            is_final: false,
        })));
        
        const updatedPeriods = periods.map(p =>
            p.id === currentPeriod.id
                ? { ...p, selected_video_frame_id: undefined }
                : p
        );
        setPeriods(updatedPeriods);
        
        setCurrentPeriod({
            ...currentPeriod,
            selected_video_frame_id: undefined,
        });
    } catch (error) {
        console.error('取消最终视频帧失败:', error);
    }
};
```

- [ ] **Step 5: 改造照片选择逻辑**

修改 `handleTogglePhotoSelect` 函数，添加待选区更新：

```typescript
const handleTogglePhotoSelect = async (photo: Photo) => {
    try {
        const updated = await updatePhoto({
            ...photo,
            is_selected: !photo.is_selected,
        });
        setCurrentPhotos(currentPhotos.map(p => p.id === updated.id ? updated : p));
        
        if (updated.is_selected) {
            addToSelectedItems({ type: 'photo', item: updated });
        } else {
            removeFromSelectedItems({ type: 'photo', item: updated });
        }
    } catch (error) {
        console.error('更新照片失败:', error);
    }
};
```

- [ ] **Step 6: 改造待选区渲染**

将待选区 tab 的数据源改为 `selectedItems`，并添加视频帧渲染逻辑：

```tsx
) : selectedTab === 'pending' ? (
    <div>
        {selectedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Plus className="w-16 h-16 mb-4 text-gray-300" />
                <p>暂无待选项目</p>
                <p className="text-sm mt-1">在"照片"或"视频"中选择项目加入待选区</p>
            </div>
        ) : (
            <>
                <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                        待选区共有 {selectedItems.length} 个项目，
                        {currentPhotos.find(p => p.is_final) || currentVideoFrames.find(f => f.is_final) 
                            ? '已确认最终项目' 
                            : '请确认1个最终项目'}
                    </p>
                </div>
                <div className="photo-grid">
                    {selectedItems.map((selectable) => {
                        if (selectable.type === 'photo') {
                            const photo = selectable.item;
                            return (
                                <div
                                    key={`photo-${photo.id}`}
                                    className={`photo-item ${
                                        photo.is_selected ? 'selected' : ''
                                    } ${photo.is_final ? 'final' : ''}`}
                                    onContextMenu={(e) => handlePhotoContextMenu(e, photo)}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        const index = currentPhotos.findIndex(p => p.id === photo.id);
                                        handleOpenPreview(index);
                                    }}
                                >
                                    <img
                                        src={loadedImages[photo.id] || ''}
                                        alt={photo.file_name}
                                        loading="lazy"
                                    />
                                    {photo.is_final && (
                                        <div className="photo-badge final">
                                            <Check className="w-3 h-3" />
                                        </div>
                                    )}
                                    {photo.is_selected && !photo.is_final && (
                                        <div className="photo-badge selected">
                                            ✓
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                        <p className="text-white text-xs truncate">
                                            {photo.file_name}
                                        </p>
                                    </div>
                                </div>
                            );
                        } else {
                            const frame = selectable.item;
                            return (
                                <div
                                    key={`frame-${frame.id}`}
                                    className={`photo-item ${
                                        frame.is_selected ? 'selected' : ''
                                    } ${frame.is_final ? 'final' : ''}`}
                                >
                                    <img
                                        src={loadedImages[frame.id] || ''}
                                        alt={`frame-${frame.id}`}
                                        loading="lazy"
                                    />
                                    {frame.is_final && (
                                        <div className="photo-badge final">
                                            <Check className="w-3 h-3" />
                                        </div>
                                    )}
                                    {frame.is_selected && !frame.is_final && (
                                        <div className="photo-badge selected">
                                            ✓
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                        <p className="text-white text-xs font-mono text-center">
                                            {Math.floor(frame.time_seconds / 60)}:{(frame.time_seconds % 60).toString().padStart(2, '0')}
                                        </p>
                                    </div>
                                </div>
                            );
                        }
                    })}
                </div>
            </>
        )}
    </div>
```

- [ ] **Step 7: 绑定视频卡片"截取画面"按钮**

修改视频卡片中的按钮，添加点击事件：

```tsx
<button
    onClick={() => handleExtractFrames(video)}
    className="mt-2 w-full btn btn-outline btn-sm"
>
    {videoFrameCounts[video.id] > 0 ? `查看帧(${videoFrameCounts[video.id]}张)` : '截取画面'}
</button>
```

- [ ] **Step 8: 添加弹窗组件调用**

在页面底部添加 `VideoFrameSettingsModal` 和 `VideoFrameViewerModal` 组件：

```tsx
<VideoFrameSettingsModal
    visible={showFrameSettings}
    video={currentVideoForFrames}
    onClose={() => setShowFrameSettings(false)}
    onGenerate={handleGenerateFrames}
/>

<VideoFrameViewerModal
    visible={showFrameViewer}
    video={currentVideoForFrames}
    frames={currentVideoFrames}
    onClose={() => setShowFrameViewer(false)}
    onReExtract={() => {
        setShowFrameViewer(false);
        setShowFrameSettings(true);
    }}
    onToggleSelect={handleToggleFrameSelect}
    onSetFinal={handleSetFinalVideoFrame}
    onCancelFinal={handleCancelFinalVideoFrame}
    onPreview={(frame) => {
        console.log('预览视频帧:', frame);
    }}
/>
```

- [ ] **Step 9: 编译验证**

Run: `pnpm run build`
Expected: 编译通过，无类型错误

- [ ] **Step 10: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "feat: integrate video frame extraction and unified pending area"
```

---

## Task 7: 前端 - 更新 VideoFrameViewerModal 组件

**Files:**
- Modify: `src/components/VideoFrameViewerModal.tsx`

- [ ] **Step 1: 更新组件逻辑**

确保 `VideoFrameViewerModal` 组件正确处理 `onToggleSelect`、`onSetFinal`、`onCancelFinal` 和 `onPreview` 回调。

- [ ] **Step 2: 编译验证**

Run: `pnpm run build`
Expected: 编译通过，无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoFrameViewerModal.tsx
git commit -m "feat: update VideoFrameViewerModal callbacks"
```

---

## Task 8: 测试验证

**Files:**
- Test: 整个应用

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm tauri dev`
Expected: 应用启动成功

- [ ] **Step 2: 测试按数量抽帧**

操作：
1. 进入周期选择页面，选择一个周期
2. 切换到视频 tab
3. 点击视频卡片的"截取画面"按钮
4. 在弹窗中选择"按数量"模式，输入20帧
5. 点击"开始抽帧"

预期结果：
- 设置弹窗关闭
- 抽帧完成后显示视频帧查看弹窗
- 显示20帧视频帧

- [ ] **Step 3: 测试按间隔抽帧**

操作：
1. 点击"重新抽帧"
2. 切换到"按间隔"模式，输入2秒
3. 点击"开始抽帧"

预期结果：
- 显示预计帧数
- 抽帧完成后显示对应数量的帧

- [ ] **Step 4: 测试数量限制**

操作：
1. 点击"重新抽帧"
2. 选择"按数量"模式，输入200帧
3. 点击"开始抽帧"

预期结果：
- 自动截断为100帧
- 显示100帧视频帧

- [ ] **Step 5: 测试待选区整合**

操作：
1. 在视频帧查看弹窗中右键点击某帧，选择"加入待选区"
2. 关闭弹窗，切换到待选区 tab

预期结果：
- 待选区显示该视频帧
- 视频帧显示时间标签

- [ ] **Step 6: 测试最终帧设置**

操作：
1. 在待选区或视频帧查看弹窗中设置某帧为最终
2. 查看周期列表

预期结果：
- 该周期标记为已完成
- 显示最终帧标记

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: complete video frame extraction feature testing"
```

---

## Self-Review

### 1. Spec 覆盖检查

| 需求 | 对应 Task |
|------|-----------|
| 点击"截取画面"按钮弹出设置弹窗 | Task 6 Step 7 |
| 按数量抽帧（默认20帧） | Task 6 Step 3 |
| 按间隔抽帧 | Task 6 Step 3 |
| 100帧数量限制 | 后端已有（video.rs） |
| 视频帧和照片共用待选区 | Task 6 Step 6 |
| 统一 SelectableItem 类型 | Task 3 |
| update_video_frame 后端接口 | Task 1, Task 2 |

### 2. 占位符扫描

无 "TBD"、"TODO"、"implement later" 等占位符。

### 3. 类型一致性

- `SelectableItem` 类型在 Task 3 定义，Task 4、Task 6 使用
- `update_video_frame` 命令在 Task 1、Task 2 定义，Task 5、Task 6 使用
- `selectedItems` 状态在 Task 4 定义，Task 6 使用

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-26-video-frame-extraction.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**