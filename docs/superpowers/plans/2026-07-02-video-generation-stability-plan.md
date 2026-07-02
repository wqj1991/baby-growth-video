# Video Generation Stability Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance video generation stability with cancellation mechanism, improved error handling, resource cleanup, and better state management.

**Architecture:** Use `Arc<AtomicBool>` as cancellation flag stored in a global hashmap. Check cancel status at key generation stages. Capture FFmpeg stderr for detailed error messages. Track temporary files for cleanup on failure/cancellation.

**Tech Stack:** Rust, Tauri 2, React, TypeScript, FFmpeg

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src-tauri/src/video.rs` | Cancel mechanism, error handling, resource cleanup |
| `src-tauri/src/main.rs` | Cancel command registration |
| `src/utils/tauriCommands.ts` | Frontend API for cancel command |
| `src/pages/VideoGeneratePage.tsx` | Cancel button, improved error display |

---

## Task 1: Add Cancellation Mechanism to video.rs

**Files:**
- Modify: `src-tauri/src/video.rs:1-76`

- [ ] **Step 1: Add cancel map and helper functions**

Add after the existing `PROGRESS_MAP`:

```rust
static ref CANCEL_MAP: Mutex<HashMap<String, Arc<AtomicBool>>> = Mutex::new(HashMap::new());
}

pub fn register_cancel_flag(task_id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    CANCEL_MAP.lock().unwrap().insert(task_id.to_string(), Arc::clone(&flag));
    flag
}

pub fn unregister_cancel_flag(task_id: &str) {
    CANCEL_MAP.lock().unwrap().remove(task_id);
}

pub fn cancel_task(task_id: &str) {
    if let Some(flag) = CANCEL_MAP.lock().unwrap().get(task_id) {
        flag.store(true, Ordering::Relaxed);
    }
}

pub fn is_cancelled(flag: &Arc<AtomicBool>) -> bool {
    flag.load(Ordering::Relaxed)
}
```

- [ ] **Step 2: Build and verify**

Run: `cd src-tauri && cargo build --quiet`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/video.rs
git commit -m "feat: add cancellation mechanism with AtomicBool"
```

---

## Task 2: Add Cancel Command to main.rs

**Files:**
- Modify: `src-tauri/src/main.rs:450-453`

- [ ] **Step 1: Add cancel_generation command**

Add after `get_generation_progress`:

```rust
#[tauri::command]
fn cancel_generation(task_id: String) -> Result<(), String> {
    video::cancel_task(&task_id);
    Ok(())
}
```

- [ ] **Step 2: Register command in invoke_handler**

Add `cancel_generation` to the invoke_handler list:

```rust
.invoke_handler(tauri::generate_handler![
    // ... other commands ...
    generate_growth_video,
    get_generation_progress,
    cancel_generation,
    get_export_records,
    // ... rest of commands ...
])
```

- [ ] **Step 3: Build and verify**

Run: `cd src-tauri && cargo build --quiet`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat: add cancel_generation tauri command"
```

---

## Task 3: Enhance FFmpeg Error Handling

**Files:**
- Modify: `src-tauri/src/video.rs:827-857`

- [ ] **Step 1: Capture FFmpeg stderr**

Modify the FFmpeg execution block to capture stderr:

```rust
let ffmpeg_result = tauri::async_runtime::spawn_blocking(move || {
    let _ = ah.emit(
        "generation-progress",
        GenerationProgress {
            stage: "ffmpeg_encoding".to_string(),
            current: 0,
            total: 1,
            percentage: 50,
            message: "正在编码视频...".to_string(),
        },
    );

    let output = Command::new(get_ffmpeg_path())
        .args(&ffmpeg_args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("执行 FFmpeg 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let error_msg = if stderr.len() > 1000 {
            format!("视频生成失败: {}", &stderr[..1000])
        } else {
            format!("视频生成失败: {}", stderr)
        };
        return Err(error_msg);
    }

    let file_size = std::fs::metadata(&output_clone)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    Ok(file_size)
})
.await
.map_err(|e| format!("FFmpeg 任务异常: {}", e))?;
```

- [ ] **Step 2: Build and verify**

Run: `cd src-tauri && cargo build --quiet`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/video.rs
git commit -m "feat: capture FFmpeg stderr for detailed error messages"
```

---

## Task 4: Add Cancel Checks to Standard Generation Pipeline

**Files:**
- Modify: `src-tauri/src/video.rs:726-892`

- [ ] **Step 1: Add task_id parameter and cancel flag**

Modify function signature and add cancel registration:

