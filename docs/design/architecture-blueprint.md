# 宝宝成长视频制作工具 — 架构设计蓝图

> 生成时间: 2026-06-29
> 项目定位: 桌面端照片→视频制作工具

---

## 一、技术栈全景

| 层次 | 技术选型 | 版本 |
|------|----------|------|
| 前端框架 | React 18 + TypeScript | ^18.2.0 / ^5.3.0 |
| 构建工具 | Vite 5 | ^5.0.0 |
| 路由 | React Router DOM v6 (HashRouter) | ^6.20.0 |
| 状态管理 | Zustand | ^4.4.0 |
| UI 样式 | Tailwind CSS 3 + 自定义色板 | ^3.3.6 |
| 图标 | Lucide React | ^0.294.0 |
| 桌面框架 | Tauri 2.0 | ^2.0.0 |
| 后端语言 | Rust (Edition 2021) | — |
| 数据库 | SQLite (rusqlite, bundled) | ^0.31 |
| 视频处理 | FFmpeg (嵌入式) | — |
| 包管理 | pnpm | — |

---

## 二、C4 架构视图

### 2.1 Context 级 — 系统边界

```
┌──────────┐    用户操作    ┌─────────────────────┐    文件IO    ┌──────────┐
│   用户    │ ────────────→ │   宝宝成长视频应用    │ ←────────→ │  文件系统  │
│          │ ←─────────── │                     │ ←────────→ │  照片/视频 │
│  家长     │    展示结果    │  React + Rust Tauri │    读写      │  media   │
└──────────┘               └─────────┬───────────┘             └──────────┘
                                      │ SQL
                                      ▼
                               ┌──────────┐
                               │  SQLite  │
                               │  app.db  │
                               └──────────┘
```

**参与方:**
- **用户（家长）** — 创建项目、选择照片、生成视频
- **文件系统** — 源照片/视频目录、应用数据目录（存储拷贝副本）
- **SQLite** — 本地持久化存储
- **FFmpeg** — 外部命令行工具（嵌入式分发）

### 2.2 Container 级 — 主要容器

```
┌──────────────────────────────────────────────────────────┐
│                   Electron-like 桌面进程                   │
│                   (Tauri Runtime)                          │
│  ┌─────────────────────┐    ┌─────────────────────────┐  │
│  │   WebView (Chromium) │    │    Rust Native Process   │  │
│  │   ─────────────────  │    │                         │  │
│  │  React 18 SPA        │    │  Tauri Commands (30+)   │  │
│  │  Router (Hash)       │    │  ├─ db.rs (SQLite CRUD) │  │
│  │  Zustand Store       │    │  ├─ media.rs (扫描)     │  │
│  │  Tailwind CSS        │    │  └─ video.rs (生成)     │  │
│  └─────────────────────┘    └─────────────────────────┘  │
│                           ↕ Tauri invoke/listen API      │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Tauri Plugins (Dialog/Fs/Shell)         │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2.3 Component 级 — 前端组件分解

```
Pages (路由层)
├── HomePage                    ← 项目列表/概览
├── BabySetupPage               ← 宝宝信息管理
├── CreateProjectPage            ← 五步向导 (Step1~5)
├── ProjectPage                  ← 项目壳 (嵌套路由)
│   ├── ProjectOverviewPage      ← 项目概览
│   ├── PeriodSelectPage         ← 核心: 周期+照片选择
│   ├── VideoGeneratePage        ← 视频生成配置
│   └── HistoryPage              ← 历史记录
│
Components (UI 组件)
├── Layout                      ← 侧边栏布局
├── WizardSidebar               ← 向导侧边栏
├── PhotoContextMenu            ← 右键菜单
├── VideoFrameSettingsModal     ← 抽帧设置弹窗
├── VideoFrameViewerModal       ← 视频帧查看器
├── ScanLogPanel                ← 扫描日志面板
└── ErrorBoundary               ← 错误边界

State (Zustand Stores)
├── useAppStore                 ← 全局运行时状态 (项目/周期/照片/日志)
└── useCreateProjectStore       ← 创建项目向导状态 (独立)

Utils
├── tauriCommands.ts            ← Tauri 命令封装 (30+ invoke 函数)
└── download.ts                 ← JSON 文件下载

