# 宝宝成长视频制作应用 - 设计文档

**日期**：2026-06-24  
**版本**：v1.0  
**状态**：设计阶段

---

## 1. 项目概述

### 1.1 项目背景

为宝宝制作成长视频是很多家长的需求，但现有的视频编辑软件要么太复杂（专业级软件学习成本高），要么太简单（模板化缺乏个性化）。本应用旨在提供一个专门针对宝宝成长视频制作的桌面工具，让家长能够轻松地按时间周期整理宝宝照片，一键生成精美的成长视频。

### 1.2 项目目标

- 提供简单易用的宝宝成长视频制作体验
- 支持按周期（周/月）自动整理照片
- 支持从视频中截取画面作为素材
- 提供专业级的视频输出质量（最高4K）
- 所有数据本地存储，保护隐私安全
- 跨平台支持（macOS / Windows）

### 1.3 目标用户

- 新手父母，想为宝宝制作成长记录视频
- 有一定电脑操作基础，但不熟悉专业视频编辑软件
- 重视隐私，希望所有数据保存在本地

### 1.4 设计原则

- **简单易用**：核心流程3步完成（选照片→设置参数→生成）
- **渐进增强**：先做核心功能，逐步增加高级特性
- **性能优先**：视频生成等重计算任务优化性能
- **隐私安全**：所有数据本地存储，不上传云端
- **现代UI**：简约现代风格，类似剪映/CapCut

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术选择 | 版本 | 说明 |
|------|----------|------|------|
| 前端框架 | React | 18.x | 组件化开发，生态成熟 |
| 语言 | TypeScript | 5.x | 类型安全，减少运行时错误 |
| UI样式 | Tailwind CSS | 3.x | 原子化CSS，快速构建UI |
| UI组件 | shadcn/ui | - | 高质量组件库，可定制 |
| 状态管理 | Zustand | 4.x | 轻量级，简单易用 |
| 路由 | React Router | 6.x | 单页应用路由 |
| 桌面框架 | Tauri | 2.x | 跨平台，体积小，性能好 |
| 后端语言 | Rust | 稳定版 | 高性能，内存安全 |
| 数据库 | SQLite | 3.x | 本地嵌入式，无需额外安装 |
| 数据库驱动 | rusqlite | - | Rust SQLite绑定 |
| 视频处理 | FFmpeg | 6.x+ | 业界标准，功能强大 |
| 图片处理 | image crate | - | Rust原生图片处理库 |

### 2.2 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    前端 UI 层                        │
│  ┌──────────┬──────────┬──────────┬──────────────┐  │
│  │ 项目管理  │ 周期管理  │ 素材浏览  │  视频生成    │  │
│  └──────────┴──────────┴──────────┴──────────────┘  │
│  ┌──────────────────────────────────────────────┐   │
│  │              Zustand 状态管理                 │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│                   Tauri 桥接层                      │
│         (invoke 调用 / event 事件推送)              │
├─────────────────────────────────────────────────────┤
│                   后端核心层 (Rust)                 │
│  ┌──────────┬──────────┬──────────┬──────────────┐  │
│  │ 数据库    │ 文件扫描  │ 图片处理  │  视频生成    │  │
│  └──────────┴──────────┴──────────┴──────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2.3 数据流

1. **前端**负责用户交互和UI展示
2. **重计算任务**（文件扫描、视频生成、缩略图生成）通过Tauri invoke交给Rust后端
3. **进度更新**通过Tauri event从后端推送到前端
4. **数据持久化**通过Rust操作SQLite数据库
5. **文件操作**（读取照片、写入视频）都在Rust层完成

---

## 3. 数据模型设计

### 3.1 数据库表结构

#### 3.1.1 projects 项目表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 项目ID |
| name | TEXT | NOT NULL | 项目名称 |
| baby_name | TEXT | NOT NULL | 宝宝姓名 |
| baby_birthday | TEXT | NOT NULL | 宝宝出生日期 (YYYY-MM-DD) |
| baby_gender | TEXT | DEFAULT 'unknown' | 性别 (male/female/unknown) |
| cycle_days | INTEGER | DEFAULT 7 | 周期天数 |
| media_folder | TEXT | NOT NULL | 素材文件夹路径 |
| output_folder | TEXT | | 输出文件夹路径 |
| thumbnail_path | TEXT | | 项目缩略图路径 |
| created_at | TEXT | NOT NULL | 创建时间 |
| updated_at | TEXT | NOT NULL | 更新时间 |

