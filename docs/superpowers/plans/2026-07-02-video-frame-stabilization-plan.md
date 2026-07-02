# Video Frame Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不引入新抽帧结果弹窗的前提下，稳定现有“设置弹窗 -> 抽帧 -> 内嵌播放器 -> 加入待选区”主链，并保证按数量/按间隔都可用。

**Architecture:** 后端补齐并暴露按间隔抽帧命令，前端统一通过 `PeriodSelectPage` 管理抽帧状态机与按钮文案。以 `temp_frames` 为唯一中间态，抽帧成功后更新计数并进入播放器，失败时可恢复重试且不污染状态。保持现有组件结构，不改待选区数据模型。

**Tech Stack:** Tauri 2 (Rust), React 18, TypeScript, Zustand, Vite

---

## File Structure

### Modify
- `src-tauri/src/video.rs`（新增按间隔抽帧实现，复用已有抽帧逻辑）
- `src-tauri/src/main.rs`（新增并注册 `generate_video_frames_by_interval` 命令）
- `src/utils/tauriCommands.ts`（新增 `getTempFrames` 封装，统一临时帧读取入口）
- `src/pages/PeriodSelectPage.tsx`（抽帧状态机、按钮行为、计数刷新、错误恢复）

### Validation Commands
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `pnpm build`
- `pnpm tauri:dev`

---

### Task 1: 后端补齐“按间隔抽帧”能力并暴露命令

**Files:**
- Modify: `src-tauri/src/video.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 在 `video.rs` 增加按间隔抽帧函数（先实现参数校验与 count 计算）**

在 `src-tauri/src/video.rs` 的 `generate_video_frames` 后新增：

```rust
pub fn generate_video_frames_by_interval(
    db: &crate::db::Database,
    video_id: i64,
    interval_seconds: f64,
) -> Result<Vec<crate::db::VideoFrameTemp>, String> {
    if interval_seconds <= 0.0 {
        return Err("抽帧间隔必须大于 0".to_string());
    }

    let video = db.get_video_by_id(video_id).map_err(|e| e.to_string())?;
    let duration = if video.duration > 0.0 {
        video.duration
    } else {
        let (d, _, _) = get_video_info(&video.file_path)?;
        d
    };

    if duration <= 0.0 {
        return Err("视频时长无效".to_string());
    }

    let mut count = (duration / interval_seconds).floor() as i64;
    if count < 1 {
        count = 1;
    }
    if count > 100 {
        count = 100;
    }

    generate_video_frames(db, video_id, count)
}
```

- [ ] **Step 2: 在 `main.rs` 增加 Tauri 命令函数**

在 `src-tauri/src/main.rs` 的视频命令区域加入：

```rust
#[tauri::command]
fn generate_video_frames_by_interval(
    video_id: i64,
    interval_seconds: f64,
    state: State<AppState>,
) -> Result<Vec<db::VideoFrameTemp>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    video::generate_video_frames_by_interval(&db, video_id, interval_seconds)
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 3: 在 `generate_handler!` 注册命令**

在 `src-tauri/src/main.rs` 的 `.invoke_handler(tauri::generate_handler![...])` 中紧跟 `generate_video_frames` 后添加：

```rust
generate_video_frames_by_interval,
```

- [ ] **Step 4: 编译校验后端**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS，无新增 Rust 编译错误。

- [ ] **Step 5: 提交**

```bash
git add src-tauri/src/video.rs src-tauri/src/main.rs
git commit -m "feat(video): expose interval-based frame extraction command"
```

---

### Task 2: 前端补齐临时帧读取封装并统一命令入口

**Files:**
- Modify: `src/utils/tauriCommands.ts`

- [ ] **Step 1: 新增 `getTempFrames` 命令封装**

在 `src/utils/tauriCommands.ts` 视频相关区域加入：

```ts
export async function getTempFrames(videoId: number): Promise<VideoFrameTemp[]> {
  return invoke('get_temp_frames', { videoId });
}
```

- [ ] **Step 2: 确认现有两种抽帧封装参数保持一致**

`src/utils/tauriCommands.ts` 中保留以下定义，不改签名：