Types (src/types/index.ts)
└── 13 个 TypeScript 接口定义
```

### 2.4 Component 级 — 后端 Rust 模块

```
main.rs (入口 + Command 注册)
├── db.rs — 数据访问层 (rusqlite)
│   ├── 7 张数据表 DDL
│   ├── Baby CRUD
│   ├── Project CRUD
│   ├── Period CRUD (+ 自动生成逻辑)
│   ├── Photo CRUD (+ 批量插入事务)
│   ├── Video CRUD (+ 批量插入事务)
│   ├── VideoFrame CRUD
│   └── ExportRecord CRUD
│
├── media.rs — 媒体扫描模块
│   ├── WalkDir 递归扫描
│   ├── 日期正则提取 (文件名)
│   ├── 格式检测 (Photo/Video)
│   ├── 图片尺寸解析 (JPEG/PNG/WebP/GIF/BMP 原生读取)
│   ├── 文件去重 + 复制到项目目录
│   ├── 周期匹配
│   ├── 扫描日志 emit → 前端
│   └── 日志持久化 (scan-log.json)
│
└── video.rs — 视频处理模块
    ├── FFmpeg 路径自动发现
    ├── ffprobe 视频信息获取
    ├── FFmpeg filter_complex 构建
    ├── 成长视频生成 (照片序列 → 视频)
    ├── 视频截图/抽帧
    └── 进度追踪 (lazy_static HashMap)
```

---

## 三、数据流架构

### 3.1 核心业务流程

```
创建项目 → 扫描文件夹 → 周期生成 → 照片选择 → 视频生成

[Step 1: 选宝宝]
  用户选宝宝 → Zustand → 保存

[Step 2: 填项目信息]
  名称+周期天数+特殊日期 → Zustand

[Step 3: 扫文件夹]
  前端 invoke scan_media_folder
    → Rust: WalkDir 递归扫描
    → 正则提取日期 → 匹配周期
    → 复制文件到项目目录 (UUID前缀防冲突)
    → 原生解析图片尺寸 (不依赖外部库)
    → 批量插入 SQLite (事务)
    → emit scan://log → 前端实时显示

[Step 4: 照片选择]
  用户浏览周期列表 → 加载照片
  invoke getImageBase64 → base64 data URL → img 渲染
  is_selected → is_final → 单周期单选

[Step 5: 视频生成]
  前端 config (分辨率/fps/转场/音乐)
    → invoke generate_growth_video
    → Rust: 构建 FFmpeg filter_complex
    → Command::new("ffmpeg").args(...)
    → PROGRESS_MAP 跟踪进度
```

### 3.2 数据持久化模型

```
babies (1) ──◎ projects (N)
                │
                ├───(1) periods (N)
                │           │
                │           ├───(N) photos
                │           ├───(N) videos
                │           └───(N) video_frames
                │
                └───(N) export_records

