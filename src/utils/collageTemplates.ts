/**
 * 拼图模板库 — 归一化坐标布局系统
 *
 * 所有坐标基于 [0, 1] 归一化，最终映射到 1080×1080 输出画布。
 * 前端渲染和 Rust 后端合成共享同一套模板数据。
 */

// ─── Types ──────────────────────────────────────────────────

/** 单个照片区域的归一化坐标定义 */
export interface CollageRegion {
  /** 左上角 X 坐标 (0~1) */
  x: number;
  /** 左上角 Y 坐标 (0~1) */
  y: number;
  /** 区域宽度比例 (0~1) */
  w: number;
  /** 区域高度比例 (0~1) */
  h: number;
  /** 对应照片索引 (0-based) */
  order: number;
}

/** 拼图模板定义 */
export interface CollageTemplate {
  /** 唯一标识，如 "t4-1" */
  id: string;
  /** 模板名称 */
  name: string;
  /** 简短描述 */
  desc: string;
  /** 使用建议 */
  tips: string;
  /** 区域定义数组（按 order 排序） */
  regions: CollageRegion[];
}

/** 所有模板按照片数量分组 */
export type TemplateLibrary = Record<number, CollageTemplate[]>;

// ─── Template Data ──────────────────────────────────────────

export const TEMPLATES: TemplateLibrary = {
  2: [
    {
      id: 't2-1', name: '左右对称', desc: '两张等宽并排',
      tips: '最简单经典的布局，适合两人合照或对比照片',
      regions: [
        { x: 0, y: 0, w: 0.5, h: 1, order: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 1, order: 1 },
      ],
    },
    {
      id: 't2-2', name: '上下对称', desc: '两张等高叠放',
      tips: '适合横屏照片组合',
      regions: [
        { x: 0, y: 0, w: 1, h: 0.5, order: 0 },
        { x: 0, y: 0.5, w: 1, h: 0.5, order: 1 },
      ],
    },
    {
      id: 't2-3', name: '左主右副', desc: '主图占 60%，副图 40%',
      tips: '突出主图的布局',
      regions: [
        { x: 0, y: 0, w: 0.6, h: 1, order: 0 },
        { x: 0.6, y: 0, w: 0.4, h: 1, order: 1 },
      ],
    },
    {
      id: 't2-4', name: '主图上副图下', desc: '主图 62% 高度',
      tips: '电影感画幅比例',
      regions: [
        { x: 0, y: 0, w: 1, h: 0.62, order: 0 },
        { x: 0, y: 0.62, w: 1, h: 0.38, order: 1 },
      ],
    },
    {
      id: 't2-5', name: '对角叠加', desc: '小图悬浮于主图之上',
      tips: '有时尚杂志封面感',
      regions: [
        { x: 0, y: 0, w: 1, h: 1, order: 0 },
        { x: 0.55, y: 0.6, w: 0.42, h: 0.38, order: 1 },
      ],
    },
  ],

  3: [
    {
      id: 't3-1', name: '一大两小', desc: '主图占左 50%，右侧上下均分',
      tips: '最常用三宫格，视觉重心突出',
      regions: [
        { x: 0, y: 0, w: 0.5, h: 1, order: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5, order: 1 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5, order: 2 },
      ],
    },
    {
      id: 't3-2', name: '横向三等分', desc: '三张等宽纵向排列',
      tips: '适合时间线/成长序列',
      regions: [
        { x: 0, y: 0, w: 0.3333, h: 1, order: 0 },
        { x: 0.3333, y: 0, w: 0.3334, h: 1, order: 1 },
        { x: 0.6667, y: 0, w: 0.3333, h: 1, order: 2 },
      ],
    },
    {
      id: 't3-3', name: '品字形', desc: '上两张等宽，下一张居中',
      tips: '稳定三角构图，适合全家福',
      regions: [
        { x: 0, y: 0, w: 0.5, h: 0.55, order: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 0.55, order: 1 },
        { x: 0.15, y: 0.55, w: 0.7, h: 0.45, order: 2 },
      ],
    },
    {
      id: 't3-4', name: '纵向三等分', desc: '三张等高排列',
      tips: '适合竖屏手机照片',
      regions: [
        { x: 0, y: 0, w: 1, h: 0.3333, order: 0 },
        { x: 0, y: 0.3333, w: 1, h: 0.3334, order: 1 },
        { x: 0, y: 0.6667, w: 1, h: 0.3333, order: 2 },
      ],
    },
    {
      id: 't3-5', name: 'L 形', desc: '左上主图 + 右和下',
      tips: '杂志式图文混排感',
      regions: [
        { x: 0, y: 0, w: 0.58, h: 0.62, order: 0 },
        { x: 0.58, y: 0, w: 0.42, h: 0.62, order: 1 },
        { x: 0, y: 0.62, w: 1, h: 0.38, order: 2 },
      ],
    },
  ],

  4: [
    {
      id: 't4-1', name: '田字格', desc: '2×2 等分',
      tips: '最经典的四方拼图，整齐均衡',
      regions: [
        { x: 0, y: 0, w: 0.5, h: 0.5, order: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5, order: 1 },
        { x: 0, y: 0.5, w: 0.5, h: 0.5, order: 2 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5, order: 3 },
      ],
    },
    {
      id: 't4-2', name: '横幅一大三小', desc: '上方主图 + 下方三张小图',
      tips: '适合主图+细节组合',
      regions: [
        { x: 0, y: 0, w: 1, h: 0.55, order: 0 },
        { x: 0, y: 0.55, w: 0.3333, h: 0.45, order: 1 },
        { x: 0.3333, y: 0.55, w: 0.3334, h: 0.45, order: 2 },
        { x: 0.6667, y: 0.55, w: 0.3333, h: 0.45, order: 3 },
      ],
    },
    {
      id: 't4-3', name: '左侧一大三小', desc: '左侧主图 + 右侧三张小图',
      tips: '经典不对称布局',
      regions: [
        { x: 0, y: 0, w: 0.55, h: 1, order: 0 },
        { x: 0.55, y: 0, w: 0.45, h: 0.3333, order: 1 },
        { x: 0.55, y: 0.3333, w: 0.45, h: 0.3333, order: 2 },
        { x: 0.55, y: 0.6666, w: 0.45, h: 0.3334, order: 3 },
      ],
    },
    {
      id: 't4-4', name: '上下对半', desc: '上下各两张',
      tips: '节奏感强，适合横版照片',
      regions: [
        { x: 0, y: 0, w: 0.5, h: 0.5, order: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5, order: 1 },
        { x: 0, y: 0.5, w: 0.5, h: 0.5, order: 2 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5, order: 3 },
      ],
    },
    {
      id: 't4-5', name: '风车形', desc: '不对称旋转式布局',
      tips: '活泼动感，适合孩子照片',
      regions: [
        { x: 0, y: 0, w: 0.6, h: 0.6, order: 0 },
        { x: 0.6, y: 0, w: 0.4, h: 0.4, order: 1 },
        { x: 0.6, y: 0.4, w: 0.4, h: 0.6, order: 2 },
        { x: 0, y: 0.6, w: 0.6, h: 0.4, order: 3 },
      ],
    },
  ],

  5: [
    {
      id: 't5-1', name: '十字形', desc: '上 2 + 中 1 通栏 + 下 2',
      tips: '中心视觉突出，左右对称',
      regions: [
        { x: 0, y: 0, w: 0.5, h: 0.28, order: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 0.28, order: 1 },
        { x: 0, y: 0.28, w: 1, h: 0.44, order: 2 },
        { x: 0, y: 0.72, w: 0.5, h: 0.28, order: 3 },
        { x: 0.5, y: 0.72, w: 0.5, h: 0.28, order: 4 },
      ],
    },
    {
      id: 't5-2', name: '一行五', desc: '五等分纵向排列',
      tips: '极简，适合时间序列',
      regions: [
        { x: 0, y: 0, w: 0.2, h: 1, order: 0 },
        { x: 0.2, y: 0, w: 0.2, h: 1, order: 1 },
        { x: 0.4, y: 0, w: 0.2, h: 1, order: 2 },
        { x: 0.6, y: 0, w: 0.2, h: 1, order: 3 },
        { x: 0.8, y: 0, w: 0.2, h: 1, order: 4 },
      ],
    },
    {
      id: 't5-3', name: '一大四小', desc: '主图左半区 + 四个小图右半区',
      tips: '适合宝宝成长月龄对照',
      regions: [
        { x: 0, y: 0, w: 0.5, h: 1, order: 0 },
        { x: 0.5, y: 0, w: 0.25, h: 0.5, order: 1 },
        { x: 0.75, y: 0, w: 0.25, h: 0.5, order: 2 },
        { x: 0.5, y: 0.5, w: 0.25, h: 0.5, order: 3 },
        { x: 0.75, y: 0.5, w: 0.25, h: 0.5, order: 4 },
      ],
    },
    {
      id: 't5-4', name: 'E 形', desc: '左一右四',
      tips: '右侧 2×2 小网格',
      regions: [
        { x: 0, y: 0, w: 0.45, h: 1, order: 0 },
        { x: 0.45, y: 0, w: 0.275, h: 0.5, order: 1 },
        { x: 0.725, y: 0, w: 0.275, h: 0.5, order: 2 },
        { x: 0.45, y: 0.5, w: 0.275, h: 0.5, order: 3 },
        { x: 0.725, y: 0.5, w: 0.275, h: 0.5, order: 4 },
      ],
    },
  ],

  6: [
    {
      id: 't6-1', name: '2×3 网格', desc: '2 列 × 3 行等分',
      tips: '整齐干净，最常用的六宫格',
      regions: [
        { x: 0, y: 0, w: 0.5, h: 0.3333, order: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 0.3333, order: 1 },
        { x: 0, y: 0.3333, w: 0.5, h: 0.3334, order: 2 },
        { x: 0.5, y: 0.3333, w: 0.5, h: 0.3334, order: 3 },
        { x: 0, y: 0.6667, w: 0.5, h: 0.3333, order: 4 },
        { x: 0.5, y: 0.6667, w: 0.5, h: 0.3333, order: 5 },
      ],
    },
    {
      id: 't6-2', name: '3×2 网格', desc: '3 列 × 2 行等分',
      tips: '横版宽屏比例',
      regions: [
        { x: 0, y: 0, w: 0.3333, h: 0.5, order: 0 },
        { x: 0.3333, y: 0, w: 0.3334, h: 0.5, order: 1 },
        { x: 0.6667, y: 0, w: 0.3333, h: 0.5, order: 2 },
        { x: 0, y: 0.5, w: 0.3333, h: 0.5, order: 3 },
        { x: 0.3333, y: 0.5, w: 0.3334, h: 0.5, order: 4 },
        { x: 0.6667, y: 0.5, w: 0.3333, h: 0.5, order: 5 },
      ],
    },
    {
      id: 't6-3', name: '一大五小', desc: '上方通栏主图 + 下方五个小图',
      tips: '主次分明，突出核心照片',
      regions: [
        { x: 0, y: 0, w: 1, h: 0.45, order: 0 },
        { x: 0, y: 0.45, w: 0.2, h: 0.55, order: 1 },
        { x: 0.2, y: 0.45, w: 0.2, h: 0.55, order: 2 },
        { x: 0.4, y: 0.45, w: 0.2, h: 0.55, order: 3 },
        { x: 0.6, y: 0.45, w: 0.2, h: 0.55, order: 4 },
        { x: 0.8, y: 0.45, w: 0.2, h: 0.55, order: 5 },
      ],
    },
    {
      id: 't6-4', name: '对角主图', desc: '左上主图 + 其余环绕',
      tips: '动态对角线构图',
      regions: [
        { x: 0, y: 0, w: 0.55, h: 0.55, order: 0 },
        { x: 0.55, y: 0, w: 0.45, h: 0.35, order: 1 },
        { x: 0.55, y: 0.35, w: 0.225, h: 0.3, order: 2 },
        { x: 0.775, y: 0.35, w: 0.225, h: 0.3, order: 3 },
        { x: 0, y: 0.55, w: 0.3, h: 0.45, order: 4 },
        { x: 0.3, y: 0.55, w: 0.7, h: 0.45, order: 5 },
      ],
    },
  ],

  7: [
    {
      id: 't7-1', name: '十字一大六小', desc: '中间主图 + 四周六个小图',
      tips: '视觉重心居中，适合宝宝满月照',
      regions: [
        { x: 0, y: 0, w: 0.28, h: 0.28, order: 0 },
        { x: 0.28, y: 0, w: 0.44, h: 0.28, order: 1 },
        { x: 0.72, y: 0, w: 0.28, h: 0.28, order: 2 },
        { x: 0, y: 0.28, w: 0.28, h: 0.44, order: 3 },
        { x: 0.28, y: 0.28, w: 0.44, h: 0.44, order: 4 },
        { x: 0.72, y: 0.28, w: 0.28, h: 0.44, order: 5 },
        { x: 0, y: 0.72, w: 1, h: 0.28, order: 6 },
      ],
    },
    {
      id: 't7-2', name: '九宫格缺两角', desc: '3×3 去掉右上和左下',
      tips: '自然留白，视觉透气',
      regions: [
        { x: 0, y: 0, w: 0.3333, h: 0.3333, order: 0 },
        { x: 0.3333, y: 0, w: 0.3333, h: 0.3333, order: 1 },
        { x: 0, y: 0.3333, w: 0.3333, h: 0.3333, order: 2 },
        { x: 0.3333, y: 0.3333, w: 0.3333, h: 0.3333, order: 3 },
        { x: 0.6667, y: 0.3333, w: 0.3333, h: 0.3333, order: 4 },
        { x: 0.3333, y: 0.6667, w: 0.3333, h: 0.3333, order: 5 },
        { x: 0.6667, y: 0.6667, w: 0.3333, h: 0.3333, order: 6 },
      ],
    },
    {
      id: 't7-3', name: '左三右四', desc: '左侧 3 行 + 右侧 2×2',
      tips: '规则中带变化',
      regions: [
        { x: 0, y: 0, w: 0.4, h: 0.3333, order: 0 },
        { x: 0, y: 0.3333, w: 0.4, h: 0.3334, order: 1 },
        { x: 0, y: 0.6667, w: 0.4, h: 0.3333, order: 2 },
        { x: 0.4, y: 0, w: 0.3, h: 0.5, order: 3 },
        { x: 0.7, y: 0, w: 0.3, h: 0.5, order: 4 },
        { x: 0.4, y: 0.5, w: 0.3, h: 0.5, order: 5 },
        { x: 0.7, y: 0.5, w: 0.3, h: 0.5, order: 6 },
      ],
    },
  ],

  8: [
    {
      id: 't8-1', name: '九宫格缺中心', desc: '四周 8 张环绕中心留白',
      tips: '中心可添加文字或装饰',
      regions: [
        { x: 0, y: 0, w: 0.3333, h: 0.3333, order: 0 },
        { x: 0.3333, y: 0, w: 0.3334, h: 0.3333, order: 1 },
        { x: 0.6667, y: 0, w: 0.3333, h: 0.3333, order: 2 },
        { x: 0, y: 0.3333, w: 0.3333, h: 0.3334, order: 3 },
        { x: 0.6667, y: 0.3333, w: 0.3333, h: 0.3334, order: 4 },
        { x: 0, y: 0.6667, w: 0.3333, h: 0.3333, order: 5 },
        { x: 0.3333, y: 0.6667, w: 0.3334, h: 0.3333, order: 6 },
        { x: 0.6667, y: 0.6667, w: 0.3333, h: 0.3333, order: 7 },
      ],
    },
    {
      id: 't8-2', name: '2×4 网格', desc: '2 列 × 4 行等分',
      tips: '纵向延伸，适合手机竖屏浏览',
      regions: [
        { x: 0, y: 0, w: 0.5, h: 0.25, order: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 0.25, order: 1 },
        { x: 0, y: 0.25, w: 0.5, h: 0.25, order: 2 },
        { x: 0.5, y: 0.25, w: 0.5, h: 0.25, order: 3 },
        { x: 0, y: 0.5, w: 0.5, h: 0.25, order: 4 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.25, order: 5 },
        { x: 0, y: 0.75, w: 0.5, h: 0.25, order: 6 },
        { x: 0.5, y: 0.75, w: 0.5, h: 0.25, order: 7 },
      ],
    },
    {
      id: 't8-3', name: '二大六小', desc: '上两张大图 + 下六张小图',
      tips: '双核心模式',
      regions: [
        { x: 0, y: 0, w: 0.5, h: 0.42, order: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 0.42, order: 1 },
        { x: 0, y: 0.42, w: 0.3333, h: 0.29, order: 2 },
        { x: 0.3333, y: 0.42, w: 0.3334, h: 0.29, order: 3 },
        { x: 0.6667, y: 0.42, w: 0.3333, h: 0.29, order: 4 },
        { x: 0, y: 0.71, w: 0.3333, h: 0.29, order: 5 },
        { x: 0.3333, y: 0.71, w: 0.3334, h: 0.29, order: 6 },
        { x: 0.6667, y: 0.71, w: 0.3333, h: 0.29, order: 7 },
      ],
    },
  ],

  9: [
    {
      id: 't9-1', name: '经典九宫格', desc: '3×3 完全等分',
      tips: '最经典的九图拼法，整齐大气',
      regions: [
        { x: 0, y: 0, w: 0.3333, h: 0.3333, order: 0 },
        { x: 0.3333, y: 0, w: 0.3334, h: 0.3333, order: 1 },
        { x: 0.6667, y: 0, w: 0.3333, h: 0.3333, order: 2 },
        { x: 0, y: 0.3333, w: 0.3333, h: 0.3334, order: 3 },
        { x: 0.3333, y: 0.3333, w: 0.3334, h: 0.3334, order: 4 },
        { x: 0.6667, y: 0.3333, w: 0.3333, h: 0.3334, order: 5 },
        { x: 0, y: 0.6667, w: 0.3333, h: 0.3333, order: 6 },
        { x: 0.3333, y: 0.6667, w: 0.3334, h: 0.3333, order: 7 },
        { x: 0.6667, y: 0.6667, w: 0.3333, h: 0.3333, order: 8 },
      ],
    },
    {
      id: 't9-2', name: '一大八小', desc: '中心大主图 + 四周八个副图',
      tips: '非常适合宝宝百日照主次分明',
      regions: [
        { x: 0, y: 0, w: 0.28, h: 0.28, order: 0 },
        { x: 0.28, y: 0, w: 0.44, h: 0.28, order: 1 },
        { x: 0.72, y: 0, w: 0.28, h: 0.28, order: 2 },
        { x: 0, y: 0.28, w: 0.28, h: 0.44, order: 3 },
        { x: 0.28, y: 0.28, w: 0.44, h: 0.44, order: 4 },
        { x: 0.72, y: 0.28, w: 0.28, h: 0.44, order: 5 },
        { x: 0, y: 0.72, w: 0.28, h: 0.28, order: 6 },
        { x: 0.28, y: 0.72, w: 0.44, h: 0.28, order: 7 },
        { x: 0.72, y: 0.72, w: 0.28, h: 0.28, order: 8 },
      ],
    },
  ],
};

