# 宝宝成长视频制作 - MVP实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现宝宝成长视频制作应用的第一阶段MVP，包括项目管理、周期管理、素材浏览选择、视频生成等核心功能。

**Architecture:** 采用Tauri + React架构，Rust后端负责数据库、文件处理、视频生成等重计算任务，React前端负责UI展示和用户交互。前后端通过Tauri invoke通信。

**Tech Stack:** Tauri 2.x, React 18, TypeScript, Tailwind CSS, Zustand, SQLite (rusqlite), FFmpeg

## Global Constraints

- 项目路径：`/Users/allen/Documents/repos/baby-growth-video`
- 前端框架：React 18 + TypeScript
- 桌面框架：Tauri 2.x
- 后端语言：Rust (stable)
- 数据库：SQLite via rusqlite
- 视频处理：FFmpeg 6.x+
- UI样式：Tailwind CSS 3.x
- 状态管理：Zustand 4.x
- 代码风格：遵循各语言社区最佳实践
- 所有数据本地存储，不上传云端

---

## 文件结构总览

### Rust后端 (src-tauri/src/)
- `main.rs` - 应用入口，Tauri初始化
- `commands.rs` - Tauri命令定义
- `error.rs` - 错误类型定义
- `models.rs` - 数据模型
- `db.rs` - 数据库操作
- `media.rs` - 媒体文件处理（扫描、缩略图）
- `video.rs` - 视频生成

### 前端 (src/)
- `main.tsx` - 应用入口
- `App.tsx` - 主应用组件
- `types/index.ts` - TypeScript类型定义
- `store/projectStore.ts` - 项目状态管理
- `store/uiStore.ts` - UI状态管理
- `utils/api.ts` - Tauri调用封装
- `utils/format.ts` - 格式化工具
- `utils/date.ts` - 日期工具
- `components/` - 通用组件
- `pages/` - 页面组件

---

