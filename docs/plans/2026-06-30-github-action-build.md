# GitHub Action 自动打包实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 GitHub Action 工作流，当创建新的 Git 标签时自动触发，在 Windows 和 macOS 平台并行构建应用并生成安装包，最后上传到 GitHub Release。

**Architecture:** 使用 GitHub Actions 并行构建 Windows 和 macOS 版本，通过 tauri build 命令生成安装包，使用 softprops/action-gh-release 创建 Release 并上传产物。

**Tech Stack:** GitHub Actions, Rust, Node.js, pnpm, Tauri v2

---

## 文件结构

- **创建:** `.github/workflows/build.yml` - GitHub Action 工作流配置
- **修改:** `src-tauri/tauri.conf.json` - 添加 macOS 的 dmg 打包目标

---

### Task 1: 创建 GitHub Action 工作流文件

**Files:**
- Create: `.github/workflows/build.yml`

- [ ] **Step 1: 创建工作流目录和文件**

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: stable

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build app
        run: pnpm tauri build

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-build
          path: |
            src-tauri/target/release/bundle/nsis/*.exe
            src-tauri/target/release/bundle/nsis/*.zip

  build-macos:
    runs-on: macos-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: stable

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build app
        run: pnpm tauri build

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: macos-build
          path: |
            src-tauri/target/release/bundle/dmg/*.dmg
            src-tauri/target/release/bundle/macos/*.app.tar.gz

  release:
    needs: [build-windows, build-macos]
    runs-on: ubuntu-latest
    steps:
      - name: Download Windows artifacts
        uses: actions/download-artifact@v4
        with:
          name: windows-build
          path: windows

      - name: Download macOS artifacts
        uses: actions/download-artifact@v4
        with:
          name: macos-build
          path: macos

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            windows/*.exe
            windows/*.zip
            macos/*.dmg
            macos/*.tar.gz
```

- [ ] **Step 2: 验证文件内容**

检查文件是否正确创建，确认 YAML 语法正确。

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "feat: add github action for auto build"
```

---

### Task 2: 修改 tauri.conf.json 添加 macOS 打包目标

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: 读取当前配置**

确认当前的 `bundle.targets` 配置。

- [ ] **Step 2: 修改配置添加 dmg 目标**

将 `bundle.targets` 从 `["nsis"]` 修改为 `["nsis", "dmg"]`：

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis", "dmg"],
    ...
  }
}
```

- [ ] **Step 3: 验证配置文件**

检查 JSON 语法是否正确，确认修改已保存。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: add dmg target for macos build"
```

---

### Task 3: 本地测试工作流配置

**Files:**
- Test: `.github/workflows/build.yml`

- [ ] **Step 1: 检查 GitHub Actions 配置**

使用 `act` 工具或直接推送到 GitHub 进行测试。

- [ ] **Step 2: 创建测试标签**

```bash
git tag v0.1.0-test
git push origin v0.1.0-test
```

- [ ] **Step 3: 查看构建状态**

在 GitHub 仓库的 Actions 页面查看构建是否成功。

- [ ] **Step 4: 清理测试标签**

```bash
git tag -d v0.1.0-test
git push origin :v0.1.0-test
```

---

## Self-Review

### 1. Spec Coverage

| 需求点 | 对应任务 |
|--------|----------|
| 标签触发 | Task 1 - on.push.tags |
| Windows 打包 (NSIS) | Task 1 - build-windows |
| macOS 打包 (DMG) | Task 1 - build-macos + Task 2 |
| 上传 Release | Task 1 - release job |
| 暂不签名 | Task 1 - 未配置签名步骤 |

### 2. Placeholder Scan

- 无 TBD 或 TODO 项
- 所有步骤都包含具体代码
- 无模糊描述

### 3. Type Consistency

- 文件路径一致
- 配置项名称一致