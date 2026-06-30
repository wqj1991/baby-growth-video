# UX 交互审计与优化设计

> **日期**: 2026-06-30  
> **审计范围**: 全量前端页面、组件、路由、状态管理的交互模式  
> **确认方式**: 6 轮交互式确认，8 项决策落地  

---

## 一、现状概览

### 1.1 页面结构
```
App
├── /create-project         独立页面（无侧边栏，5步向导）
└── / (Layout + 侧边栏)
    ├── /                   HomePage（首页）
    ├── /baby-setup         BabySetupPage（宝宝信息）
    ├── /settings           SettingsPage（设置）
    └── /project/:id        ProjectPage（项目页）
        ├── overview        ProjectOverviewPage
        ├── periods         PeriodSelectPage ⭐
        ├── generate        VideoGeneratePage
        └── history         HistoryPage
```

### 1.2 状态管理
- **useAppStore** (Zustand): 全局状态，管理宝宝/项目/周期/照片/视频/截帧/待选区/拼图/播放器/生成进度/AI设置
- **useCreateProjectStore** (Zustand): 向导专属状态，管理5步流程的临时数据

### 1.3 交互模式统计
| 类型 | 数量 | 分布 |
|------|------|------|
| 单击选择 | 8处 | 宝宝选择、项目选择、周期选择、照片标记等 |
| 双击预览 | 2处 | 照片网格、待选区面板 |
| ~~右键菜单~~ | ~~1处~~ | 已删除（PhotoContextMenu.tsx 移除） |
| Hover显示操作 | 3处 | 照片卡片、项目卡片、待选区卡片 |
| 拖拽操作 | 1处 | 待选区面板宽度调整 |
| 模态框 | 4个 | 图片预览、视频截帧设置、截帧查看、模板选择 |
| 进度条 | 2处 | 扫描进度、视频生成进度 |
| 加载状态 | 3处 | 首页、项目页、周期页 |
| 空状态 | 6处 | 各列表为空时的引导提示 |

---

## 二、确认的 UX 优化决策

### 决策 1: 向导步骤文件重命名 ✅
**问题**: `Step3SelectFolder.tsx` 实际是步骤4，`Step4GeneratePeriods.tsx` 实际是步骤3，与 `CreateProjectPage.tsx` 中 `steps` 数组定义不一致。
**方案**: 重命名组件文件，使其与步骤编号一致：
- `Step3GeneratePeriods.tsx` → 步骤3
- `Step4SelectFolder.tsx` → 步骤4
**流程保持**: 先生成周期 → 再扫描文件夹（符合业务逻辑）

### 决策 2: 照片选择流程保持不变 ✅
**现状**: 照片选择采用两步流程：加入待选区 (is_selected) → 多选打勾 (is_multi_selected) → 拼图/最终选定 (is_final)
**方案**: 保持现状。当前两步操作逻辑清晰，用户容易理解各状态含义。

#### 照片状态流转详解

每张 `Photo` 实体包含 **3 个布尔标记**，各自独立控制不同 UI 行为：

| 标记 | 含义 | 触发操作 | 清除条件 |
|------|------|----------|----------|
| `is_selected` | 已加入待选区 | 点击「加入待选区」按钮 | 在待选区点击「移除」或再次点击照片 |
| `is_multi_selected` | 多选打勾（拼图用） | 在待选区勾选 checkbox | 取消勾选或离开待选区 |
| `is_final` | 该周期最终选定 | 在待选区点击「单独选定」 | 点击「取消最终」 |

#### 路径 1 及其回退详解

路径 1 是照片网格与待选区之间的双向通道，核心是 `handleTogglePhotoSelect` 这个唯一的 toggle 函数。

**正向：网格 → 待选区**

```
照片网格 Hover → 点击「+ 加入待选区」
  → handleTogglePhotoSelect(photo)
  → photo.is_selected = false → 取反为 true
  → updatePhoto() 持久化到 SQLite
  → addToSelectedItems({ type: 'photo', item })
  → pending_count +1
```

**反向（回退）：待选区 → 网格**

有 **两个入口**，都最终调用同一个 `handleTogglePhotoSelect`：

| 回退入口 | 位置 | UI | 触发链 |
|----------|------|----|--------|
| A. Hover 取消 | 照片网格 PhotoCard | Hover → 显示「✕ 从待选区取消」按钮 | `onToggleSelect` → `handleTogglePhotoSelect(photo)` |
| B. 移除按钮 | 待选区 PendingSelectionPanel | 点击「移除」按钮 | `onRemoveItem` → `handleRemoveFromStash(item)` → `handleTogglePhotoSelect({ ...photo, is_selected: true })` |

