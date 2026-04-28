// Stub for "server-only" used in vitest. The real package throws when imported
// from a client bundle. Tests run in jsdom which is treated as client by vite,
// so we replace it with an empty module.
export {};
