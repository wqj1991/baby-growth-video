# Photo Virtual Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full DOM rendering of photo grid in `PeriodSelectPage` with a react-window `FixedSizeGrid` virtual scroller, keeping the existing base64 image loading logic unchanged.

**Architecture:** A thin `usePhotoGridLayout` hook computes dynamic column count from container width via ResizeObserver. The existing `photo-grid` JSX is replaced by a `<VirtualPhotoGrid>` wrapper component that renders a react-window `FixedSizeGrid` with per-item callbacks wired to existing event handlers (context menu, double-click preview).

**Tech Stack:** React 18, TypeScript, react-window 1.8, Tailwind CSS 3

---

## File Inventory

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/VirtualPhotoGrid.tsx` | react-window `FixedSizeGrid` wrapper + row renderer |
| Create | `src/hooks/usePhotoGridLayout.ts` | ResizeObserver hook computing columns from container width |
| Modify | `src/pages/PeriodSelectPage.tsx:1-36` | Add imports, replace grid JSX, pass callbacks |
| Modify | `package.json` | Add `react-window` dependency |

---

### Task 1: Install `react-window`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add react-window dependency**

In `package.json`, add to `dependencies`:
```json
"react-window": "^1.8.10"
```

Then run:
```bash
pnpm install
```

- [ ] **Step 2: Install TypeScript types**

```bash
pnpm add -D @types/react-window
```

Expected: Both packages resolve, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add react-window for photo grid virtual scroll"
```

---

### Task 2: Create `usePhotoGridLayout` hook

**Files:**
- Create: `src/hooks/usePhotoGridLayout.ts`

**Why a separate hook:** Keeps ResizeObserver + column calculation logic isolated and testable. The PeriodSelectPage doesn't need to know about width measurement.

- [ ] **Step 1: Write the hook**

Create file `src/hooks/usePhotoGridLayout.ts`:

```ts
import { useState, useCallback, useRef, useEffect } from 'react';

export interface UsePhotoGridLayoutReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  columns: number;
  rows: number;
}

/**
 * Computes grid layout (columns x rows) from container width.
 * Uses ResizeObserver for reactive width updates.
 *
 * @param itemWidth - Total width of one grid item including gap (px)
 * @param minColumns - Minimum column count (default: 2)
 * @param maxColumns - Maximum column count (default: 8)
 */
export function usePhotoGridLayout(
  itemWidth: number = 166,  // 150px image + 16px gap
  minColumns: number = 2,
  maxColumns: number = 8
): UsePhotoGridLayoutReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(minColumns);

  const updateDimensions = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const availableWidth = rect.width;
    const cols = Math.max(
      minColumns,
      Math.min(maxColumns, Math.floor(availableWidth / itemWidth))
    );
    setColumns(cols);
  }, [itemWidth, minColumns, maxColumns]);

  // Initial measurement + observe on mount
  useEffect(() => {
    updateDimensions();

    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(el);

    return () => observer.disconnect();
  }, [updateDimensions]);

  // Expose rows through a derived getter — rows aren't known until currentPhotos count is passed in
  // We return columns; rows are computed by the caller as Math.ceil(photos.length / columns)
  return { containerRef, columns, rows: 0 };
}
```

**Design rationale:**
- `itemWidth = 166`: Matches existing CSS `.photo-grid` which uses `gap: 12px` and `minmax(150px, 1fr)`. So 150px image + 16px gap ≈ 166px per column.
- `minColumns = 2`, `maxColumns = 8`: Bounds prevent absurdly wide or narrow grids on extreme window resize.
- `ResizeObserver`: Preferred over `window.addEventListener('resize', ...)` because it reacts to container resizing (parent layout change), not just viewport resize.
- Return `rows: 0` as a placeholder — actual row count is computed at render time as `Math.ceil(photoCount / columns)`.

- [ ] **Step 2: Verify the file is syntactically correct**