两个入口的内部逻辑完全相同：
```
  → handleTogglePhotoSelect(photo)
  → photo.is_selected = true → 取反为 false
  → updatePhoto() 持久化
  → removeFromSelectedItems({ type: 'photo', item })
  → is_multi_selected 强制重置为 false（第 349 行: newSelected ? photo.is_multi_selected : false）
  → pending_count -1
  → 照片从待选区消失，回归网格普通状态
```

**注意**：回退时 `is_multi_selected` 会强制清零，防止「移除后重新加入」时残留旧勾选。

#### 路径 3 及其回退详解

路径 3 是「单独选定 → 最终确认」的通道，核心是 `handleSetFinalPhoto` / `handleCancelFinalPhoto` 这一对函数。

**正向：待选区 → 最终确认**

有 **两个入口**：

| 入口 | 位置 | UI | 触发链 |
|------|------|----|--------|
| A. 设最终 | 照片网格 PhotoCard | Hover → 显示「✓ 设为最终」按钮（紫色） | `onSetFinal` → `handleSetFinalPhoto(photo)` |
| B. 单独选定 | 待选区 PendingSelectionPanel | Hover 卡片底部 → 点击「单独选定」按钮 | `onSelectSingle` → `handleSetFinalPhoto(item.item as Photo)` |

两个入口汇聚到同一个函数：
```
handleSetFinalPhoto(photo)
  → setFinalPhoto(periodId, photoId)   // Rust 后端持久化
  → setCurrentPhotos: 所有 p.is_final = (p.id === photo.id)
  → setSelectedItems: 同步该 photo 的 is_final = true（留在待选区中）
  → setPeriods: selected_photo_id = photo.id
  → setCurrentPeriod: selected_photo_id = photo.id
  → updatePeriodStat: has_final = true
```

**反向（回退）：取消最终选定**

这是一个 **全局操作** — 取消整个周期所有照片的 `is_final`，不是单张操作：

| 回退入口 | 位置 | UI | 触发链 |
|----------|------|----|--------|
| 取消最终 | 照片网格 PhotoCard | Hover → 显示「✕ 取消最终」按钮（红色 `#d44d68`） | `onCancelFinal` → `handleCancelFinalPhoto()` |

```
handleCancelFinalPhoto()
  → cancelFinalPhoto(periodId)          // Rust 后端持久化
  → setCurrentPhotos: 所有 p.is_final = false     ← 全局清除
  → setSelectedItems: 所有 type='photo' 的 is_final = false  ← 同步待选区
  → setPeriods: selected_photo_id = undefined      ← 回退周期级关联
  → setCurrentPeriod: selected_photo_id = undefined
  → updatePeriodStat: has_final = false
```

**关键细节**：

- `handleCancelFinalPhoto` **不接受参数**（第 385 行），不管从哪个 PhotoCard 触发，都**全局取消**当前周期所有照片的 `is_final`
- PhotoCard 中 `onCancelFinal` 虽然传入 `(photo)`，但回调是 `() => handleCancelFinalPhoto()`，参数被忽略
- 待选区 PendingSelectionPanel **没有**「取消最终」按钮，只能通过 PhotoCard hover 触发
- 取消最终 ≠ 从待选区移除：`is_selected` 和 `is_multi_selected` 不受影响，照片仍在待选区中
- 时间线指示器：绿色（已确认最终）→ 橙色（已有待选）或蓝色（当前查看）

#### 路径 5: 照片网格 → 最终选定（跳过待选区）

这是路径 3 入口 A 的独立变体 — 用户可以在照片网格中**直接**将照片设为最终，无需先加入待选区。

**正向**

```
照片网格 Hover → 点击「✓ 设为最终」（紫色按钮）
  → handleSetFinalPhoto(photo)
  → setFinalPhoto(periodId, photoId)   // Rust 后端
  → setCurrentPhotos: 所有 p.is_final = (p.id === photo.id)
  → setSelectedItems: map 遍历 —— 若 photo 不在待选区中，无变化
  → setPeriods: selected_photo_id = photo.id
  → setCurrentPeriod: selected_photo_id = photo.id
  → updatePeriodStat: has_final = true
```

与路径 3 的**唯一区别**：`setSelectedItems` 没有可操作项 — 照片从未进入待选区，所以 `selectedItems.map(...)` 不产生任何效果。

**反向（回退）**

```
同一 PhotoCard Hover → 点击「✕ 取消最终」（红色按钮）
  → handleCancelFinalPhoto()  ← 全局清除，同路径 3 回退
```

回退与路径 3 完全一致，因为 `handleCancelFinalPhoto` 是无参数的全局操作。

