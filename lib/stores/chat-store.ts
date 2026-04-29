'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatStore {
  support: { isOpen: boolean; unread: number };
  openSupport: () => void;
  closeSupport: () => void;
  toggleSupport: () => void;
  clearUnread: () => void;
  incUnread: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      support: { isOpen: false, unread: 0 },
      openSupport: () => set((s) => ({ support: { ...s.support, isOpen: true, unread: 0 } })),
      closeSupport: () => set((s) => ({ support: { ...s.support, isOpen: false } })),
      toggleSupport: () =>
        set((s) => ({
          support: {
            ...s.support,
            isOpen: !s.support.isOpen,
            unread: s.support.isOpen ? s.support.unread : 0,
          },
        })),
      clearUnread: () => set((s) => ({ support: { ...s.support, unread: 0 } })),
      incUnread: () => set((s) => ({ support: { ...s.support, unread: s.support.unread + 1 } })),
    }),
    { name: 'lc-chat' },
  ),
);
