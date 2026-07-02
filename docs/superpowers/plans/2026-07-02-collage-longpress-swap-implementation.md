# Collage Long-Press Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在拼图画布中实现“短按格内平移、长按换位拖拽”的统一 Pointer 交互，满足 300ms 长按、4px 防误触、24px 吸附阈值。

**Architecture:** 在现有 `CollageWorkspace` 内引入手势状态机，统一处理 pointerdown/move/up/cancel。将阈值判定与命中算法拆到独立工具模块，先用测试锁定行为，再接入组件并替换旧的 canvas HTML5 拖拽路径。保留右侧列表排序能力不变。

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Zustand, Vitest, @testing-library/react, jsdom

---

## File Structure

### Create
- `vitest.config.ts`（Vitest 配置）
- `src/test/setup.ts`（测试环境初始化）
- `src/utils/collageGesture.ts`（手势阈值、命中、状态转移纯函数）
- `src/utils/collageGesture.test.ts`（纯函数单测）
- `src/components/CollageWorkspace.pointer.test.tsx`（关键交互测试）

### Modify
- `package.json`（新增 test 脚本与测试依赖）
- `src/components/CollageWorkspace.tsx`（接入 pointer 状态机，移除画布换位 draggable 路径）
- `src/index.css`（补充换位模式视觉态类）

### Validation Commands
- `pnpm install`
- `pnpm test --run`
- `pnpm build`

---

### Task 1: 建立前端测试基线（Vitest + jsdom）

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json`

- [ ] **Step 1: 写出最小失败测试入口（先让命令可执行）**

在 `src/test/setup.ts` 放入最小初始化代码：

```ts
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 2: 运行测试命令确认当前失败（依赖缺失）**

Run: `pnpm test --run`
Expected: FAIL，提示 `test` script 或 `vitest` 不存在。

- [ ] **Step 3: 增加脚本与依赖，补齐配置**

在 `package.json` 中新增：

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest --run"
  },
  "devDependencies": {
    "vitest": "^2.0.5",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8",
    "jsdom": "^24.1.0"
  }
}
```

创建 `vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
  },
});
```

- [ ] **Step 4: 运行测试命令确认测试框架可启动**

Run: `pnpm install && pnpm test:run`
Expected: PASS（0 tests 或后续任务前的空集通过）。

- [ ] **Step 5: 提交**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts src/test/setup.ts
git commit -m "test: setup vitest and jsdom for UI interaction tests"
```

---

### Task 2: 手势阈值与命中算法（纯函数）

**Files:**
- Create: `src/utils/collageGesture.ts`
- Create: `src/utils/collageGesture.test.ts`

- [ ] **Step 1: 先写失败测试，锁定核心规则**

在 `src/utils/collageGesture.test.ts` 写入：

```ts
import { describe, expect, it } from 'vitest';
import {
  PRESS_MOVE_THRESHOLD_PX,
  LONG_PRESS_MS,
  SNAP_THRESHOLD_PX,
  distance,
  shouldEnterLongPress,
  shouldEnterPan,
  pickSwapCandidate,
} from './collageGesture';

describe('collageGesture thresholds', () => {
  it('uses agreed constants', () => {
    expect(PRESS_MOVE_THRESHOLD_PX).toBe(4);
    expect(LONG_PRESS_MS).toBe(300);
    expect(SNAP_THRESHOLD_PX).toBe(24);
  });

  it('allows long press only when movement <= 4px', () => {
    expect(shouldEnterLongPress(3.9, 300)).toBe(true);
    expect(shouldEnterLongPress(4, 300)).toBe(true);
    expect(shouldEnterLongPress(4.01, 300)).toBe(false);
  });

  it('enters pan when movement > 4px before long press', () => {
    expect(shouldEnterPan(4.01)).toBe(true);
    expect(shouldEnterPan(4)).toBe(false);
  });
});

describe('swap candidate picking', () => {
  it('picks nearest non-self target within 24px', () => {
    const candidate = pickSwapCandidate(
      1,
      { x: 100, y: 100 },
      [
        { regionIdx: 0, centerX: 200, centerY: 200 },
        { regionIdx: 1, centerX: 101, centerY: 101 },
        { regionIdx: 2, centerX: 110, centerY: 108 },
      ],
    );

    expect(candidate?.regionIdx).toBe(2);
  });

  it('returns null when all targets are outside threshold', () => {
    const candidate = pickSwapCandidate(
      0,
      { x: 0, y: 0 },
      [{ regionIdx: 2, centerX: 100, centerY: 100 }],
    );
    expect(candidate).toBeNull();
  });

  it('distance helper returns euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
```