所有 ON DELETE CASCADE
```

---

## 四、架构决策记录 (ADRs)

### ADR-001: Tauri 而非 Electron

**背景:** 需要一个桌面应用来访问本地文件系统、调用 FFmpeg 命令行工具。Electron 和 Tauri 是两大主流选择。

**决策:** 选用 Tauri 2.0 + Rust 后端。

**原因:**
- 应用体积: Tauri ~5-10MB vs Electron ~70-150MB
- 内存占用: WebView 原生共享 vs 独立 Chromium 实例
- Rust 后端天然适合文件 I/O 和 FFmpeg 调用
- rusqlite bundled 模式零外部依赖

**代价:**
- 需要掌握 Rust 语言
- Tauri 生态不如 Electron 丰富
- WebView 跨平台一致性需自行处理

### ADR-002: 文件拷贝策略而非引用

**背景:** 扫描文件夹时面对照片源文件，有两种策略：保持引用 or 拷贝到应用目录。

**决策:** 完整拷贝到应用数据目录（带 UUID 前缀）。

**原因:**
- 源文件可能被移动/删除/重命名
- 避免路径失效导致应用崩溃
- 删除项目时可一并清理

**代价:**
- 磁盘占用翻倍（原片 + 副本）
- 大视频文件拷贝耗时较长
- 不支持增量扫描（当前是全量扫描+去重）

### ADR-003: Zustand 而非 Redux/MobX

**背景:** 状态管理方案选择。

**决策:** Zustand (单 store + 独立向导 store)。

**原因:**
- 最小样板代码，适合单开发者项目
- 内置支持 async actions
- TypeScript 友好

**代价:**
- 大型项目可能需要 Reusable States 拆分
- 无中间件生态系统

### ADR-004: 原生图片尺寸解析

**背景:** 需要在不引入大型图像处理库的情况下获取照片尺寸。

**决策:** 手动解析 JPEG/PNG/WebP/GIF/BMP 文件头。

**原因:**
- `image` crate (Rust 官方图像库) 编译时间长、二进制膨胀
- 只需读取文件头中的尺寸信息，不需要解码像素
- 零额外依赖

**代价:**
- 每种格式需手写解析器 (~200行/格式)
- 不支持所有子格式（如 HEIC/HEIF 只检测扩展名）
- 容易因畸形文件崩溃（虽然有安全守卫）

---

## 五、当前项目的核心难点与分析

### 难点 1: 大规模文件扫描的性能

| 维度 | 现状 | 风险 |
|------|------|------|
| 扫描方式 | WalkDir 递归遍历，单线程 | 10万+文件时显著变慢 |
| 图片尺寸 | 逐个文件原生解析 | IO 密集 |
| 数据库写入 | 已有批量事务 | ✅ 良好 |
| 文件复制 | 顺序逐文件拷贝 | 大量小文件时成为瓶颈 |

**解决方案:**
1. 使用 `rayon` (已在依赖中) 并行化 WalkDir 遍历和文件处理
2. 图片尺寸读取可以使用 `image` crate 的 `image_dimensions()` API 减少手写解析
3. 文件拷贝使用异步 IO (`tokio::fs`) 或至少 buffered copy
4. 增量扫描：记录文件 hash/mtime，只处理变更文件

### 难点 2: 大量 base64 图片的内存管理

| 维度 | 现状 | 风险 |
|------|------|------|
| 加载策略 | 分批 5 张，Promise.all | ✅ 部分缓解 |
| 缓存 | loadedImages Record<string> | 照片多了内存爆炸 |
| 释放 | 切换周期时 `setLoadedImages({})` | ✅ 有释放 |
| 大文件 | 无大小限制 | 高分辨率 HEIC → base64 膨胀 33% |

**解决方案:**
1. 增加图片懒加载 + 虚拟滚动 (react-window)，只显示视口内图片
2. 限制最大缓存数量 (LRU 淘汰)
3. 对超大图片（>10MB）做缩略图预处理
4. 考虑使用 `URL.createObjectURL` + Tauri asset protocol 替代 base64

### 难点 3: 视频生成的同步阻塞

| 维度 | 现状 | 风险 |
|------|------|------|
| 执行方式 | `Command::status()` 同步等待 | ❌ 严重问题 |
| 进度追踪 | PROGRESS_MAP，仅 5→100 | 粗略，非实时更新 |
| UI 响应 | `isGenerating` 控制 loading 态 | FFmpeg 期间前端仍可点击 |
| 失败恢复 | 无，只能重试 | 30分钟生成任务失败无补偿 |

**解决方案:**
1. `tokio::spawn` 异步执行 FFmpeg + `Command::spawn()`
2. 解析 FFmpeg stderr 实时进度（`-progress pipe:1`）
3. 前端通过 `listen('video://progress')` 事件接收实时进度
4. 失败时保留中间产物，支持断点续传

### 难点 4: 数据库并发安全

| 维度 | 现状 | 风险 |
|------|------|------|
| 锁机制 | `Arc<Mutex<Database>>` | 全局写锁 |
| 并发命令 | scan + video 可能并发 | 死锁风险 |
| WAL 模式 | 未启用 | 并发读阻塞写 |

**解决方案:**
1. 启用 SQLite WAL 模式: `PRAGMA journal_mode=WAL`
2. 替换 `Mutex` 为 `RwLock` 提升并发读性能
3. 或用 `r2d2` 连接池管理数据库连接

### 难点 5: 照片选择的状态一致性

| 维度 | 现状 | 风险 |
|------|------|------|
| 双重状态 | `is_final` on Photo + `selected_photo_id` on Period | 可能不一致 |
| 取消逻辑 | 多处 `cancel_final` 分散在各组件 | 原子性问题 |
| 跨周期 | 无约束（但业务要求每周期1张） | 靠应用层保障 |

**解决方案:**
1. 数据库层面加 UNIQUE 约束: `(period_id)` on is_final=1
2. 将 `selected_photo_id` 设为 Period 表的唯一真实来源，Photo 表的 `is_final` 变为派生属性
3. 使用数据库事务保证两步操作原子性

### 难点 6: HEIC/HEIF 格式支持缺失

| 维度 | 现状 | 风险 |
|------|------|------|
| 扩展名检测 | ✅ 已列出 | 能识别 |
| 尺寸解析 | ❌ 未实现 | `get_image_dimensions` 返回 (0,0) |
| 文件拷贝 | ✅ 无条件拷贝 | 文件能存 |
| 显示 | ⚠️ WebView 支持有限 | Safari OK, Chrome 不行 |

**解决方案:**
1. 引入 `libheif` Rust crate 解码 HEIC 为 JPEG
2. 或在拷贝时转换格式: `cargo install heif-convert` 作为子进程

---

## 六、待完成功能路线图

```
P0 (阻塞发布)
├── 视频生成页面: 实际调用 generateGrowthVideo (目前是模拟)
├── 视频生成异步化: tokio spawn + 实时进度
└── 创建项目完整 UI 流程 (目前已有 Wizard 骨架)

