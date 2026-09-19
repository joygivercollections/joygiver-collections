import { FormEvent, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

export function Layout() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/search?search=${encodeURIComponent(value)}` : "/search");
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="announcement">
        <p>Based in Abuja <span aria-hidden="true">·</span> Nationwide delivery</p>
      </div>
      <header className="site-header">
        <div className="site-header__top page-width">
          <NavLink className="wordmark" to="/" aria-label="Joygiver Collections home">
            <span className="wordmark__monogram" aria-hidden="true">J</span>
            <span className="wordmark__text">Joygiver <small>Collections</small></span>
          </NavLink>
          <nav className="desktop-nav" aria-label="Primary navigation">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/new">New</NavLink>
            <NavLink to="/thrifted">Thrifted</NavLink>
          </nav>
          <NavLink className="cart-link" to="/cart" aria-label="Shopping bag, 0 items">
            <span aria-hidden="true">Bag</span>
            <span className="cart-link__count">0</span>
          </NavLink>
        </div>
        <div className="site-header__search page-width">
          <form className="search-form" role="search" onSubmit={submitSearch}>
            <span className="search-form__icon" aria-hidden="true">⌕</span>
            <label className="sr-only" htmlFor="site-search">Search the collection</label>
            <input
              id="site-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search gowns, skirts, tops…"
              aria-label="Search the collection"
            />
            <button type="submit">Search</button>
          </form>
        </div>
        <nav className="mobile-nav page-width" aria-label="Collections">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/new">New arrivals</NavLink>
          <NavLink to="/thrifted">Thrifted finds</NavLink>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="page-width site-footer__grid">
          <div>
            <p className="footer-mark">Joygiver Collections</p>
            <p>Elevated new and handpicked thrifted fashion, thoughtfully selected in Abuja.</p>
          </div>
          <div>
            <p className="eyebrow">Shop</p>
            <NavLink to="/new">New collection</NavLink>
            <NavLink to="/thrifted">Thrifted collection</NavLink>
          </div>
          <div>
            <p className="eyebrow">Delivery</p>
            <p>Abuja pickup and delivery across Nigeria. Final delivery cost is confirmed on WhatsApp.</p>
          </div>
        </div>
        <div className="page-width site-footer__bottom">
          <p>© {new Date().getFullYear()} Joygiver Collections</p>
          <NavLink to="/owner/login">Owner sign in</NavLink>
        </div>
      </footer>
    </div>
  );
}
