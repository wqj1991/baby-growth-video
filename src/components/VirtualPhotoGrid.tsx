import { useState, useEffect, type CSSProperties } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import type { Photo } from '../types';
import PhotoCard from './PhotoCard';

interface VirtualPhotoGridProps {
  photos: Photo[];
  loadedImages: Record<number, string>;
  /** A ref pointing to the wrapper <div> that defines the grid's available space */
  parentRef: React.RefObject<HTMLDivElement | null>;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
  onDoubleClick?: (photo: Photo) => void;
  onOpenPreview?: (index: number) => void;
  onSelect?: (photo: Photo) => void;
  onAddToStash?: (photo: Photo) => void;
  className?: string;
}

const ITEM_SIZE = 166; // 150px image + 16px gap
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 8;

/**
 * Virtualized photo grid using react-window.
 * Measures its parent wrapper div for exact pixel dimensions,
 * then passes those to FixedSizeGrid for accurate rendering.
 */
export default function VirtualPhotoGrid({
  photos,
  loadedImages,
  parentRef,
  onContextMenu,
  onDoubleClick,
  onOpenPreview,
  onSelect,
  onAddToStash,
  className = '',
}: VirtualPhotoGridProps) {
  const [dimensions, setDimensions] = useState({ width: 800, height: 400, columns: 4 });

  // Measure parent wrapper — exact available space for the grid
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const measure = () => {
      // clientWidth/clientHeight already account for padding (px-5, pb-5)
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw <= 0 || ch <= 0) return;

      const cols = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Math.floor(cw / ITEM_SIZE)));
      setDimensions({ width: cw, height: ch, columns: cols });
    };

    // Small delay to let flexbox finish layout before first measure
    const timer = setTimeout(measure, 0);

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [parentRef]);

  const { width, height, columns } = dimensions;
  const totalCount = photos.length;
  const rowCount = totalCount > 0 ? Math.ceil(totalCount / columns) : 0;

  return (
    <div className={`${className} h-full`}>
      <Grid
        columnCount={columns}
        rowCount={rowCount}
        width={width}
        height={height}
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