P1 (用户体验)
├── 历史记录页面实现
├── 视频播放器集成 (Tauri Shell open / 内嵌 video 标签)
├── 更多转场效果 (slide, zoom 目前是 fade 占位)
└── 字幕叠加

P2 (高级特性)
├── HEIC 完整支持
├── 批量导入已有项目 (恢复模式)
├── 视频压缩/导出质量调节
└── 多宝宝对比时间线
```

---

## 七、质量属性评估

| 属性 | 评分 | 说明 |
|------|------|------|
| **可维护性** | B+ | 模块划分清晰，但 db.rs 单文件过长 (~1000行) |
| **可扩展性** | B | 添加新图片格式需改动 media.rs 多个函数 |
| **性能** | B- | 扫描和文件拷贝是瓶颈，视频生成阻塞 |
| **可靠性** | B | 缺少事务回滚覆盖、错误处理不够细粒度 |
| **安全性** | B | 路径 traversal 未校验 (用户可控 folder_path) |
| **可测试性** | C | 无测试框架，Rust 侧纯函数可测试但未写 |

---

## 八、推荐改进优先级

1. **立即**: 视频生成真正调用 FFmpeg 并处理 stderr 实时进度
2. **本周**: 给 Rust 代码加上单元测试 (media.rs 的日期提取、格式检测逻辑)
3. **本月**: 重构 db.rs 为分层架构 (repository 模式)，单文件拆分
4. **下版本**: 引入虚拟滚动 + 缩略图缓存，解决大图内存问题
5. **长期**: 考虑迁移到 libheif 完整支持 iOS 照片格式

---

## 九、六大难点详细设计方案

### 难点 1: 大规模文件扫描并行化

#### 问题分析

当前 `scan_media_folder` 使用 `WalkDir::new(folder).into_iter().filter_map(|e| e.ok())` 单线程遍历。面对一个含 50,000 张照片的文件夹,每条文件需要:
1. 路径检查 (`is_file()`)
2. 扩展名匹配（6 种图片格式 + 9 种视频格式的逐一遍历）
3. 正则提取日期
4. 文件 IO 读取尺寸（JPEG/PNG/WebP/GIF/BMP 各一个文件头解析）
5. `fs::copy`（64KB buffer 顺序写入）
6. `HashSet::contains` 查重

总计 50,000 次串行 IO 操作,保守估计耗时 5-10 分钟。

#### 选定方案: rayon + par_bridge (v1.0)

基于用户投票结果,采用以下方案:
- **并行化**: rayon 线程池,在 WalkDir 上使用 `par_bridge()` 并行处理
- **视频信息**: 保持现有 ffprobe 方式
- **进度反馈**: 每处理 50 个文件上报一次

#### 详细实现

```
Rust 后端改动:

1. Cargo.toml 新增 cfg-if 依赖（用于条件编译）
   cfg-if = "1.0"

2. scan_media_folder 重构:
   
   Phase 1 (现有): 单线程扫描,收集所有元数据
     - 扩展名匹配 → 用 HashSet::from(...) 替代数组遍历
     - 正则提取日期 (不变)
     - 文件尺寸解析 (不变)
     - 复制文件 (不变)
     - 查重 (不变)
   
   Phase 2: 并行化处理
     将 walkdir 迭代改为:
       WalkDir::new(folder)
         .into_iter()
         .par_bridge()
         .filter_map(process_entry)  // 每个文件独立处理
     process_entry 是纯函数,无共享状态
   
   Phase 3: 并行进度上报
     每 batch_size (默认 50) 个文件处理完,emit 一次进度
     用 channel 收集每个 thread 的结果,最后 merge

前端改动:
- scan_media_folder Tauri command 加 emit_scan_progress 事件
- 前端 ScanLogPanel 增加"已处理 X/Y 文件"计数器
- 日志面板增加"取消"按钮,通过 AtomicBool 传递

性能目标:
  1000 文件: ~5s (vs 当前 ~30s) → 6x 提升
  10000 文件: ~30s (vs 当前 ~5min) → 10x 提升
  50000 文件: ~2min (vs 当前 ~25min) → 12x 提升