## Task 1: 项目初始化与基础配置

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/error.rs`
- Create: `src-tauri/src/models.rs`
- Create: `src-tauri/src/db.rs`
- Create: `src-tauri/src/media.rs`
- Create: `src-tauri/src/video.rs`
- Create: `src-tauri/src/commands.rs`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

**Interfaces:**
- Produces: 可运行的Tauri项目基础结构，前后端能正常启动

### 步骤

- [ ] **Step 1: 配置Rust后端依赖**

创建 `src-tauri/Cargo.toml`：
```toml
[package]
name = "baby-growth-video"
version = "0.1.0"
description = "Baby Growth Video Maker"
authors = ["you"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = ["dialog-open", "dialog-save", "fs-all", "path-all", "shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
rusqlite = { version = "0.31", features = ["bundled"] }
chrono = { version = "0.4", features = ["serde"] }
image = "0.24"
walkdir = "2.4"
regex = "1.10"
anyhow = "1.0"
thiserror = "1.0"
uuid = { version = "1.6", features = ["v4"] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

- [ ] **Step 2: 配置Tauri**

创建 `src-tauri/tauri.conf.json`：
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Baby Growth Video",
  "version": "0.1.0",
  "identifier": "com.babygrowth.video",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:8092",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "宝宝成长视频制作",
        "width": 1280,
        "height": 800,
        "minWidth": 960,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 3: 创建构建脚本**

创建 `src-tauri/build.rs`：
```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 4: 创建错误类型**

创建 `src-tauri/src/error.rs`：
```rust
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Image error: {0}")]
    Image(#[from] image::ImageError),
    
    #[error("Regex error: {0}")]
    Regex(#[from] regex::Error),
    
    #[error("Chrono error: {0}")]
    Chrono(#[from] chrono::ParseError),
    
    #[error("{0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type AppResult<T> = Result<T, AppError>;
```

- [ ] **Step 5: 创建数据模型**

创建 `src-tauri/src/models.rs`：
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub baby_name: String,
    pub baby_birthday: String,
    pub baby_gender: String,
    pub cycle_days: i32,
    pub media_folder: String,
    pub output_folder: Option<String>,
    pub thumbnail_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewProject {
    pub name: String,
    pub baby_name: String,
    pub baby_birthday: String,
    pub baby_gender: String,
    pub cycle_days: i32,
    pub media_folder: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Period {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub sort_order: i32,
    pub is_custom: bool,
    pub selected_photo_id: Option<i64>,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Photo {
    pub id: i64,
    pub project_id: i64,
    pub period_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub taken_date: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub is_selected: bool,
    pub is_final: bool,
    pub description: Option<String>,
    pub thumbnail_path: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Video {
    pub id: i64,
    pub project_id: i64,
    pub period_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub duration: Option<f64>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub taken_date: String,
    pub thumbnail_path: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoFrame {
    pub id: i64,
    pub video_id: i64,
    pub project_id: i64,
    pub period_id: i64,
    pub file_path: String,
    pub timestamp: f64,
    pub is_selected: bool,
    pub is_final: bool,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportRecord {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub output_path: String,
    pub resolution: String,
    pub duration: Option<f64>,
    pub file_size: Option<i64>,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}
```

- [ ] **Step 6: 创建数据库模块骨架**

创建 `src-tauri/src/db.rs`：
```rust
use crate::error::AppResult;
use rusqlite::Connection;
use std::path::Path;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(path: &Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> AppResult<()> {
        // 表结构将在Task 2中实现
        Ok(())
    }
}
```

- [ ] **Step 7: 创建媒体处理模块骨架**

创建 `src-tauri/src/media.rs`：
```rust
use crate::error::AppResult;

// 媒体扫描和处理功能将在Task 3中实现
pub fn scan_media_folder(_folder: &str) -> AppResult<()> {
    Ok(())
}
```

- [ ] **Step 8: 创建视频生成模块骨架**

创建 `src-tauri/src/video.rs`：
```rust
use crate::error::AppResult;

// 视频生成功能将在Task 4中实现
pub fn generate_video(_project_id: i64) -> AppResult<()> {
    Ok(())
}
```

- [ ] **Step 9: 创建命令模块骨架**

创建 `src-tauri/src/commands.rs`：
```rust
use crate::error::AppResult;

// Tauri命令将在后续任务中实现
```

- [ ] **Step 10: 创建主入口文件**

创建 `src-tauri/src/main.rs`：
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod error;
mod media;
mod models;
mod video;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 11: 更新前端入口文件**

创建 `src/main.tsx`：
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 12: 创建主应用组件**

创建 `src/App.tsx`：
```tsx
import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">宝宝成长视频制作</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-600">项目初始化完成，后续功能开发中...</p>
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 13: 创建全局样式**

创建 `src/index.css`：
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 14: 验证项目结构**

运行：`ls -la src-tauri/src/`
预期：能看到 main.rs, error.rs, models.rs, db.rs, media.rs, video.rs, commands.rs

运行：`ls -la src/`
预期：能看到 main.tsx, App.tsx, index.css

- [ ] **Step 15: 提交代码**

```bash
cd /Users/allen/Documents/repos/baby-growth-video
git init
git add .
git commit -m "feat: initialize project structure"
```

---

## Task 2: 数据库层实现

**Files:**
- Modify: `src-tauri/src/db.rs`
- Test: 数据库初始化和基本CRUD测试

**Interfaces:**
- Consumes: models.rs 中的数据结构
- Produces: 完整的数据库CRUD操作，供后续任务调用

### 步骤

- [ ] **Step 1: 实现数据库表初始化**

在 `src-tauri/src/db.rs` 中实现 `init_tables` 方法，创建所有表：
```rust
fn init_tables(&self) -> AppResult<()> {
    self.conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            baby_name TEXT NOT NULL,
            baby_birthday TEXT NOT NULL,
            baby_gender TEXT NOT NULL DEFAULT 'unknown',
            cycle_days INTEGER NOT NULL DEFAULT 7,
            media_folder TEXT NOT NULL,
            output_folder TEXT,
            thumbnail_path TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            is_custom INTEGER NOT NULL DEFAULT 0,
            selected_photo_id INTEGER,
            description TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            period_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            taken_date TEXT NOT NULL,
            width INTEGER,
            height INTEGER,
            is_selected INTEGER NOT NULL DEFAULT 0,
            is_final INTEGER NOT NULL DEFAULT 0,
            description TEXT,
            thumbnail_path TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            period_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            duration REAL,
            width INTEGER,
            height INTEGER,
            taken_date TEXT NOT NULL,
            thumbnail_path TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS video_frames (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            period_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            timestamp REAL NOT NULL,
            is_selected INTEGER NOT NULL DEFAULT 0,
            is_final INTEGER NOT NULL DEFAULT 0,
            description TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS exports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            output_path TEXT NOT NULL,
            resolution TEXT NOT NULL,
            duration REAL,
            file_size INTEGER,
            status TEXT NOT NULL,
            error_message TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_periods_project_id ON periods(project_id);
        CREATE INDEX IF NOT EXISTS idx_photos_period_id ON photos(period_id);
        CREATE INDEX IF NOT EXISTS idx_videos_period_id ON videos(period_id);
        CREATE INDEX IF NOT EXISTS idx_exports_project_id ON exports(project_id);
        ",
    )?;
    Ok(())
}
```

- [ ] **Step 2: 实现Project的CRUD**

在 `src-tauri/src/db.rs` 中实现项目相关的数据库操作方法。

- [ ] **Step 3: 实现Period的CRUD**

实现周期相关的数据库操作方法。

- [ ] **Step 4: 实现Photo的CRUD**

实现照片相关的数据库操作方法。

- [ ] **Step 5: 实现Video的CRUD**

实现视频相关的数据库操作方法。

- [ ] **Step 6: 实现VideoFrame的CRUD**

实现视频截图相关的数据库操作方法。

- [ ] **Step 7: 实现Export的CRUD**

实现导出记录相关的数据库操作方法。

- [ ] **Step 8: 测试数据库功能**

编写简单测试验证数据库初始化和基本CRUD。

- [ ] **Step 9: 提交代码**

```bash
git add src-tauri/src/db.rs
git commit -m "feat: implement database layer with all CRUD operations"
```

---

## Task 3: 媒体扫描与处理

**Files:**
- Modify: `src-tauri/src/media.rs`
- Create: 缩略图生成功能

**Interfaces:**
- Consumes: db.rs 数据库操作
- Produces: 媒体文件扫描、日期识别、缩略图生成功能

### 步骤

- [ ] **Step 1: 实现文件日期识别**

实现从文件名提取日期、读取EXIF、文件修改时间兜底的逻辑。

- [ ] **Step 2: 实现文件夹递归扫描**

实现递归扫描文件夹，识别照片和视频文件。

- [ ] **Step 3: 实现照片缩略图生成**

使用 image crate 生成照片缩略图，缓存到本地。

- [ ] **Step 4: 实现视频缩略图生成**

调用 FFmpeg 截取视频第一帧作为缩略图。

- [ ] **Step 5: 实现周期自动生成**

根据宝宝出生日期和周期天数，自动生成周期列表。

- [ ] **Step 6: 实现媒体文件归类**

将扫描到的照片和视频按日期归类到对应的周期。

- [ ] **Step 7: 测试媒体扫描功能**

使用测试文件夹验证扫描和分类功能。

- [ ] **Step 8: 提交代码**

```bash
git add src-tauri/src/media.rs
git commit -m "feat: implement media scanning and thumbnail generation"
```

---

## Task 4: 视频生成功能

**Files:**
- Modify: `src-tauri/src/video.rs`

**Interfaces:**
- Consumes: db.rs 数据库操作, 选中的照片列表
- Produces: 视频生成功能，支持进度回调

### 步骤

- [ ] **Step 1: 实现FFmpeg命令封装**

封装FFmpeg调用，支持参数配置。

- [ ] **Step 2: 实现单张照片视频片段生成**

实现将单张照片转换为带缩放动画的视频片段。

- [ ] **Step 3: 实现淡入淡出转场**

实现照片之间的淡入淡出转场效果。

- [ ] **Step 4: 实现视频拼接**

将多个视频片段拼接成完整视频。

- [ ] **Step 5: 实现背景音乐混合**

支持添加背景音乐，自动调整时长。

- [ ] **Step 6: 实现进度解析**

解析FFmpeg输出，计算生成进度。

- [ ] **Step 7: 测试视频生成**

使用测试照片验证视频生成功能。

- [ ] **Step 8: 提交代码**

```bash
git add src-tauri/src/video.rs
git commit -m "feat: implement video generation with FFmpeg"
```

---

## Task 5: Tauri命令封装

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/main.rs`

**Interfaces:**
- Consumes: db.rs, media.rs, video.rs 的功能
- Produces: 前端可调用的Tauri命令集合

### 步骤

- [ ] **Step 1: 实现项目管理命令**

封装项目的增删改查命令。

- [ ] **Step 2: 实现周期管理命令**

封装周期的增删改查命令。

- [ ] **Step 3: 实现媒体管理命令**

封装媒体扫描、照片查询、视频查询等命令。

- [ ] **Step 4: 实现照片选择命令**

封装标记候选、确认选用、添加描述等命令。

- [ ] **Step 5: 实现视频截图命令**

封装视频播放、截图等命令。

- [ ] **Step 6: 实现视频生成命令**

封装视频生成、进度查询等命令。

- [ ] **Step 7: 实现导出记录命令**

封装导出历史查询命令。

- [ ] **Step 8: 注册命令到Tauri**

在 main.rs 中注册所有命令。

- [ ] **Step 9: 提交代码**

```bash
git add src-tauri/src/commands.rs src-tauri/src/main.rs
git commit -m "feat: implement Tauri commands for all features"
```

---

## Task 6: 前端基础结构与类型定义

**Files:**
- Create: `src/types/index.ts`
- Create: `src/utils/api.ts`
- Create: `src/utils/format.ts`
- Create: `src/utils/date.ts`
- Create: `src/store/projectStore.ts`
- Create: `src/store/uiStore.ts`

**Interfaces:**
- Produces: 前端基础工具和状态管理

### 步骤

- [ ] **Step 1: 定义TypeScript类型**

创建所有数据结构的TypeScript类型定义。

- [ ] **Step 2: 封装Tauri API调用**

封装所有invoke调用，提供类型安全的API函数。

- [ ] **Step 3: 实现格式化工具**

实现文件大小、日期、时长等格式化工具。

- [ ] **Step 4: 实现日期工具**

实现周期计算、日期格式化等工具。

- [ ] **Step 5: 创建项目状态管理**

使用Zustand创建项目状态管理store。

- [ ] **Step 6: 创建UI状态管理**

创建UI相关的状态管理，如加载状态、弹窗状态等。

- [ ] **Step 7: 提交代码**

```bash
git add src/types src/utils src/store
git commit -m "feat: implement frontend types, utils and state management"
```

---

## Task 7: 项目管理页面

**Files:**
- Create: `src/pages/HomePage.tsx`
- Create: `src/pages/NewProjectPage.tsx`
- Create: `src/components/ProjectCard.tsx`
- Create: `src/components/Wizard.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: projectStore, api.ts
- Produces: 项目列表、新建项目向导页面

### 步骤

- [ ] **Step 1: 创建项目卡片组件**

实现项目卡片，显示缩略图、宝宝姓名、更新时间等。

- [ ] **Step 2: 创建向导组件**

实现通用的向导（Wizard）组件，支持多步骤。

- [ ] **Step 3: 实现首页项目列表**

实现首页，展示所有项目，支持新建和打开。

- [ ] **Step 4: 实现新建项目向导**

实现三步向导：宝宝信息 → 周期设置 → 素材文件夹。

- [ ] **Step 5: 实现项目删除功能**

支持删除项目，带确认提示。

- [ ] **Step 6: 集成路由**

在 App.tsx 中配置路由。

- [ ] **Step 7: 测试项目管理流程**

测试创建、查看、删除项目的完整流程。

- [ ] **Step 8: 提交代码**

```bash
git add src/pages src/components src/App.tsx
git commit -m "feat: implement project management pages"
```

---

## Task 8: 周期管理与素材浏览

**Files:**
- Create: `src/pages/ProjectPage.tsx`
- Create: `src/components/PeriodSidebar.tsx`
- Create: `src/components/PhotoGrid.tsx`
- Create: `src/components/PhotoDetail.tsx`
- Create: `src/components/CandidateBar.tsx`

**Interfaces:**
- Consumes: projectStore, api.ts
- Produces: 周期侧边栏、照片网格、详情查看、候选栏

### 步骤

- [ ] **Step 1: 创建周期侧边栏组件**

实现周期列表，显示周期名、日期、素材数量、选中状态。

- [ ] **Step 2: 创建照片网格组件**

实现照片网格展示，支持选中状态。

- [ ] **Step 3: 创建照片详情弹窗**

实现照片大图查看，添加描述，设为选用。

- [ ] **Step 4: 创建候选栏组件**

底部横向滚动的候选照片栏。

- [ ] **Step 5: 实现项目编辑主页面**

整合侧边栏和主内容区。

- [ ] **Step 6: 实现添加自定义周期功能**

支持添加特殊日子，如满月、百天等。

- [ ] **Step 7: 实现照片选择流程**

实现标记候选、确认选用的完整流程。

- [ ] **Step 8: 测试素材浏览与选择**

测试完整的照片浏览和选择流程。

- [ ] **Step 9: 提交代码**

```bash
git add src/pages/ProjectPage.tsx src/components/
git commit -m "feat: implement period management and photo browsing"
```

---

## Task 9: 视频播放器与截图功能

**Files:**
- Create: `src/components/VideoPlayer.tsx`
- Modify: `src/pages/ProjectPage.tsx`

**Interfaces:**
- Consumes: api.ts, projectStore
- Produces: 视频播放、截图功能

### 步骤

- [ ] **Step 1: 创建视频播放器组件**

实现视频播放、暂停、进度控制。

- [ ] **Step 2: 实现截图功能**

支持在任意时间点截图，保存到素材库。

- [ ] **Step 3: 集成视频标签页**

在项目页面添加视频标签，展示视频列表。

- [ ] **Step 4: 实现截图管理**

截图可以像照片一样被选用。

- [ ] **Step 5: 测试视频截图功能**

测试视频播放和截图流程。

- [ ] **Step 6: 提交代码**

```bash
git add src/components/VideoPlayer.tsx src/pages/ProjectPage.tsx
git commit -m "feat: implement video player and frame capture"
```

---

## Task 10: 视频生成与导出页面

**Files:**
- Create: `src/pages/ExportPage.tsx`
- Create: `src/components/VideoTimeline.tsx`
- Create: `src/components/ExportSettings.tsx`
- Create: `src/components/ProgressModal.tsx`

**Interfaces:**
- Consumes: api.ts, projectStore
- Produces: 视频预览、参数设置、生成进度、导出历史

### 步骤

- [ ] **Step 1: 创建视频时间轴预览组件**

展示按周期排列的照片缩略图。

- [ ] **Step 2: 创建导出设置组件**

分辨率、时长、转场、音乐等参数设置。

- [ ] **Step 3: 创建进度弹窗组件**

显示生成进度和预计时间。

- [ ] **Step 4: 实现导出页面**

整合预览、设置、生成按钮。

- [ ] **Step 5: 实现进度实时更新**

监听Tauri事件，实时更新进度。

- [ ] **Step 6: 实现导出历史**

展示历史导出记录。

- [ ] **Step 7: 测试视频生成流程**

测试完整的视频生成流程。

- [ ] **Step 8: 提交代码**

```bash
git add src/pages/ExportPage.tsx src/components/
git commit -m "feat: implement video export page with progress display"
```

---

## Task 11: 整体集成与优化

**Files:**
- 多个文件

**Interfaces:**
- Produces: 完整可运行的MVP应用

### 步骤

- [ ] **Step 1: 完善错误处理**

统一错误提示，优化用户体验。

- [ ] **Step 2: 添加加载状态**

所有异步操作都有加载提示。

- [ ] **Step 3: 优化空状态**

完善各种空状态页面的展示。

- [ ] **Step 4: 整体UI优化**

调整配色、间距、动画等细节。

- [ ] **Step 5: 端到端测试**

测试从创建项目到生成视频的完整流程。

- [ ] **Step 6: 性能优化**

优化大量照片时的加载性能。

- [ ] **Step 7: 编写README**

完善项目说明文档。

- [ ] **Step 8: 提交代码**

```bash
git add .
git commit -m "feat: final integration and polish for MVP"
```

---

## 自我审查清单

- [ ] **Spec覆盖检查**：设计文档中的所有第一阶段功能都有对应任务
- [ ] **占位符检查**：没有TBD、TODO等未完成内容
- [ ] **类型一致性**：前后端类型定义一致
- [ ] **依赖顺序**：任务按依赖关系正确排序
- [ ] **可测试性**：每个任务都有可验证的交付物

---

## 执行方式选择

计划已完成并保存到 `docs/superpowers/plans/2026-06-24-baby-growth-video-mvp.md`。

**两种执行方式：**

**1. Subagent-Driven (推荐)** - 每个任务派发给独立的子agent，任务间进行审查，迭代速度快

**2. Inline Execution** - 在当前会话中按顺序执行，批量执行后检查点回顾

你希望用哪种方式开始实现？
