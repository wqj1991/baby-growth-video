# 待选区重新设计功能文档

## 1. 背景与目标

### 1.1 背景
当前周期详情页（PeriodSelectPage）的待选区功能存在以下问题：

1. **待选区位置靠后**：Tab 顺序为「全部照片 | 视频 | 待选区」，用户需要多次点击才能到达
2. **周期切换后默认不选中待选区**：用户切换周期后需要手动切换到待选区 tab
3. **状态混淆**：`is_selected` 字段同时承担两个角色——照片是否在待选区中、是否被选中用于拼图，导致放入待选区后自动被勾选用于拼图

### 1.2 目标
- 将待选区 tab 移到最左侧，提升可见性和操作效率
- 切换周期后自动选中待选区 tab，方便用户查看当前周期的待选内容
- 分离"在待选区中"和"被选中用于拼图"两个状态
- 放入待选区后不自动选中用于拼图，用户需要手动点击选择
- 保留待选区多选拼图功能（2-4张）

## 2. 需求概述

### 2.1 功能清单
1. **Tab 顺序调整**：将待选区移到最左侧，新顺序为「待选区 | 全部照片 | 视频」
2. **周期切换自动切换 tab**：切换周期后自动选中待选区 tab
3. **状态分离**：新增 `is_multi_selected` 字段，用于标记是否被选中用于拼图
4. **放入待选区不自动选中**：加入待选区时只设置 `is_selected=true`，`is_multi_selected` 保持 `false`
5. **待选区手动多选**：用户在待选区中点击照片切换 `is_multi_selected` 状态
6. **拼图功能保留**：选中 2-4 张后可生成拼图

### 2.2 范围
- 周期详情页（PeriodSelectPage）
- 照片和视频帧都适用
- 后端数据库暂不持久化 `is_multi_selected`，仅在前端状态管理

## 3. 功能设计

### 3.1 Tab 结构调整

**原有结构：**
```
全部照片 | 视频 | 待选区
```

**新结构：**
```
待选区 | 全部照片 | 视频
```

- **待选区 tab**（最左侧）：显示当前周期的待选照片/视频帧
- **全部照片 tab**：显示当前周期的所有照片
- **视频 tab**：显示当前周期的所有视频

### 3.2 周期切换行为

**原有行为：** 切换周期后保持当前 tab

**新行为：** 切换周期后自动切换到待选区 tab

### 3.3 状态分离设计

**数据模型变更：**

| 字段 | 类型 | 含义 | 默认值 |
|------|------|------|--------|
| `is_selected` | boolean | 是否在待选区中 | false |
| `is_multi_selected` | boolean | 是否被选中用于拼图 | false |

**状态组合：**

| is_selected | is_multi_selected | 含义 | 视觉表现 |
|-------------|-------------------|------|----------|
| false | false | 在照片列表中，未加入待选区 | 普通照片卡片 |
| true | false | 在待选区中，未选中用于拼图 | 待选区卡片，未勾选 |
| true | true | 在待选区中，已选中用于拼图 | 待选区卡片，已勾选 |
| false | true | 不可能状态 | - |

### 3.4 交互流程

```
1. 用户在「全部照片」中右键点击 → 「加入待选区」
   ↓
2. 照片进入待选区（is_selected = true，is_multi_selected = false）
   ↓
3. 用户切换到「待选区」tab（或周期切换自动切换）
   ↓
4. 用户点击待选区中的照片 → 切换 is_multi_selected 状态
   ↓
5. 选中 2-4 张后 → 点击「生成拼图」
   ↓
6. 进入拼图工作区
```

### 3.5 待选区面板交互

**原有交互：**
- 点击照片 → 切换 `is_selected`（同时改变待选区状态和拼图选择状态）

**新交互：**
- 点击照片 → 切换 `is_multi_selected`（仅改变拼图选择状态）
- 删除按钮 → 从待选区移除（设置 `is_selected = false`）

## 4. 技术实现方案