- 视觉表现：PhotoCard 获得紫色 ring + 绿色确认圆点，无需经过琥珀色待选标记
- 时间线直接从未开始 → 已确认最终（跳过「已有待选」的橙色状态）
- 若后续再将同一照片加入待选区，`is_final` 标记已存在，待选区自动显示绿色确认圆点

#### 完整状态机

```
                        ┌──────────────┐
                        │   浏览照片    │  (is_selected=false, is_multi=false, is_final=false)
                        │  Photo Grid  │
                        └───┬───┬───┬──┘
                            │   │   │
            ┌───────────────┼───┘   └──────────────────┐
            │ 加入待选区     │   设为最终（跳过待选区）   │ Hover「取消」
            │ (路径1正向)    │   (路径5)                │ (路径1回退A)
            ▼               ▼                          │
         ┌──────────────────────────────────────────┐  │
         │           待选区 PendingPanel              │  │
         │      (is_selected=true)                   │  │
         │                                           │  │
         │  ┌─────────────────────────────────────┐ │  │
         │  │  勾选 checkbox                       │ │  │
         │  │  → is_multi_selected = toggle        │ │  │
         │  │  → 多选后可「生成拼图」              │ │  │
         │  │     → TemplateSelector →             │ │  │
         │  │       CollageWorkspace               │ │  │
         │  └─────────────────────────────────────┘ │  │
         │                                           │  │
         │  ┌─────────────────────────────────────┐ │  │
         │  │  点击「单独选定」                     │ │  │
         │  │  → is_final = true                   │ │  │
         │  │  → Period.selected_photo_id = photo.id│ │  │
         │  │  → 周期状态 → "已确认最终" 🟢        │ │  │
         │  │  → 可「取消最终」回退                 │ │  │
         │  └─────────────────────────────────────┘ │  │
         │                                           │  │
         │  ┌─────────────────────────────────────┐ │  │
         │  │  移除（回退入口B）                    │ │  │
         │  │  → is_selected = false               │ │◄─┘
         │  │  → is_multi_selected = false (强制)   │ │
         │  │  → 退回照片网格                      │ │
         │  └─────────────────────────────────────┘ │
         └──────────────────────────────────────────┘
            ▲ 回退入口A: PhotoCard hover「取消」按钮
            │   → 同一 toggle，取反 is_selected
            ▼
         取消最终（路径3/5 回退）
            → handleCancelFinalPhoto() 全局清除
```

#### 关键规则

1. **待选区是主要操作入口**: 拼图、单独选定等核心操作在待选区执行。照片网格可**直接**「设为最终」（路径5，跳过待选区）
2. **is_final 与 is_selected 共存**: 设为最终后照片仍留在待选区，可同时勾选 is_multi_selected 参与拼图
3. **取消最终 → 全局回退**: `handleCancelFinalPhoto` 会清除当前周期所有照片的 `is_final` 和 `selected_photo_id`
4. **周期级别的最终选定**: `Period.selected_photo_id` 指向最终选定的照片/视频帧 ID，是周期时间线的数据源
5. **跨周期隔离**: 切换周期时，待选区 (`selectedItems`) 会根据新周期的 `is_selected` 照片重新加载

#### 数据流

```
照片选择操作 → Zustand Store (useAppStore)
  ├── selectedItems[]          ← 待选区面板的数据源
  ├── currentPhotos[]          ← 照片网格的数据源（含 is_selected/final 状态）
  ├── periods[].selected_photo_id  ← 周期时间线的数据源
  └── periodStats[].has_final / pending_count  ← 周期统计徽章的数据源
```

---

## 🎬 视频截帧 UX 操作

`VideoFrame` 与 `Photo` 共享相同的 3 布尔标记体系（`is_selected` / `is_multi_selected` / `is_final`），但**截帧的进入路径与照片完全不同**——照片来自文件夹扫描，截帧来自视频 FFmpeg 提取。

### 入口

视频 Tab 中每个视频卡片有 **两个操作按钮**：

| 按钮 | 触发 | 目标 |
|------|------|------|
| 「截取画面」（/ 查看(N)） | `handleExtractFrames(video)` | VideoFrameSettingsModal |
| 「播放」 | `handleOpenInlinePlayer(video)` | VideoFramePlayer（内嵌播放器） |

按钮文本根据 `videoFrameCounts[video.id]` 动态变化：首次为「截取画面」，有帧后变为「查看(N)」。

---

### 路径 A: 设置 → FFmpeg 抽帧 → 帧浏览器