```

#### 预期收益与风险

| 指标 | 当前 | 改造后 | 提升 |
|------|------|--------|------|
| 1000 文件扫描 | ~30s | ~5s | 6x |
| 10000 文件扫描 | ~5min | ~30s | 10x |
| 50000 文件扫描 | ~25min | ~2min | 12x |

**代价与风险:**
- **并行 IO 竞争**: NVMe SSD 影响不大,HDD 上可能更慢。增加 `batch_size` 配置降低并行度可缓解
- **取消语义**: 用 `AtomicBool` + rayon `Interrupt` trait 实现优雅取消
- **测试复杂度**: 并行代码单元测试用 `rayon::current_num_threads()` 固定线程数

### 难点 2: 图片内存管理虚拟滚动方案

#### 问题分析

当前流程：用户在 `PeriodSelectPage` 选择一个周期 → 加载该周期所有照片 → `tauriCommands.getImageBase64()` 转为 base64 → 存入 Zustand `loadedImages` → 渲染到 `<img>` 标签。

假设一个周期有 500 张照片，平均每张 5MB（iPhone 原图）：
- 原始文件大小: 500 × 5MB = 2.5GB
- base64 膨胀后: 2.5GB × 1.33 = 3.3GB
- 即使分批加载，Zustand 缓存也始终持有 5 张 × 5MB × 1.33 = 33MB 的 base64 数据

但实际问题是：**base64 data URL 本身就有开销** — 浏览器需要将 string 解析为 image binary 再渲染。5MB 原图 → 6.7MB base64 string → 6.7MB decoded → 渲染。这个过程中内存峰值可达 20MB/张。

#### 详细设计方案

```
方案 A: 虚拟滚动 + 按需加载（推荐）

使用 react-window 的 FixedSizeList 替代普通 div 列表:

import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={filteredPhotos.length}
  itemSize={180}  // 每张图片卡片高度
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <PhotoCard
        photo={photos[index]}
        imageUrl={getOptimizedUrl(photos[index])}
      />
    </div>
  )}
</FixedSizeList>

getOptimizedUrl 策略:
- 如果照片 < 2MB: 走现有 base64 流程
- 如果照片 2-5MB: 缩略图预处理 → resize 到宽 800px → JPEG quality 85
- 如果照片 > 5MB: 仅显示占位符 + 点击后再加载

具体实现:

// Rust 新增 Tauri Command
#[tauri::command]
async fn get_thumbnail(
  file_path: String,
  max_width: i32,
  quality: i32,
) -> Result<String, String> {
  // 使用 image crate resize + jpeg encode
  // 或直接调用 ffmpeg thumbnail
  use image::load_with_format(...)
    .resize(max_width, max_width * ratio, ImageFilters::Nearest)
    .to_rgba8()
    .save_with_format(...)
}

// 前端缩略图缓存
const thumbnailCache = new Map<string, string>();
const MAX_CACHE_SIZE = 20;

function getOrGenerateThumbnail(photo) {
  if (thumbnailCache.has(photo.file_path)) {
    return thumbnailCache.get(photo.file_path);
  }
  // 异步生成
  return tauriCommands.getThumbnail(photo.file_path, 400, 85)
    .then(url => {
      if (thumbnailCache.size >= MAX_CACHE_SIZE) {
        const firstKey = thumbnailCache.keys().next().value;
        URL.revokeObjectURL(firstKey);
        thumbnailCache.delete(firstKey);
      }
      thumbnailCache.set(photo.file_path, url);
      return url;
    });
}


方案 B: Tauri Asset Protocol（备选）

不使用 base64，而是将项目目录注册为 Tauri 静态资源路径:

// tauri.conf.json
{
  "bundle": {
    "resources": ["./data/projects/*"]
  },
  "allowlist": {
    "fs": {
      "scope": [
        "$DATA/projects/*/photos/*"
      ]
    }
  }
}

// 前端直接使用:
<img src={`asset:/projects/${projectId}/photos/${uuid}_filename.jpg`} />

优势: 零内存开销，浏览器直接读取文件
劣势: Tauri 2.0 的 asset protocol 配置复杂，需要额外安全配置
```

#### 内存占用对比

| 方案 | 500 张照片周期 | 内存峰值 | 加载速度 |
|------|---------------|---------|---------|
| 当前 (base64 全量) | 全部加载 | 3.3GB+ | 很慢 |
| 当前 (分批 5 张) | 只显示 5 张 | ~33MB | 可接受 |
| 方案 A: 虚拟滚动 + 20 张缓存 | 视口内可见 | ~150MB | 更快 |
| 方案 B: Asset Protocol | 所有照片 lazy-load | ~50MB | 最快 |

#### 实施计划

1. 优先做方案 A（改动小，效果立竿见影）
2. 中期评估是否需要方案 B（取决于性能监测数据）
3. 同时加入图片加载错误边界 — 加载失败的图片显示占位图而非崩溃

### 难点 3: 视频生成异步化详细设计

这是最关键的 P0 难题。当前代码是同步阻塞的，需要完整重构。

#### 当前问题链路

```
前端: generateGrowthVideo(config) → 模拟 setTimeout → 假进度条
      ↓
Rust: #[tauri::command] fn generate_growth_video(...) 
      → video::generate_growth_video()
      → Command::new("ffmpeg").args(...).status()  // 同步等待！
      → 前端完全不知道进度
