import { create } from 'zustand';

// Toast types — defined here to avoid isolatedModules bundler issues
export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 默认 4000
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

let toastId = 0;
const nextId = () => `toast-${++toastId}`;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (type, title, message, duration = 4000) => {
    const id = nextId();
    const toast: Toast = { id, type, title, message, duration };
    set({ toasts: [...get().toasts, toast] });

    if (duration > 0) {
      setTimeout(() => {
        // 通过 store 移除，确保状态同步
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/** 便捷函数 — 可在组件外调用 */
export const showToast = (type: ToastType, title: string, message?: string, duration?: number) => {
  useToastStore.getState().addToast(type, title, message, duration);
};
