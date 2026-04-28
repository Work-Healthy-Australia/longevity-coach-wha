'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatStore {
  alex: { isOpen: boolean; unread: number };
  openAlex: () => void;
  closeAlex: () => void;
  toggleAlex: () => void;
  clearUnread: () => void;
  incUnread: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      alex: { isOpen: false, unread: 0 },
      openAlex: () => set((s) => ({ alex: { ...s.alex, isOpen: true, unread: 0 } })),
      closeAlex: () => set((s) => ({ alex: { ...s.alex, isOpen: false } })),
      toggleAlex: () =>
        set((s) => ({
          alex: {
            ...s.alex,
            isOpen: !s.alex.isOpen,
            unread: s.alex.isOpen ? s.alex.unread : 0,
          },
        })),
      clearUnread: () => set((s) => ({ alex: { ...s.alex, unread: 0 } })),
      incUnread: () => set((s) => ({ alex: { ...s.alex, unread: s.alex.unread + 1 } })),
    }),
    { name: 'lc-chat' },
  ),
);