```

#### 详细设计方案

```
架构变更: 从同步调用 → 异步任务队列 + 事件推送

===== Rust 后端改动 =====

1. 添加任务管理器模块 video/task_manager.rs

use std::sync::{Arc, Mutex};
use tokio::task::JoinHandle;
use tokio::sync::broadcast;

struct VideoGenerationTask {
    handle: JoinHandle<Result<ExportRecord, String>>,
    progress_tx: broadcast::Sender<i32>,
    task_id: String,
    status: TaskStatus,  // Pending, Running, Success, Failed
}

enum TaskStatus {
    Pending,
    Running,
    Success(ExportRecord),
    Failed(String),
}

struct TaskManager {
    tasks: Mutex<HashMap<String, VideoGenerationTask>>,
}

impl TaskManager {
    async fn submit_task(
        &self,
        project_id: i64,
        config: VideoConfig,
        output_path: String,
        progress_rx: broadcast::Receiver<i32>,
    ) -> String {
        let task_id = uuid::Uuid::new_v4().to_string();
        let (tx, _) = broadcast::channel(32);  // 进度缓冲区

        let handle = tokio::spawn(async move {
            // 实际调用 video::generate_growth_video_async
            let record = generate_growth_video_async(
                &db, project_id, &config, &output_path, tx.clone(),
            ).await?;
            ExportRecord { id: task_id.parse()?, ..., status: "success".into() }
        });

        // 存储任务
        self.tasks.lock().unwrap().insert(task_id, VideoGenerationTask {
            handle, progress_tx: tx, task_id: task_id.clone(), status: TaskStatus::Pending,
        });

        // 订阅进度
        progress_rx  // 返回给调用者
        task_id  // 返回给前端
    }
}

2. FFmpeg 异步执行: video/generation.rs

pub async fn generate_growth_video_async(
    db: &Database,
    project_id: i64,
    config: &VideoConfig,
    output_path: &str,
    progress_tx: broadcast::Sender<i32>,
) -> Result<ExportRecord, String> {
    let photos = get_final_photos_for_project(db, project_id)?;
    
    let ffmpeg_args = generate_ffmpeg_command(&photos, config, output_path);

    // 关键: 使用 tokio::process::Command 代替 std::process::Command
    let mut child = tokio::process::Command::new(get_ffmpeg_path())
        .args(&ffmpeg_args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("FFmpeg启动失败: {}", e))?;

    // 解析 stderr 获取实时进度
    if let Some(ref mut stderr) = child.stderr {
        let reader = stderr.try_clone().unwrap();
        let progress_handle = tokio::spawn(async move {
            let mut buf_reader = BufReader::new(reader);
            let mut line = String::new();
            loop {
                line.clear();
                match buf_reader.read_line(&mut line) {
                    Ok(0) => break,  // EOF
                    Ok(_) => {
                        // 解析 "time=00:01:23.45 fps=30.0 speed=2.5x" 格式
                        if let Some(time_str) = parse_ffmpeg_time(&line) {
                            let progress = calc_progress(time_str, total_duration);
                            let _ = progress_tx.send(progress);
                        }
                    }
                    Err(e) => break,
                }
            }
        });

        let status = child.wait().await?;
        progress_handle.abort();

        if status.success() {
            // 更新数据库
            Ok(record)
        } else {
            Err("FFmpeg 返回非零退出码".into())
        }
    }
}

3. Tauri 命令变更

#[tauri::command]
async fn start_video_generation(
    project_id: i64,
    config: VideoConfig,
    output_path: String,
    state: State<AppState>,
) -> Result<String, String> {  // 返回 task_id
    let progress_rx = task_manager.submit_task(project_id, config, output_path).await?;
    Ok(task_id)
}

#[tauri::command]
fn listen_video_progress(
    task_id: String,
    state: State<AppState>,
) -> Result<broadcast::Receiver<i32>, String> {
    // 注意: Tauri 2.0 不直接支持返回 broadcast::Receiver
    // 需要用 tauri::Emitter 的 emit 替代
    Ok(task_manager.get_progress_channel(&task_id)?.subscribe())
}

===== 前端改动 =====

// VideoGeneratePage.tsx 改造

const handleGenerate = async () => {
  // 1. 提交生成任务
  const taskId = await generateGrowthVideo(projectId, config, outputPath);
  
  // 2. 监听进度事件
  const unlisten = await listen('video://progress', (event: Payload) => {
    const { task_id, progress } = event.payload;
    if (task_id === taskId) {
      setGenerationProgress(progress);
    }
  });
  
  // 3. 轮询完成状态（Tauri 2.0 不支持直接返回 Receiver，用 polling 替代）
  const checkCompletion = setInterval(async () => {
    const status = await getGenerationStatus(taskId);
    if (status === 'success') {
      clearInterval(checkCompletion);
      unlisten();
      setGenerationProgress(100);
      alert('视频生成完成！');
    } else if (status === 'failed') {
      clearInterval(checkCompletion);
      unlisten();
      alert('视频生成失败');
    }
  }, 1000);
};


