# 拼图区域编辑 + 导出设置 — 完成总结

## 新增功能

### 1. 区域点击选中
- 点击预览画布中任意区域 → 橙色高亮 ring + 右上角序号标签
- 右侧照片列表中对应行同步高亮
- 点击画布空白或再次点击同区域 → 取消选中

### 2. 区域编辑工具栏（选中后显示）
| 操作 | 说明 |
|------|------|
| **替换照片** | 展开当前周期所有照片缩略图网格，点击即换（已用照片标记"已用"） |
| **旋转 90°** | 每次顺时针旋转 90°（0→90→180→270→0） |
| **水平翻转** | 切换镜像翻转，按钮高亮指示当前状态 |
| **垂直翻转** | 切换上下翻转，按钮高亮指示当前状态 |

所有变换通过 CSS `transform` 实时预览在画布中。

### 3. 导出设置（侧边栏可折叠面板）
- **清晰度滑块**：60% ~ 100%，4 个快捷预设（低/中/高/无损）
- **输出尺寸**：1080 / 2048 / 4096 px，三个按钮切换
- **预估文件大小**：基于 `pixels × quality_ratio` 经验公式实时计算

## 修改文件

| 文件 | 变更 |
|------|------|
| `src/utils/collageTemplates.ts` | +RegionTransform 类型、toCssTransform()、QUALITY_PRESETS、OUTPUT_SIZE_PRESETS、estimateFileSize() |
| `src/store/index.ts` | +selectedRegionIndex、regionTransforms、collageQuality、collageOutputSize |
| `src/components/CollageWorkspace.tsx` | 全面重写：区域选中+变换预览+编辑工具栏+照片替换器+导出设置 |
| `src/pages/PeriodSelectPage.tsx` | handleGenerateCollage 扩展签名，构造后端 genPayload |

## 后端接口预留结构

```typescript
{
  template_id: "t3-1",
  output_width: 1080,
  output_height: 1080,
  gap_px: 3,
  jpeg_quality: 92,
  photo_paths: ["/path/photo1.jpg", "/path/photo2.jpg", "/path/photo3.jpg"],
  regions: [
    { x: 0, y: 0, w: 0.5, h: 1, order: 0, rotation: 0, flip_h: false, flip_v: false },
    { x: 0.5, y: 0, w: 0.5, h: 0.5, order: 1, rotation: 90, flip_h: false, flip_v: false },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5, order: 2, rotation: 0, flip_h: true, flip_v: false },
  ]
}
```

Rust 后端收到后流程：region 坐标 → 裁剪子图 → 应用 rotation/flip → 像素拼合 → JPEG 编码 → 写入文件 → 返回路径给前端加入待选区。