#### 3.1.2 periods 周期表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 周期ID |
| project_id | INTEGER | NOT NULL, FOREIGN KEY | 所属项目ID |
| name | TEXT | NOT NULL | 周期名称 |
| start_date | TEXT | NOT NULL | 开始日期 |
| end_date | TEXT | NOT NULL | 结束日期 |
| sort_order | INTEGER | NOT NULL | 排序序号 |
| is_custom | BOOLEAN | DEFAULT 0 | 是否自定义添加 |
| selected_photo_id | INTEGER | FOREIGN KEY | 最终选中的照片ID |
| description | TEXT | | 周期描述/字幕 |
| created_at | TEXT | NOT NULL | 创建时间 |

#### 3.1.3 photos 照片表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 照片ID |
| project_id | INTEGER | NOT NULL, FOREIGN KEY | 所属项目ID |
| period_id | INTEGER | NOT NULL, FOREIGN KEY | 所属周期ID |
| file_path | TEXT | NOT NULL | 文件绝对路径 |
| file_name | TEXT | NOT NULL | 文件名 |
| file_size | INTEGER | NOT NULL | 文件大小（字节） |
| taken_date | TEXT | NOT NULL | 拍摄日期 |
| width | INTEGER | | 宽度（像素） |
| height | INTEGER | | 高度（像素） |
| is_selected | BOOLEAN | DEFAULT 0 | 是否被标记为候选 |
| is_final | BOOLEAN | DEFAULT 0 | 是否最终选用 |
| description | TEXT | | 照片描述/字幕 |
| thumbnail_path | TEXT | | 缩略图路径 |
| created_at | TEXT | NOT NULL | 创建时间 |

#### 3.1.4 videos 视频表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 视频ID |
| project_id | INTEGER | NOT NULL, FOREIGN KEY | 所属项目ID |
| period_id | INTEGER | NOT NULL, FOREIGN KEY | 所属周期ID |
| file_path | TEXT | NOT NULL | 文件绝对路径 |
| file_name | TEXT | NOT NULL | 文件名 |
| file_size | INTEGER | NOT NULL | 文件大小（字节） |
| duration | REAL | | 时长（秒） |
| width | INTEGER | | 宽度（像素） |
| height | INTEGER | | 高度（像素） |
| taken_date | TEXT | NOT NULL | 拍摄日期 |
| thumbnail_path | TEXT | | 缩略图路径 |
| created_at | TEXT | NOT NULL | 创建时间 |

#### 3.1.5 video_frames 视频截图表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 截图ID |
| video_id | INTEGER | NOT NULL, FOREIGN KEY | 所属视频ID |
| project_id | INTEGER | NOT NULL, FOREIGN KEY | 所属项目ID |
| period_id | INTEGER | NOT NULL, FOREIGN KEY | 所属周期ID |
| file_path | TEXT | NOT NULL | 截图文件路径 |
| timestamp | REAL | NOT NULL | 截图时间点（秒） |
| is_selected | BOOLEAN | DEFAULT 0 | 是否被标记为候选 |
| is_final | BOOLEAN | DEFAULT 0 | 是否最终选用 |
| description | TEXT | | 描述 |
| created_at | TEXT | NOT NULL | 创建时间 |

#### 3.1.6 exports 导出记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 导出ID |
| project_id | INTEGER | NOT NULL, FOREIGN KEY | 所属项目ID |
| name | TEXT | NOT NULL | 导出名称 |
| output_path | TEXT | NOT NULL | 输出文件路径 |
| resolution | TEXT | NOT NULL | 分辨率（如"3840x2160"） |
| duration | REAL | | 总时长（秒） |
| file_size | INTEGER | | 文件大小（字节） |
| status | TEXT | NOT NULL | 状态 (processing/completed/failed) |
| error_message | TEXT | | 错误信息（失败时） |
| created_at | TEXT | NOT NULL | 创建时间 |
| completed_at | TEXT | | 完成时间 |