==== 替代方案: 使用 Tauri 事件系统（更简单，推荐） ====

因为 Tauri 2.0 不支持返回 Channel 类型，最简单的方案是:

// Rust: 直接用 window.emit 推送到前端
pub async fn generate_growth_video_async(
    db: &Database,
    project_id: i64,
    config: &VideoConfig,
    output_path: &str,
    window: tauri::Window,
) -> Result<ExportRecord, String> {
    let mut child = tokio::process::Command::new(ffmpeg_path)
        .args(args)
        .stderr(std::process::Stdio::piped())
        .spawn()?;

    if let Some(ref mut stderr) = child.stderr {
        // 实时解析并 emit
        let reader = BufReader::new(stderr.try_clone().unwrap());
        for line in reader.lines() {
            let line = line?;
            if line.contains("time=") {
                let progress = calc_progress_from_line(&line);
                let _ = window.emit("video://progress", ProgressEvent { progress });
            }
        }
    }

    child.wait().await?
}

// 前端:
useEffect(() => {
  const unlisten = listen<'ProgressEvent'>('video://progress', (event) => {
    setGenerationProgress(event.payload.progress);
  });
  return () => unlisten();
}, []);
```

#### 数据流变更对比

```
Before:
  前端 ──invoke──→ Rust: Command::status() ──等待──→ Rust 返回 ──→ 前端
  ↑                                    ↓
  └──────────── 完全阻塞，进度虚假 ─────┘

After:
  前端 ──invoke(start_video_gen)──→ Rust: tokio::spawn(Command) ──→ 立即返回 task_id
  ↓                                                                        ↓
  ←── listen('video://progress') ←──── FFmpeg stderr parsing ←────────────┘
```

### 难点 4: 数据库并发安全改造

#### 详细方案

```
// main.rs 改动

use std::sync::Arc;
use tokio::sync::RwLock;  // 替换 Mutex

// 1. Database 结构加 init_wal 方法
impl Database {
    pub fn init(&mut self) -> Result<()> {
        let conn = Connection::open(Self::get_db_path())?;
        // 关键: 启用 WAL 模式
        conn.pragma_update(None, "journal_mode", "WAL")?;
        // 提升并发读性能
        conn.pragma_update(None, "busy_timeout", "5000")?;  // 5秒超时
        conn.pragma_update(None, "wal_autocheckpoint", "1000")?;
        
        self.conn = Some(conn);
        self.create_tables()?;
        Ok(())
    }
}

// 2. AppState 改用 RwLock
struct AppState {
    db: Arc<RwLock<Database>>,  // 原来是 Arc<Mutex<Database>>
}

// 3. 所有 Tauri 命令的锁获取方式变更
#[tauri::command]
async fn scan_media_folder(
    project_id: i64,
    folder_path: String,
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<media::ScanResult, String> {
    let db = state.db.read().await;  // 读锁，不阻塞其他读
    media::scan_media_folder(&db, project_id, &folder_path, window)
}

// 写操作仍然用写锁
#[tauri::command]
async fn set_final_photo(
    period_id: i64,
    photo_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut db = state.db.write().await;  // 排他锁
    db.set_final_photo(period_id, photo_id)
}
```

#### 读写锁对比

| 操作 | 当前 (Mutex) | 改造后 (RwLock) | WAL 模式 |
|------|-------------|----------------|---------|
| 100 并发读照片 | 串行 | 并行 | 并行 |
| 写 + 读 | 互斥 | 读不阻塞写，写阻塞读 | 读不阻塞读 |
| 扫描并发生成 | ❌ 死锁 | ⚠️ 写锁冲突 | ✅ WAL 分离 |

### 难点 5: 状态一致性与约束加固

#### 当前问题

```sql
-- Photos 表
is_selected INTEGER NOT NULL DEFAULT 0  -- 用户点了哪个
is_final INTEGER NOT NULL DEFAULT 0     -- 是否是最终选定

-- Periods 表
selected_photo_id INTEGER               -- 最终选定的照片ID

-- 这三个字段可能不一致!
-- 例如: Photo.is_final=1 但 Period.selected_photo_id=NULL
```

#### 详细方案

```
// db.rs 改动: 添加约束并重构 set_final_photo

pub fn set_final_photo(&self, period_id: i64, photo_id: i64) -> Result<()> {
    let conn = self.get_conn();
    
    // 在一个事务中原子执行
    let txn = conn.transaction()?;
    
    // Step 1: 取消该周期内所有照片的 is_final
    txn.execute(
        "UPDATE photos SET is_final = 0, is_selected = 0 WHERE period_id = ?1",
        params![period_id],
    )?;
    
    // Step 2: 设置选中照片的 is_final 和 is_selected
    txn.execute(
        "UPDATE photos SET is_final = 1, is_selected = 1 WHERE id = ?1",
        params![photo_id],
    )?;
    
    // Step 3: 同步更新 Periods 表的 selected_photo_id
    txn.execute(
        "UPDATE periods SET selected_photo_id = ?1 WHERE id = ?2",
        params![photo_id, period_id],
    )?;
    
    txn.commit()?;
    Ok(())
}

// DDL 改造: 添加 CHECK 约束防止逻辑冲突
conn.execute(
    "ALTER TABLE photos ADD CONSTRAINT chk_photo_period_selection
     CHECK (is_final = 0 OR (period_id IN (SELECT id FROM periods WHERE selected_photo_id = photos.id)))",
    [],
)?;

// 或者更简单的: 在 photos 表加唯一索引（每周期最多一个 final）
conn.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_period_final 
     ON photos(period_id) 
     WHERE is_final = 1",
    [],
)?;