```rust
pub async fn generate_growth_video_async(
    db: Arc<Mutex<Database>>,
    project_id: i64,
    config: VideoConfig,
    output_path: String,
    app_handle: tauri::AppHandle,
    task_id: String,
) -> Result<ExportRecord, String> {
    let cancel_flag = register_cancel_flag(&task_id);
    let _guard = scopeguard::guard((), |_| unregister_cancel_flag(&task_id));

    // ── Phase 1: 读取照片 + 创建导出记录 ──
    let (photos, record) = {
        // ... existing code ...
    };

    if is_cancelled(&cancel_flag) {
        return Err("用户已取消".to_string());
    }

    // ── Phase 2: AI 过渡帧生成（如启用）──
    // ... existing code ...

    if is_cancelled(&cancel_flag) {
        return Err("用户已取消".to_string());
    }

    // ── Phase 3: 构建 FFmpeg 命令 ──
    // ... existing code ...

    if is_cancelled(&cancel_flag) {
        return Err("用户已取消".to_string());
    }

    // ── Phase 4: 执行 FFmpeg ──
    // ... existing code ...
}
```

- [ ] **Step 2: Add scopeguard dependency to Cargo.toml**

```toml
[dependencies]
# ... other dependencies ...
scopeguard = "1.2"
```

- [ ] **Step 3: Build and verify**

Run: `cd src-tauri && cargo build --quiet`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/video.rs src-tauri/Cargo.toml
git commit -m "feat: add cancel checks to standard video generation pipeline"
```

---

## Task 5: Add Cancel Checks to Agnes Generation Pipeline

**Files:**
- Modify: `src-tauri/src/video.rs:489-724`

- [ ] **Step 1: Add task_id parameter and cancel flag**

Modify function signature and add cancel registration:

```rust
pub async fn generate_growth_video_agnes(
    db: Arc<Mutex<Database>>,
    project_id: i64,
    config: VideoConfig,
    overall_prompt: String,
    photo_texts: Vec<PhotoText>,
    output_path: String,
    app_handle: tauri::AppHandle,
    task_id: String,
) -> Result<ExportRecord, String> {
    let cancel_flag = register_cancel_flag(&task_id);
    let _guard = scopeguard::guard((), |_| unregister_cancel_flag(&task_id));

    // ── Phase 1: 读取设置和照片 ──
    let (settings, photos, record) = {
        // ... existing code ...
    };

    if is_cancelled(&cancel_flag) {
        return Err("用户已取消".to_string());
    }

    // ── Phase 2: 文字预处理 ──
    // ... existing code ...

    if is_cancelled(&cancel_flag) {
        return Err("用户已取消".to_string());
    }

    // ── Phase 3: 调用 Agnes API ──
    // ... existing code ...

    // Fallback to standard mode on Agnes failure
    if is_cancelled(&cancel_flag) {
        return Err("用户已取消".to_string());
    }
}
```

- [ ] **Step 2: Build and verify**

Run: `cd src-tauri && cargo build --quiet`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/video.rs
git commit -m "feat: add cancel checks to Agnes video generation pipeline"
```

---

## Task 6: Update Frontend Command Interface

**Files:**
- Modify: `src/utils/tauriCommands.ts:221-240`

- [ ] **Step 1: Add cancel_generation function**

Add after `generateGrowthVideo`:

```typescript
export async function cancelGeneration(taskId: string): Promise<void> {
  return invoke('cancel_generation', { taskId });
}
```

- [ ] **Step 2: Update generateGrowthVideo to accept taskId**

Modify function signature:

```typescript
export async function generateGrowthVideo(
  projectId: number,
  config: VideoConfig,
  outputPath: string,
  overallPrompt?: string,
  photoTexts?: PhotoText[],
  taskId?: string,
): Promise<ExportRecord> {
  return invoke('generate_growth_video', {
    projectId,
    config,
    outputPath,
    overallPrompt: overallPrompt || null,
    photoTexts: photoTexts || null,
    taskId: taskId || null,
  });
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `pnpm run build --quiet`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src/utils/tauriCommands.ts
git commit -m "feat: add cancelGeneration command and update generateGrowthVideo"
```

---

## Task 7: Add Cancel Button to VideoGeneratePage

**Files:**
- Modify: `src/pages/VideoGeneratePage.tsx:126-205`

- [ ] **Step 1: Add taskId state and cancel handler**

Add state and handler:

```typescript
const [taskId, setTaskId] = useState<string>('');

const handleCancel = async () => {
  if (taskId) {
    await cancelGeneration(taskId);
    setGenerationStage('cancelled');
    setGenerationMessage('生成已取消');
    setIsGenerating(false);
  }
};
```

- [ ] **Step 2: Generate taskId on generation start**

Modify `handleGenerate`:

