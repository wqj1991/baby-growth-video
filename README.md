# 宝宝成长视频制作工具

一个基于 Tauri 的桌面应用，用于制作宝宝成长视频。按周期整理宝宝照片，用户选择每个周期的代表照片，最终生成完整的成长视频。

## 当前状态

🚧 **开发中** - 基础框架已完成，核心功能正在完善中

### 已实现功能
- ✅ 项目基础框架（React + Tauri + SQLite）
- ✅ 宝宝信息管理（添加、查看）
- ✅ 项目管理（创建、查看）
- ✅ 周期管理（自动生成、手动添加、删除）
- ✅ 媒体扫描（自动识别日期、去重）
- ✅ 照片浏览和选择
- ✅ 视频信息获取
- ✅ 视频截图生成
- ✅ 视频生成（FFmpeg实际执行）
- ✅ 本地数据库存储

### 待完善功能
- 🚧 创建项目的UI流程
- 🚧 视频生成页面的实际调用
- 🚧 历史记录页面
- 🚧 视频生成异步化（当前是同步阻塞）
- 🚧 更丰富的转场效果
- 🚧 字幕和文字叠加
- 🚧 应用图标和打包

## 功能特性

### 选取阶段
- 📝 填写宝宝出生信息（姓名、小名、出生日期、性别）
- 📅 设置生成周期（默认7天/周）
- 🔄 自动生成每个周期
- ➕ 支持添加自定义周期（满月、百天、半岁、一岁等）
- 🖼️ 浏览每个周期的照片，标记候选照片
- ✅ 每个周期最终确认1张照片
- 📝 为选中的照片添加描述文字
- 🎬 支持从视频中截取画面使用

### 生成视频阶段
- 🎞️ 按周期顺序排列照片
- ⚙️ 可配置视频参数（分辨率、帧率、照片时长等）
- 🌟 多种转场效果（淡入淡出、滑动、缩放）
- 🎵 支持添加背景音乐
- 📊 实时显示生成进度
- 💾 支持多种格式导出（mp4, mov, avi）

### 历史记录
- 💾 本地数据库存储所有数据
- 📋 保存所有项目历史
- 🔄 可以打开历史项目继续编辑
- 📹 记录每次视频导出的详细信息

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **后端**：Rust + Tauri
- **状态管理**：Zustand
- **路由**：React Router DOM v6
- **数据库**：SQLite（rusqlite）
- **视频处理**：ffmpeg

## 开发环境要求

- Node.js >= 16
- Rust >= 1.60
- Tauri CLI
- ffmpeg（视频生成和截图需要）

### 安装 FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
```bash
# 使用 chocolatey
choco install ffmpeg

# 或从官网下载: https://ffmpeg.org/download.html
```

### 安装 Tauri CLI

```bash
cargo install tauri-cli
```

## 安装和运行

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式运行

```bash
npm run tauri:dev
```

### 3. 构建生产版本

```bash
npm run tauri:build
```

## 项目结构

```
baby-growth-video/
├── src/                          # 前端代码
│   ├── components/               # 通用组件
│   │   └── Layout.tsx           # 布局组件
│   ├── pages/                    # 页面组件
│   │   ├── HomePage.tsx         # 首页
│   │   ├── BabySetupPage.tsx    # 宝宝信息设置
│   │   ├── ProjectPage.tsx      # 项目页面
│   │   ├── PeriodSelectPage.tsx # 周期选择（核心功能）
│   │   ├── VideoGeneratePage.tsx # 视频生成
│   │   └── HistoryPage.tsx      # 历史记录
│   ├── store/                    # 状态管理
│   │   └── index.ts             # Zustand store
│   ├── types/                    # TypeScript类型定义
│   │   └── index.ts
│   ├── utils/                    # 工具函数
│   │   └── tauriCommands.ts     # Tauri命令封装
│   ├── App.tsx                  # 主应用组件
│   ├── main.tsx                 # 入口文件
│   └── index.css                # 全局样式
├── src-tauri/                    # Rust后端代码
│   ├── src/
│   │   ├── main.rs              # 主入口
│   │   ├── db.rs                # 数据库操作
│   │   ├── media.rs             # 媒体处理
│   │   └── video.rs             # 视频生成
│   ├── Cargo.toml               # Rust依赖
│   ├── tauri.conf.json          # Tauri配置
│   ├── build.rs                 # 构建脚本
│   └── icons/                   # 应用图标
├── package.json                 # 前端依赖
├── vite.config.ts               # Vite配置
├── tailwind.config.js           # Tailwind配置
└── tsconfig.json                # TypeScript配置
```

## 数据库设计

### 数据表
1. **babies** - 宝宝信息表
2. **projects** - 项目表
3. **periods** - 周期表
4. **photos** - 照片表
5. **videos** - 视频表
6. **video_frames** - 视频截图表
7. **export_records** - 导出记录表

## 使用说明

### 1. 添加宝宝信息
- 进入"宝宝信息"页面
- 点击"添加宝宝"按钮
- 填写宝宝姓名、小名、出生日期、性别
- 保存

### 2. 创建视频项目
- 在首页点击"新建项目"
- 选择宝宝
- 设置项目名称和周期天数
- 创建项目

### 3. 选择照片
- 进入项目的"周期选择"页面
- 点击"自动生成"生成周期（或手动添加）
- 点击"扫描文件夹"选择宝宝照片所在文件夹
- 系统会自动按日期将照片分配到对应周期
- 浏览每个周期的照片，点击标记为候选
- 从候选照片中选择1张作为最终照片

### 4. 生成视频
- 进入"生成视频"页面
- 配置视频参数（分辨率、帧率、照片时长、转场效果等）
- 可选择添加背景音乐
- 点击"开始生成"
- 等待视频生成完成

### 5. 查看历史记录
- 进入"历史记录"页面
- 查看所有已生成的视频
- 可以播放、下载或删除

## 支持的文件格式

### 照片格式
- JPG/JPEG
- PNG
- GIF
- BMP
- WebP
- HEIC/HEIF
- TIFF/TIF

### 视频格式
- MP4
- MOV
- AVI
- MKV
- FLV
- WMV
- WebM
- M4V
- 3GP

## 注意事项

1. 视频生成需要安装 ffmpeg
2. 照片文件名建议包含日期信息（如 2024-01-01-xxx.jpg），系统会自动识别
3. 所有数据存储在本地，不会上传到任何服务器
4. 建议定期备份数据库文件
5. 当前视频生成是同步执行的，会阻塞UI，后续版本会改为异步

## 故障排除

### Cargo 依赖下载失败

如果遇到 cargo 依赖下载失败，可以尝试切换 Rust 镜像源：

```bash
# 编辑 ~/.cargo/config.toml，添加以下内容
[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "git://mirrors.ustc.edu.cn/crates.io-index"
```

### 视频生成失败

1. 检查 ffmpeg 是否已正确安装：`ffmpeg -version`
2. 检查照片文件是否存在
3. 检查输出目录是否有写入权限

### 照片无法显示

在 Tauri 应用中，本地文件路径需要使用 `file://` 协议。如果照片无法显示，请检查：
1. 文件路径是否正确
2. 文件是否存在
3. Tauri 的安全配置是否允许访问该目录

## 许可证

MIT License