```ts
export async function generateVideoFrames(videoId: number, count: number): Promise<VideoFrameTemp[]> {
  return invoke('generate_video_frames', { videoId, count });
}

export async function generateVideoFramesByInterval(videoId: number, intervalSeconds: number): Promise<VideoFrameTemp[]> {
  return invoke('generate_video_frames_by_interval', { videoId, intervalSeconds });
}
```

- [ ] **Step 3: 编译校验前端类型**

Run: `pnpm build`
Expected: PASS，无 TypeScript 错误。

- [ ] **Step 4: 提交**

```bash
git add src/utils/tauriCommands.ts
git commit -m "feat(video): add getTempFrames command wrapper"
```

---

### Task 3: `PeriodSelectPage` 抽帧状态机改造（功能完整 + 体验一致）

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx`

- [ ] **Step 1: 将全局布尔抽帧状态改为“按视频粒度”状态**

把：

```ts
const [isExtractingFrames, setIsExtractingFrames] = useState(false);
```

替换为：

```ts
const [extractingVideoId, setExtractingVideoId] = useState<number | null>(null);
```

- [ ] **Step 2: 新增计数刷新工具函数（单视频 + 批量）**

在 `PeriodSelectPage.tsx` 中新增：

```ts
const refreshVideoFrameCount = async (videoId: number) => {
  try {
    const frames = await getTempFrames(videoId);
    setVideoFrameCounts((prev) => ({ ...prev, [videoId]: frames.length }));
    return frames.length;
  } catch (error) {
    console.error('加载临时帧计数失败:', error);
    setVideoFrameCounts((prev) => ({ ...prev, [videoId]: 0 }));
    return 0;
  }
};

const refreshAllVideoFrameCounts = async (videos: Video[]) => {
  const entries = await Promise.all(
    videos.map(async (video) => ({
      id: video.id,
      count: await refreshVideoFrameCount(video.id),
    }))
  );
  const next: Record<number, number> = {};
  entries.forEach(({ id, count }) => {
    next[id] = count;
  });
  setVideoFrameCounts(next);
};
```

- [ ] **Step 3: 在 `loadPeriodMedia` 成功后刷新所有视频临时帧计数**

将 `loadPeriodMedia` 中加载视频后逻辑补齐为：

```ts
const videos = await getPeriodVideos(periodId);
setCurrentVideos(videos);
await refreshAllVideoFrameCounts(videos);
setSelectedTab('photos');
```

- [ ] **Step 4: 统一抽帧入口行为（无帧走设置、有帧直达查看）**

把原 `handleExtractFrames` 改为：

```ts
const handleExtractFrames = async (video: Video) => {
  const existingCount = videoFrameCounts[video.id] || 0;
  if (existingCount > 0) {
    await loadTempFrames(video.id);
    setCurrentPlayingVideo(video);
    setShowVideoPlayer(true);
    setShowInlinePlayer(true);
    return;
  }
  setCurrentVideoForFrames(video);
  setShowFrameSettings(true);
};
```

- [ ] **Step 5: 统一 `handleGenerateFrames` 成功/失败状态转换**

将 `handleGenerateFrames` 改为：

```ts
const handleGenerateFrames = async (mode: 'count' | 'interval', value: number) => {
  if (!currentVideoForFrames) return;

  const video = currentVideoForFrames;
  setShowFrameSettings(false);
  setExtractingVideoId(video.id);

  try {
    if (mode === 'count') {
      await generateVideoFrames(video.id, value);
    } else {
      await generateVideoFramesByInterval(video.id, value);
    }

    await loadTempFrames(video.id);
    await refreshVideoFrameCount(video.id);

    setCurrentPlayingVideo(video);
    setShowVideoPlayer(true);
    setShowInlinePlayer(true);
  } catch (error) {
    console.error('抽帧失败:', error);
    showToast('error', '抽帧失败', '请重试');
  } finally {
    setExtractingVideoId(null);
  }
};
```

- [ ] **Step 6: 统一按钮禁用与文案渲染规则**

将视频卡片按钮改为：

```tsx
<button
  onClick={() => handleExtractFrames(video)}
  className="btn btn-primary btn-sm flex-1 text-[11px]"
  disabled={extractingVideoId === video.id}
