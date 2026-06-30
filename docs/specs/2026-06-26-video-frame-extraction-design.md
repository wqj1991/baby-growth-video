# 视频抽帧功能设计文档（方案A：弹窗式 + 统一待选区）

## 1. 背景与目标

### 1.1 背景
现有产品中已有视频抽帧的基础功能，包括后端的 `generate_video_frames` 和 `generate_video_frames_by_interval` 函数，以及前端的 `VideoFrameSettingsModal` 和 `VideoFrameViewerModal` 组件。但视频卡片上的"截取画面"按钮尚未绑定功能，视频帧无法加入待选区，也无法与照片共用待选区。

### 1.2 目标
- 实现视频抽帧完整流程：点击按钮 → 设置参数 → 抽帧 → 查看结果
- 支持按数量和按间隔两种抽帧模式，默认20帧，最多100帧
- 视频帧和照片共用同一个待选区
- 使用统一的 `SelectableItem` 联合类型管理待选区数据

---

## 2. 需求分析

### 2.1 核心需求
1. **抽帧触发**：点击视频卡片上的"截取画面"按钮弹出设置弹窗
2. **双模式抽帧**：
   - 按数量模式：用户输入帧数（默认20，范围1-100）
   - 按间隔模式：用户输入间隔秒数，自动计算帧数
3. **数量限制**：单视频最多支持100帧
4. **结果展示**：抽帧完成后在弹窗中展示所有帧，支持选择、设为最终、预览
5. **待选区整合**：视频帧和照片共用同一个待选区

### 2.2 非功能需求
1. **性能**：抽帧过程异步执行，不阻塞UI
2. **兼容性**：保持与现有视频帧架构的兼容性
3. **用户体验**：模式切换时自动换算参数，实时显示预计帧数

---

## 3. 架构设计

### 3.1 数据模型设计

#### 3.1.1 统一待选区类型

在 `types/index.ts` 中新增 `SelectableItem` 联合类型：

```typescript
export type SelectableItem = 
  | { type: 'photo'; item: Photo }
  | { type: 'frame'; item: VideoFrame };
```

**字段说明**：
- `type`：判别器，区分照片和视频帧
- `item`：实际的数据对象（Photo 或 VideoFrame）

#### 3.1.2 状态管理变更

在 `store/index.ts` 中新增：

```typescript
// 待选区项目（照片 + 视频帧）
selectedItems: SelectableItem[];
setSelectedItems: (items: SelectableItem[]) => void;
addToSelectedItems: (item: SelectableItem) => void;
removeFromSelectedItems: (item: SelectableItem) => void;
```

### 3.2 组件交互流程

```
视频卡片"截取画面"按钮
        ↓
  VideoFrameSettingsModal（设置抽帧参数）
        ↓
  点击"开始抽帧"
        ↓
  关闭设置弹窗，显示加载状态
        ↓
  调用后端抽帧接口
        ↓
  VideoFrameViewerModal（展示抽帧结果）
        ↓
  右键菜单操作（加入待选区、设为最终、预览）
        ↓
  更新 selectedItems（待选区）
```

### 3.3 待选区渲染逻辑

待选区 tab 将从 `selectedItems` 数组渲染，根据 `type` 字段区分渲染方式：

- **照片**：显示缩略图、文件名、选中标记、最终标记
- **视频帧**：显示缩略图、时间标签（如 00:02）、选中标记、最终标记

---

## 4. 详细设计

### 4.1 后端设计

#### 4.1.1 现有函数复用

后端已实现以下函数，无需修改：
- `generate_video_frames(video_id, count)`：按数量抽帧
- `generate_video_frames_by_interval(video_id, interval_seconds)`：按间隔抽帧
- `get_video_frames(video_id)`：获取视频帧列表
- `set_final_video_frame(period_id, frame_id)`：设置最终视频帧
- `cancel_final_video_frame(period_id)`：取消最终视频帧

#### 4.1.2 新增函数

需要新增 `update_video_frame` 函数，用于更新视频帧的 `is_selected` 状态：

```rust
#[tauri::command]
fn update_video_frame(frame: db::VideoFrame, state: State<AppState>) -> Result<db::VideoFrame, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_video_frame(&frame).map_err(|e| e.to_string())
}
```

### 4.2 前端设计

#### 4.2.1 状态管理修改

在 `store/index.ts` 中：

1. 新增 `SelectableItem` 类型导入
2. 新增状态：
   - `selectedItems: SelectableItem[]`
   - `setSelectedItems`、`addToSelectedItems`、`removeFromSelectedItems`

#### 4.2.2 命令封装修改

在 `utils/tauriCommands.ts` 中新增：

```typescript
export async function updateVideoFrame(frame: VideoFrame): Promise<VideoFrame> {
    return invoke('update_video_frame', { frame });
}
```

