# 网格布局调整完成

## 本次修改

- **照片网格统一为 3 列/行**：将 `src/index.css` 中 `.photo-grid` 的默认列数从 5 列改为 3 列，并移除了 1280px/960px 的响应式断点，确保所有使用 `photo-grid` 的地方都统一显示 3 张照片/行。
- **视频网格改为 2 列/行**：将 `src/pages/PeriodSelectPage.tsx` 中「视频」Tab 的 `grid-cols-3` 改为 `grid-cols-2`，使每个视频卡片更宽、更协调。
- **新增 `.video-grid` 工具类**：在 `src/index.css` 中预留了 `display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;` 样式，方便后续统一使用。

## 影响范围

- `VirtualPhotoGrid` 组件（所有使用 `.photo-grid` 的照片列表）现在统一为 3 列。
- `PeriodSelectPage` 的「视频」Tab 现在每行显示 2 个视频。

## 后续建议

- 如果后续想把视频卡片也抽成独立组件并统一使用 `.video-grid`，可以告诉我。
- 若在大屏下觉得 3 列照片过大，可考虑按最小宽度 (`minmax`) 而非固定列数布局。
