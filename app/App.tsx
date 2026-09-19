import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CataloguePage } from "./pages/CataloguePage";
import { HomePage } from "./pages/HomePage";
import { ProductPage } from "./pages/ProductPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="new" element={<CataloguePage condition="new" />} />
        <Route path="thrifted" element={<CataloguePage condition="thrifted" />} />
        <Route path="search" element={<CataloguePage />} />
        <Route path="product/:slug" element={<ProductPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
