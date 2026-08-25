import { createBrowserRouter, Outlet } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { AuthGuard } from "./AuthGuard";
import { HomePage } from "../../pages/home/HomePage";
import { CatalogoPage } from "../../pages/catalog/CatalogoPage";
import { LoginPage } from "../../pages/auth/LoginPage";
import { RegisterPage } from "../../pages/auth/RegisterPage";
import { VerifyEmailPage } from "../../pages/auth/VerifyEmailPage";
import { ForgotPasswordPage } from "../../pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../../pages/auth/ResetPasswordPage";
import { ProfilePage } from "../../pages/dashboard/DashboardPage";
import { RecordDetailPage } from "../../pages/records/RecordDetailPage";
import { AlbumDetailPage } from "../../pages/albums/AlbumDetailPage";
import { CartPage } from "../../pages/cart/CartPage";
import { BazaresPage } from "../../pages/bazares/BazaresPage";
import { OrdersPage } from "../../pages/orders/OrdersPage";
import { DesignSystemPage } from "../../pages/design-system/DesignSystem";
import { TerminosPage } from "../../pages/legal/TerminosPage";
import { PrivacidadPage } from "../../pages/legal/PrivacidadPage";
import { AyudaPage } from "../../pages/legal/AyudaPage";
import { ContactoPage } from "../../pages/legal/ContactoPage";
import { AdminPage } from "../../pages/admin/AdminPage";
import { NotFoundPage } from "../../pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: (
      <Layout>
        <Outlet />
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
          { path: "inventario", element: <AdminPage /> },
        ]
      },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
