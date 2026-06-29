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
