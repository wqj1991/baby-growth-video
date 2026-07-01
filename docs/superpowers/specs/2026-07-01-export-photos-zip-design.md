# 导出周期确认照片为 ZIP 压缩包 — 设计文档

> 日期: 2026-07-01
> 状态: Draft → 待用户审核

## 1. 功能概述

将项目中所有周期的「最终确认」照片导出为一个 ZIP 压缩包，ZIP 内按周期分文件夹，文件夹和 ZIP 文件名使用 `yyyyMMdd-yyyyMMdd` 日期格式。

## 2. 用户决策记录

| 决策项 | 选择 |
|--------|------|
| 导出范围 | 整个项目所有周期，内部按周期分文件夹 |
| 照片内容 | 仅最终确认的照片 (is_final=true) |
| ZIP 内内容 | 仅照片原始文件（不含元数据 JSON/CSV） |
| 日期命名格式 | yyyyMMdd-yyyyMMdd（如 20240115-20240214） |
| 实现方案 | Rust ZIP + 简单 loading（方案 B） |
| 导出按钮位置 | 周期选择页 + 项目概览页 |

## 3. ZIP 结构设计

```
宝宝成长-20240115-20241214.zip          ← ZIP 文件名: {项目名}-{最早周期开始}-{最晚周期结束}
├── 20240115-20240214/                   ← 周期文件夹: {start_date}-{end_date}
│   └── IMG_20240120_143022.jpg          ← 照片保留原始文件名 (original_file_name)
├── 20240215-20240314/
│   └── photo_baby_smile.jpg
├── 20240315-20240414/
│   └── IMG_20240320_091500.jpg
└── 20240415-20241214/                   ← 无最终照片的周期不创建文件夹
```

**规则:**
- 周期没有最终确认照片 → 不创建空文件夹，直接跳过
- 照片原始文件不存在 → 跳过该文件，继续其他周期
- 照片文件名冲突（同一周期多张 final，或不同周期同名） → 在文件名前加 thumbnail_id 前缀避免冲突

## 4. 技术架构

### 4.1 Rust 后端

**新增依赖:**
- `zip = "2"` — Rust ZIP 库，支持创建 ZIP 文件

**新增 Tauri Command:**

```rust
#[tauri::command]
fn export_project_photos(
    project_id: i64,
    save_path: String,    // 前端通过 tauri-plugin-dialog 选择的保存路径
    state: State<AppState>,
) -> Result<ExportPhotosResult, String>
```

**返回结构:**

```rust
#[derive(Serialize)]
struct ExportPhotosResult {
    file_path: String,      // 实际保存的完整路径
    photo_count: usize,     // 成功打包的照片数量
    skipped_count: usize,   // 因文件缺失跳过的数量
    total_size: u64,        // ZIP 文件大小(bytes)
    period_count: usize,    // 包含照片的周期数量
}
```

**命令执行流程:**

1. 获取项目信息（名称）和所有周期列表（按 sort_order 排序）
2. 遍历每个周期：
   - 查询该周期 is_final=true 的 thumbnails
   - 如无 final 照片，跳过该周期
   - 如有 final 照片，读取 original_path 的文件数据
   - 将文件添加到 ZIP 中对应周期文件夹下
3. ZIP 文件先写入临时目录（`std::env::temp_dir()`）
4. 完成后将临时 ZIP 移动/拷贝到用户指定的 `save_path`
5. 返回 ExportPhotosResult

**日期格式化:**
- 使用 `chrono::NaiveDate::parse_from_str` 解析 Period 的 start_date/end_date
- 格式化为 `%Y%m%d` (yyyyMMdd)
- ZIP 文件名: `{project_name}-{earliest_start}-{latest_end}.zip`
- 周期文件夹名: `{start_date_yyyyMMdd}-{end_date_yyyyMMdd}`

**错误处理:**
- 文件不存在: 记录 skipped_count，继续其他周期
- 日期解析失败: 使用原始字符串作为文件夹名（降级策略）
- ZIP 写入失败: 返回错误字符串，前端显示 error toast
- 所有周期均无 final 照片: 返回特殊提示，前端显示 warning toast