>
  {extractingVideoId === video.id
    ? '抽帧中...'
    : (videoFrameCounts[video.id] || 0) > 0
      ? `查看(${videoFrameCounts[video.id]})`
      : '截取画面'}
</button>
```

- [ ] **Step 7: 周期切换时重置抽帧进行态，避免残留锁定**

在当前周期切换 `useEffect` 内，将：

```ts
setVideoFrameCounts({});
```

后追加：

```ts
setExtractingVideoId(null);
```

- [ ] **Step 8: 编译校验前端**

Run: `pnpm build`
Expected: PASS，无新增类型或构建错误。

- [ ] **Step 9: 提交**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "feat(video): stabilize frame extraction state and card UX"
```

---

### Task 4: 播放器退出后的计数回写与失败可恢复

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx`

- [ ] **Step 1: 在关闭内嵌播放器时刷新当前视频计数**

把 `handleCloseInlinePlayer` 改为：

```ts
const handleCloseInlinePlayer = async () => {
  const closingVideo = currentPlayingVideo;
  setShowInlinePlayer(false);
  setShowVideoPlayer(false);
  setCurrentPlayingVideo(null);

  if (closingVideo) {
    await refreshVideoFrameCount(closingVideo.id);
  }
};
```

- [ ] **Step 2: 确保失败路径可立即重试**

保留 `handleGenerateFrames` 的 `finally { setExtractingVideoId(null); }`，并确认失败后不修改 `videoFrameCounts` 的值。

示例保持：

```ts
} catch (error) {
  console.error('抽帧失败:', error);
  showToast('error', '抽帧失败', '请重试');
} finally {
  setExtractingVideoId(null);
}
```

- [ ] **Step 3: 本地手工验证核心链路**

Run: `pnpm tauri:dev`
Expected:
- 数量模式可抽帧并进入播放器，按钮变为 `查看(n)`
- 间隔模式可抽帧并进入播放器，按钮变为 `查看(n)`
- 抽帧中重复点击同视频按钮无效
- 抽帧失败后按钮恢复并可再次发起
- 退出播放器后计数与按钮状态一致

- [ ] **Step 4: 提交**

```bash
git add src/pages/PeriodSelectPage.tsx
git commit -m "fix(video): refresh temp frame count on inline player close"
```

---

### Task 5: 端到端验收与收尾

**Files:**
- Modify: 无（仅验证）

- [ ] **Step 1: 后端构建校验**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS。

- [ ] **Step 2: 前端构建校验**

Run: `pnpm build`
Expected: PASS。

- [ ] **Step 3: 关键体验验收回归**

Run: `pnpm tauri:dev`
Expected:
- 视频卡片文案仅出现三种状态：`截取画面` / `查看(n)` / `抽帧中...`
- 同一视频不会并发触发多次抽帧
- 抽帧错误提示统一为 `抽帧失败，请重试`
- 未引入新的抽帧结果弹窗流程

- [ ] **Step 4: 合并提交（可选）**

```bash
git log --oneline -n 5
```

Expected: 包含本计划对应的后端、前端稳定化提交。

---

## Spec Coverage Self-Check

1. 规格要求“按数量/按间隔都可用”
   - 对应 Task 1（后端实现与注册）+ Task 3（前端调用）
2. 规格要求“抽帧后稳定进入内嵌播放器”
   - 对应 Task 3 Step 5
3. 规格要求“文案/加载态/错误提示一致”
   - 对应 Task 3 Step 6 + Step 5 + Task 4 Step 2
4. 规格要求“计数与状态一致”
   - 对应 Task 3 Step 2/3 + Task 4 Step 1
5. 规格边界“不新增结果弹窗流程”
   - 贯穿 Task 3/4，且 Task 5 验收显式检查

Placeholder Scan: 已检查，无 TBD/TODO/implement later 等占位。
Type Consistency: `generate_video_frames_by_interval(video_id, interval_seconds)`、`getTempFrames(videoId)`、`extractingVideoId` 在任务中命名一致。
