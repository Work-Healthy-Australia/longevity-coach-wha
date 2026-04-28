# Next.js 16 Conventions

This project runs Next.js 16. APIs, file naming, and component behaviour differ from what model training data knows. Read `node_modules/next/dist/docs/` before writing any Next.js code.

---

## Breaking changes to know

| Old (your training data) | New (this project) |
|---|---|
| `middleware.ts` | `proxy.ts` — same concept, renamed |
| `useFormState` from `react-dom` | `useActionState` from `react` — React 19 rename |
| Edge runtime middleware | Fluid Compute — full Node.js available |

---

## Route groups

Route groups use parentheses and do **not** add URL segments:

| Group | URL prefix | Purpose |
|---|---|---|
| `(public)` | none | Marketing pages, no auth |
| `(auth)` | none | Login, signup, password reset |
| `(app)` | none | Signed-in member area |
| `(admin)` | none | Admin CRM |

A page at `app/(app)/dashboard/page.tsx` is served at `/dashboard`.

---

## Server actions

- All form mutations use server actions defined in `actions.ts` files co-located with the route.
- Server actions return typed result objects — never throw on validation failure; return `{ error: string }`.
- On error, echo back safe field values (not passwords) via `state.values` so forms can repopulate.

---

## Supabase clients

Use the right client for the context:

| Client | File | When to use |
|---|---|---|
| Browser | `lib/supabase/client.ts` | Client components only |
| Server | `lib/supabase/server.ts` | Server components and server actions |
| Admin | `lib/supabase/admin.ts` | Webhook routes and service-role operations |
| Proxy | `lib/supabase/proxy.ts` | Route guard (`proxy.ts`) only |

Never import the admin client in a page or server component — it bypasses RLS.

---

## Styling

- Tailwind v4 via `@tailwindcss/postcss` — used sparingly.
- Most page styling lives in scoped CSS files co-located with the route (e.g. `home.css` next to `page.tsx`).
- Global styles are in `app/globals.css`.
- Do not add Tailwind utility classes where a scoped CSS file already exists for that page.

---

## File naming

- `_components/` prefix keeps shared component folders from being treated as route segments.
- `actions.ts` is the conventional name for server action files.
- `.gitkeep` files mark placeholder directories for planned features — do not delete them.