```
Video Card「截取画面」
  → handleExtractFrames(video)
    → setCurrentVideoForFrames(video)
    → setShowFrameSettings(true)
      └─ [VideoFrameSettingsModal]
           │
           ├─ 模式: 「按数量抽帧」（默认） / 「按间隔抽帧」
           │  · count 模式: 滑块 1~100（默认20）
           │  · interval 模式: 秒数输入 + 实时计算 `⌊duration/interval⌋`
           │
           └─ 「开始抽帧」
               → onGenerate(mode, value)
                 → handleGenerateFrames(mode, value)
                   → setIsExtractingFrames(true)  ← 视频卡片按钮变灰色「抽帧中...」
                   → generateVideoFrames() / generateVideoFramesByInterval()
                   → setCurrentVideoFrames(frames)
                   → setVideoFrameCounts(...)      ← 更新按钮文本
                   → setShowFrameViewer(true)
                     └─ [VideoFrameViewerModal] 全屏帧浏览器
```

**VideoFrameSettingsModal** 细节：
- 模式切换时自动重算（从 interval 切回 count 会带入计算值）
- 实时显示「预计抽取 N 帧（最多 100 帧）」
- 关闭/打开自动重置状态
- Escape 键关闭

---

### 路径 B: 内嵌播放器 → 手动截帧（模拟）

```
Video Card「播放」
  → handleOpenInlinePlayer(video)
    → setShowInlinePlayer(true)
    → setCurrentPlayingVideo(video)
      └─ [VideoFramePlayer] 全屏内嵌播放器
           │
           ├─ 播放控制: 播放/暂停、逐帧、倍速(0.25/0.5/1/2×)
           ├─ 进度条可点击跳转
           ├─ 附近帧预览条（8帧缩略图，含模糊警告 ⚠️）
           │
           ├─ 「截取此帧」按钮 (Camera icon)
           │   → handleCapture()
           │     → mockFrame (id=Date.now(), time_seconds=进度百分比)
           │     → onCapture(frame)
           │       → addToSelectedItems({ type: 'video_frame', item: { ...frame, is_selected: true } })
           │       ← 直接进入待选区！
           │
           └─ 截帧结果栏（底部）
               ├─ 缩略图 + 时间码 + 运动模糊警告
               ├─ 「加入待选区」→ onAddToStash
               └─ 「直接选定」→ (预留按钮，TODO)
```

**⚠️ 注意**: VideoFramePlayer 当前使用**模拟截帧**（`mockFrame`，`id: Date.now()`）。截帧后直接添加到待选区，不走 `updateVideoFrame` 持久化。与路径 A 不同——路径 A 的帧是 FFmpeg 真实生成且写入 DB 的。

---

### 帧浏览器（VideoFrameViewerModal）操作

提取完成后进入全屏帧浏览器，4列网格展示所有帧：

| 操作 | 触发方式 | 实现 |
|------|----------|------|
| **勾选/取消** | 点击帧左上角 checkbox | `toggleSelect(frameId)` → `selectedIds` Set 增删 |
| **单独加待选区** | 点击帧右上角 🟢 + 按钮 | `onAddSingle(frame)` → `addToSelectedItems()` |
| **批量加待选区** | 勾选 ≥1 帧 → 底部「加入待选区(N)」 | `onConfirmSelection(selectedFrames)` → 逐个 add |
| **预览** | 双击帧 | `onPreview(frame)` → 打开 PhotoViewer |
| **重新抽帧** | 顶部「重新抽帧」按钮 | `onReExtract()` → 关闭 Viewer → 重新打开 Settings |

**状态指示**：
- 勾选中的帧 → 紫色 ring（`ring-[#7c5cbf]`）
- 已确认最终 → 绿色 ring（`ring-green-500`），顶部状态栏显示「· 已确认最终帧」
- 每帧底部有时间码 `M:SS`

---

### 截帧进入待选区后的操作

帧进入待选区后，与照片**完全共用** PendingSelectionPanel 的交互体系：

| 操作 | 状态变化 | 实现 |
|------|----------|------|
| **移除** | `is_selected=false` | `handleToggleFrameSelect(frame)` → `updateVideoFrame()` 持久化 → `removeFromSelectedItems()` |
| **多选勾选** | `is_multi_selected=toggle` | `handleToggleMultiSelect(item)` → 同步 `currentVideoFrames` + `selectedItems` |
| **设为最终** | `is_final=true` | `handleSetFinalVideoFrame(frame)` → `setFinalVideoFrame()` 持久化 → 更新 `period.selected_photo_id` |
| **拼图** | 勾选 ≥2 → 生成拼图 | 与照片混合进入 CollageWorkspace |

