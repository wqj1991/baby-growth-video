# 数据库并发安全改造 — 设计规格

> 对应：架构蓝图 难点 4
> 日期：2026-06-29
> 状态：已确认

---

## 背景

当前数据库层有一个共享的 `rusqlite::Connection`，由全局 `Arc<Mutex<Database>>` 保护。存在三个问题：

1. **WAL 未启用** — SQLite 默认 DELETE 日志模式，读写互斥
2. **外键未强制执行** — schema 定义了 `ON DELETE CASCADE` 但缺 `PRAGMA foreign_keys = ON`，外键约束形同虚设
3. **锁持有时间过长** — `scan_media_folder` 在 `spawn_blocking` 内一锁到底，文件复制等慢 IO 也持着锁

## 为什么不用 RwLock

蓝图原方案建议用 `tokio::sync::RwLock` 替换 `Mutex`，但存在编译期约束：

```
rusqlite::Connection: Send ✅ | Sync ❌
spawn_blocking 要求闭包是 Send
RwLockReadGuard<T>: Send 当且仅当 T: Sync
→ Connection 不满足 Sync → 编译失败
```

`Mutex<T>` 只要求 `T: Send`，因为排他访问不涉及共享引用。当前架构正确。

## 方案：Mutex + WAL + 锁粒度优化

### 改动 1：db.rs — 初始化 PRAGMA

在 `Database::init()` 的 `Connection::open` 之后、`create_tables` 之前加入：

```rust
conn.pragma_update(None, "journal_mode", "WAL")?;
conn.pragma_update(None, "foreign_keys", "ON")?;
conn.pragma_update(None, "busy_timeout", "5000")?;
conn.pragma_update(None, "synchronous", "NORMAL")?;
```

| Pragma | 作用 |
|--------|------|
| `journal_mode=WAL` | 读写不互斥——核心收益 |
| `foreign_keys=ON` | 修复外键约束从未执行的 bug |
| `busy_timeout=5000` | 写冲突时等 5 秒而不是立即报错 |
| `synchronous=NORMAL` | WAL 模式下安全降低同步级别，提升写性能 |

### 改动 2：main.rs — 缩短锁持有时间

`scan_media_folder` 和 `scan_period_folder` 两条 async command 里，`spawn_blocking` 的闭包当前是：

```rust
let db = db.lock()...;
media::scan_media_folder(&db, project_id, &folder_path, window)
```

整个扫描过程（包括 `fs::copy` 文件复制）都持着数据库锁。改为分阶段：

```rust
// Phase 1: 遍历文件系统（无锁）
let scan_entries = media::collect_media_entries(&folder_path)?;

// Phase 2: 写入数据库（持锁，毫秒级）
let db = db.lock()...;
let photos = media::insert_scanned_photos(&db, project_id, &scan_entries.photo_entries)?;
let videos = media::insert_scanned_videos(&db, project_id, &scan_entries.video_entries)?;
drop(db);

// Phase 3: 复制文件（无锁，耗时的 IO）
media::copy_media_files(&scan_entries, &project_dir)?;
```

scan_period_folder 同理。

### 改动 3：media.rs — 函数拆分

将原来混合 IO+DB 的大函数拆成三个职责清晰的函数：

```
collect_media_entries(folder_path) → ScanEntries
    ├── WalkDir 遍历
    ├── 正则日期提取
    ├── 格式检测
    └── 图片尺寸解析

insert_scanned_photos(&db, project_id, entries) → Vec<Photo>
    └── 批量 INSERT（事务）

insert_scanned_videos(&db, project_id, entries) → Vec<Video>
    └── 批量 INSERT（事务）

copy_media_files(entries, project_dir)
    └── fs::copy 每个文件到项目目录
```

### 不改的部分

- `AppState { db: Arc<Mutex<Database>> }` 结构不变
- 所有 Tauri command 签名不变
- 前端零改动
- `get_conn(&self)` 内部 API 不变
- 数据库表结构不变

## 验收标准

| # | 标准 | 验证方式 |
|---|------|---------|
| 1 | `PRAGMA journal_mode` 返回 `wal` | 启动后在代码中查询 pragma |
| 2 | `PRAGMA foreign_keys` 返回 `1` | 同上 |
| 3 | 删除项目时级联删除 photos/videos/periods | 手动测试 |
| 4 | `scan_media_folder` 期间其他命令可正常读数据库 | 扫描时同时浏览周期列表 |
| 5 | `cargo build` 无 warning/error | CI |
| 6 | 现有功能无回归 | 冒烟测试 |

## 风险

- **synchronous=NORMAL**：极端情况（OS 崩溃+WAL 未 flush）可能丢最后一个事务。桌面 app 场景可接受。
- **函数拆分**：`scan_media_folder` 重构涉及调用链变更，需仔细对齐参数和返回值。
- **无自动化测试**：当前项目无 Rust 测试框架，验证靠手动+编译。
