/* eslint-disable react-refresh/only-export-components */
import { Outlet, createBrowserRouter } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { AlbumDetailPage } from "../../pages/albums/AlbumDetailPage";
import { LoginPage } from "../../pages/auth/LoginPage";
import { ProfilePage } from "../../pages/dashboard/DashboardPage";
import { NotFoundPage } from "../../pages/NotFoundPage";
import { AuthGuard } from "./AuthGuard";
import { HomePage } from "../../pages/home/HomePage";
import { DesignSystemPage } from "../../pages/design-system/DesignSystem";
import { RegisterPage } from "../../pages/auth/RegisterPage";
import { RecordDetailPage } from "../../pages/records/RecordDetailPage";
import { CartPage } from "../../pages/cart/CartPage";

const AppLayout = () => (
  <Layout>
    <Outlet />
  </Layout>
);

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        element: <HomePage />
      },
      {
        path: "/design-system",
        element: <DesignSystemPage />
      },
      {
        path: "/albums/:albumId",
        element: <AlbumDetailPage />
      },
      {
        path: "/records/:slug",
        element: <RecordDetailPage />
      },
      {
        path: "/login",
        element: <LoginPage />
      },
      {
        path: "/register",
        element: <RegisterPage />
      },
      {
        element: <AuthGuard />,
        children: [
          {
            path: "/perfil",
            element: <ProfilePage />
          },
          {
            path: "/carritos",
            element: <CartPage />
          }
        ]
      },
      {
        path: "*",
        element: <NotFoundPage />
      }
    ]
  }
]);
