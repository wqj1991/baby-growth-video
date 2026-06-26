# 扫描日志持久化与下载功能设计文档

## 1. 背景与目标

### 1.1 背景
当前扫描日志功能存在以下问题：
1. 扫描完成后，日志面板消失，无法回顾扫描详情
2. 日志仅存在于内存中，刷新页面或重新打开应用后丢失
3. 周期页面的扫描功能没有日志显示
4. 无法导出/下载扫描日志

### 1.2 目标
1. 扫描完成后日志仍然可见，支持回顾
2. 日志持久化保存到项目文件夹，关闭应用后不丢失
3. 周期页面的扫描也支持日志显示
4. 支持下载扫描日志（JSON 格式）

## 2. 功能范围

### 2.1 包含的功能
- 扫描日志持久化存储（JSON 格式）
- 扫描完成后日志面板保留显示
- 周期页面扫描支持日志显示
- 日志下载功能（JSON 格式）
- 历史扫描日志加载

### 2.2 不包含的功能
- 多版本历史日志保留（仅保留最新一次）
- 日志搜索/过滤的高级功能
- 日志上传/导入功能

## 3. 后端设计

### 3.1 日志存储结构

**存储位置**：`projects/<project_id>/scan-log.json`

**JSON 格式**：
```json
{
  "project_id": 1,
  "scanned_at": "2026-06-26T10:00:00+08:00",
  "folder_path": "D:\\baobao\\亲宝宝\\骏骏",
  "total_files": 100,
  "logs": [
    {
      "level": "info",
      "message": "开始扫描文件夹: D:\\baobao\\亲宝宝\\骏骏",
      "timestamp": 1719367200000,
      "file_name": null
    },
    {
      "level": "success",
      "message": "✓ 已识别照片: 2026-03-10-000000.jpg (2026-03-10)",
      "timestamp": 1719367201000,
      "file_name": "2026-03-10-000000.jpg"
    }
  ]
}
```

### 3.2 数据结构（Rust）

```rust
#[derive(Serialize, Deserialize)]
struct ScanLogFile {
    project_id: i64,
    scanned_at: String,  // ISO 8601 格式
    folder_path: String,
    total_files: i64,
    logs: Vec<ScanLogEntry>,
}

#[derive(Serialize, Deserialize)]
struct ScanLogEntry {
    level: String,
    message: String,
    timestamp: i64,  // 毫秒时间戳
    file_name: Option<String>,
}
```

### 3.3 扫描函数改造

**改造点**：
1. 在 `scan_media_folder` 函数中添加 `Vec<ScanLogEntry>` 收集日志
2. 每次 emit 事件的同时，也 push 到日志列表
3. 扫描完成后，将日志保存到文件

**函数签名不变**，但内部增加日志收集逻辑。

### 3.4 新增命令

#### 3.4.1 get_scan_log
读取项目的历史扫描日志。

```rust
#[tauri::command]
fn get_scan_log(project_id: i64) -> Result<Option<ScanLogFile>, String>
```

**返回值**：
- `Some(ScanLogFile)` - 存在历史日志
- `None` - 不存在历史日志

#### 3.4.2 （可选）save_scan_log
保存扫描日志（也可以直接在 scan_media_folder 内部完成，不需要单独命令）。

### 3.5 文件保存逻辑

1. 扫描完成后，构建 `ScanLogFile` 结构体
2. 序列化为 JSON 字符串
3. 写入到 `projects/<project_id>/scan-log.json`
4. 如果写入失败，不影响扫描结果（只打错误日志）

## 4. 前端设计

### 4.1 状态管理调整

**当前状态**：日志状态在 `createProjectStore` 中，仅用于创建项目流程。

**调整方案**：
- 将 `scanLogs`、`isLogExpanded`、`autoScrollLog` 等状态移到全局 store
- 或者在 `appStore` 中新增扫描日志相关状态
- 两个页面（创建项目页、周期页）共享状态

**推荐方案**：在 `appStore` 中新增扫描日志状态，因为两个页面都需要用。

### 4.2 页面改造

#### 4.2.1 Step3SelectFolder（创建项目第三步）

