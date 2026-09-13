# CONTEXT.md — Moctezuma Records Frontend (session handoff)

> **Read this before doing anything.** This file captures the current state of the
> project so a fresh agent session can pick up where the last one left off.
> Conventions live in `AGENTS.md` — this file is the *what we just did* snapshot.

Last updated: 2026-08-15

---

## 1. Repos & stack

| Repo | Path | Stack |
|---|---|---|
| Frontend | `femoctezuma-records` (this repo) | React 19, Vite 7, TypeScript 5.9, react-router v7, Tailwind 3.4 |
| Backend | sibling `bemoctezuma_records` | Django 5.2.1, DRF, PostgreSQL, SimpleJWT, Stripe, pytest |

Note: the macOS home directory contains a **curly apostrophe** — always use the literal
path `~/Documents/Documents - Roberto’s MacBook Air/...` (curly `’`, not straight `'`).

## 2. Email verification + purchase gate — just implemented

The backend implements email verification ("2FA por email", signed-link, 24 h expiry).
`REQUIRE_EMAIL_VERIFICATION` is **off by default in code but enabled locally** (`.env.local`
in the backend). Frontend work (all uncommitted):

- `src/app/domain/auth.ts`: `User.emailVerified?`, `VerifyEmailInput`, `ResendVerificationInput`, `VerifyEmailResult`.
- `src/app/services/authService.ts`: `verifyEmail({uid, token})`, `resendVerification({email})`;
  `mapTokens()` surfaces `email_verified` from the backend response.
- `src/app/providers/AuthProvider.tsx`: context now exposes `emailVerified: boolean | null`,
  plus `markEmailVerified()` (instant unlock after verification) and `resendVerification(email)`.
  Persists to `sessionStorage["moctezuma-session"]`. NOTE: this file uses the newer
  single-quote/no-semicolon style — don't reformat it.
- `src/pages/auth/VerifyEmailPage.tsx` (NEW, `/verificar-correo`): reads `uid`/`token` from the
  query string, calls `verifyEmail()`, calls `markEmailVerified()` on success so cart/profile
  unlock immediately without re-login. Invalid/expired link → backend `400 {token: [...]}` shown as-is.
- `src/pages/auth/RegisterPage.tsx`: success screen "Revisa tu correo" + resend button instead of
  silent redirect. `LoginPage.tsx`: `403 email_not_verified` state + resend button.
- **Gate UX**:
  - `src/components/Card.tsx` + `src/pages/records/RecordDetailPage.tsx`: add-to-cart button is
    `disabled` when authenticated and `emailVerified === false`, label "Verifica tu correo para
    comprar", native `title` tooltip, and (record detail) an inline banner linking to `/perfil`.
  - `src/pages/cart/CartPage.tsx` (NEW, `/carritos`): not logged in → login CTA; unverified →
    blocked view with resend + profile link; verified → full cart (quantity +/- capped by stock,
    remove item, empty cart, total, "Proceder al pago" → `createCheckoutSession(cartCode, "store")`).
  - `src/pages/orders/OrdersPage.tsx` (NEW, `/mis-ordenes`): same gate; also the destination of
    the Stripe checkout `success_url`. Order card shows amount, date, item count, ship_link, status pill.
  - `src/pages/dashboard/DashboardPage.tsx`: "✓ Correo verificado" / "✉️ Verificación pendiente"
    badge + resend panel available anytime.
- `src/app/services/cartService.ts` (restored from git `24f091a^`, plus new `getCart()`): types
  `CartItem`, `CartResponse`, `ShippingDetails`, `CartRepository` with `getCarts/getCart/addItem/
  updateItem/removeItem/removeAll/createCheckoutSession`.
- `src/components/Toast.tsx` (restored from `24f091a^`, rebuilt with current design tokens):
  portal-based toast with `tone: success|warning|error` and Spanish labels.
- `src/app/router/routes.tsx`: added `/carritos`, `/mis-ordenes`; `/perfil` and `/verificar-correo`
  exist; `/perfil` is behind `AuthGuard`.