### 4.1 类型定义变更

**文件：** `src/types/index.ts`

在 `Photo` 和 `VideoFrame` 接口中新增字段：

```typescript
// Photo 接口新增
is_multi_selected: boolean;

// VideoFrame 接口新增
is_multi_selected: boolean;
```

### 4.2 状态管理

**文件：** `src/store/index.ts`

- 保留现有的 `selectedItems` 数组，存储待选区中的项目
- `selectedItems` 中的项目 `is_selected` 为 `true`
- `is_multi_selected` 在前端状态中管理，不持久化到后端

### 4.3 组件修改

#### 4.3.1 PeriodSelectPage

**文件：** `src/pages/PeriodSelectPage.tsx`

**修改内容：**
1. **Tab 顺序调整**：修改 tab 按钮顺序为「待选区 | 全部照片 | 视频」
2. **周期切换自动切换 tab**：在 `loadPeriodMedia` 函数末尾添加 `setSelectedTab('pending')`
3. **handleToggleMultiSelect 修改**：操作 `is_multi_selected` 而非 `is_selected`
4. **handleTogglePhotoSelect 修改**：放入待选区时只设置 `is_selected`，不设置 `is_multi_selected`
5. **handleToggleFrameSelect 修改**：同照片处理逻辑

#### 4.3.2 PendingSelectionPanel

**文件：** `src/components/PendingSelectionPanel.tsx`

**修改内容：**
1. **isItemSelected 修改**：检查 `is_multi_selected` 而非 `is_selected`
2. **onToggleMultiSelect 调用**：点击时切换 `is_multi_selected`

#### 4.3.3 PhotoCard

**文件：** `src/components/PhotoCard.tsx`

**修改内容：**
1. 更新状态徽章逻辑，区分待选和最终选中

### 4.4 数据流转

```
1. 用户右键点击照片 → 选择「加入待选区」
   ↓
2. handleTogglePhotoSelect → 设置 is_selected = true（is_multi_selected 不变）
   ↓
3. addToSelectedItems → 将照片加入 selectedItems 数组
   ↓
4. 切换周期 → loadPeriodMedia → setSelectedTab('pending')
   ↓
5. 用户在待选区点击照片 → handleToggleMultiSelect → 切换 is_multi_selected
   ↓
6. 选中 2-4 张 → handleEnterCollage → 进入拼图工作区
```

## 5. 测试要点

### 5.1 功能测试
- [ ] Tab 顺序为「待选区 | 全部照片 | 视频」
- [ ] 切换周期后自动切换到待选区 tab
- [ ] 加入待选区后照片不自动勾选用于拼图
- [ ] 在待选区中点击照片可以切换勾选状态
- [ ] 选中 2-4 张后可以生成拼图
- [ ] 从待选区移除照片后，`is_selected` 和 `is_multi_selected` 都设为 `false`

### 5.2 交互测试
- [ ] 待选区照片点击交互正常
- [ ] 删除按钮正常工作
- [ ] 单独选定按钮正常工作
- [ ] 拼图按钮在选中不足/超过时正确禁用

### 5.3 边界情况
- [ ] 待选区为空时显示空状态
- [ ] 超过 4 张时显示警告提示
- [ ] 只有 1 张时显示拼图提示

## 6. 影响范围

### 6.1 修改的文件
1. `src/types/index.ts` - 添加 `is_multi_selected` 字段
2. `src/pages/PeriodSelectPage.tsx` - Tab 顺序、周期切换行为、事件处理逻辑
3. `src/components/PendingSelectionPanel.tsx` - 选中状态判断逻辑
4. `src/components/PhotoCard.tsx` - 状态徽章显示逻辑

### 6.2 未修改的文件
1. `src/store/index.ts` - 状态结构不变
2. `src/components/PhotoContextMenu.tsx` - 菜单结构不变
3. `src/components/CollageWorkspace.tsx` - 拼图工作区不变
4. 后端 API - 无需修改