**当前布局**：
```
{folderPath && !scanResult && (
  扫描按钮
  日志面板（仅扫描中显示）
)}

{scanResult && (
  扫描结果统计卡片
)}
```

**改造后布局**：
```
{folderPath && !scanResult && (
  扫描按钮
  日志面板（扫描中显示）
)}

{scanResult && (
  扫描结果统计卡片
  日志面板（扫描完成后显示，可折叠）
)}
```

#### 4.2.2 PeriodSelectPage（周期详情页）

**当前布局**：
- 顶部有"扫描文件夹"按钮
- 点击后直接扫描，没有日志显示

**改造后布局**：
```
顶部工具栏
  ...
  [扫描文件夹按钮]

{isScanning || scanLogs.length > 0 && (
  日志面板（可折叠）
)}
```

### 4.3 ScanLogPanel 组件增强

**新增功能**：
- 工具栏添加「下载 JSON」按钮
- 点击下载按钮，触发文件下载

**下载实现方式**：
- 方式 A：前端构造 JSON 字符串，通过 Blob 下载
- 方式 B：调用后端命令，下载项目文件夹下的 scan-log.json 文件

**推荐方式 A**：简单直接，不依赖后端文件。
（但用户要求日志保存到项目文件夹，所以两种方式都可以，方式 B 更符合"下载已保存的文件"的语义）

### 4.4 历史日志加载

**加载时机**：
1. 创建项目页进入时，如果项目已有历史扫描日志，加载并显示
2. 周期详情页进入时，如果项目已有历史扫描日志，加载并显示

**加载逻辑**：
- 调用 `get_scan_log(project_id)` 命令
- 如果返回日志，设置到 store 中
- 如果没有返回，不显示日志面板

## 5. 数据流

### 5.1 扫描过程数据流

```
用户点击扫描
  ↓
前端：clearScanLogs() + setIsScanning(true)
  ↓
前端：注册日志事件监听
  ↓
后端：scan_media_folder() 开始执行
  ↓
后端：每处理一条日志 → emit 事件 + push 到内存列表
  ↓
前端：收到事件 → 追加到日志列表 → 刷新 UI
  ↓
后端：扫描完成 → 保存日志到 scan-log.json
  ↓
前端：收到结果 → setScanResult() + setIsScanning(false)
  ↓
前端：日志面板保留显示
```

### 5.2 历史日志加载数据流

```
页面加载
  ↓
检查是否有 project_id
  ↓
调用 get_scan_log(project_id)
  ↓
有日志 → 设置到 store → 显示日志面板
无日志 → 不显示日志面板
```

## 6. 错误处理

### 6.1 日志保存失败
- 不影响扫描结果
- 控制台打印错误日志
- 前端仍然可以看到内存中的日志（只是不能持久化）

### 6.2 历史日志读取失败
- 不影响页面功能
- 控制台打印错误日志
- 视为无历史日志

### 6.3 下载失败
- 提示用户下载失败
- 控制台打印错误日志

## 7. 性能考虑

### 7.1 日志数量限制
- 前端最多保留 1000 条日志（已有）
- 后端保存全部日志（不限制，或限制为 10000 条）

### 7.2 文件大小
- JSON 格式，每条日志约 100-200 字节
- 1000 条日志约 100-200KB，完全没问题

## 8. 兼容性

### 8.1 旧项目兼容
- 旧项目没有 scan-log.json 文件 → 视为无历史日志
- 不影响其他功能

## 9. 实现计划

### 任务清单
1. 后端 - 添加 ScanLogFile 和 ScanLogEntry 结构体
2. 后端 - 改造 scan_media_folder 收集日志
3. 后端 - 扫描完成后保存日志到文件
4. 后端 - 添加 get_scan_log 命令
5. 前端 - 调整状态管理（移到全局 store）
6. 前端 - Step3SelectFolder 页面改造（扫描完成后保留日志）
7. 前端 - PeriodSelectPage 页面添加日志面板
8. 前端 - ScanLogPanel 添加下载按钮
9. 前端 - 添加历史日志加载逻辑
10. 测试验证
