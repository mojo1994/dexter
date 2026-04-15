import { create } from 'zustand';

type DeviceType = 'desktop' | 'tablet' | 'mobile';

interface EditorState {
  currentPageId: string | null;
  currentProjectId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  device: DeviceType;
  showCode: boolean;
  showLayers: boolean;
  setCurrentPage: (pageId: string, projectId: string) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setDevice: (device: DeviceType) => void;
  toggleCode: () => void;
  toggleLayers: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  currentPageId: null,
  currentProjectId: null,
  isDirty: false,
  isSaving: false,
  device: 'desktop',
  showCode: false,
  showLayers: false,

  setCurrentPage: (pageId: string, projectId: string) =>
    set({ currentPageId: pageId, currentProjectId: projectId, isDirty: false }),

  setDirty: (dirty: boolean) => set({ isDirty: dirty }),
  setSaving: (saving: boolean) => set({ isSaving: saving }),
  setDevice: (device: DeviceType) => set({ device }),
  toggleCode: () => set((s) => ({ showCode: !s.showCode })),
  toggleLayers: () => set((s) => ({ showLayers: !s.showLayers })),
}));
