import { Outlet, createBrowserRouter } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { AlbumDetailPage } from "../../pages/albums/AlbumDetailPage";
import { LoginPage } from "../../pages/auth/LoginPage";
import { DashboardPage } from "../../pages/dashboard/DashboardPage";
import { NotFoundPage } from "../../pages/NotFoundPage";
import { AuthGuard } from "./AuthGuard";
import { HomePage } from "../../pages/home/HomePage";
import { DesignSystemPage } from "../../pages/design-system/DesignSystem";

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
        path: "/login",
        element: <LoginPage />
      },
      {
        element: <AuthGuard />,
        children: [
          {
            path: "/dashboard",
            element: <DashboardPage />
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
