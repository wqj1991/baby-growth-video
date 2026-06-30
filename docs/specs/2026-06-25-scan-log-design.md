# 扫描实时日志功能设计文档

**日期：** 2026-06-25
**状态：** 待评审
**作者：** AI Assistant

## 概述

为扫描照片和视频功能增加实时日志滚动显示，用户可以在扫描过程中看到每个文件的处理状态，并支持展开查看完整日志。

## 需求背景

当前扫描功能只有一个模拟进度条，用户无法了解具体扫描进度和每个文件的处理结果。增加实时日志可以：
- 让用户直观了解扫描进度和细节
- 方便排查问题文件（如日期识别失败、复制失败等）
- 提升用户信任感和操作透明度

## 设计方案

### 技术选型

采用 **Tauri 事件系统** 方案：
- 后端扫描过程中通过事件向前端实时推送日志
- 前端监听事件并实时更新日志列表
- 扫描完成后返回最终 ScanResult 统计数据

**选择理由：**
- 实时性好，用户体验流畅
- 符合 Tauri 官方推荐的前后端通信模式
- 事件系统可复用于视频生成等其他耗时操作
- 架构清晰，易于维护和扩展

---

## 后端设计（Rust）

### 事件定义

**事件名：** `scan://log`（使用命名空间避免冲突）

**Payload 结构：**
```rust
struct ScanLogEvent {
    level: String,        // "success" | "warn" | "error" | "info"
    message: String,      // 日志消息内容
    timestamp: i64,       // 时间戳（毫秒）
    file_name: Option<String>,  // 关联的文件名（可选）
}
```

### 扫描函数改造

**文件：** `src-tauri/src/media.rs`

**改动点：**
1. `scan_media_folder` 函数增加 `window: tauri::Window` 参数
2. 在以下节点 emit 日志事件：

| 节点 | 级别 | 示例消息 |
|------|------|----------|
| 扫描开始 | info | "开始扫描文件夹: /path/to/folder" |
| 文件识别成功 | success | "✓ 已识别: IMG_001.jpg (2026-03-15)" |
| 重复文件 | warn | "⚠ 跳过重复: IMG_002.jpg" |
| 日期不匹配周期 | warn | "⚠ 日期不在周期内: IMG_003.jpg" |
| 未识别日期 | warn | "⚠ 无法识别日期: IMG_004.jpg" |
| 复制失败 | error | "✗ 复制失败: IMG_005.jpg - 权限不足" |
| 扫描完成 | info | "扫描完成，共处理 128 个文件" |

### 命令注册更新

**文件：** `src-tauri/src/main.rs`

- `scan_media_folder` 命令签名增加 `window: Window` 参数
- Tauri 的 `generate_handler!` 宏会自动处理 Window 注入

### 性能考虑

- 日志事件 emit 是异步的，不阻塞扫描主流程
- 第一版不做批量合并，每个文件单独 emit 事件
- 如果后续遇到性能问题（如几千个文件），可以优化为每 10 个文件批量 emit 一次

---

## 前端设计（React）

### 数据结构

**文件：** `src/types/index.ts`

```typescript
export interface ScanLog {
  id: string;           // 唯一标识（时间戳+索引）
  level: 'success' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;    // 毫秒时间戳
  fileName?: string;
}
```

### 状态管理

**文件：** `src/store/createProjectStore.ts`

新增状态：
- `scanLogs: ScanLog[]` - 日志列表
- `isLogExpanded: boolean` - 是否展开日志面板（默认 false）
- `autoScrollLog: boolean` - 是否自动滚动（默认 true）

新增方法：
- `addScanLog(log: Omit<ScanLog, 'id'>)` - 追加一条日志
- `clearScanLogs()` - 清空日志
- `toggleLogExpanded()` - 切换展开状态
- `toggleAutoScrollLog()` - 切换自动滚动

### 新增组件：ScanLogPanel

**文件：** `src/components/ScanLogPanel.tsx`

**Props：**
```typescript
interface ScanLogPanelProps {
  logs: ScanLog[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
}
```

#### 收起状态（默认）
- 高度：约 120px，显示最近 5-6 条日志
- 底部有"展开查看全部日志 ▼"按钮
- 右侧显示日志总数（如"共 128 条"）
- 自动滚动到底部

#### 展开状态
- 高度：最大 60vh，可滚动
- 底部有"收起 ▲"按钮
- 顶部工具栏：
  - 🔄 自动滚动开关（默认开启）
  - 📋 复制全部日志按钮
  - 🔍 过滤选项（全部/成功/警告/错误）