// ─── Utility Functions ──────────────────────────────────────

/** 获取指定数量的所有模板 */
export function getTemplatesByCount(count: number): CollageTemplate[] {
  return TEMPLATES[count] || [];
}

/** 根据 ID 查找模板 */
export function getTemplateById(id: string): CollageTemplate | undefined {
  for (const count of Object.keys(TEMPLATES)) {
    const found = TEMPLATES[Number(count)]?.find((t) => t.id === id);
    if (found) return found;
  }
  return undefined;
}

/** 根据照片数量获取推荐模板（第一个模板） */
export function getRecommendedTemplate(count: number): CollageTemplate | null {
  const templates = getTemplatesByCount(count);
  return templates.length > 0 ? templates[0] : null;
}

// ─── Region Editing Types ──────────────────────────────────

/** 单个区域的图片变换状态 */
export interface RegionTransform {
  /** 旋转角度: 0 | 90 | 180 | 270 */
  rotation: number;
  /** 是否水平翻转 */
  flipH: boolean;
  /** 是否垂直翻转 */
  flipV: boolean;
}

/** 默认变换（无变换） */
export const DEFAULT_TRANSFORM: RegionTransform = {
  rotation: 0,
  flipH: false,
  flipV: false,
};

/** 生成 CSS transform 字符串 */
export function toCssTransform(t: RegionTransform): string {
  const parts: string[] = [];
  if (t.rotation !== 0) parts.push(`rotate(${t.rotation}deg)`);
  if (t.flipH) parts.push('scaleX(-1)');
  if (t.flipV) parts.push('scaleY(-1)');
  return parts.length > 0 ? parts.join(' ') : 'none';
}