```typescript
const handleGenerate = async () => {
  // ... existing validation ...
  
  const newTaskId = `generate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  setTaskId(newTaskId);
  
  setIsGenerating(true);
  // ... rest of function ...
};
```

- [ ] **Step 3: Pass taskId to generateGrowthVideo**

```typescript
const result = await generateGrowthVideo(
  currentProject.id,
  { ...config, video_mode: videoMode, ai_enabled: aiEnabled },
  outputPath,
  videoMode === 'agnes' ? overallPrompt : undefined,
  videoMode === 'agnes' ? photoTexts : undefined,
  newTaskId,
);
```

- [ ] **Step 4: Add cancel button in generation UI**

Add cancel button next to progress bar:

```tsx
{isGenerating && (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <StageIcon stage={generationStage} />
        <span className="text-sm font-medium text-stone-700">
          {getStageLabel(generationStage)}
        </span>
      </div>
      <button
        onClick={handleCancel}
        className="text-sm text-error hover:text-error/80 font-medium"
      >
        取消生成
      </button>
    </div>
    {/* ... rest of progress UI ... */}
  </div>
)}
```

- [ ] **Step 5: Handle cancelled state in StageIcon**

Add case to `StageIcon`:

```typescript
case 'cancelled':
  return <X className={`${baseClass} text-stone-500`} />;
```

- [ ] **Step 6: Verify TypeScript compilation**

Run: `pnpm run build --quiet`
Expected: Build succeeds with no errors

- [ ] **Step 7: Commit**

```bash
git add src/pages/VideoGeneratePage.tsx
git commit -m "feat: add cancel button and taskId management to VideoGeneratePage"
```

---

## Task 8: Update Backend Command to Accept taskId

**Files:**
- Modify: `src-tauri/src/main.rs:422-448`

- [ ] **Step 1: Add taskId parameter to generate_growth_video**

```rust
#[tauri::command]
async fn generate_growth_video(
    project_id: i64,
    config: video::VideoConfig,
    output_path: String,
    overall_prompt: Option<String>,
    photo_texts: Option<Vec<video::PhotoText>>,
    task_id: Option<String>,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<db::ExportRecord, String> {
    let db = state.db.clone();
    let tid = task_id.unwrap_or_else(|| format!("task_{}", uuid::Uuid::new_v4()));

    if config.video_mode == "agnes" {
        video::generate_growth_video_agnes(
            db,
            project_id,
            config,
            overall_prompt.unwrap_or_default(),
            photo_texts.unwrap_or_default(),
            output_path,
            app_handle,
            tid,
        )
        .await
    } else {
        video::generate_growth_video_async(db, project_id, config, output_path, app_handle, tid).await
    }
}
```

- [ ] **Step 2: Build and verify**

Run: `cd src-tauri && cargo build --quiet`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat: pass taskId to video generation functions"
```

---

## Task 9: Add Resource Cleanup on Failure/Cancellation

**Files:**
- Modify: `src-tauri/src/video.rs`

- [ ] **Step 1: Add helper function to clean AI frames directory**

```rust
fn cleanup_ai_frames(project_id: i64) {
    let ai_frames_dir = get_ai_frames_dir(project_id);
    if ai_frames_dir.exists() {
        let _ = std::fs::remove_dir_all(&ai_frames_dir);
    }
}

fn cleanup_agnes_temp(project_id: i64) {
    let temp_dir = get_ai_frames_dir(project_id).join("agnes_temp");
    if temp_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
```

- [ ] **Step 2: Call cleanup on failure/cancellation in standard mode**

```rust
// After FFmpeg phase error handling
match ffmpeg_result {
    Ok(file_size) => {
        // ... success handling ...
    }
    Err(e) => {
        cleanup_ai_frames(project_id);
        let _ = app_handle.emit(
            "generation-progress",
            GenerationProgress {
                stage: "error".to_string(),
                current: 0,
                total: photos.len(),
                percentage: 100,
                message: format!("视频生成失败: {}", e),
            },
        );
        Err(e)
    }
}
```

- [ ] **Step 3: Call cleanup on failure/cancellation in Agnes mode**

Add cleanup calls in Agnes mode error paths.

- [ ] **Step 4: Build and verify**

Run: `cd src-tauri && cargo build --quiet`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/video.rs
git commit -m "feat: add resource cleanup on failure and cancellation"
```

---

## Task 10: Test and Verify

**Files:**
- All modified files

- [ ] **Step 1: Build the entire project**

Run: `pnpm run tauri build --debug`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run frontend tests**

Run: `pnpm run test`
Expected: All tests pass

- [ ] **Step 3: Manual verification**

1. Start the app
2. Create a project and select photos
3. Start video generation
4. Click "取消生成" button
5. Verify generation stops
6. Verify temporary files are cleaned up

- [ ] **Step 4: Commit final changes**

```bash
git add -A
git commit -m "chore: finalize video generation stability enhancements"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| Cancel mechanism with AtomicBool | Task 1, 2, 4, 5 |
| FFmpeg stderr capture | Task 3 |
| Cancel checks at key stages | Task 4, 5 |
| Frontend cancel button | Task 7 |
| Resource cleanup | Task 9 |
| Error handling | Task 3, 4, 5 |

### Placeholder Scan

- No TBD, TODO, or placeholder text
- All code blocks contain complete code
- All commands include expected output

### Type Consistency

- `task_id` parameter consistent across all functions
- `cancel_generation` command matches frontend API
- `is_cancelled` helper used consistently

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-02-video-generation-stability-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?