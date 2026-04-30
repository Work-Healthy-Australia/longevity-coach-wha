import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
};

type ToastStore = {
  toasts: Toast[];
  add: (message: string, type?: ToastType, duration?: number) => void;
  dismiss: (id: string) => void;
};

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = "success", duration = 4000) => {
    const id = `toast-${++counter}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export function toast(message: string, type?: ToastType, duration?: number) {
  useToastStore.getState().add(message, type, duration);
}