#### 4.2.3 视频卡片改造

在 `PeriodSelectPage.tsx` 中：

1. 绑定"截取画面"按钮点击事件
2. 如果视频已有抽帧记录，显示帧数量徽标

```tsx
<button
    onClick={() => handleExtractFrames(video)}
    className="mt-2 w-full btn btn-outline btn-sm"
>
    {videoFrameCounts[video.id] > 0 ? `查看帧(${videoFrameCounts[video.id]}张)` : '截取画面'}
</button>
```

#### 4.2.4 抽帧设置弹窗

使用现有的 `VideoFrameSettingsModal` 组件：
- 默认选中"按数量"模式，默认20帧
- 支持模式切换和参数自动换算
- 实时显示预计帧数和数量限制提示

#### 4.2.5 视频帧查看弹窗

使用现有的 `VideoFrameViewerModal` 组件：
- 显示所有视频帧，支持网格布局
- 右键菜单：加入待选区、设为最终、预览
- 支持重新抽帧

#### 4.2.6 待选区改造

将待选区的数据源从 `currentPhotos.filter(p => p.is_selected)` 改为 `selectedItems`：

```tsx
<div className="photo-grid">
    {selectedItems.map((selectable) => {
        if (selectable.type === 'photo') {
            const photo = selectable.item;
            return (
                <div key={`photo-${photo.id}`} className="photo-item">
                    <img src={loadedImages[photo.id] || ''} alt={photo.file_name} />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-white text-xs truncate">{photo.file_name}</p>
                    </div>
                </div>
            );
        } else {
            const frame = selectable.item;
            return (
                <div key={`frame-${frame.id}`} className="photo-item">
                    <img src={loadedFrameImages[frame.id] || ''} alt={`frame-${frame.id}`} />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-white text-xs font-mono text-center">
                            {formatTime(frame.time_seconds)}
                        </p>
                    </div>
                </div>
            );
        }
    })}
</div>
```

### 4.3 交互逻辑

#### 4.3.1 抽帧流程

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

#### 4.3.2 视频帧选择

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
```

#### 4.3.3 照片选择（改造）

```typescript
const handleTogglePhotoSelect = async (photo: Photo) => {
    try {
        const updated = await updatePhoto({
            ...photo,
            is_selected: !photo.is_selected,
        });
        
        setCurrentPhotos(currentPhotos.map(p => 
            p.id === updated.id ? updated : p
        ));
        
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

---

## 5. 数据库修改

需要在 `db.rs` 中新增 `update_video_frame` 函数：

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

---

## 6. 实现步骤

### 阶段一：后端修改
1. 在 `db.rs` 中新增 `update_video_frame` 和 `get_video_frame_by_id` 函数
2. 在 `main.rs` 中新增 `update_video_frame` Tauri 命令并注册

### 阶段二：前端状态管理
1. 在 `types/index.ts` 中新增 `SelectableItem` 类型
2. 在 `store/index.ts` 中新增 `selectedItems` 状态和相关方法
3. 在 `utils/tauriCommands.ts` 中新增 `updateVideoFrame` 命令封装

### 阶段三：组件改造
1. 修改 `PeriodSelectPage.tsx`：
   - 绑定视频卡片"截取画面"按钮点击事件
   - 改造待选区使用 `selectedItems` 渲染
   - 改造照片选择逻辑使用 `addToSelectedItems`/`removeFromSelectedItems`
2. 修改 `VideoFrameViewerModal.tsx`：
   - 更新 `onToggleSelect` 回调逻辑

### 阶段四：测试验证
1. 测试抽帧功能（按数量、按间隔）
2. 测试待选区整合（照片和视频帧）
3. 测试最终帧设置
4. 测试数量限制（100帧上限）

---

## 7. 风险与注意事项

### 7.1 技术风险
1. **类型安全**：联合类型需要确保所有操作都正确处理两种类型
2. **状态同步**：待选区状态需要与数据库中的 `is_selected` 字段保持同步

### 7.2 用户体验风险
1. **待选区混淆**：用户可能分不清照片和视频帧
   - 缓解：在待选区中为视频帧添加特殊标识（如视频图标）

### 7.3 数据一致性
1. **重复选择**：确保同一个项目不会重复加入待选区
   - 方案：使用 `type + item.id` 作为唯一标识

---

## 8. 总结

本方案实现了视频抽帧的完整流程，包括：
- 弹窗式抽帧设置和结果查看
- 双模式抽帧（按数量/按间隔）
- 100帧数量限制
- 统一待选区数据模型（`SelectableItem` 联合类型）
- 照片和视频帧共用待选区

方案保持了与现有架构的兼容性，同时提供了灵活的抽帧方式和统一的用户体验。