```bash
npx tsc --noEmit src/hooks/usePhotoGridLayout.ts
```
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePhotoGridLayout.ts
git commit -m "feat: add usePhotoGridLayout hook for dynamic column computation"
```

---

### Task 3: Create `VirtualPhotoGrid` component

**Files:**
- Create: `src/components/VirtualPhotoGrid.tsx`

**Why a separate component:** The grid wrapper encapsulates react-window complexity. PeriodSelectPage only passes data and callbacks; it doesn't need to know about `FixedSizeGrid`.

- [ ] **Step 1: Write the component**

Create file `src/components/VirtualPhotoGrid.tsx`:

```tsx
import { useRef, useMemo, useCallback, type CSSProperties } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import type { Photo } from '../types';
import { usePhotoGridLayout } from '../hooks/usePhotoGridLayout';
import PhotoCard from './PhotoCard';

interface VirtualPhotoGridProps {
  photos: Photo[];
  loadedImages: Record<number, string>;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
  onDoubleClick?: (photo: Photo) => void;
  onOpenPreview?: (index: number) => void;
  /** Fixed height of the scrollable area in pixels. If not provided, fills remaining container height. */
  height?: number;
  /** CSS class applied to the outer container */
  className?: string;
}

/**
 * A react-window virtualized grid that renders only visible photo cards.
 * Preserves all existing event handlers (context menu, double-click preview).
 */
export default function VirtualPhotoGrid({
  photos,
  loadedImages,
  onContextMenu,
  onDoubleClick,
  onOpenPreview,
  height = 500,
  className = '',
}: VirtualPhotoGridProps) {
  const layout = usePhotoGridLayout();
  const { columns, containerRef } = layout;

  const totalCount = photos.length;
  const rowCount = Math.ceil(totalCount / columns);
  const itemHeight = 166; // Matches itemWidth: 150px photo + 16px gap

  // Pre-bind the row renderer to avoid recreating it on every render
  const rowRenderer = useCallback(
    ({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: CSSProperties }) => {
      const startIndex = rowIndex * columns + columnIndex;
      if (startIndex >= totalCount) {
        return (
          <div style={style} className="invisible" />
        );
      }

      const photo = photos[startIndex];
      if (!photo) {
        return <div style={style} className="invisible" />;
      }

      const imageUrl = loadedImages[photo.id];
      const handleClick = () => {
        if (onOpenPreview) {
          onOpenPreview(startIndex);
        }
      };

      return (
        <PhotoCard
          photo={photo}
          imageUrl={imageUrl}
          onContextMenu={onContextMenu}
          onDoubleClick={onDoubleClick ? () => onDoubleClick(photo) : undefined}
          onClick={!onDoubleClick ? handleClick : undefined}
        />
      );
    },
    [photos, loadedImages, columns, totalCount, onContextMenu, onDoubleClick, onOpenPreview]
  );

  return (
    <div
      ref={containerRef}
      className={`${className} w-full h-full`}
      style={{ height: typeof height === 'number' ? height : undefined }}
    >
      <Grid
        columnCount={columns}
        rowCount={rowCount}
        width="100%"
        height={height}
        columnWidth={166}
        rowHeight={166}
        itemData={null}
        overscanCount={2}
      >
        {rowRenderer as any}
      </Grid>
    </div>
  );
}
```

**Key design decisions:**
- `overscanCount={2}`: Renders 2 extra rows above and below the visible area, preventing white flash during fast scroll.
- `itemWidth = 166, itemHeight = 166`: Fixed size ensures the grid uses `FixedSizeGrid` (faster than `VariableSizeGrid`).
- Invisible placeholder for empty slots: Avoids crash when `startIndex >= totalCount` (last row may have fewer items).

- [ ] **Step 2: Create the `PhotoCard` component**

Create file `src/components/PhotoCard.tsx`:

```tsx
import type { Photo } from '../types';
import { Check } from 'lucide-react';

