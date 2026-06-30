import type { Photo } from '../types';
import PhotoCard from './PhotoCard';

interface VirtualPhotoGridProps {
  photos: Photo[];
  loadedImages: Record<number, string>;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
  onDoubleClick?: (photo: Photo) => void;
  onToggleSelect?: (photo: Photo) => void;
  onSetFinal?: (photo: Photo) => void;
  onCancelFinal?: (photo: Photo) => void;
  onOpenPreview?: (index: number) => void;
  onSelect?: (photo: Photo) => void;
  onAddToStash?: (photo: Photo) => void;
}

export default function VirtualPhotoGrid({
  photos,
  loadedImages,
  onContextMenu,
  onDoubleClick,
  onToggleSelect,
  onSetFinal,
  onCancelFinal,
  onOpenPreview,
  onSelect,
  onAddToStash,
}: VirtualPhotoGridProps) {
  return (
    <div className="photo-grid">
      {photos.map((photo, idx) => {
        const imageUrl = loadedImages[photo.id];
        return (
          <PhotoCard
            key={photo.id}
            photo={photo}
            imageUrl={imageUrl}
            onContextMenu={onContextMenu}
            onDoubleClick={onDoubleClick ? () => onDoubleClick(photo) : undefined}
            onToggleSelect={onToggleSelect}
            onSetFinal={onSetFinal}
            onCancelFinal={onCancelFinal}
            onClick={onOpenPreview ? () => onOpenPreview(idx) : undefined}
            onSelect={onSelect}
            onAddToStash={onAddToStash}
          />
        );
      })}
    </div>
  );
}