**「设为最终」完整调用链**：
```
PendingPanel「单独选定」
  → handleSelectSingle(item)
    → handleSetFinalVideoFrame(frame)
      → setFinalVideoFrame(periodId, frame.id)     ← Tauri 持久化
      → setCurrentVideoFrames(所有帧 is_final 重置，仅目标帧=true)
      → setSelectedItems(is_final 同步)
      → setPeriods(selected_photo_id = frame.id)
      → updatePeriodStat(has_final: true)
```

**回退（取消最终）**：
```
PhotoCard hover「✕ 取消最终」（仅照片端）
  / PendingPanel → 无独立「取消最终」按钮（与照片共用 handleCancelFinalPhoto）

→ handleCancelFinalPhoto()
  → cancelFinalVideoFrame(periodId)  ← Tauri 清除
  → currentVideoFrames 所有 is_final=false
  → selected_photo_id=undefined
  → has_final=false
```

### 跨周期数据加载

切换周期时（`loadPeriodData`），视频帧与照片一起加载：

```
loadPeriodData(periodId)
  → getPeriodVideoFrames(periodId)     ← Tauri 查询
  → setCurrentVideoFrames(frames)
  → pendingFrames = frames
      .filter(f => f.is_selected)
      .map(f => ({ type: 'video_frame', item: { ...f, is_multi_selected: false } }))
  → allPending = [...pendingPhotos, ...pendingFrames]
  → setSelectedItems(allPending)
```

**关键细节**: 跨周期加载时 `is_multi_selected` 强制重置为 `false`（与照片一致），确保上一周期的拼图勾选不会泄漏到新周期。

---

## 🖥️ 路径操作 → UI 显示状态映射

每种路径操作会**同时影响多个 UI 表面**。以下是每个操作发生后，各组件的前后视觉状态对照。

### 受影响的 UI 组件一览

| 组件 | 位置 | 显示哪些状态 |
|------|------|-------------|
| **PhotoCard** | 照片网格 | hover 按钮组、ring 彩色边框、右下角状态圆点 |
| **PendingSelectionPanel** | 右侧待选区 | 照片列表、多选 checkbox 勾选、「单独选定」按钮、多选进度条、「生成拼图」按钮启用/禁用 |
| **PeriodTimeline** | 顶部水平步进器 | 圆点图标（空心/勾选）、状态徽章（未开始/完成）、pending_count 数字徽章、连接线颜色 |
| **VideoCard** | 视频 Tab 网格 | 「截取画面」/「查看(N)」/「抽帧中...」按钮文本、disabled 态 |
| **VideoFrameViewerModal** | 全屏帧浏览器 | 帧缩略图 ring、单帧 + 按钮、批量「加入待选区(N)」按钮、顶部状态栏「已确认最终帧」 |
| **PendingSelectionPanel (header)** | 待选区顶部 | 计数徽章 `已选 N 项`、`拼图 N 张` |
| **PeriodTimeline (stats)** | 步进器子项 | photoCount / videoCount / pendingCount 三个数字徽章 |

### 状态标记 → 视觉信号速查

| 属性 | true 时视觉表现 | false 时视觉表现 |
|------|----------------|-----------------|
| `is_selected` | PhotoCard: hover 按钮变为「✕ 从待选区取消」；右下角 🟡 琥珀圆点；PendingPanel 中出现该照片 | PhotoCard: hover 按钮显示「+ 加入待选区」；无圆点；PendingPanel 中不出现 |
| `is_multi_selected` | PendingPanel: checkbox 打勾；底部「生成拼图」按钮计数 +1；≥2 张时底部显示紫色进度条 + 已选中 N 张提示 | PendingPanel: checkbox 空 |
| `is_final` | PhotoCard: 紫色 ring (`ring-[#7c5cbf]`)；hover 按钮变为「✕ 取消最终」红色；右下角 🟣 紫色 Check 圆点；Timeline: 圆点变为 Check ✓，徽章「完成」绿色 | PhotoCard: 无 ring；hover 显示「✓ 设为最终」紫色按钮；无圆点或仅琥珀圆点 |
| `has_final` (周期) | Timeline 圆点从空心 Circle 变为实心 Check；连接线两端均为 done 时变蓝色实线；`selected_photo_id` 非 null | Timeline 圆点为空心 Circle；`selected_photo_id` 为 null/undefined |
| `pending_count` | Timeline 子项内显示 `+N` amber 徽章 | Timeline 内不显示 pending 徽章 |
| `videoFrameCounts[v.id]` | VideoCard 按钮文本「查看(N)」→ 有帧历史 | 按钮文本「截取画面」→ 无帧 |
| `isExtractingFrames` | VideoCard 按钮变灰 disabled「抽帧中...」 | 正常可点击 |

---

### 📊 路径对照表

