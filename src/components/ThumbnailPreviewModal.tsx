import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Thumbnail } from '../types';
import { getOriginalFile } from '../utils/tauriCommands';

interface ThumbnailPreviewModalProps {
  visible: boolean;
  thumbnail: Thumbnail | null;
  thumbnails: Thumbnail[];
  onClose: () => void;
  onNavigate?: (thumbnail: Thumbnail) => void;
}

export default function ThumbnailPreviewModal({
  visible,
  thumbnail,
  thumbnails,
  onClose,
  onNavigate,
}: ThumbnailPreviewModalProps) {
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!visible || !thumbnail) {
      requestIdRef.current += 1;
      setLoading(false);
      setOriginalUrl('');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setOriginalUrl('');

    getOriginalFile(thumbnail.id)
      .then(url => {
        if (requestIdRef.current !== requestId) return;
        setOriginalUrl(url);
      })
      .catch(err => {
        if (requestIdRef.current !== requestId) return;
        console.error('Failed to load original:', err);
        setOriginalUrl(thumbnail.base64_data);
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setLoading(false);
      });

    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current += 1;
      }
    };
  }, [visible, thumbnail?.id]);

  if (!visible) return null;

  const currentIndex = thumbnail 
    ? thumbnails.findIndex(t => t.id === thumbnail.id)
    : -1;

  const handlePrev = () => {
    if (currentIndex > 0 && onNavigate) {
      onNavigate(thumbnails[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < thumbnails.length - 1 && onNavigate) {
      onNavigate(thumbnails[currentIndex + 1]);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in"
      onClick={onClose}
    >
      <button 
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-8 h-8" />
      </button>

      {currentIndex > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
        >
          <ChevronLeft className="w-10 h-10" />
        </button>
      )}

      {currentIndex < thumbnails.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
        >
          <ChevronRight className="w-10 h-10" />
        </button>
      )}

      <div 
        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center" 
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        ) : originalUrl ? (
          <img 
            src={originalUrl} 
            alt={thumbnail?.original_file_name} 
            className="max-w-full max-h-[85vh] object-contain" 
          />
        ) : (
          <div className="text-white/60">加载失败</div>
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm">
        <span className="font-medium">{thumbnail?.original_file_name}</span>
        <span className="mx-2">·</span>
        <span>{currentIndex + 1} / {thumbnails.length}</span>
      </div>
    </div>
  );
}