### 4.2 前端

**新增函数 (tauriCommands.ts):**

```typescript
export interface ExportPhotosResult {
  file_path: string;
  photo_count: number;
  skipped_count: number;
  total_size: number;
  period_count: number;
}

export async function exportProjectPhotos(
  projectId: number,
  savePath: string
): Promise<ExportPhotosResult> {
  return invoke('export_project_photos', { projectId, savePath });
}
```

**新增组件状态:**

在 `PeriodSelectPage` 和 `ProjectOverviewPage` 中各自添加:
```typescript
const [isExporting, setIsExporting] = useState(false);
```

**导出按钮交互流程:**

1. 用户点击「导出照片」按钮
2. 前端调用 `saveFile(defaultName)` 打开系统保存对话框
   - defaultName 预计算: 需要从 periods 和 project 信息生成
   - 如果用户取消保存对话框 → 不触发导出
3. 获得 savePath 后，设置 `isExporting = true`，显示 loading 状态
4. 调用 `exportProjectPhotos(projectId, savePath)`
5. 成功: `isExporting = false`，显示 success toast（照片数、文件大小、保存路径）
6. 失败: `isExporting = false`，显示 error toast

**导出按钮 UI:**

周期选择页 — 顶部工具栏右侧，品牌渐变按钮:
```html
<button className="btn-gradient" disabled={isExporting}>
  {isExporting ? '正在导出...' : '导出照片'}
</button>
```

项目概览页 — 快捷操作区新增第四个卡片（或替换某个现有卡片位置），与「开始选照片」「生成视频」「历史记录」并列。

**Loading 状态展示:**

按钮文案切换为「正在导出...」，按钮 disabled，无单独弹窗遮罩。

**Success Toast 示例:**
```
✓ 导出成功！8 张照片 · 2.3 MB · 保存至 D:/Downloads/
```

**Warning Toast（无最终照片时）:**
```
⚠ 没有可导出的照片，请先在周期中确认最终照片
```

## 5. 不在范围内 (Out of Scope)

- ❌ 导出进度条/事件推送（方案 B 仅用简单 loading）
- ❌ 导出待选区照片
- ❌ 导出全部照片（未选择的也导出）
- ❌ 导出元数据 JSON/CSV 文件
- ❌ 增量导出/断点续传
- ❌ 自动导出（定时/自动化）

## 6. 依赖变更

### Cargo.toml 新增:
```toml
zip = "2"
```

### 前端无需新增 npm 依赖
已有 `@tauri-apps/plugin-dialog` 的 `save` 函数。

## 7. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src-tauri/Cargo.toml` | 修改 | 添加 `zip = "2"` 依赖 |
| `src-tauri/src/main.rs` | 修改 | 注册 `export_project_photos` 命令 |
| `src-tauri/src/db.rs` | 修改 | 新增 `get_final_thumbnails_for_project()` 方法 |
| `src/utils/tauriCommands.ts` | 修改 | 新增 `exportProjectPhotos()` 函数和 `ExportPhotosResult` 类型 |
| `src/types.ts` | 修改 | 新增 `ExportPhotosResult` 接口 |
| `src/pages/PeriodSelectPage.tsx` | 修改 | 添加导出按钮和 isExporting 状态 |
| `src/pages/ProjectOverviewPage.tsx` | 修改 | 添加导出卡片和 isExporting 状态 |

## 8. 测试要点

- 无最终照片的项目 → warning toast
- 只有部分周期有最终照片 → 正确跳过空周期
- 照片文件不存在（被删除） → skipped_count 正确计数
- 大量照片（50+） → ZIP 生成性能可接受（< 10s）
- 文件名冲突 → 自动添加 ID 前缀避免覆盖
- 用户取消保存对话框 → 不触发导出
- 跨平台路径（Windows 反斜杠） → ZIP 内使用正斜杠