#### 路径 1 正向: 照片网格 → 待选区

| 组件 | 受影响的 UI 状态 | 视觉变化 |
|------|-----------------|----------|
| **PhotoCard** | `is_selected` → `true` | hover 按钮组: 「+ 加入待选区」(隐藏) →「✕ 从待选区取消」(显示)；右下角出现 🟡 琥珀圆点 |
| **PendingSelectionPanel** | `selectedItems` 新增 | 列表长度 +1，出现新卡片（照片缩略图 + checkbox + 「移除」按钮 + hover「单独选定」） |
| **PendingSelectionPanel (header)** | `selectedItems.length` 变化 | 顶部计数徽章 `已选 N 项`更新（从无到有 或 N→N+1） |
| **PeriodTimeline** | `pending_count` +1 | 对应周期步进器内 `+N` 徽章出现/数值 +1 |
| **VideoCard / ViewerModal** | 无变化 | — |

**回退 A / B (路径 1 反向)** 则是以上所有变化反转：PhotoCard 恢复「+ 加入待选区」+ 圆点消失；PendingPanel 列表减少；Timeline pending_count -1。

---

#### 路径 3 正向: 待选区 → 最终选定

| 组件 | 受影响的 UI 状态 | 视觉变化 |
|------|-----------------|----------|
| **PhotoCard** | `is_final` → `true` | 照片获得紫色 `ring-2 ring-[#7c5cbf]`；hover 按钮组: 「✓ 设为最终」(隐藏) →「✕ 取消最终」红色按钮显示；右下角 🟣 紫色 Check 圆点出现（若已在待选区，琥珀圆点被紫色圆点覆盖） |
| **PendingSelectionPanel** | `is_final` 同步 | 对应卡片同样出现紫色 ring，hover「单独选定」按钮可能隐藏（不再需要） |
| **PeriodTimeline** | `has_final` → `true`; `selected_photo_id` 设置 | 圆点从空心 `Circle` 变为实心 `Check` ✓；状态徽章从「未开始」变为「完成」；连接线变蓝色实线（done 状态） |
| **PeriodTimeline** | `pending_count` 不变 | ⚠️ pending_count 不受此操作影响（照片最终后仍留在待选区） |
| **VideoCard / ViewerModal** | 无变化 | — |

**回退 (路径 3 反向)**:
| 组件 | 视觉变化 |
|------|----------|
| **PhotoCard** | 紫色 ring 消失 → 恢复琥珀圆点（若仍在待选区）或完全无圆点（若通过路径5直接设为最终）；hover 按钮恢复「✓ 设为最终」(紫色) |
| **PendingSelectionPanel** | 所有待选区卡片 `is_final` 变为 false → 紫色 ring 消失（⏳ 当前 PendingPanel 无 "取消最终" 入口） |
| **PeriodTimeline** | 圆点从 Check ✓ 变回 Circle ○；状态徽章从「完成」→「未开始」；连接线从蓝色实线 → 灰色虚线 |

⚠️ 回退不影响 `is_selected`，pending_count 不变。

---

#### 路径 5: 照片网格 → 直接最终选定（跳过待选区）

UI 变化与路径 3 正向完全一致，**仅** `PendingSelectionPanel` 不同：

| 组件 | 路径 5 vs 路径 3 的区别 |
|------|------------------------|
| **PhotoCard** | **同** — 紫色 ring + 紫色 Check 圆点 +「✕ 取消最终」按钮 |
| **PendingSelectionPanel** | **无变化** — 照片从未加入待选区，列表不受影响 |
| **PendingSelectionPanel (header)** | **无变化** — `selectedItems.length` 不变 |
| **PeriodTimeline** | **同** — Check ✓ +「完成」徽章 + 蓝色连接线 |
| **PeriodTimeline** | `pending_count` **不变**（照片未入待选区，pending_count 本来就不计它） |

**回退 同路径 3** — `handleCancelFinalPhoto()` 全局清除 → PhotoCard ring 消失（路径5回退后 PhotoCard 回到完全初始态：无圆点、无 ring、hover 显示「+ 加入待选区」和「✓ 设为最终」）。

---

#### 路径 2: 待选区 → 拼图

| 组件 | 受影响的 UI 状态 | 视觉变化 |
|------|-----------------|----------|
| **PendingSelectionPanel** | `is_multi_selected` toggle | 勾选 checkbox: 对应卡片 ↑ 勾选状态；底部多选区域出现/更新 |
| **PendingSelectionPanel (底部)** | `multiSelectedCount` 变化 | 0 张: 显示 💡 提示「单击照片进行多选，选 2–6 张可启用拼图」；1 张: 无显示（进度条消失）；2–6 张: 显示 🧩「已选中 N 张」+ 紫色进度条 +「生成拼图(N张)」按钮启用 |
| **PendingSelectionPanel (底部按钮)** | `canCollage` 变化 | `multiSelectedCount >= 2`:「生成拼图」按钮从 disabled 灰 → 可点击紫色；按钮文本带 `(N张)` |
| **其他组件** | 无变化 | — |

