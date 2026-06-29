import { useState, useCallback, useRef, useEffect } from 'react';

export interface UsePhotoGridLayoutReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  columns: number;
  rows: number;
}

/**
 * Computes grid layout (columns x rows) from container width.
 * Uses ResizeObserver for reactive width updates.
 *
 * @param itemWidth - Total width of one grid item including gap (px)
 * @param minColumns - Minimum column count (default: 2)
 * @param maxColumns - Maximum column count (default: 8)
 */
export function usePhotoGridLayout(
  itemWidth: number = 166,  // 150px image + 16px gap
  minColumns: number = 2,
  maxColumns: number = 8
): UsePhotoGridLayoutReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(minColumns);

  const updateDimensions = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const availableWidth = rect.width;
    const cols = Math.max(
      minColumns,
      Math.min(maxColumns, Math.floor(availableWidth / itemWidth))
    );
    setColumns(cols);
  }, [itemWidth, minColumns, maxColumns]);

  // Initial measurement + observe on mount
  useEffect(() => {
    updateDimensions();

    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(el);

    return () => observer.disconnect();
  }, [updateDimensions]);

  // Expose rows through a derived getter — rows aren't known until currentPhotos count is passed in
  // We return columns; rows are computed by the caller as Math.ceil(photos.length / columns)
  return { containerRef, columns, rows: 0 };
}
