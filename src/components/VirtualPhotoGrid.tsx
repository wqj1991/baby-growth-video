import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import type { Photo } from '../types';
import PhotoCard from './PhotoCard';

interface VirtualPhotoGridProps {
  photos: Photo[];
  loadedImages: Record<number, string>;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
  onDoubleClick?: (photo: Photo) => void;
  onOpenPreview?: (index: number) => void;
  onSelect?: (photo: Photo) => void;
  onAddToStash?: (photo: Photo) => void;
  className?: string;
  gridHeight: number;
}

const ITEM_SIZE = 166; // 150px image + 16px gap
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 8;

/**
 * Virtualized photo grid using react-window.
 * Renders only visible photo cards for performance.
 * Internally measures its container to compute columns and pass pixel dimensions to FixedSizeGrid.
 */
export default function VirtualPhotoGrid({
  photos,
  loadedImages,
  onContextMenu,
  onDoubleClick,
  onOpenPreview,
  onSelect,
  onAddToStash,
  className = '',
  gridHeight,
}: VirtualPhotoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [columns, setColumns] = useState(4);

  // Measure container width, compute columns
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      if (w > 0) {
        setContainerWidth(Math.max(200, w));
        setColumns(Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Math.floor(w / ITEM_SIZE))));
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const totalCount = photos.length;
  const rowCount = totalCount > 0 ? Math.ceil(totalCount / columns) : 0;

  // Ensure grid has valid dimensions before rendering
  const safeWidth = containerWidth > 0 ? containerWidth : 800;
  const safeHeight = gridHeight > 0 ? gridHeight : 400;

  return (
    <div ref={containerRef} className={`${className} min-h-[200px]`}>
      <Grid
        columnCount={columns}
        rowCount={rowCount}
        width={safeWidth}
        height={safeHeight}
        columnWidth={ITEM_SIZE}
        rowHeight={ITEM_SIZE}
        overscanCount={2}
        itemData={undefined}
      >
        {({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: CSSProperties }) => {
          const idx = rowIndex * columns + columnIndex;

          if (idx >= totalCount) {
            return <div style={style} className="invisible pointer-events-none" />;
          }

          const photo = photos[idx];
          if (!photo) {
            return <div style={style} className="invisible pointer-events-none" />;
          }

          const imageUrl = loadedImages[photo.id];

          return (
            <div style={style}>
              <PhotoCard
                photo={photo}
                imageUrl={imageUrl}
                onContextMenu={onContextMenu}
                onDoubleClick={onDoubleClick ? () => onDoubleClick(photo) : undefined}
                onClick={onOpenPreview ? () => onOpenPreview(idx) : undefined}
                onSelect={onSelect}
                onAddToStash={onAddToStash}
              />
            </div>
          );
        }}
      </Grid>
    </div>
  );
}