**去勾选（拼图回退）**: checkbox 取消 → 计数减 → 若 < 2 张，「生成拼图」按钮重新 disabled + 进度条消失 + 提示恢复。

---

#### 视频截帧 路径 A（FFmpeg 抽帧 → 帧浏览器 → 待选区）

| 组件 | 阶段 | 受影响状态 | 视觉变化 |
|------|------|-----------|----------|
| **VideoCard** | 设置中 | `showFrameSettings=true` | VideoFrameSettingsModal 弹窗覆盖 |
| **VideoCard** | 抽帧中 | `isExtractingFrames=true` | 按钮变灰 disabled + 文本「抽帧中...」 |
| **VideoCard** | 完成 | `videoFrameCounts[v.id]=N` | 按钮恢复可点击 + 文本「查看(N)」 |
| **VideoFrameViewerModal** | 帧浏览器打开 | 全屏 4 列网格 | 每帧显示: 缩略图 + 时间码 `M:SS` + 左上角 checkbox + 右上角 🟢 + |
| **VideoFrameViewerModal** | 勾选帧 | `selectedIds` Set | 勾中的帧 → 紫色 `ring-[#7c5cbf]`；顶部批量按钮文字变成「加入待选区(N)」 |
| **VideoFrameViewerModal** | 单帧 + | `addToSelectedItems()` | 帧直接加入 `selectedItems`，同路径 1 正向 → PhotoCard/PendingPanel 变化 |
| **PendingSelectionPanel** | 帧入待选区后 | 与照片共存的东东 | `selectedItems` 新增 video_frame 类型项 → 列表长度 +1 → header 计数 +1 |

---

#### 视频截帧 路径 B（内嵌播放器 手动截帧 → 待选区）

| 组件 | 阶段 | 受影响状态 | 视觉变化 |
|------|------|-----------|----------|
| **VideoCard** | 播放器打开 | `showInlinePlayer=true` | VideoFramePlayer 全屏内嵌播放器 |
| **VideoFramePlayer** | 截帧 | `onCapture(frame)` → mockFrame | 截帧结果栏出现缩略图 + 时间码 +「加入待选区」按钮 |
| **PendingSelectionPanel** | 帧入待选区 | `addToSelectedItems({type:'video_frame',item:{...mockFrame,is_selected:true}})` | 列表 +1，照片网格无变化（截帧不在照片网格） |
| **⚠️ 注意** | 持久性 | `id=Date.now()` 不入 DB | 刷新周期后该帧消失（模拟数据无持久化） |

---

#### 视频帧 → 最终选定（待选区或 ViewerModal）

与照片路径 3 / 5 一致，具体差异：

| 组件 | 照片路径 vs 视频帧路径 |
|------|----------------------|
| **PhotoCard** | 照片网格中的 PhotoCard 受影响 | 视频帧没有独立的 VideoFrameCard，所以 PhotoCard 不受此类操作影响 |
| **VideoFrameViewerModal** | — | 顶部状态栏显示「· 已确认最终帧」；最终帧获得绿色 `ring-green-500` |
| **PendingSelectionPanel** | 帧卡片 `is_final=true` → 同照片，紫色 ring | 与照片卡片共用 PendingPanel，视觉一致 |
| **PeriodTimeline** | Check ✓ +「完成」+ 蓝色连接线 | **同照片** — 因为 `selected_photo_id` 被设置为 `frame.id` |
| **回退** | `handleCancelFinalPhoto()` → 全局清除 Foto + 视频帧 is_final | 同时调用 `cancelFinalVideoFrame(periodId)` |

---

### 📊 聚合影响：同时触发的 UI 表面数量

| 路径 | 操作 | 触发的 UI 组件数 |
|------|------|-----------------|
| 路径 1 正向 | 加入待选区 | **3 个**: PhotoCard + PendingPanel + Timeline (pending_count) |
| 路径 1 回退 | 移除出待选区 | **3 个**: 同上但反向 |
| 路径 3 / 5 正向 | 设为最终 | **3–4 个**: PhotoCard + PendingPanel (若有) + Timeline (Check/徽章) + ViewerModal (若为帧) |
| 路径 3 / 5 回退 | 取消最终 | **3–4 个**: PhotoCard + PendingPanel + Timeline + ViewerModal (若为帧) |
| 路径 2 | 拼图勾选 | **1 个** (自含式): PendingPanel 底部 + 卡片 checkbox |
| FFmpeg 抽帧 | 视频 → 帧浏览器 | **4 阶段**: VideoCard(按钮) → SettingsModal → Extracting → ViewerModal |
| 手动截帧 | 播放器截帧 | **2 个**: VideoFramePlayer(结果栏) + PendingPanel(列表) |

