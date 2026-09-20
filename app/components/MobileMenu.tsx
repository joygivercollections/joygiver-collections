import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { SocialLinks } from "./SocialLinks";

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("keydown", handleKey); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [open]);

  if (!open) return null;
  return <div className="mobile-menu-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <aside ref={panelRef} className="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="mobile-menu__head"><p>Joygiver Collections</p><button ref={closeRef} type="button" aria-label="Close menu" onClick={onClose}>×</button></div>
      <nav aria-label="Information"><NavLink to="/about" onClick={onClose}>About Us <span aria-hidden="true">→</span></NavLink><NavLink to="/contact" onClick={onClose}>Contact <span aria-hidden="true">→</span></NavLink></nav>
      <div className="mobile-menu__social"><p className="eyebrow">Follow and order</p><SocialLinks /></div>
      <p className="mobile-menu__note">Based in Abuja · Nationwide delivery</p>
    </aside>
  </div>;
}
