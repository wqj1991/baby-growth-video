import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import CollageWorkspace from './CollageWorkspace';
import { useAppStore } from '../store';

vi.mock('../store/toastStore', () => ({
  showToast: vi.fn(),
}));

const baseTemplate = {
  id: 't1',
  name: 'test-template',
  desc: 'desc',
  tips: 'tips',
  regions: [
    { x: 0, y: 0, w: 0.5, h: 0.5, order: 0 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5, order: 1 },
  ],
};

beforeEach(() => {
  useAppStore.setState({
    selectedTemplate: baseTemplate as never,
    selectedTemplateId: 't1',
    collageGap: 3,
    collagePhotoOrder: [0, 1],
    selectedRegionIndex: null,
    regionTransforms: {},
    collageQuality: 90,
    collageOutputSize: 1600,
    currentProject: { id: 1 } as never,
    currentPeriod: { id: 1 } as never,
  });
});

function renderWorkspace() {
  return render(
    <CollageWorkspace
      selectedItems={[
        {
          id: 10,
          source_type: 'scan',
          original_file_name: 'a.jpg',
        } as never,
        {
          id: 11,
          source_type: 'scan',
          original_file_name: 'b.jpg',
        } as never,
      ]}
      loadedImages={{
        10: 'data:image/png;base64,AAA',
        11: 'data:image/png;base64,BBB',
      }}
      pendingItems={[]}
      onBack={vi.fn()}
      onGenerate={vi.fn()}
      generating={false}
    />,
  );
}

describe('CollageWorkspace pointer gestures', () => {
  it('short move enters panning and updates transform state', async () => {
    const { container } = renderWorkspace();
    const regions = container.querySelectorAll('.collage-canvas .absolute');
    const source = regions[0] as HTMLElement;

    fireEvent.pointerDown(source, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(source, { pointerId: 1, clientX: 110, clientY: 105 });
    fireEvent.pointerUp(source, { pointerId: 1, clientX: 110, clientY: 105 });

    await waitFor(() => {
      const transforms = useAppStore.getState().regionTransforms;
      expect(transforms[0]).toBeTruthy();
      expect(typeof transforms[0].offsetX).toBe('number');
      expect(typeof transforms[0].offsetY).toBe('number');
    });
  });

  it('long press enters swapping visual state', async () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWorkspace();
      const regions = container.querySelectorAll('.collage-canvas .absolute');
      const source = regions[0] as HTMLElement;

      fireEvent.pointerDown(source, { pointerId: 2, clientX: 120, clientY: 120 });
      act(() => {
        vi.advanceTimersByTime(310);
      });

      expect(source.style.border).toContain('dashed');
    } finally {
      vi.useRealTimers();
    }
  });
});