---
### 决策 3: 自定义确认 Modal ✅
**问题**: 删除项目/宝宝使用 `window.confirm()`，风格与玻璃拟态设计割裂。
**方案**: 创建统一的自定义 ConfirmModal 组件，符合品牌色调（暖琥珀渐变），所有危险操作统一使用。

### 决策 4: 设置页分离为基础设置 + AI设置 ✅
**问题**: SettingsPage 仅3个开关，useAppStore 中的 aiSettings 包含完整配置未展示。
**方案**: 设置页拆分为两个 Tab：
- **基础设置**: 背景音乐、照片质量等
- **AI 设置**: Provider 选择、API Endpoint、API Key、Model、Style Preset、Frame Duration

### 决策 5: 视频预览区域增强 ✅
**问题**: 生成前为静态占位符，生成后无内嵌播放能力。
**方案**: 
- 生成前：展示已选照片的时间线缩略图序列
- 生成后：自动替换为 HTML5 `<video>` 播放器

### 决策 6: Toast 通知系统 ✅
**问题**: 多处使用 `alert()` 显示错误信息，风格不统一。
**方案**: 创建统一的 Toast 通知系统，支持 success / warning / error / info 四种类型，自动消失。

### 决策 7: 侧边栏禁用项行为 ✅
**问题**: 未选择项目时，「视频制作」和「历史记录」显示为禁用但仍可点击跳转到 `/`。
**方案**: 禁用状态时完全不响应点击事件（移除 onClick handler，仅保留视觉禁用样式）。

### 决策 8: 项目概览页精简 ✅
**问题**: ProjectOverviewPage 内容冗余，与子页面职责重叠。
**方案**: 精简为基本信息卡片（项目名、宝宝、周期天数）+ 快捷入口按钮（选照片 / 生成视频 / 历史记录），核心操作仍在子页面完成。

---

## 三、代码审查发现的额外问题

| 优先级 | 问题 | 说明 |
|--------|------|------|
| 🔴 P0 | 路径 traversal 未校验 (TD-006) | 照片路径来自扫描结果直接传给 Rust，需校验路径合法性 |
| ⚠️ P1 | Store 重复代码 | useAppStore 和 useCreateProjectStore 中 scanLogs 管理逻辑完全相同 |
| ⚠️ P1 | navigate(-1) 不可靠 | SettingsPage 和 BabySetupPage 使用 navigate(-1)，历史栈不可控时行为异常 |
| ⚠️ P1 | 拼图生成 TODO | CollageWorkspace 的生成按钮调用 alert() 占位，后端接口未集成 |
| 💡 P2 | 键盘快捷键缺失 | 无 Ctrl+Z 撤销、Space 预览等桌面端常用快捷键 |
| 💡 P2 | 无响应式设计 | 仅适配 1280px+ 桌面端，无平板/移动端布局 |

---

## 四、后续实施建议

### Phase 1 — 基础交互优化（本次）
1. 重命名向导步骤文件
2. 创建 Toast 通知组件
3. 创建 ConfirmModal 组件
4. 替换所有 alert() / confirm() 调用
5. 侧边栏禁用项点击修复

### Phase 2 — 页面增强
6. 设置页 Tab 拆分 + AI 配置表单
7. 视频预览区照片序列 + 播放器
8. 项目概览页精简

### Phase 3 — 技术债偿还
9. 提取共用 scanLogs Hook
10. 修复路径 traversal 校验
11. 拼图生成后端接口集成
12. 键盘快捷键
13. 响应式布局

---

## 五、未涉及的交互区域（保持现状）

以下交互模式经分析确认为合理，暂不调整：
- 照片选择的两步流程（加入待选区 → 多选打勾）
- 向导线性步骤（支持返回但不支持跳步，已完成步骤可点击回溯）
- 周期时间线水平步进器
- 照片预览全屏灯箱（键盘左右切换 + ESC 关闭）
- 视频截帧设置弹窗
- 拼图模板选择器
- 三栏布局 + 拖拽分隔条（PeriodSelectPage）
- 视频生成进度条（阶段图标 + 进度百分比 + 降级通知）

---
**审计完成**: 2026-06-30  
**实施待定**: 等待用户确认后进入 planning 阶段
