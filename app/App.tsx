import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CartPage } from "./cart/CartPage";
import { CataloguePage } from "./pages/CataloguePage";
import { HomePage } from "./pages/HomePage";
import { ProductPage } from "./pages/ProductPage";
import { LoginPage } from "./admin/LoginPage";
import { AdminLayout } from "./admin/AdminLayout";
import { DashboardPage } from "./admin/DashboardPage";
import { ProductsPage } from "./admin/ProductsPage";
import { ProductForm } from "./admin/ProductForm";
import { CategoriesPage } from "./admin/CategoriesPage";
import { AccountPage } from "./admin/AccountPage";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";

export function App() {
  return (
    <Routes>
      <Route path="owner/login" element={<LoginPage />} />
      <Route path="owner" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="new" element={<Navigate to="/new/women" replace />} />
        <Route path="new/:audience" element={<CataloguePage condition="new" />} />
        <Route path="thrifted" element={<Navigate to="/thrifted/women" replace />} />
        <Route path="thrifted/:audience" element={<CataloguePage condition="thrifted" />} />
        <Route path="search" element={<CataloguePage />} />
        <Route path="product/:slug" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
