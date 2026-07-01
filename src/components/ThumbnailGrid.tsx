import type { Thumbnail } from '../types';
import ThumbnailCard from './ThumbnailCard';

interface ThumbnailGridProps {
  thumbnails: Thumbnail[];
  onPreview?: (thumbnail: Thumbnail) => void;
  onAddToPending?: (thumbnail: Thumbnail) => void;
  onRemoveFromPending?: (thumbnail: Thumbnail) => void;
  onSetFinal?: (thumbnail: Thumbnail) => void;
  onCancelFinal?: () => void;
}

export default function ThumbnailGrid({
  thumbnails,
  onPreview,
  onAddToPending,
  onRemoveFromPending,
  onSetFinal,
  onCancelFinal,
}: ThumbnailGridProps) {
  return (
    <div className="photo-grid">
      {thumbnails.map((thumb) => (
        <ThumbnailCard
          key={thumb.id}
          thumbnail={thumb}
          onPreview={onPreview}
          onAddToPending={onAddToPending}
          onRemoveFromPending={onRemoveFromPending}
          onSetFinal={onSetFinal}
          onCancelFinal={onCancelFinal}
        />
      ))}
    </div>
  );
}
