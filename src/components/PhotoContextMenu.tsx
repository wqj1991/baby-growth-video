import React, { useEffect, useRef } from 'react';
import { Eye, Check, Plus, Minus, X } from 'lucide-react';
import type { Photo } from '../types';

interface PhotoContextMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  photo: Photo | null;
  onAddToPending: (photo: Photo) => void;
  onRemoveFromPending: (photo: Photo) => void;
  onSetFinal: (photo: Photo) => void;
  onCancelFinal: (photo: Photo) => void;
  onPreview: (photo: Photo) => void;
  onClose: () => void;
}

const PhotoContextMenu: React.FC<PhotoContextMenuProps> = ({
  visible,
  position,
  photo,
  onAddToPending,
  onRemoveFromPending,
  onSetFinal,
  onCancelFinal,
  onPreview,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 计算菜单位置，处理边界
  const getMenuStyle = (): React.CSSProperties => {
    if (!visible || !photo) return { display: 'none' };

    const menuWidth = 160; // 预估菜单宽度
    const menuHeight = 120; // 预估菜单高度
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = position.x;
    let top = position.y;

    // 右边界检测
    if (left + menuWidth > viewportWidth) {
      left = viewportWidth - menuWidth - 10;
    }

    // 下边界检测
    if (top + menuHeight > viewportHeight) {
      top = viewportHeight - menuHeight - 10;
    }

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 1000,
    };
  };

  // 点击外部关闭菜单
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [visible, onClose]);

  if (!visible || !photo) return null;

  const handleMenuItemClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={getMenuStyle()}
      onClick={(e) => e.stopPropagation()}
    >
      {!photo.is_selected ? (
        <button
          className="context-menu-item"
          onClick={() => handleMenuItemClick(() => onAddToPending(photo))}
        >
          <Plus className="w-4 h-4" />
          <span>加入到待选区</span>
        </button>
      ) : (
        <button
          className="context-menu-item"
          onClick={() => handleMenuItemClick(() => onRemoveFromPending(photo))}
        >
          <Minus className="w-4 h-4" />
          <span>从待选区移除</span>
        </button>
      )}
      {!photo.is_final ? (
        <button
          className="context-menu-item"
          onClick={() => handleMenuItemClick(() => onSetFinal(photo))}
        >
          <Check className="w-4 h-4" />
          <span>确认选择</span>
        </button>
      ) : (
        <button
          className="context-menu-item"
          onClick={() => handleMenuItemClick(() => onCancelFinal(photo))}
        >
          <X className="w-4 h-4" />
          <span>取消最终选择</span>
        </button>
      )}
      <div className="context-menu-divider" />
      <button
        className="context-menu-item"
        onClick={() => handleMenuItemClick(() => onPreview(photo))}
      >
        <Eye className="w-4 h-4" />
        <span>预览</span>
      </button>
    </div>
  );
};

export default PhotoContextMenu;
