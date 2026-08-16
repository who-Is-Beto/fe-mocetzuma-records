# AGENTS.md — Moctezuma Records Frontend

You are a coding assistant for **Moctezuma Records**, a vinyl-record e-commerce frontend built with React + TypeScript + Vite. You handle new features, bug fixes, and refactors across the codebase.

> **Session handoff:** read `CONTEXT.md` at the repo root before starting any task —
> it documents the recently implemented email-verification ("2FA por email") flow, the
> purchase gate for unverified users, and the current uncommitted state of both repos.

## Stack & Runtime

- React 19.2, TypeScript 5.9, Vite 7 (`@vitejs/plugin-react-swc`), Tailwind CSS 3.4
- Router: `react-router-dom` v7 (`createBrowserRouter` + `<Layout>` + `Outlet`)
- No test framework, no data-fetching library (custom hooks instead of react-query)
- Backend (Django/DRF) runs at `http://localhost:8008`; API base in `src/app/config/api.ts`

## Project Layout

```
src/
  app/
    config/        # api.ts (API_BASE_URL), endpoints.ts
    domain/        # TS types: album.ts, auth.ts
    hooks/         # useServiceQuery, useServiceMutation, index.ts
    lib/           # httpClient.ts (fetch wrapper + HttpError)
    providers/     # AuthProvider.tsx (context + sessionStorage)
    router/        # routes.tsx, AuthGuard.tsx
    services/      # authService.ts, cartService.ts, recordService.ts (repository pattern)
  components/      # Button, Card, Layout, Loader, Navbar, SearchBar, Toast
  pages/
    auth/          # LoginPage, RegisterPage, VerifyEmailPage
    cart/          # CartPage (/carritos)
    orders/        # OrdersPage (/mis-ordenes)
    dashboard/     # DashboardPage (ProfilePage, /perfil)
    records/       # RecordDetailPage
    albums/        # AlbumDetailPage
    home/          # HomePage
    design-system/ # DesignSystem
  index.css        # Tailwind + fonts (Krona One, Work Sans)
```

## Conventions

- **Design tokens** (Tailwind config — use these, never raw hex):
  - Colors: `bg-sand`, `bg-cream`, `text-navy`, `text-denim`, `text-orange`, `text-coral`, `text-charcoal`, `bg-sun`, `bg-amber`, `bg-denim`
  - Typography: `font-display` (Krona One) for headings, `font-body` (Work Sans) for body
  - Shadows: `shadow-panel`, `shadow-card`; radius: `rounded-pill`, `rounded-soft`, `rounded-[28px]` for page sections, `rounded-2xl` for cards/panels
  - Eyebrow labels: `text-xs uppercase tracking-[0.16em] tracking-[0.18em] text-orange`
  - Panels: `rounded-[28px] border border-navy/10 bg-cream/80 shadow-panel backdrop-blur`
  - Cards: `rounded-2xl border border-navy/10 bg-cream/80 shadow-card backdrop-blur`
  - Gradient placeholder for images: `bg-gradient-to-br from-denim/10 via-cream to-sand/80`
- **All UI copy is in Spanish** (including toasts, empty states, buttons).
- **Money display**: `Number(value).toLocaleString("es-mx", { style: "currency", currency: "MXN" })`. Never `parseFloat` on display.
- **Repository pattern**: services export `createXService(config)` returning a typed repository interface (see `cartService.ts`, `authService.ts`). Auth-dependent services accept `{ getToken: () => string | null }`.
- **HTTP**: use `http<T>(path, { method, body, token, query, signal })` from `src/app/lib/httpClient.ts`. Errors are `HttpError` (`err.status`, `err.data`). Backend error shape: `{ error: { code, message } }`.
- **Data fetching**: `useServiceQuery(deps, fetcher, { enabled, initialData })` from `src/app/hooks`. It auto-runs on dep changes and aborts stale requests; use `refetch()` manually.
- **Auth**: read `useAuth()` from `AuthProvider` — exposes `isAuthenticated`, `token`, `user`, `emailVerified` (boolean | null), `login`, `register`, `logout`, `markEmailVerified`, `resendVerification`. Session persists in `sessionStorage["moctezuma-session"]`.
- **Session storage keys**: `moctezuma-session` (auth incl. `emailVerified`), `moctezuma-cart-code` (cart code). Treat `emailVerified === null` as *unknown* (legacy session) — let the API 403 (`email_not_verified`) decide.
- **Formatting**: most files use double quotes + semicolons; newer files (e.g. `AuthProvider.tsx`) use single quotes without semicolons. Match the style of the file you're editing; default to double quotes + semicolons for new files.
- React Router v7: routes are objects in `src/app/router/routes.tsx` (not JSX `<Route>`). Route paths are Spanish slugs.

## Commands

```bash
npm run dev          # http://localhost:5173 (backend must run on 8008)
npm run build        # tsc -b && vite build
npm run lint         # eslint .
npm run preview
npx tsc -b --force   # FAST typecheck — use this to verify changes
```

TypeScript errors are the main correctness gate — run `npx tsc -b --force` after changes and make sure it exits 0.

## Backend integration notes

- Proxy in `vite.config.ts`: `/records`, `/albums`, `/auth` → `VITE_API_URL ?? http://api.moctezumarecords.com`. The `.env` file sets `VITE_API_URL = http://127.0.0.1:8008/` for local dev.
- The backend enforces a purchase gate: unverified users get `403 { error: { code: "email_not_verified" } }` on cart/checkout/orders endpoints. The UI blocks before that, but must also react to the 403 (see `isVerificationError` pattern in `CartPage.tsx`).
- Cart contract: `GET /carts/`, `GET /cart/<code>/`, `POST /cart/add/` (body `cart_code`, `record_id`, `email`, `quantity`), `PUT /cart/update/` (`item_id`, `quantity`), `DELETE /cart/remove/` (`cart_code`, `record_id`), `DELETE /cart/remove-all/` / `/cart/delete/` (`cart_code`), `POST /create-checkout-session/` (`cart_code`, `shipped_to`, `shipping_details`) → `checkout_url`.
- Auth contract: `POST /auth/login/`, `/auth/register/`, `/auth/refresh/`, `/auth/me/`, `/auth/verify-email/` (`uid`, `token`), `/auth/verify-email/resend/` (`email`, throttled 5/h).

## Things to avoid

- Don't add third-party packages (axios, react-query, etc.) without checking `package.json` first and explaining why. The repo intentionally uses fetch + custom hooks.
- Don't hardcode backend URLs in components — go through `API_BASE_URL` or the proxy.
- Don't commit secrets; `.env` is gitignored.
- Don't touch `dist/` (build output) — it's gitignored.
- Keep all user-facing text in Spanish.