## 3. Current uncommitted state

```bash
git status --short   # M: README.md, auth.ts, AuthProvider.tsx, routes.tsx, authService.ts,
                     #    Card.tsx, LoginPage.tsx, RegisterPage.tsx, DashboardPage.tsx, RecordDetailPage.tsx
                     # ?? new: cartService.ts, Toast.tsx, VerifyEmailPage.tsx, pages/cart/, pages/orders/
```

`npx tsc -b --force` exits 0. `npm run build` also passes (slow; `tsc` is the fast check).
Nothing committed/pushed yet — user reviews first. The old deleted cart version is recoverable
from git history at `24f091a^` (`cartService.ts`, `Toast.tsx`, old `CartPage.tsx`).

## 4. Design system (non-negotiable)

- Tokens: `sand`, `cream`, `navy`, `denim`, `orange`, `amber`, `sun`, `coral`, `charcoal`.
- Fonts: `font-display` (Krona One) headings, `font-body` (Work Sans); loaded via Google Fonts in `index.css`.
- Page sections: `rounded-[28px] border border-navy/10 bg-cream/80 shadow-panel backdrop-blur`.
- Cards: `rounded-2xl border border-navy/10 bg-cream/80 shadow-card backdrop-blur`.
- Buttons: `Button` component with `tone="navy" | "orange" | "sun" | "outline"`, `pill` default.
- Eyebrows: `text-xs uppercase tracking-[0.16em] text-orange` (some use `[0.18em]`).
- Currency: `toLocaleString("es-mx", { style: "currency", currency: "MXN" })`.
- All copy in Spanish. Emoji icons used sparingly in empty states/badges (🛒 📦 ✉️ ✓ 🎵).

## 5. Key decisions & gotchas

- The purchase gate is **backend-enforced** (403 `email_not_verified` on all cart/checkout/orders
  endpoints when the flag is on) — the UI is a first line of defense, not the gate itself.
- `emailVerified === null` (legacy session saved before this feature) means "unknown": the UI
  allows the request and the `isVerificationError` helper flips `blockedByApi` when the API 403s.
  Copy that helper pattern rather than inventing a new error check.
- `withBase()` in `cartService.ts` appends a trailing `/` (unlike `authService.ts`); both handle
  it because backend URL patterns end with slashes and Django's `APPEND_SLASH`/allowlist is lenient
  for non-GET. Don't "fix" one to match the other without testing against the backend.
- `.env` (gitignored) holds `VITE_API_URL = http://127.0.0.1:8008/` (trailing slash — handled).
  If missing, `api.ts` falls back to `http://localhost:8008` and the Vite proxy targets
  `http://api.moctezumarecords.com` (prod) — don't hardcode prod API URLs in components.
- `useServiceQuery` re-runs the fetcher on dep changes; pass stable deps (e.g. `[token, canUseCart]`)
  or you'll get infinite refetch loops. Note `refetch` inside its `useEffect` deps is disabled via
  eslint-disable — the caller's `deps` array is what matters.
- No tests exist (no vitest/jest). Typecheck + `npm run lint` are the verification gates.
- Session storage keys must stay `moctezuma-session` / `moctezuma-cart-code` — both backend
  docs and pages reference them.

## 6. Open items / next steps

- Live end-to-end test: backend on 8008 + `npm run dev`, register a fresh account, verify via the
  emailed link (prod SMTP), then cart → Stripe test-mode checkout → lands on `/mis-ordenes`.
- Shipping-details flow (`shipped_to="home"`) is NOT rebuilt in the new `CartPage` — checkout
  hardcodes `"store"` ("Envío a tienda de la CDMX, acordado por Instagram"). Restore home/bazar
  shipping UI if needed.
- `CartPage` only fetches the first cart (`carts[0]`); multi-cart UX is out of scope.
- Nothing is committed in either repo — user reviews before committing.
- Future/out-of-scope (user-mentioned): "admin role can handle the database from an admin page".
