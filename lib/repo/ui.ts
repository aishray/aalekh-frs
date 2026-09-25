'use client';

import { create } from 'zustand';

type UiState = {
  refPanel: { projectId: string; ref: string } | null;
  openRef: (projectId: string, ref: string) => void;
  closeRef: () => void;
  presenter: boolean;
  setPresenter: (v: boolean) => void;
  search: boolean;
  setSearch: (v: boolean) => void;
};

export const useUi = create<UiState>((set) => ({
  refPanel: null,
  openRef: (projectId, ref) => set({ refPanel: { projectId, ref } }),
  closeRef: () => set({ refPanel: null }),
  presenter: false,
  setPresenter: (v) => set({ presenter: v }),
  search: false,
  setSearch: (v) => set({ search: v }),
}));