// 前端 TypeScript 类型也需调整
// types/index.ts
export interface Photo {
  // is_final 变为派生属性，不再直接编辑
  // 只操作 setFinalPhoto(periodId, photoId)
}

// Store 变更
const setFinalPhoto = (periodId: number, photoId: number) => {
  setFinalPhotoCommand(periodId, photoId);  // Tauri invoke
  // 自动刷新对应 period 的 photos 列表
  invalidatePeriodPhotos(periodId);
};
```

### 难点 6: HEIC 支持完整方案

#### 方案对比

```
方案 A: libheif (推荐，纯 Rust)
━━━━━━━━━━━━━━━━━━━━━━━━━━
+ 编译即得，无需外部依赖
+ 原生解码，性能优秀
+ 可集成到现有 media.rs 流程
- heif-rs crate 维护不活跃（最近 commit 2 年前）
- 需要链接 libheif C 库（构建时依赖）

方案 B: heif-convert 子进程 (快速实现)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+ 零 Rust 代码改动
+ 利用现成的 heif-convert 工具
- 每次 HEIC 需要 spawn 子进程，性能差
- 需要分发 heif-convert 二进制

方案 C: ffmpeg 转换 (最通用)
━━━━━━━━━━━━━━━━━━━━━━━━━━
+ ffmpeg 已经必须安装
+ 支持所有格式
- 调用链过长（HEIC → JPEG → base64）
- 依赖已存在的 ffmpeg 安装

方案 D: 降级体验 (最低成本)
━━━━━━━━━━━━━━━━━━━━━━━━━━
+ 零开发成本
- 用户看到 HEIC 照片只有文件名和占位图标
```

#### 推荐方案: A + D 组合

```
// media.rs: get_image_dimensions 新增 HEIC 分支

fn get_heic_dimensions(path: &Path) -> (i64, i64) {
    // 检测 libheif 是否可用
    match unsafe { heif_context_open(path.to_str().unwrap()) } {
        Ok(ctx) => {
            let handle = unsafe { heif_context_get_primary_image(ctx) };
            let info = unsafe { heif_image_handle_get_info(handle) };
            let width = info.width;
            let height = info.height;
            unsafe { heif_release_handle(handle) };
            unsafe { heif_context_close(ctx) };
            (width as i64, height as i64)
        }
        Err(_) => (0, 0),
    }
}

// Cargo.toml 新增:
heif-rs = { version = "0.1", optional = true }

// 编译特征控制
[features]
default = []
heic-support = ["heif-rs"]

// 前端兼容:
// 获取到 (0,0) 时显示警告标签: "HEIC 格式，需要安装 libheif 才能预览"
```

---

## 十、技术债务清单

| 编号 | 债务项 | 影响 | 优先级 | 预计工时 |
|------|--------|------|--------|---------|
| TD-001 | 视频生成同步阻塞 | 核心体验 | P0 | 2天 |
| TD-002 | HEIC 照片尺寸返回 (0,0) | iOS 用户 | P1 | 1天 |
| TD-003 | db.rs ~1000 行单文件 | 可维护性 | P2 | 半天 |
| TD-004 | 无单元测试 | 回归风险 | P1 | 持续 |
| TD-005 | 转场效果 placeholder (zoom/slide = fade) | 产品体验 | P2 | 2天 |
| TD-006 | 路径 traversal 未校验 | 安全性 | P1 | 半天 |
| TD-007 | 文件复制无进度反馈 | 扫描体验 | P2 | 半天 |
| TD-008 | progress bar 前端模拟 | 信任度 | P0 | 2天 |
