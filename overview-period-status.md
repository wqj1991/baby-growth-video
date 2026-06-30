# 周期状态统一为三种

## 变更总结

**需求**: 周期时间线状态应统一为：未开始 / 已有待选 / 已确认最终

**改动范围**: 2 个文件

| 文件 | 变更 |
|------|------|
| `src/components/PeriodTimeline.tsx` | 状态计算改为数据驱动：按 `selected_photo_id` + 媒体数量判定；当前选中仅作为 `selected` 视觉标识 |
| `src/index.css` | 将 `.done/.current/.pending` 替换为 `.confirmed/.has_pending/.not_started`；新增 `.selected` 选中光环；待选徽章改为白色 |

**状态判定逻辑**:
- `已确认最终`: `selected_photo_id` 存在
- `已有待选`: 无最终，但照片/视频总数 > 0
- `未开始`: 无最终且无媒体

**视觉处理**:
- 已确认: 绿色圆点 + 勾选 + 绿色文字
- 已有待选: 橙色渐变圆点 + 待选计数 + 橙色文字
- 未开始: 灰色数字圆点 + 灰色文字
- 当前选中: 橙色外圈光环，不影响状态颜色

**验证**: TypeScript 零错误 (`tsc --noEmit`)
