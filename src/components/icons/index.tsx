import React from 'react';

// ============================================================
// BabyGrowth Icons — 定制图标系统
// 设计语言：暖琥珀 · 珊瑚主题 | 圆润线条 | 温暖亲切
// 统一规范：24×24 viewBox · strokeWidth 2 · round caps/joins
// ============================================================

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

const defaults = (
  size: IconProps['size'] = 24,
  sw: IconProps['strokeWidth'] = 2,
  extra: React.SVGProps<SVGSVGElement> = {}
) => ({
  xmlns: 'http://www.w3.org/2000/svg',
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...extra,
});

// ─── 导航类 ───────────────────────────────────────────────

export const Home: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M3 12l2-2m0 0l7-7 7 7m-14 0v10a1 1 0 001 1h4m9-11l2 2m-2-2v10a1 1 0 01-1 1h-4m-4 0v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    <path d="M9.5 3.5l-3 3.5" strokeWidth={1.5} opacity={0.4} />
  </svg>
);

export const Baby: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <circle cx="12" cy="11" r="8" />
    <circle cx="9" cy="9.5" r="1.2" fill="currentColor" />
    <circle cx="15" cy="9.5" r="1.2" fill="currentColor" />
    <path d="M9 14c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" />
    <path d="M12 3c-.6 0-1 .4-1 1 0 .3.2.6.4.8" opacity={0.5} strokeWidth={1.5} />
  </svg>
);

export const Video: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <rect x="2" y="4" width="15" height="16" rx="3" />
    <path d="M17 9l5-3v12l-5-3" />
    <circle cx="9.5" cy="12" r="2.5" fill="currentColor" opacity={0.15} />
    <path d="M9.5 10.5v3M8 12h3" opacity={0.7} strokeWidth={1.2} />
  </svg>
);

export const History: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
    <path d="M3.5 3.5l2 2" opacity={0.4} strokeWidth={1.5} />
    <path d="M20.5 3.5l-2 2" opacity={0.4} strokeWidth={1.5} />
  </svg>
);

export const Settings: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

export const Sparkles: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
    <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5z" opacity={0.6} />
    <path d="M19 5l.5 1.5L21 7l-1.5.5L19 9l-.5-1.5L17 7l1.5-.5z" opacity={0.4} />
  </svg>
);

// ─── 箭头类 ───────────────────────────────────────────────

export const ChevronRight: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const ChevronDown: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const ChevronUp: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);

export const ArrowLeft: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const ArrowRight: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

// ─── 操作类 ───────────────────────────────────────────────

export const Plus: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <circle cx="12" cy="12" r="9" opacity={0.15} />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

export const Minus: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M5 12h14" />
  </svg>
);

export const X: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const Check: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M5 13l4 4L19 7" />
  </svg>
);

export const CheckCircle: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l3 3 5-5" />
  </svg>
);

export const CheckCircle2: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l3 3 5-5" />
    <circle cx="12" cy="12" r="7" fill="currentColor" opacity={0.08} />
  </svg>
);

export const AlertCircle: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

// ─── 媒体类 ───────────────────────────────────────────────

export const Play: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <circle cx="12" cy="12" r="9" opacity={0.12} />
    <path d="M10 8l6 4-6 4z" fill="currentColor" stroke="none" />
  </svg>
);

export const Pause: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

export const SkipBack: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M18 5l-8 7 8 7z" fill="currentColor" stroke="none" />
    <path d="M6 5v14" />
  </svg>
);

export const SkipForward: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M6 5l8 7-8 7z" fill="currentColor" stroke="none" />
    <path d="M18 5v14" />
  </svg>
);

export const Music: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export const Camera: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M3 7a2 2 0 012-2h2l2-2h6l2 2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <circle cx="12" cy="13" r="3.5" />
    <circle cx="12" cy="13" r="1.2" fill="currentColor" opacity={0.3} />
  </svg>
);

export const Image: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" opacity={0.3} />
    <path d="M3 16l5-5 3 3 4-4 6 6" />
  </svg>
);

export const Film: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M7 3v18M17 3v18M3 8h4M17 8h4M3 16h4M17 16h4" />
  </svg>
);

export const Eye: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// ─── 文件/数据类 ──────────────────────────────────────────

export const Folder: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);

export const FileText: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h5" />
  </svg>
);

export const Download: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M12 3v12M8 11l4 4 4-4" />
    <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </svg>
);

export const Save: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </svg>
);

export const Trash2: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

// ─── 时间/日期类 ──────────────────────────────────────────

export const Clock: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

export const Calendar: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M8 14h.01M12 14h.01M16 14h.01" opacity={0.5} />
  </svg>
);

// ─── 布局/界面类 ──────────────────────────────────────────

export const LayoutDashboard: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <rect x="3" y="3" width="7" height="8" rx="1.5" />
    <rect x="14" y="3" width="7" height="4" rx="1.5" />
    <rect x="14" y="10" width="7" height="10" rx="1.5" />
    <rect x="3" y="14" width="7" height="6" rx="1.5" />
  </svg>
);

export const GripVertical: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <circle cx="9" cy="5" r="1" fill="currentColor" />
    <circle cx="15" cy="5" r="1" fill="currentColor" />
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="19" r="1" fill="currentColor" />
    <circle cx="15" cy="19" r="1" fill="currentColor" />
  </svg>
);

export const Grid3X3: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="13" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="13" width="6" height="6" rx="1" />
    <rect x="13" y="13" width="6" height="6" rx="1" />
  </svg>
);

// ─── 功能类 ───────────────────────────────────────────────

export const Star: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M12 2l2.6 6.2L21 9.2l-4.7 4 .9 6.8-5.2-3-5.2 3 .9-6.8-4.7-4 6.4-1z" />
  </svg>
);

export const Wand2: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M15 4l-2 2 5 5 2-2a2.8 2.8 0 00-5-5z" />
    <path d="M3 21l9-9" />
    <path d="M8 2l.5 1.5L10 4l-1.5.5L8 6l-.5-1.5L6 4l1.5-.5z" opacity={0.6} />
    <path d="M20 14l.5 1.5L22 16l-1.5.5L20 18l-.5-1.5L18 16l1.5-.5z" opacity={0.6} />
  </svg>
);

export const RefreshCw: React.FC<IconProps> = ({ size, strokeWidth, ...props }) => (
  <svg {...defaults(size, strokeWidth, props)}>
    <path d="M21 12a9 9 0 00-9-9 9 9 0 00-9 9" />
    <path d="M3 12a9 9 0 009 9 9 9 0 009-9" />
    <path d="M3 4v4h4" />
    <path d="M21 20v-4h-4" />
  </svg>
);

// ─── 导出所有图标名称列表（便于类型约束和自动补全）────────

export const iconNames = [
  'Home', 'Baby', 'Video', 'History', 'Settings', 'Sparkles',
  'ChevronRight', 'ChevronDown', 'ChevronUp',
  'ArrowLeft', 'ArrowRight',
  'Plus', 'Minus', 'X', 'Check', 'CheckCircle', 'CheckCircle2', 'AlertCircle',
  'Play', 'Pause', 'SkipBack', 'SkipForward', 'Music', 'Camera', 'Image', 'Film', 'Eye',
  'Folder', 'FileText', 'Download', 'Save', 'Trash2',
  'Clock', 'Calendar',
  'LayoutDashboard', 'GripVertical', 'Grid3X3',
  'Star', 'Wand2', 'RefreshCw',
] as const;

export type IconName = typeof iconNames[number];
