import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ownerApi, type OwnerSession } from "../api";

export function AdminLayout() {
  const [owner, setOwner] = useState<OwnerSession | null>(null);
  const [checking, setChecking] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    ownerApi.session(controller.signal)
      .then(setOwner)
      .catch(() => navigate(`/owner/login?from=${encodeURIComponent(location.pathname + location.search)}`, { replace: true }))
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, []);

  if (checking || !owner) return <main className="admin-loading"><span>J</span><p>Opening your dashboard…</p></main>;

  async function logout() {
    await ownerApi.logout().catch(() => undefined);
    navigate("/owner/login", { replace: true });
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <NavLink className="admin-brand" to="/owner"><span>J</span><strong>Joygiver<small>Owner dashboard</small></strong></NavLink>
        <nav aria-label="Owner dashboard">
          <NavLink end to="/owner"><span aria-hidden="true">⌂</span> Overview</NavLink>
          <NavLink to="/owner/products"><span aria-hidden="true">◇</span> Products</NavLink>
          <NavLink to="/owner/wholesale"><span aria-hidden="true">□</span> Wholesale</NavLink>
          <NavLink to="/owner/categories"><span aria-hidden="true">☷</span> Clothing Types</NavLink>
          <NavLink to="/owner/account"><span aria-hidden="true">○</span> Account</NavLink>
        </nav>
        <div className="admin-sidebar__bottom">
          <p>{owner.email}</p>
          <button type="button" onClick={logout}>Sign out</button>
          <a href="/" target="_blank">View storefront ↗</a>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-mobile-head"><NavLink to="/owner" className="admin-brand"><span>J</span><strong>Joygiver</strong></NavLink><NavLink to="/owner/products/new" className="button button--dark">Add product</NavLink></header>
        <nav className="admin-mobile-nav" aria-label="Dashboard sections"><NavLink end to="/owner">Overview</NavLink><NavLink to="/owner/products">Products</NavLink><NavLink to="/owner/wholesale">Wholesale</NavLink><NavLink to="/owner/categories">Clothing Types</NavLink><NavLink to="/owner/account">Account</NavLink></nav>
        <Outlet context={{ owner }} />
      </div>
    </div>
  );
}