// ─── Export Settings Types ──────────────────────────────────

/** 拼图导出质量预设 */
export const QUALITY_PRESETS = [
  { label: '低', value: 60, desc: '文件小，适合预览分享' },
  { label: '中', value: 80, desc: '平衡质量与大小' },
  { label: '高', value: 92, desc: '高品质，适合打印' },
  { label: '无损', value: 100, desc: '最高质量，文件较大' },
] as const;

/** 拼图输出尺寸预设 */
export const OUTPUT_SIZE_PRESETS = [
  { label: '标准', value: 1080, desc: '1080×1080 · 适合社交媒体' },
  { label: '高清', value: 2048, desc: '2048×2048 · 适合打印小尺寸' },
  { label: '超清', value: 4096, desc: '4096×4096 · 适合大幅打印' },
] as const;

/** 估算拼图文件大小（基于压缩比经验值） */
export function estimateFileSize(
  pixelCount: number,
  quality: number,
): { bytes: number; label: string } {
  // 经验公式: bytes ≈ pixels * quality_ratio / compression_factor
  // JPEG 在 quality=80 时约 0.3-0.5 bytes/pixel, quality=60 约 0.15-0.25
  const ratio = quality <= 60 ? 0.18 : quality <= 80 ? 0.35 : quality <= 92 ? 0.55 : 0.85;
  const bytes = Math.round(pixelCount * ratio);
  const label =
    bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return { bytes, label };
}

/** 支持的拼图照片数量范围 */
export const SUPPORTED_PHOTO_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9] as const;
export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 9;