- 日志区域可滚动

#### 日志条目样式
- 左侧对应颜色的图标：
  - success：绿色 ✓
  - warn：黄色 ⚠
  - error：红色 ✗
  - info：蓝色 ℹ
- 等宽字体（font-mono）
- 时间戳浅灰色显示在右侧
- 鼠标悬停显示完整文件名 tooltip

### 事件监听工具

**文件：** `src/utils/tauriCommands.ts`

新增工具函数：
```typescript
// 开始监听扫描日志
export function onScanLog(callback: (log: ScanLog) => void): () => void {
  // 返回取消监听函数
}
```

### Step3SelectFolder 集成

**文件：** `src/pages/create-project/Step3SelectFolder.tsx`

改动点：
1. 扫描开始时：
   - 清空日志
   - 注册 `scan://log` 事件监听
   - 保存取消监听函数

2. 扫描过程中：
   - 收到事件后追加到日志列表
   - 自动滚动（如果开启）

3. 扫描结束后：
   - 移除事件监听（避免内存泄漏）
   - 保留日志供用户查看

4. 移除当前的模拟进度条（setInterval）
   - 进度可以基于已处理日志数量 / 预估总数（可选）
   - 或者保留进度条但用实际日志数量驱动

---

## 交互流程

```
用户点击"开始扫描"
    │
    ▼
前端: 清空日志 + 注册事件监听 + 调用 scan_media_folder
    │
    ├──────────────────────────────────┐
    │                                   │
    ▼                                   ▼
后端: 开始扫描                      前端: 等待事件
    │                                   │
    ├─ emit "开始扫描..." ─────────────►│ 追加日志 + 滚动
    ├─ emit "✓ 已识别 file1.jpg" ─────►│ 追加日志 + 滚动
    ├─ emit "⚠ 跳过重复 file2.jpg" ───►│ 追加日志 + 滚动
    ├─ emit "✗ 复制失败 file3.jpg" ───►│ 追加日志 + 滚动
    │  ...                              │  ...
    ├─ emit "扫描完成" ────────────────►│ 追加日志
    │                                   │
    ▼                                   ▼
返回 ScanResult ◄────────────────────── 前端接收结果
    │
    ▼
前端: 移除事件监听 + 更新统计数据 + 显示结果
```

---

## 错误处理与边界情况

### 1. 扫描中断
- 组件卸载时确保事件监听器被正确移除
- 使用 useEffect 的 cleanup 函数处理

### 2. 大量日志性能
- 第一版不做限制，简单实现
- 如果实际遇到性能问题，再考虑：
  - 虚拟滚动
  - 只保留最近 500 条，更早的"加载更多"
  - 批量更新（每 100ms 合并一次日志更新）

### 3. 事件丢失
- 日志只是辅助用户了解过程，不要求 100% 精确
- 扫描完成后以 ScanResult 的统计数据为准
- 即使丢失部分日志事件，不影响最终结果

### 4. 重新扫描
- 点击"重新扫描"时，清空之前的日志列表
- 重置展开状态和滚动位置

---

## 改动范围总结

| 层级 | 文件 | 改动内容 |
|------|------|----------|
| 后端 | `src-tauri/src/media.rs` | 扫描函数增加 Window 参数，各节点 emit 事件 |
| 后端 | `src-tauri/src/main.rs` | 命令签名更新（自动注入 Window） |
| 前端 | `src/types/index.ts` | 新增 ScanLog 类型 |
| 前端 | `src/store/createProjectStore.ts` | 新增日志相关状态和方法 |
| 前端 | `src/utils/tauriCommands.ts` | 新增事件监听工具函数 |
| 前端 | `src/components/ScanLogPanel.tsx` | 新增日志面板组件 |
| 前端 | `src/pages/create-project/Step3SelectFolder.tsx` | 集成语日面板，移除模拟进度 |

---

## 后续可扩展方向

1. **日志导出**：支持将扫描日志导出为文本文件
2. **日志搜索**：在展开状态支持关键词搜索
3. **失败文件列表**：单独列出所有处理失败的文件，方便用户排查
4. **进度百分比**：基于文件总数计算真实进度条
5. **复用到其他功能**：视频生成、帧提取等耗时操作也可以用同样的事件机制显示实时日志

---

## 自审检查

- [x] 没有 TBD / TODO 占位符
- [x] 各部分描述一致，没有矛盾
- [x] 范围清晰，是一个独立可实现的功能
- [x] 需求明确，没有歧义