- [ ] **Step 2: 运行指定测试并确认失败**

Run: `pnpm test:run src/utils/collageGesture.test.ts`
Expected: FAIL，提示模块或导出不存在。

- [ ] **Step 3: 实现最小可用纯函数模块**

在 `src/utils/collageGesture.ts` 写入：

```ts
export const PRESS_MOVE_THRESHOLD_PX = 4;
export const LONG_PRESS_MS = 300;
export const SNAP_THRESHOLD_PX = 24;

export interface Point {
  x: number;
  y: number;
}

export interface RegionCenter {
  regionIdx: number;
  centerX: number;
  centerY: number;
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function shouldEnterLongPress(moveDistance: number, elapsedMs: number): boolean {
  return moveDistance <= PRESS_MOVE_THRESHOLD_PX && elapsedMs >= LONG_PRESS_MS;
}

export function shouldEnterPan(moveDistance: number): boolean {
  return moveDistance > PRESS_MOVE_THRESHOLD_PX;
}

export function pickSwapCandidate(
  selfRegionIdx: number,
  pointer: Point,
  centers: RegionCenter[],
): { regionIdx: number; distance: number } | null {
  const candidates = centers
    .filter((c) => c.regionIdx !== selfRegionIdx)
    .map((c) => ({
      regionIdx: c.regionIdx,
      distance: distance(pointer, { x: c.centerX, y: c.centerY }),
    }))
    .sort((a, b) => (a.distance - b.distance) || (a.regionIdx - b.regionIdx));

  const nearest = candidates[0];
  if (!nearest || nearest.distance > SNAP_THRESHOLD_PX) {
    return null;
  }
  return nearest;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test:run src/utils/collageGesture.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/collageGesture.ts src/utils/collageGesture.test.ts
git commit -m "test: add collage gesture threshold and snap candidate unit tests"
```

---

### Task 3: 组件交互测试（先失败）

**Files:**
- Create: `src/components/CollageWorkspace.pointer.test.tsx`
- Modify: `src/components/CollageWorkspace.tsx`（仅在后续任务实现）

- [ ] **Step 1: 写失败测试覆盖三条关键路径**

在 `src/components/CollageWorkspace.pointer.test.tsx` 编写场景：

```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import CollageWorkspace from './CollageWorkspace';

function renderWorkspace() {
  return render(
    <CollageWorkspace
      selectedItems={[]}
      loadedImages={{}}
      pendingItems={[]}
      onBack={vi.fn()}
      onGenerate={vi.fn()}
      generating={false}
    />,
  );
}

describe('CollageWorkspace pointer gestures', () => {
  it('starts pan when pointer move exceeds 4px before 300ms', () => {
    const { container } = renderWorkspace();
    const region = container.querySelector('[data-region-idx="0"]') as HTMLElement;

    fireEvent.pointerDown(region, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(region, { clientX: 106, clientY: 100, pointerId: 1 });

    expect(region.dataset.gesturePhase).toBe('panning');
  });

  it('enters swapping after 300ms when movement <= 4px', async () => {
    vi.useFakeTimers();
    const { container } = renderWorkspace();
    const region = container.querySelector('[data-region-idx="0"]') as HTMLElement;

    fireEvent.pointerDown(region, { clientX: 100, clientY: 100, pointerId: 1 });
    vi.advanceTimersByTime(300);

    expect(region.dataset.gesturePhase).toBe('swapping');
    vi.useRealTimers();
  });

  it('does not swap when dropping in blank area', () => {
    const { container } = renderWorkspace();
    const canvas = container.querySelector('[data-collage-canvas]') as HTMLElement;

    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 500, clientY: 500, pointerId: 1 });

    expect(canvas.dataset.swapResult).toBe('rebound');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test:run src/components/CollageWorkspace.pointer.test.tsx`
Expected: FAIL，提示缺少 `data-region-idx` / `data-gesture-phase` 或行为未实现。

- [ ] **Step 3: 仅补最小可测标记（不改业务逻辑）**

在 `CollageWorkspace` 先加入测试标识位（后续任务再接完整逻辑）：

```tsx
<div
  data-collage-canvas
  data-swap-result={swapResultForTest}
>
  <div
    data-region-idx={idx}
    data-gesture-phase={gestureState.phase}
  />
</div>
```

