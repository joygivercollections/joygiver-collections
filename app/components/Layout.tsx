import { FormEvent, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../cart/cart-store";
import { storeConfig } from "../config";
import { MobileMenu } from "./MobileMenu";
import { SocialLinks } from "./SocialLinks";

export function Layout() {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const cartCount = cart.reduce((count, line) => count + line.quantity, 0);
  const collectionRouteOrder: Record<string, number> = { "/": 0, "/new": 1, "/thrifted": 2 };
  const currentRouteOrder = collectionRouteOrder[location.pathname];
  const previousRouteOrder = useRef(currentRouteOrder);
  const transitionDirection = currentRouteOrder === undefined || previousRouteOrder.current === undefined || currentRouteOrder === previousRouteOrder.current
    ? ""
    : currentRouteOrder > previousRouteOrder.current ? "forward" : "backward";

  useEffect(() => {
    previousRouteOrder.current = currentRouteOrder;
  }, [currentRouteOrder]);

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
            <img className="wordmark__image" src={storeConfig.logoUrl} alt="" />
          </NavLink>
          <nav className="desktop-nav" aria-label="Primary navigation">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/new">New</NavLink>
            <NavLink to="/thrifted">Thrifted</NavLink>
            <NavLink to="/about">About Us</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>
          <div className="header-actions">
            <NavLink className="cart-link" to="/cart" aria-label={`Shopping bag, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}>
              <span aria-hidden="true">Bag</span>
              <span className="cart-link__count">{cartCount}</span>
            </NavLink>
            <button className="menu-button" type="button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <span /><span /><span />
            </button>
          </div>
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
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main key={location.pathname} id="main-content" tabIndex={-1} className={transitionDirection ? `page-transition--${transitionDirection}` : undefined}>
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
          <div>
            <p className="eyebrow">Follow &amp; order</p>
            <SocialLinks className="footer-socials" />
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
