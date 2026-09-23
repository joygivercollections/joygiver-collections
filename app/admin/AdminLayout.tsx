import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ownerApi, type OwnerSession } from "../api";

export function AdminLayout() {
  const [owner, setOwner] = useState<OwnerSession | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [checking, setChecking] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    ownerApi.session(controller.signal)
      .then((session) => {
        setOwner(session);
        ownerApi.settings(controller.signal).then((settings) => setLogoUrl(settings.logoUrl)).catch(() => undefined);
      })
      .catch(() => navigate(`/owner/login?from=${encodeURIComponent(location.pathname + location.search)}`, { replace: true }))
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, []);

  if (checking || !owner) return <main className="admin-loading"><span>J</span><p>Opening your dashboard…</p></main>;

  async function logout() {
    await ownerApi.logout().catch(() => undefined);
    navigate("/owner/login", { replace: true });
  }

  const brandMark = logoUrl
    ? <span className="admin-brand__mark"><img src={logoUrl} alt="Joygiver Collections" onError={() => setLogoUrl("")} /></span>
    : <span className="admin-brand__mark" aria-hidden="true">J</span>;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <NavLink className="admin-brand" to="/owner">{brandMark}<strong>Joygiver<small>Owner dashboard</small></strong></NavLink>
        <nav aria-label="Owner dashboard">
          <NavLink end to="/owner"><span aria-hidden="true">⌂</span> Overview</NavLink>
          <NavLink to="/owner/products"><span aria-hidden="true">◇</span> Products</NavLink>
          <NavLink to="/owner/wholesale"><span aria-hidden="true">□</span> Wholesale</NavLink>
          <NavLink to="/owner/promotions"><span aria-hidden="true">%</span> Promotions</NavLink>
          <NavLink to="/owner/categories"><span aria-hidden="true">☷</span> Clothing Types</NavLink>
          <NavLink to="/owner/site-settings"><span aria-hidden="true">✦</span> Site Settings</NavLink>
          <NavLink to="/owner/account"><span aria-hidden="true">○</span> Account</NavLink>
        </nav>
        <div className="admin-sidebar__bottom">
          <p>{owner.email}</p>
          <button type="button" onClick={logout}>Sign out</button>
          <a href="/" target="_blank" rel="noreferrer">View shop ↗</a>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-mobile-head">
          <NavLink to="/owner" className="admin-brand">{brandMark}<strong>Joygiver</strong></NavLink>
          <div className="admin-mobile-head__actions"><a href="/" target="_blank" rel="noreferrer">View shop ↗</a><NavLink to="/owner/products/new" className="button button--dark">Add product</NavLink></div>
        </header>
        <nav className="admin-mobile-nav" aria-label="Dashboard sections"><NavLink end to="/owner">Overview</NavLink><NavLink to="/owner/products">Products</NavLink><NavLink to="/owner/wholesale">Wholesale</NavLink><NavLink to="/owner/promotions">Promotions</NavLink><NavLink to="/owner/categories">Clothing Types</NavLink><NavLink to="/owner/site-settings">Site Settings</NavLink><NavLink to="/owner/account">Account</NavLink></nav>
        <Outlet context={{ owner }} />
      </div>
    </div>
  );
}
