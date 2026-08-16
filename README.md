# 💿 Moctezuma Records — Frontend

Tienda de discos de vinilo. React 19 + TypeScript + Vite + Tailwind CSS + React Router v7.

## Correr el proyecto

```bash
npm install
npm run dev        # http://localhost:5173
```

El backend (Django) debe estar corriendo en `http://localhost:8008`. La URL del backend se configura en `src/app/config/api.ts` (variable `VITE_API_URL`, por defecto `http://localhost:8008`). Las rutas `/records`, `/albums` y `/auth` se proxean al backend en desarrollo vía `vite.config.ts`.

## Verificación de email (2FA por email) ✉️

Al registrarse, el backend crea el usuario con `email_verified=false` y envía un correo con un enlace firmado. Si el flag `REQUIRE_EMAIL_VERIFICATION` está activo en el backend, el usuario **no puede iniciar sesión** hasta confirmar el correo.

### Flujo

1. **Registro** (`RegisterPage.tsx`):
   - Se llama a `POST /api/auth/register/`.
   - El backend responde con `{ tokens, email_verified: false, ... }` y envía el correo de verificación.
   - En vez de redirigir silenciosamente, la página muestra una pantalla de éxito **"Revisa tu correo"** con un botón de *reenviar* enlace y un enlace para seguir explorando.

2. **Enlace de verificación**:
   - El correo apunta a `{FRONTEND_URL}/verificar-correo?uid=...&token=...` (lo arma el backend con su variable `FRONTEND_URL`).
   - `uid` es el `uid` codificado del usuario y `token` es el token firmado por Django (`default_token_generator`). Ambos expiran a las 24 h.

3. **Verificación** (`VerifyEmailPage.tsx`):
   - Lee `uid`/`token` de la query string con `useSearchParams`.
   - Llama a `POST /api/auth/verify-email/` con `{ uid, token }` vía `authService.verifyEmail()`.
   - Si el token es inválido o expiró, el backend responde `400` con `{ token: ["Invalid or expired verification link"] }`; la página muestra ese mensaje.
   - En éxito muestra **"¡Correo verificado!"** y un botón para ir a la tienda.

4. **Login** (`LoginPage.tsx`):
   - Si el usuario intenta entrar sin verificar y el backend lo exige, responde `403` con `code: "email_not_verified"`.
   - La página muestra ese estado con un botón para **reenviar el enlace de verificación**.

5. **Reenvío**:
   - `POST /api/auth/verify-email/resend/` (rate-limited por el backend a 5/hora).
   - Se usa desde `RegisterPage.tsx` (pantalla "Revisa tu correo"), desde `LoginPage.tsx` (estado `email_not_verified`), desde `CartPage`/`OrdersPage` y desde el perfil.

### Gate de carrito para usuarios sin verificar 🛒

El catálogo siempre es público (puedes ver los discos sin cuenta), pero la **compra** está bloqueada hasta que el correo esté verificado:

- **Botón "Añadir al carrito"** (`Card.tsx` en el catálogo y `RecordDetailPage.tsx`): si la sesión está autenticada pero `emailVerified === false`, el botón se deshabilita, muestra "Verifica tu correo para comprar" y al pasar el mouse sobre él aparece un tooltip (atributo `title`) explicando que hay que verificar el correo.
- **Página del carrito** (`/carritos`, `CartPage.tsx`): 
  - Sin sesión → invita a iniciar sesión.
  - Autenticado sin verificar → vista bloqueada con botón "Reenviar enlace de verificación" y acceso al perfil.
  - Verificado → carrito funcional (cantidades, quitar artículos, vaciar, total y checkout vía Stripe).
- **Órdenes** (`/mis-ordenes`, `OrdersPage.tsx`): misma lógica de bloqueo; es el destino del `success_url` del checkout.
- **Perfil** (`/perfil`): muestra una insignia "✓ Correo verificado" o "✉️ Verificación pendiente", y un panel para **reenviar el enlace en cualquier momento**.
- Al verificar desde el enlace (`VerifyEmailPage.tsx`), la sesión se actualiza al instante (`markEmailVerified` en `AuthProvider`), así que carrito y perfil se desbloquean sin volver a iniciar sesión.

> El backend también aplica el gate en sus endpoints de carrito/checkout/órdenes (`403 email_not_verified`), así que el bloqueo no es solo visual. La UI reacciona a ese `403` mostrando la vista bloqueada por si la sesión local quedó desactualizada.

### Archivos clave

| Archivo | Qué hace |
|---------|----------|
| `src/app/domain/auth.ts` | Tipos: `User.emailVerified`, `VerifyEmailInput`, `ResendVerificationInput`, `VerifyEmailResult`. |
| `src/app/services/authService.ts` | `verifyEmail()`, `resendVerification()`; `mapTokens()` expone `email_verified`. |
| `src/app/services/cartService.ts` | `getCarts()`, `getCart()`, `addItem()`, `updateItem()`, `removeItem()`, `removeAll()`, `createCheckoutSession()`. |
| `src/app/providers/AuthProvider.tsx` | Guarda `emailVerified` en `sessionStorage` (`moctezuma-session`), lo expone en el contexto, y provee `markEmailVerified()` + `resendVerification()`. |
| `src/pages/auth/VerifyEmailPage.tsx` | Página destino del enlace (`/verificar-correo`); marca la sesión como verificada. |
| `src/pages/auth/RegisterPage.tsx` | Pantalla de éxito "Revisa tu correo" + resend. |
| `src/pages/auth/LoginPage.tsx` | Estado `email_not_verified` + resend. |
| `src/components/Card.tsx` / `src/pages/records/RecordDetailPage.tsx` | Botón "Añadir al carrito" bloqueado + tooltip para usuarios sin verificar. |
| `src/pages/cart/CartPage.tsx` | Carrito en `/carritos`, bloqueado para usuarios sin verificar. |
| `src/pages/orders/OrdersPage.tsx` | Órdenes en `/mis-ordenes`, bloqueadas para usuarios sin verificar. |
| `src/pages/dashboard/DashboardPage.tsx` | Estado de verificación + reenvío del enlace en cualquier momento. |
| `src/app/router/routes.tsx` | Define las rutas `/verificar-correo`, `/carritos` y `/mis-ordenes`. |

### Notas

- El usuario ya autenticado antes de esta feature tendrá `emailVerified` ausente en su sesión guardada; el frontend lo trata como no verificado hasta el próximo login/refresh.
- Los mensajes de la verificación están en español, igual que el resto de la app.
