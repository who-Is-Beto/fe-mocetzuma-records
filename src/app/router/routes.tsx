import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { Loader } from "../../components/Loader";
import { AuthGuard } from "./AuthGuard";

// Route-level code splitting: every page is its own chunk. Layout, Navbar and
// AuthGuard stay eager because every route depends on them.
const HomePage = lazy(() =>
  import("../../pages/home/HomePage").then((m) => ({ default: m.HomePage }))
);
const CatalogoPage = lazy(() =>
  import("../../pages/catalog/CatalogoPage").then((m) => ({ default: m.CatalogoPage }))
);
const LoginPage = lazy(() =>
  import("../../pages/auth/LoginPage").then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import("../../pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage }))
);
const VerifyEmailPage = lazy(() =>
  import("../../pages/auth/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage }))
);
const ForgotPasswordPage = lazy(() =>
  import("../../pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import("../../pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage }))
);
const ProfilePage = lazy(() =>
  import("../../pages/dashboard/DashboardPage").then((m) => ({ default: m.ProfilePage }))
);
const RecordDetailPage = lazy(() =>
  import("../../pages/records/RecordDetailPage").then((m) => ({ default: m.RecordDetailPage }))
);
const AlbumDetailPage = lazy(() =>
  import("../../pages/albums/AlbumDetailPage").then((m) => ({ default: m.AlbumDetailPage }))
);
const CartPage = lazy(() =>
  import("../../pages/cart/CartPage").then((m) => ({ default: m.CartPage }))
);
const BazaresPage = lazy(() =>
  import("../../pages/bazares/BazaresPage").then((m) => ({ default: m.BazaresPage }))
);
const OrdersPage = lazy(() =>
  import("../../pages/orders/OrdersPage").then((m) => ({ default: m.OrdersPage }))
);
const DesignSystemPage = lazy(() =>
  import("../../pages/design-system/DesignSystem").then((m) => ({ default: m.DesignSystemPage }))
);
const TerminosPage = lazy(() =>
  import("../../pages/legal/TerminosPage").then((m) => ({ default: m.TerminosPage }))
);
const PrivacidadPage = lazy(() =>
  import("../../pages/legal/PrivacidadPage").then((m) => ({ default: m.PrivacidadPage }))
);
const AyudaPage = lazy(() =>
  import("../../pages/legal/AyudaPage").then((m) => ({ default: m.AyudaPage }))
);
const ContactoPage = lazy(() =>
  import("../../pages/legal/ContactoPage").then((m) => ({ default: m.ContactoPage }))
);
const AdminPage = lazy(() =>
  import("../../pages/admin/AdminPage").then((m) => ({ default: m.AdminPage }))
);
const NotFoundPage = lazy(() =>
  import("../../pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage }))
);

export const router = createBrowserRouter([
  {
    element: (
      <Layout>
        <Suspense fallback={<Loader />}>
          <Outlet />
        </Suspense>
      </Layout>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: "catalogo", element: <CatalogoPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "verificar-correo", element: <VerifyEmailPage /> },
      { path: "olvidaste-contrasena", element: <ForgotPasswordPage /> },
      { path: "restablecer-contrasena", element: <ResetPasswordPage /> },
      { path: "records/:slug", element: <RecordDetailPage /> },
      { path: "albums/:albumId", element: <AlbumDetailPage /> },
      { path: "design-system", element: <DesignSystemPage /> },
      { path: "carrito", element: <CartPage /> },
      { path: "bazares", element: <BazaresPage /> },
      { path: "mis-ordenes", element: <OrdersPage /> },
      { path: "terminos-y-condiciones", element: <TerminosPage /> },
      { path: "politica-de-privacidad", element: <PrivacidadPage /> },
      { path: "ayuda", element: <AyudaPage /> },
      { path: "contacto", element: <ContactoPage /> },
      {
        element: <AuthGuard />,
        children: [
          { path: "perfil", element: <ProfilePage /> },
          { path: "admin", element: <AdminPage /> },
          // Legacy alias — the admin view used to live at /inventario.
          { path: "inventario", element: <Navigate to="/admin" replace /> },
        ]
      },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);