# GitHub Action 自动打包设计文档

## 概述

为宝宝成长视频应用添加 GitHub Action 工作流，实现当创建新的 Git 标签时自动触发打包，分别在 Windows 和 macOS 平台生成安装包，并上传到 GitHub Release。

## 需求分析

| 需求点 | 描述 |
|--------|------|
| 触发条件 | 创建新的 Git 标签（v* 格式）时触发 |
| Windows 打包 | 生成 NSIS 安装包（.exe） |
| macOS 打包 | 生成 DMG 磁盘镜像（.dmg） |
| 产物处理 | 自动创建 GitHub Release，上传安装包作为资产 |
| Mac 签名 | 暂不签名（用户未准备证书） |

## 技术方案

### 工作流结构

```
触发条件：创建新的 Git 标签 (v*)
    │
    ├─→ Windows 构建 (windows-latest)
    │       ├─ 设置 Rust toolchain
    │       ├─ 设置 Node.js + pnpm
    │       ├─ 安装依赖
    │       └─ 运行 tauri build (生成 NSIS)
    │
    ├─→ macOS 构建 (macos-latest)
    │       ├─ 设置 Rust toolchain
    │       ├─ 设置 Node.js + pnpm
    │       ├─ 安装依赖
    │       └─ 运行 tauri build (生成 DMG)
    │
    └─→ 创建 Release 并上传产物
            └─ 上传所有构建产物到 GitHub Release
```

### 关键配置

#### 1. 工作流文件路径

`.github/workflows/build.yml`

#### 2. 触发规则

```yaml
on:
  push:
    tags:
      - 'v*'
```

#### 3. Windows 构建步骤

- 虚拟机：`windows-latest`
- 设置 Rust：使用 `dtolnay/rust-toolchain` 安装 stable 版本
- 设置 Node：使用 `actions/setup-node` 安装 Node 20 + pnpm
- 缓存依赖：使用 `actions/cache` 缓存 pnpm 和 Rust 依赖
- 构建命令：`pnpm tauri build`

#### 4. macOS 构建步骤

- 虚拟机：`macos-latest`（macOS 14 Sonoma）
- 设置 Rust：使用 `dtolnay/rust-toolchain` 安装 stable 版本
- 设置 Node：使用 `actions/setup-node` 安装 Node 20 + pnpm
- 缓存依赖：使用 `actions/cache` 缓存 pnpm 和 Rust 依赖
- 构建命令：`pnpm tauri build`
- 注意：暂不签名，需在 tauri.conf.json 中配置 `bundle.targets` 为 `["dmg"]`

#### 5. Release 创建

- 使用 `softprops/action-gh-release` 动作
- 将构建产物（.exe, .dmg）作为 Release 资产上传

### 文件修改

#### 需要新增的文件

1. `.github/workflows/build.yml` - GitHub Action 工作流配置

#### 需要修改的文件

1. `src-tauri/tauri.conf.json` - 添加 macOS 的 dmg 打包目标

## 实施步骤

1. 创建 `.github/workflows/build.yml` 文件
2. 修改 `src-tauri/tauri.conf.json`，添加 macOS 的 dmg 打包目标
3. 测试工作流：创建标签触发构建

## 注意事项

1. **macOS 签名**：当前未配置签名，生成的 DMG 需要用户手动右键打开（macOS 安全限制）
2. **缓存优化**：使用 GitHub Actions 缓存可以显著加快后续构建速度
3. **标签格式**：仅触发 `v*` 格式的标签，如 `v0.1.0`, `v1.0.0`
4. **并行构建**：Windows 和 macOS 构建并行执行，节省时间

## 后续扩展

1. 添加 macOS 签名（需要 Apple Developer 证书）
2. 添加 Linux 平台支持
3. 添加代码签名验证
4. 添加自动更新服务器配置