### 3.2 表关系

```
projects (1) ──→ (N) periods
   │                  │
   │                  ├──→ (N) photos
   │                  ├──→ (N) videos
   │                  └──→ (N) video_frames
   │
   └──→ (N) exports
```

---

## 4. 功能模块设计

### 4.1 第一阶段（MVP）- 核心功能

#### 4.1.1 项目管理模块

**功能清单**：
- 创建新项目
- 项目列表展示
- 打开/编辑项目
- 删除项目
- 项目设置修改

**创建项目流程**：
```
1. 首页点击"新建项目"
2. 填写宝宝信息（姓名、出生日期、性别）
3. 设置周期天数（默认7天）
4. 选择素材文件夹
5. 系统自动扫描并分类照片/视频
6. 自动生成周期列表
7. 进入项目编辑界面
```

**界面设计**：
- 首页：项目卡片列表 + 新建按钮
- 新建项目：向导式（Wizard）3步完成

#### 4.1.2 周期管理模块

**功能清单**：
- 自动生成周期列表
- 添加自定义周期（特殊日子）
- 周期重命名
- 删除自定义周期
- 调整周期顺序
- 周期状态显示（是否已选照片）

**自动生成规则**：
- 从宝宝出生日期开始，每N天为一个周期
- 周期名称格式："第1周"、"第2周"...
- 自动计算每个周期的起止日期
- 自动统计每个周期的照片数和视频数

**自定义周期**：
- 支持添加单个日期（如"满月"、"百天"）
- 支持添加日期范围
- 自定义周期可拖拽排序
- 自定义周期可删除

#### 4.1.3 素材浏览与选择模块

**功能清单**：
- 按周期浏览照片/视频
- 照片网格展示
- 标记候选照片（可多选）
- 确认最终选用照片（每周期1张）
- 照片详情查看
- 添加照片描述
- 视频播放
- 视频截图
- 截图管理

**照片选择流程**：
```
1. 左侧选择周期
2. 中间区域浏览照片网格
3. 点击照片标记为候选
4. 底部候选栏对比查看
5. 选择1张设为最终选用
6. （可选）添加文字描述
```

**视频截图流程**：
```
1. 切换到视频标签
2. 点击视频打开播放器
3. 播放/暂停找到合适画面
4. 点击截图按钮保存
5. 截图自动加入素材库
6. 可像照片一样选用
```

#### 4.1.4 视频生成模块

**功能清单**：
- 视频顺序预览
- 分辨率设置
- 单张照片时长设置
- 转场效果选择
- 背景音乐选择
- 视频生成
- 进度显示
- 生成完成预览
- 导出保存

**视频参数选项**：
- 分辨率：4K (3840×2160) / 2K (2560×1440) / 1080p / 720p
- 单张时长：2秒 / 3秒 / 5秒 / 自定义
- 转场效果：淡入淡出 / 滑动 / 缩放 / 无转场
- 背景音乐：本地音频文件 / 无音乐
- 输出格式：MP4 (H.264 + AAC)

**生成流程**：
```
1. 点击"生成视频"
2. 设置输出参数
3. 开始生成
4. 实时显示进度和预计时间
5. 生成完成自动预览
6. 保存到指定位置
```

### 4.2 第二阶段 - 增强编辑

**功能清单**：
- 可视化时间轴（单轨道）
- 拖拽调整照片顺序
- 拖拽调整单张时长
- 文字字幕（字体、大小、颜色、位置）
- 滤镜效果（日系、胶片、清新、黑白等）
- 更多转场效果（10+种）
- 照片裁剪/缩放/平移
- 背景音乐增强（多段、音量、淡入淡出）

### 4.3 第三阶段 - 专业级编辑

**功能清单**：
- 多轨道编辑（视频轨、音频轨、字幕轨、特效轨）
- 画中画
- 贴纸/边框/粒子特效
- 关键帧动画（缩放、平移、旋转）
- 视频片段编辑（裁剪、调速、拼接）
- 批量导出（多分辨率）
- 模板系统（预设成长视频模板）
- 人脸检测/智能选图

---

## 5. 关键技术方案

