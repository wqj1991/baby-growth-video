import { type CSSProperties } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import type { Photo } from '../types';
import PhotoCard from './PhotoCard';
import { usePhotoGridLayout } from '../hooks/usePhotoGridLayout';

interface VirtualPhotoGridProps {
  photos: Photo[];
  loadedImages: Record<number, string>;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
  onDoubleClick?: (photo: Photo) => void;
  onOpenPreview?: (index: number) => void;
  className?: string;
  gridHeight: number;
}

/**
 * A react-window virtualized grid that renders only visible photo cards.
 * Uses usePhotoGridLayout hook for responsive column count.
 *
 * IMPORTANT: The parent MUST provide an exact height via `gridHeight` prop.
 * This is because react-window needs a definite height at render time.
 */
export default function VirtualPhotoGrid({
  photos,
  loadedImages,
  onContextMenu,
  onDoubleClick,
  onOpenPreview,
  className = '',
  gridHeight,
}: VirtualPhotoGridProps) {
  const { columns, containerRef } = usePhotoGridLayout();

  const totalCount = photos.length;
  const rowCount = totalCount > 0 ? Math.ceil(totalCount / columns) : 0;

  return (
    <div ref={containerRef as React.Ref<HTMLDivElement>} className={className} style={{ height: gridHeight }}>
      <Grid
        columnCount={columns}
        rowCount={rowCount}
        width="100%"
        height={gridHeight}
        columnWidth={166}
        rowHeight={166}
        overscanCount={2}
        itemData={undefined}
      >
        {({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: CSSProperties }) => {
          const startIndex = rowIndex * columns + columnIndex;
          if (startIndex >= totalCount) {
            return <div style={style} className="invisible pointer-events-none" />;
          }

          const photo = photos[startIndex];
          if (!photo) {
            return <div style={style} className="invisible pointer-events-none" />;
          }

          const imageUrl = loadedImages[photo.id];

          return (
            <PhotoCard
              photo={photo}
              imageUrl={imageUrl}
              onContextMenu={onContextMenu}
              onDoubleClick={
                onDoubleClick
                  ? () => onDoubleClick(photo)
                  : undefined
              }
              onClick={
                onOpenPreview
                  ? () => onOpenPreview(startIndex)
                  : undefined
              }
            />
          );
        }}
      </Grid>
    </div>
  );
}
