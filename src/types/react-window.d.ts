declare module 'react-window' {
  import type { CSSProperties, ComponentType, ForwardRefExoticComponent, RefAttributes, RefObject } from 'react';

  export interface WindowProps {
    width: number | string;
    height: number;
    overscanCount: number;
    itemCount: number;
    itemSize?: number | ((index: number) => number);
    children: (props: { index: number; style: CSSProperties }) => React.ReactNode;
    itemData?: unknown;
  }

  export interface GridProps {
    columnCount: number;
    rowCount: number;
    width: number | string;
    height: number;
    columnWidth: number | ((index: number) => number);
    rowHeight: number | ((index: number) => number);
    overscanCount: number;
    children: (props: {
      columnIndex: number;
      rowIndex: number;
      style: CSSProperties;
    }) => React.ReactNode;
    itemData?: unknown;
  }

  export const FixedSizeList: ForwardRefExoticComponent<
    WindowProps & RefAttributes<unknown>
  >;

  export const VariableSizeList: ForwardRefExoticComponent<
    WindowProps & RefAttributes<unknown>
  >;

  export const FixedSizeGrid: ForwardRefExoticComponent<GridProps>;

  export const VariableSizeGrid: ForwardRefExoticComponent<GridProps>;
}