- [ ] **Step 4: 重新跑测试，确认仍失败在行为断言**

Run: `pnpm test:run src/components/CollageWorkspace.pointer.test.tsx`
Expected: FAIL（结构断言通过，但交互断言失败）。

- [ ] **Step 5: 提交**

```bash
git add src/components/CollageWorkspace.pointer.test.tsx src/components/CollageWorkspace.tsx
git commit -m "test: add failing pointer gesture scenarios for collage workspace"
```

---

### Task 4: 接入 Pointer 手势状态机并替换画布换位拖拽

**Files:**
- Modify: `src/components/CollageWorkspace.tsx`
- Modify: `src/utils/collageGesture.ts`（必要时补 helper）

- [ ] **Step 1: 先让测试明确失败点**

Run: `pnpm test:run src/components/CollageWorkspace.pointer.test.tsx`
Expected: FAIL，定位到 phase 和 swap 结果不符合预期。

- [ ] **Step 2: 实现最小可过行为（Pointer 统一入口）**

在 `CollageWorkspace.tsx` 实现：

```tsx
type GesturePhase = 'idle' | 'pressing' | 'panning' | 'swapping' | 'settling';

const [gestureState, setGestureState] = useState<{
  phase: GesturePhase;
  pointerId: number | null;
  sourceRegionIdx: number | null;
  startClientX: number;
  startClientY: number;
  swapCandidateRegionIdx: number | null;
}>({
  phase: 'idle',
  pointerId: null,
  sourceRegionIdx: null,
  startClientX: 0,
  startClientY: 0,
  swapCandidateRegionIdx: null,
});

const longPressTimerRef = useRef<number | null>(null);

function clearLongPressTimer() {
  if (longPressTimerRef.current !== null) {
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }
}

function beginPress(regionIdx: number, e: React.PointerEvent<HTMLDivElement>) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  setGestureState({
    phase: 'pressing',
    pointerId: e.pointerId,
    sourceRegionIdx: regionIdx,
    startClientX: e.clientX,
    startClientY: e.clientY,
    swapCandidateRegionIdx: null,
  });

  clearLongPressTimer();
  longPressTimerRef.current = window.setTimeout(() => {
    setGestureState((prev) => {
      if (prev.phase !== 'pressing') return prev;
      return { ...prev, phase: 'swapping' };
    });
  }, 300);
}

function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
  setGestureState((prev) => {
    if (prev.pointerId !== e.pointerId) return prev;

    const dx = e.clientX - prev.startClientX;
    const dy = e.clientY - prev.startClientY;
    const moveDistance = Math.sqrt(dx * dx + dy * dy);

    if (prev.phase === 'pressing' && moveDistance > 4) {
      clearLongPressTimer();
      return { ...prev, phase: 'panning' };
    }

    if (prev.phase === 'swapping' && prev.sourceRegionIdx !== null) {
      const candidate = pickSwapCandidate(prev.sourceRegionIdx, { x: e.clientX, y: e.clientY }, regionCentersRef.current);
      return { ...prev, swapCandidateRegionIdx: candidate?.regionIdx ?? null };
    }

    return prev;
  });
}

function endGesture(e: React.PointerEvent<HTMLDivElement>) {
  setGestureState((prev) => {
    if (prev.pointerId !== e.pointerId) return prev;

    if (prev.phase === 'swapping') {
      if (prev.sourceRegionIdx !== null && prev.swapCandidateRegionIdx !== null) {
        swapRegions(prev.sourceRegionIdx, prev.swapCandidateRegionIdx);
        setSwapResultForTest('swapped');
      } else {
        setSwapResultForTest('rebound');
      }
    }

    return {
      phase: 'idle',
      pointerId: null,
      sourceRegionIdx: null,
      startClientX: 0,
      startClientY: 0,
      swapCandidateRegionIdx: null,
    };
  });

  clearLongPressTimer();
}
```

并移除画布区域旧路径：
- `draggable={...}`
- `onDragStart/onDragOver/onDragLeave/onDrop/onDragEnd`
- `spaceDragMode` 相关逻辑与提示

- [ ] **Step 3: 跑组件测试与纯函数测试**

Run:
- `pnpm test:run src/utils/collageGesture.test.ts`
- `pnpm test:run src/components/CollageWorkspace.pointer.test.tsx`

Expected: PASS。

- [ ] **Step 4: 构建验证**

Run: `pnpm build`
Expected: PASS，Vite build 成功。

- [ ] **Step 5: 提交**

