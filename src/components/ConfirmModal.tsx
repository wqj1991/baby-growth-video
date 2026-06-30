import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // 焦点管理：弹窗打开时聚焦确认按钮
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => confirmBtnRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Escape 关闭
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* 半透明遮罩 */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* 弹窗卡片 */}
      <div
        className={`
          relative glass-strong rounded-2xl shadow-xl
          w-full max-w-md mx-4 p-6
          animate-in fade-in zoom-in-95 duration-200
        `}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100/80 rounded-xl transition-all duration-200"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 图标 + 标题 */}
        <div className="flex items-start gap-4 mb-2">
          {isDanger && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#fae7ea] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#d44d68]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3
              id="confirm-modal-title"
              className={`text-lg font-bold ${isDanger ? 'text-[#d44d68]' : 'text-stone-800'}`}
            >
              {title}
            </h3>
            {message && (
              <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">{message}</p>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 active:scale-[0.98] transition-all duration-200"
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            disabled={loading}
            className={`
              px-6 py-2.5 rounded-xl text-sm font-bold text-white
              transition-all duration-200 active:scale-[0.98] flex items-center gap-2 justify-center
              ${loading
                ? 'opacity-70 cursor-not-allowed'
                : isDanger
                  ? 'bg-gradient-to-r from-[#d44d68] to-[#ba3050] shadow-lg shadow-[#d44d68]/25 hover:shadow-xl hover:shadow-[#d44d68]/35 hover:-translate-y-0.5'
                  : 'bg-gradient-to-r from-warmth-400 to-warmth-500 shadow-lg shadow-warmth-400/25 hover:shadow-xl hover:shadow-warmth-400/35 hover:-translate-y-0.5'
              }
            `}
          >
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