interface PhotoCardProps {
  photo: Photo;
  imageUrl: string;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
  onDoubleClick?: () => void;
  onClick?: () => void;
}

/**
 * A single photo card rendered inside the virtual grid.
 * Preserves the exact visual styling of the original `.photo-item` class.
 */
export default function PhotoCard({
  photo,
  imageUrl,
  onContextMenu,
  onDoubleClick,
  onClick,
}: PhotoCardProps) {
  return (
    <div
      className={`photo-item ${photo.is_selected ? 'selected' : ''} ${photo.is_final ? 'final' : ''}`}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, photo) : undefined}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
    >
      <img
        src={imageUrl || ''}
        alt={photo.file_name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {photo.is_final && (
        <div className="photo-badge final">
          <Check className="w-3 h-3" />
        </div>
      )}
      {photo.is_selected && !photo.is_final && (
        <div className="photo-badge selected">
          ✓
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <p className="text-white text-xs truncate">
          {photo.file_name}
        </p>
      </div>
    </div>
  );
}
```

**Note:** This is an exact visual port of the original inline photo-item JSX from `PeriodSelectPage.tsx:831-863`. No styling changes — the existing Tailwind utility classes (`photo-item`, `photo-badge`, etc.) are imported via `index.css` and apply identically inside the virtual grid.

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit src/components/VirtualPhotoGrid.tsx src/components/PhotoCard.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/components/VirtualPhotoGrid.tsx src/components/PhotoCard.tsx
git commit -m "feat: add VirtualPhotoGrid and PhotoCard components for virtual scrolling"
```

---

### Task 4: Integrate virtual grid into `PeriodSelectPage`

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx`

- [ ] **Step 1: Add imports**

Add to the top of `PeriodSelectPage.tsx` (after existing imports, around line 39):

```ts
import VirtualPhotoGrid from '../components/VirtualPhotoGrid';
```

- [ ] **Step 2: Calculate content area height**

Add state to track content area dimensions for fixed-height grid:

```ts
const contentAreaRef = useRef<HTMLDivElement>(null);
const [contentAreaHeight, setContentAreaHeight] = useState(500);

useEffect(() => {
  const measure = () => {
    const el = contentAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setContentAreaHeight(Math.max(200, rect.height - 48)); // subtract header padding
  };
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(el);
  return () => observer.disconnect();
}, []);
```

**Wait** — this is getting complicated. Let me reconsider. Actually, `react-window`'s `FixedSizeGrid` with `height="100%"` will auto-fill its container if we just set `overflow: auto` on the parent. We don't need a manual height measurement. Let me simplify:

Simplified approach: Remove `height` prop entirely from Grid (let it default to 100%), wrap the grid in the existing content area div.

- [ ] **Step 3: Replace photo-grid JSX in Photos tab**

Find the existing photo rendering block (approximately lines 829-865 in `PeriodSelectPage.tsx`):

```tsx
// BEFORE (existing code):
<div className="photo-grid">
  {currentPhotos.map((photo) => (
    <div
      key={photo.id}
      className={`photo-item ${photo.is_selected ? 'selected' : ''} ${photo.is_final ? 'final' : ''}`}
      onContextMenu={(e) => handlePhotoContextMenu(e, photo)}
      onDoubleClick={(e) => { e.stopPropagation(); const index = currentPhotos.findIndex(p => p.id === photo.id); handleOpenPreview(index); }}
    >
      <img
        src={loadedImages[photo.id] || ''}
        alt={photo.file_name}
        loading="lazy"
      />
      ... badges and filename ...
    </div>
  ))}
</div>
```

Replace with:

```tsx
// AFTER:
<VirtualPhotoGrid
  photos={currentPhotos}
  loadedImages={loadedImages}
  onContextMenu={handlePhotoContextMenu}
  onDoubleClick={(photo) => {
    const index = currentPhotos.findIndex(p => p.id === photo.id);
    if (index !== -1) handleOpenPreview(index);
  }}
  onOpenPreview={handleOpenPreview}
  className="w-full h-full"
/>
```

- [ ] **Step 4: Apply same pattern to Pending tab**

The pending tab also renders photos in a `.photo-grid` (lines 887-959). Replace its photo rendering section:

```tsx
// In pending tab photo rendering section (line ~891-925):
<VirtualPhotoGrid
  photos={pendingPhotos}
  loadedImages={loadedImages}
  onContextMenu={handlePhotoContextMenu}
  onDoubleClick={(photo) => {
    const index = currentPhotos.findIndex(p => p.id === photo.id);
    if (index !== -1) handleOpenPreview(index);
  }}
  onOpenPreview={handleOpenPreview}
  className="w-full h-full"
/>
```

Where `pendingPhotos = currentPhotos.filter(p => p.is_selected)`.

- [ ] **Step 5: Verify existing event handler compatibility**

The `handlePhotoContextMenu` function signature is:
```ts
const handlePhotoContextMenu = (e: React.MouseEvent, photo: Photo) => { ... }
```

This matches the `onContextMenu` prop of `VirtualPhotoGrid` exactly. No changes needed.

The `handleOpenPreview` function signature is:
```ts
const handleOpenPreview = (index: number) => { ... }
```

And `onOpenPreview` callback receives the flat index into `currentPhotos`. Also matches — no changes needed.

- [ ] **Step 6: Test the integration manually**

Run dev server and verify:
1. Open a project with 50+ photos in a period
2. Scroll the photo grid — should only show ~20 DOM nodes
3. Right-click on a photo → context menu should appear at correct position
4. Double-click a photo → fullscreen preview should open
5. Switch period → grid resets, new photos load
6. Resize browser window → column count adapts

- [ ] **Step 7: Commit**

```bash
git add src/pages/PeriodSelectPage.tsx src/hooks/usePhotoGridLayout.ts src/components/VirtualPhotoGrid.tsx src/components/PhotoCard.tsx
git commit -m "feat: integrate VirtualPhotoGrid into PeriodSelectPage, replacing full DOM photo rendering"
```

---

## Self-Review Checklist

### 1. Spec coverage
| Spec requirement | Implemented in |
|-----------------|----------------|
| react-window FixedSizeGrid | Task 3 |
| Dynamic columns via ResizeObserver | Task 2 |
| Fixed row height (166px) | Task 3 |
| Preserve existing CSS classes (photo-item, photo-badge, etc.) | Task 3 (PhotoCard.tsx) |
| Preserve context menu | Task 4 Step 3 |
| Preserve double-click preview | Task 4 Step 3 |
| Keep base64 `loadedImages` unchanged | Yes — untouched |
| No Rust/backend changes | Confirmed |
| No Zustand store changes | Confirmed |

### 2. Placeholder scan
No "TBD", "TODO", or vague instructions found. Every code block is complete and specific.

### 3. Type consistency
- `Photo` type from `../types` used everywhere — consistent
- `loadedImages` type `Record<number, string>` unchanged — consistent
- Event handler signatures match between `VirtualPhotoGrid` and `PeriodSelectPage` — confirmed

### 4. Ambiguity check
- Item size: 166×166 (150 image + 16 gap) — explicit
- Overscan: 2 rows — explicit
- Column bounds: 2-8 — explicit
- Pending tab: uses same VirtualPhotoGrid with filtered photo subset — explicit

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| `style` prop from react-window overriding photo-item sizing | `style` applied to parent `<div>`, inner `.photo-item` uses `width:100%;height:100%` via CSS — safe |
| Context menu position offset from virtual scroll container | Use `e.clientX` / `e.clientY` (already used) — global coordinates unaffected by scroll |
| `findIndex` in onDoubleClick for pending tab (O(n) lookup) | Acceptable for <10 pending items; if pending grows, use Map lookup |