### 5.1 文件扫描与日期识别

**优先级策略**：
1. 从文件名提取日期（匹配 `YYYY-MM-DD` 格式）
2. 读取照片EXIF信息中的拍摄日期
3. 读取视频元数据中的创建时间
4. 使用文件修改时间兜底

**支持的文件格式**：
- 照片：.jpg, .jpeg, .png, .heic, .webp, .gif, .bmp
- 视频：.mp4, .mov, .avi, .mkv, .m4v

**性能优化**：
- 增量扫描：只扫描新增/修改的文件
- 多线程处理：并行处理多个文件
- 结果缓存：扫描结果存入数据库，下次直接读取

### 5.2 缩略图生成

**方案**：
- 照片：使用 Rust `image` crate 生成
- 视频：使用 FFmpeg 截取第1帧
- 缓存策略：按需生成，本地缓存
- 缩略图尺寸：256×256（列表用）/ 1024×1024（详情用）
- 缓存位置：应用数据目录下的 `thumbnails` 文件夹

### 5.3 视频生成

**核心技术**：FFmpeg 命令行调用

**第一阶段实现**：
- 基础照片轮播
- 淡入淡出转场
- 缩放动画（Ken Burns效果）
- 背景音乐

**FFmpeg 命令示例**：
```bash
ffmpeg \
  -loop 1 -t 3 -i photo1.jpg \
  -loop 1 -t 3 -i photo2.jpg \
  -i background.mp3 \
  -filter_complex "
    [0:v]zoompan=z='min(zoom+0.0015,1.5)':d=75:s=3840x2160,format=yuv420p[v0];
    [1:v]fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5,zoompan=z='min(zoom+0.0015,1.5)':d=75:s=3840x2160,format=yuv420p[v1];
    [v0][v1]concat=n=2:v=1:a=0[outv]
  " \
  -map "[outv]" -map 2:a \
  -c:v libx264 -preset medium -crf 18 \
  -c:a aac -b:a 192k \
  -shortest \
  output.mp4
```

**进度推送**：
- 解析 FFmpeg 输出获取进度
- 通过 Tauri event 推送到前端
- 显示百分比和预计剩余时间

### 5.4 视频截图

**方案**：使用 FFmpeg 截取指定时间点的帧

**命令示例**：
```bash
ffmpeg -i input.mp4 -ss 5.5 -vframes 1 -q:v 2 output.jpg
```

**功能**：
- 精确到0.1秒的截图
- 高质量JPG输出
- 自动保存到项目缓存目录
- 自动关联到对应周期

### 5.5 数据库操作

**方案**：
- 使用 Rust `rusqlite` crate
- 所有操作封装在 Rust 层
- 前端通过 Tauri invoke 调用
- 数据库文件：应用数据目录下 `baby_growth.db`

**性能优化**：
- 使用 WAL 模式提升并发性能
- 批量操作使用事务
- 常用查询建立索引

---

## 6. 项目文件结构

```
baby-growth-video/
├── docs/                           # 文档
│   └── specs/                     # 设计文档
│       └── 2026-06-24-baby-growth-video-design.md
├── src/                            # 前端源码
│   ├── components/                 # 通用组件
│   │   ├── PhotoGrid.tsx          # 照片网格组件
│   │   ├── PeriodSidebar.tsx      # 周期侧边栏
│   │   ├── VideoPlayer.tsx        # 视频播放器
│   │   ├── ProgressBar.tsx        # 进度条
│   │   └── Wizard.tsx             # 向导组件
│   ├── pages/                      # 页面
│   │   ├── HomePage.tsx           # 首页/项目列表
│   │   ├── NewProjectPage.tsx     # 新建项目向导
│   │   ├── ProjectPage.tsx        # 项目编辑页
│   │   └── ExportPage.tsx         # 导出视频页
│   ├── store/                      # 状态管理
│   │   ├── projectStore.ts        # 项目状态
│   │   └── uiStore.ts             # UI状态
│   ├── types/                      # TypeScript类型
│   │   └── index.ts
│   ├── utils/                      # 工具函数
│   │   ├── api.ts                 # Tauri调用封装
│   │   ├── format.ts              # 格式化工具
│   │   └── date.ts                # 日期工具
│   ├── App.tsx                    # 主应用组件
│   ├── main.tsx                   # 应用入口
│   └── index.css                  # 全局样式
├── src-tauri/                      # Tauri后端
│   ├── src/
│   │   ├── main.rs                # 应用入口
│   │   ├── commands.rs            # Tauri命令定义
│   │   ├── db.rs                  # 数据库操作
│   │   ├── models.rs              # 数据模型
│   │   ├── media.rs               # 媒体处理（扫描、缩略图）
│   │   ├── video.rs               # 视频生成
│   │   └── error.rs               # 错误处理
│   ├── icons/                      # 应用图标
│   ├── Cargo.toml                 # Rust依赖配置
│   ├── build.rs                   # 构建脚本
│   └── tauri.conf.json            # Tauri配置
├── public/                         # 静态资源
├── package.json                    # 前端依赖
├── vite.config.ts                  # Vite配置
├── tailwind.config.js              # Tailwind CSS配置
├── postcss.config.js               # PostCSS配置
├── tsconfig.json                   # TypeScript配置
├── tsconfig.node.json              # Node TypeScript配置
└── README.md                       # 项目说明
```

