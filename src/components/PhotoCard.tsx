import type { Photo } from '../types';
import { Check } from 'lucide-react';

interface PhotoCardProps {
  photo: Photo;
  imageUrl: string;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
  onDoubleClick?: () => void;
  onClick?: () => void;
}

/**
 * A single photo card rendered inside the virtual grid.
 * Preserves the exact visual styling of the original `.photo-item` class.
 */
export default function PhotoCard({
  photo,
  imageUrl,
  onContextMenu,
  onDoubleClick,
  onClick,
}: PhotoCardProps) {
  return (
    <div
      className={`photo-item ${photo.is_selected ? 'selected' : ''} ${photo.is_final ? 'final' : ''}`}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, photo) : undefined}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
    >
      <img
        src={imageUrl || ''}
        alt={photo.file_name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {photo.is_final && (
        <div className="photo-badge final">
          <Check className="w-3 h-3" />
        </div>
      )}
      {photo.is_selected && !photo.is_final && (
        <div className="photo-badge selected">
          ✓
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <p className="text-white text-xs truncate">
          {photo.file_name}
        </p>
      </div>
    </div>
  );
}
