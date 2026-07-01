# 周期删除功能设计

## 概述

为成长周期管理添加删除能力，允许用户在创建项目的步骤3中删除不需要的周期。删除操作需要确认弹窗，防止误删。

## 功能需求

1. **删除按钮**：在周期列表每个条目的右侧显示删除按钮（垃圾桶图标），鼠标悬停时显示
2. **确认弹窗**：点击删除按钮后弹出确认对话框，包含周期名称和警告信息
3. **执行删除**：用户确认后调用后端 API 删除周期
4. **状态更新**：删除成功后从前端状态中移除该周期
5. **错误处理**：删除失败时显示错误提示

## 技术实现

### 1. 状态管理

在 Zustand store 中添加 `removePeriod` action：

```typescript
removePeriod: (periodId: number) => void;
```

实现逻辑：从 `periods` 数组中过滤掉指定 ID 的周期。

### 2. UI 修改

修改 `Step3GeneratePeriods.tsx`：

- 在每个周期条目右侧添加删除按钮（默认隐藏，hover 显示）
- 添加 `ConfirmModal` 组件用于确认删除
- 添加状态管理删除弹窗的打开/关闭和当前删除的周期

### 3. API 调用

使用已有的 `deletePeriod` 函数：

```typescript
export async function deletePeriod(periodId: number): Promise<void>;
```

### 4. 交互流程

```
用户 hover 周期条目 → 显示删除按钮
用户点击删除按钮 → 打开确认弹窗
用户点击"取消" → 关闭弹窗
用户点击"确认删除" → 调用 API → 更新前端状态 → 关闭弹窗
```

## UI 设计

### 删除按钮

- 图标：垃圾桶图标（Trash2）
- 位置：周期条目右侧，日期旁边
- 样式：默认透明，hover 时显示红色背景和白色图标

### 确认弹窗

使用项目现有的 `ConfirmModal` 组件，配置：

- `title`: "确认删除"
- `message`: "确定要删除周期「{周期名称}」吗？此操作无法撤销。"
- `confirmText`: "确认删除"
- `cancelText`: "取消"
- `variant`: "danger"

## 文件修改清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/store/createProjectStore.ts` | 修改 | 添加 `removePeriod` action |
| `src/pages/create-project/Step3GeneratePeriods.tsx` | 修改 | 添加删除按钮和确认弹窗 |

## 注意事项

1. 删除周期后，与该周期关联的缩略图和视频数据需要在后端级联删除（后端已处理）
2. 删除后需要确保至少保留一个周期，避免空周期列表导致后续流程问题
3. 删除操作需要 loading 状态，防止重复点击

## 依赖检查

- ✅ 后端 `delete_period` 命令已存在
- ✅ 前端 `deletePeriod` API 函数已存在
- ✅ `ConfirmModal` 组件已存在
- ✅ `showToast` 函数已存在（用于错误提示）