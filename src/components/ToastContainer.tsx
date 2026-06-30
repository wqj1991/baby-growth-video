import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import type { ToastType } from '../store/toastStore';

const iconMap: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const borderColorMap: Record<ToastType, string> = {
  success: 'border-l-[#2d9d5f]',
  warning: 'border-l-[#f5c000]',
  error: 'border-l-[#d44d68]',
  info: 'border-l-[#5b66c0]',
};

const bgMap: Record<ToastType, string> = {
  success: 'bg-[#d9f2e4]/70',
  warning: 'bg-[#fff9e0]/70',
  error: 'bg-[#fae7ea]/70',
  info: 'bg-[#e4e7f6]/70',
};

const iconColorMap: Record<ToastType, string> = {
  success: 'text-[#2d9d5f]',
  warning: 'text-[#f5c000]',
  error: 'text-[#d44d68]',
  info: 'text-[#5b66c0]',
};

/** 单个 Toast 条目，处理进入/退出动画 */
function ToastItem({
  id,
  type,
  title,
  message,
  duration = 4000,
}: {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [entering, setEntering] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const enterTimer = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(enterTimer);
  }, []);

  // 手动关闭时触发退出动画
  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => removeToast(id), 300);
  };

  // 自动消失时触发退出动画
  useEffect(() => {
    if (leaving) return;
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => removeToast(id), 300);
    }, duration + 80); // 80ms buffer for enter animation
    return () => clearTimeout(timer);
  }, [duration, id, removeToast, leaving]);

  const Icon = iconMap[type];

  return (
    <div
      className={`
        pointer-events-auto glass-strong
        flex items-start gap-3 w-full max-w-sm px-4 py-3
        border-l-4 rounded-xl shadow-lg
        transition-all duration-300 ease-out
        ${borderColorMap[type]} ${bgMap[type]}
        ${entering ? 'translate-x-full opacity-0' : ''}
        ${leaving ? 'translate-x-full opacity-0 scale-95' : 'translate-x-0 opacity-100'}
        ${!entering && !leaving ? 'scale-100' : ''}
      `}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColorMap[type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-800">{title}</p>
        {message && (
          <p className="text-xs text-stone-500 mt-0.5 line-clamp-3">{message}</p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-0.5 -mr-1 text-stone-400 hover:text-stone-600 transition-colors rounded-md hover:bg-stone-200/50"
        aria-label="关闭通知"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Toast 通知容器 — 固定在右下角，支持多条堆叠 */
export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 pointer-events-none"
      aria-live="polite"
      aria-label="通知"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} />
      ))}
    </div>
  );
}