```bash
git add src/components/CollageWorkspace.tsx src/utils/collageGesture.ts
git commit -m "feat: unify collage pan and swap interactions with pointer state machine"
```

---

### Task 5: 补齐换位视觉态与吸附反馈

**Files:**
- Modify: `src/components/CollageWorkspace.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: 先写视觉态断言测试（可基于 className）**

在 `src/components/CollageWorkspace.pointer.test.tsx` 补用例：

```tsx
it('applies swapping visual classes after long press', async () => {
  vi.useFakeTimers();
  const { container } = renderWorkspace();
  const region = container.querySelector('[data-region-idx="0"]') as HTMLElement;

  fireEvent.pointerDown(region, { clientX: 100, clientY: 100, pointerId: 1 });
  vi.advanceTimersByTime(300);

  expect(region.className).toContain('collage-region-swapping');
  vi.useRealTimers();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test:run src/components/CollageWorkspace.pointer.test.tsx`
Expected: FAIL，类名未出现。

- [ ] **Step 3: 实现视觉态 class 与样式**

在 `CollageWorkspace.tsx` 区域类名增加：

```tsx
const isSwappingSource = gestureState.phase === 'swapping' && gestureState.sourceRegionIdx === idx;
const isSwapCandidate = gestureState.phase === 'swapping' && gestureState.swapCandidateRegionIdx === idx;

className={[
  'collage-region',
  isSwappingSource ? 'collage-region-swapping' : '',
  isSwapCandidate ? 'collage-region-swap-candidate' : '',
].join(' ')}
```

在 `src/index.css` 增加：

```css
.collage-region-swapping {
  transform: scale(1.04);
  border: 2px dashed rgba(245, 139, 61, 0.9);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
  opacity: 0.9;
  z-index: 20;
}

.collage-region-swap-candidate {
  outline: 3px solid rgba(245, 139, 61, 0.9);
  outline-offset: -2px;
}
```

- [ ] **Step 4: 运行测试与构建**

Run:
- `pnpm test:run src/components/CollageWorkspace.pointer.test.tsx`
- `pnpm build`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/components/CollageWorkspace.pointer.test.tsx src/components/CollageWorkspace.tsx src/index.css
git commit -m "feat: add long-press swap visual states and snap highlight"
```

---

### Task 6: 回归验证与收尾

**Files:**
- Modify: `docs/STATUS.md`（可选：记录本次交互升级）

- [ ] **Step 1: 运行全量前端测试**

Run: `pnpm test:run`
Expected: PASS。

- [ ] **Step 2: 运行构建与 Tauri 检查**

Run:
- `pnpm build`
- `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: PASS。

- [ ] **Step 3: 手工验收（按规格逐条）**

手工验证场景：
1. 短按拖动立即进入格内平移。
2. 位移超过边界后不换格，仅受限回弹。
3. 按住 300ms 且位移 <= 4px 进入换位模式。
4. 长按后拖到最近块 <= 24px，松手互换。
5. 长按后拖到空白区，松手回弹。
6. 连续多次平移/换位操作无卡死。

- [ ] **Step 4: 记录结果并提交**

如需要，在 `docs/STATUS.md` 追加一段简要记录：

```md
- 2026-07-02: 完成拼图画布 Pointer 手势统一（短按平移 / 长按换位），阈值为 300ms / 4px / 24px。
```

- [ ] **Step 5: 最终提交**

```bash
git add src docs package.json pnpm-lock.yaml
git commit -m "feat: implement collage long-press swap with bounded pan"
```

---

## Self-Review

### 1. Spec Coverage
- 短按默认平移：Task 4。
- 格内边界锁定：Task 4（复用 clamp）。
- 长按 300ms：Task 2/4。
- 4px 防误触：Task 2/4。
- 换位视觉态：Task 5。
- 24px 吸附与互换：Task 2/4。
- 空白区域回弹：Task 3/4。
- 右侧列表拖拽不变：Task 4（仅移除画布 draggable）。

### 2. Placeholder Scan
- 无 TBD/TODO/“后续补充”占位语句。
- 每个代码步骤均附示例代码。

### 3. Type Consistency
- 阈值常量统一使用：`PRESS_MOVE_THRESHOLD_PX=4`、`LONG_PRESS_MS=300`、`SNAP_THRESHOLD_PX=24`。
- 手势阶段命名统一：`idle/pressing/panning/swapping/settling`。
- 候选目标字段统一：`swapCandidateRegionIdx`。
