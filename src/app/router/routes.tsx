import { createBrowserRouter, Outlet } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { AuthGuard } from "./AuthGuard";
import { HomePage } from "../../pages/home/HomePage";
import { LoginPage } from "../../pages/auth/LoginPage";
import { RegisterPage } from "../../pages/auth/RegisterPage";
import { VerifyEmailPage } from "../../pages/auth/VerifyEmailPage";
import { ProfilePage } from "../../pages/dashboard/DashboardPage";
import { RecordDetailPage } from "../../pages/records/RecordDetailPage";
import { AlbumDetailPage } from "../../pages/albums/AlbumDetailPage";
import { CartPage } from "../../pages/cart/CartPage";
import { OrdersPage } from "../../pages/orders/OrdersPage";
import { DesignSystemPage } from "../../pages/design-system/DesignSystem";
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
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "verificar-correo", element: <VerifyEmailPage /> },
      { path: "records/:slug", element: <RecordDetailPage /> },
      { path: "albums/:albumId", element: <AlbumDetailPage /> },
      { path: "design-system", element: <DesignSystemPage /> },
      { path: "carritos", element: <CartPage /> },
      { path: "mis-ordenes", element: <OrdersPage /> },
      {
        element: <AuthGuard />,
        children: [{ path: "perfil", element: <ProfilePage /> }]
      },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