---

## 7. 开发计划

### 7.1 第一阶段：MVP（2-3周）

| 任务 | 预计工时 | 说明 |
|------|----------|------|
| 项目初始化 | 0.5天 | Tauri项目创建、依赖配置、基础结构 |
| 数据库设计与实现 | 1天 | 表结构、CRUD操作、初始化 |
| 文件扫描功能 | 1.5天 | 递归扫描、日期识别、入库 |
| 缩略图生成 | 1天 | 照片/视频缩略图、缓存 |
| 项目管理UI | 1.5天 | 项目列表、新建向导、设置 |
| 周期管理UI | 1天 | 周期列表、添加自定义周期 |
| 素材浏览UI | 2天 | 照片网格、详情、候选、选用 |
| 视频播放器 | 1.5天 | 播放控制、截图功能 |
| 视频生成功能 | 2天 | FFmpeg集成、参数设置、进度推送 |
| 导出功能 | 1天 | 导出设置、历史记录 |
| 测试与优化 | 1.5天 | 功能测试、性能优化、Bug修复 |
| **合计** | **约14天** | |

### 7.2 第二阶段：增强编辑（1-2个月）

| 任务 | 预计工时 | 说明 |
|------|----------|------|
| 时间轴组件 | 5天 | 可视化时间轴、拖拽交互 |
| 文字字幕 | 3天 | 文字编辑、样式设置、动画 |
| 滤镜效果 | 3天 | 滤镜算法、预设滤镜 |
| 转场效果增强 | 3天 | 更多转场效果 |
| 照片编辑 | 3天 | 裁剪、缩放、平移 |
| 音乐增强 | 2天 | 多段音乐、音量调节、淡入淡出 |
| 测试与优化 | 3天 | 功能测试、性能优化 |
| **合计** | **约22天** | |

### 7.3 第三阶段：专业级编辑（2-3个月）

根据需求再细化。

---

## 8. 风险与挑战

### 8.1 技术风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| FFmpeg跨平台兼容性 | 中 | 提前在各平台测试，准备静态编译版本 |
| 4K视频生成速度慢 | 高 | 优化FFmpeg参数，提供多档质量选择 |
| 大量照片的性能问题 | 中 | 虚拟滚动、缩略图懒加载、分页加载 |
| HEIC格式支持 | 低 | 使用第三方库，或提示用户转换格式 |

### 8.2 项目风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 功能范围膨胀 | 高 | 严格按阶段开发，MVP先上线再迭代 |
| UI/UX设计不足 | 中 | 参考成熟产品（剪映、CapCut），多做用户测试 |
| 开发周期超预期 | 中 | 预留缓冲时间，优先保证核心功能 |

---

## 9. 后续优化方向

- AI智能选图（自动挑选最好的照片）
- 人脸检测与识别（按人物分类）
- 云同步功能（可选，保持本地优先）
- 更多模板和主题
- 社交分享功能
- 照片修复/增强（去噪、调色）

---

**文档结束**
