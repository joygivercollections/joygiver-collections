import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { InvalidCartReason, ValidatedCart, ValidatedCartLine } from "../../shared/contracts";
import { formatNaira, getStoreConfig, validateCart } from "../api";
import { storeConfig } from "../config";
import { removeCartLine, saveCart, setAllSelected, setQuantity, setSelected, useCart } from "./cart-store";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "./whatsapp";

const invalidMessages: Record<InvalidCartReason, string> = {
  sold: "This piece is sold and no longer available.",
  hidden: "This piece is no longer available.",
  deleted: "This piece is no longer available.",
  out_of_stock: "This piece is currently out of stock.",
  size_unavailable: "Your selected size is no longer available.",
  quantity_reduced: "The available quantity has changed.",
};

export function CartPage({ whatsAppNumber }: { whatsAppNumber?: string }) {
  const lines = useCart();
  const [customerName, setCustomerName] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [validation, setValidation] = useState<ValidatedCart>({ valid: [], invalid: [], subtotalKobo: 0 });
  const [checking, setChecking] = useState(false);
  const [validationError, setValidationError] = useState(false);
  const [resolvedWhatsAppNumber, setResolvedWhatsAppNumber] = useState(whatsAppNumber ?? storeConfig.whatsAppNumber);
  const selected = useMemo(() => lines.filter((line) => line.selected), [lines]);
  const validationKey = selected.map((line) => `${line.productId}:${line.size}:${line.quantity}:${line.lastKnownPriceKobo}`).join("|");

  useEffect(() => {
    if (whatsAppNumber || resolvedWhatsAppNumber) return;
    const controller = new AbortController();
    getStoreConfig(controller.signal).then((config) => setResolvedWhatsAppNumber(config.whatsAppNumber)).catch(() => undefined);
    return () => controller.abort();
  }, [whatsAppNumber, resolvedWhatsAppNumber]);

  useEffect(() => {
    if (selected.length === 0) {
      setValidation({ valid: [], invalid: [], subtotalKobo: 0 });
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    setChecking(true);
    setValidationError(false);
    validateCart(selected, controller.signal)
      .then((result) => {
        setValidation(result);
        const invalidKeys = new Set(result.invalid.map((line) => `${line.productId}:${line.size}`));
        const validByKey = new Map(result.valid.map((line) => [`${line.productId}:${line.size}`, line]));
        let changed = false;
        const next = lines.map((line) => {
          const key = `${line.productId}:${line.size}`;
          if (invalidKeys.has(key) && line.selected) {
            changed = true;
            return { ...line, selected: false };
          }
          const canonical = validByKey.get(key);
          if (canonical && (line.lastKnownPriceKobo !== canonical.canonicalPriceKobo || line.quantity !== canonical.quantity)) {
            changed = true;
            return { ...line, lastKnownPriceKobo: canonical.canonicalPriceKobo, quantity: canonical.quantity };
          }
          return line;
        });
        if (changed) saveCart(next);
      })
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setValidationError(true);
      })
      .finally(() => setChecking(false));
    return () => controller.abort();
    // The serialized key intentionally represents only the selected order payload.
  }, [validationKey]);

  const validatedItems = validation.valid.filter((line) => lines.some((item) => item.productId === line.productId && item.size === line.size && item.selected));
  const subtotalKobo = validatedItems.reduce((total, item) => total + item.canonicalPriceKobo * item.quantity, 0);
  const message = buildWhatsAppMessage({ customerName, deliveryLocation, items: validatedItems, subtotalKobo });
  const whatsAppUrl = resolvedWhatsAppNumber ? buildWhatsAppUrl(resolvedWhatsAppNumber, message) : "";
  const ready = validatedItems.length > 0 && !checking && !validationError && Boolean(whatsAppUrl);

  if (lines.length === 0) {
    return (
      <section className="cart-empty page-width">
        <span aria-hidden="true">J</span>
        <p className="eyebrow">Your bag</p>
        <h1>Beautiful choices start here.</h1>
        <p>Your bag is empty. Explore the latest collection and add the pieces that feel like you.</p>
        <Link className="button button--dark" to="/search">Explore the collection</Link>
      </section>
    );
  }

  return (
    <div className="cart-page page-width">
      <header className="cart-page__header">
        <div><p className="eyebrow">Your selection</p><h1>Shopping bag</h1></div>
        <p>{lines.length} {lines.length === 1 ? "piece" : "pieces"}</p>
      </header>
      <div className="cart-page__grid">
        <section aria-labelledby="bag-items-title">
          <div className="cart-select-bar">
            <h2 className="sr-only" id="bag-items-title">Bag items</h2>
            <button type="button" onClick={() => setAllSelected(true)}>Select all</button>
            <button type="button" onClick={() => setAllSelected(false)}>Clear selection</button>
            <p aria-live="polite">{selected.length} selected</p>
          </div>
          <div className="cart-lines">
            {lines.map((line) => {
              const unavailable = validation.invalid.find((item) => item.productId === line.productId && item.size === line.size);
              const corrected = validation.valid.find((item) => item.productId === line.productId && item.size === line.size && item.priceChanged);
              return (
                <article className={`cart-line${unavailable ? " cart-line--unavailable" : ""}`} key={`${line.productId}:${line.size}`}>
                  <label className="cart-line__select">
                    <input type="checkbox" aria-label={line.name} checked={line.selected} disabled={Boolean(unavailable)} onChange={(event) => setSelected(line.productId, event.target.checked, line.size)} />
                    <span aria-hidden="true" />
                  </label>
                  <div className="cart-line__image">
                    {line.imageUrl ? <img src={line.imageUrl} alt="" /> : <span aria-hidden="true">J</span>}
                  </div>
                  <div className="cart-line__details">
                    <p className="eyebrow">{line.reference}</p>
                    <h3>{line.name}</h3>
                    <p>Size: {line.size}</p>
                    <p className="cart-line__price">{formatNaira(line.lastKnownPriceKobo)}</p>
                    {unavailable ? <p className="cart-line__notice" role="status">{invalidMessages[unavailable.reason]}</p> : null}
                    {corrected ? <p className="cart-line__notice" role="status">Price updated to {formatNaira(corrected.canonicalPriceKobo)}.</p> : null}
                  </div>
                  <div className="cart-line__controls">
                    <label>Quantity
                      <span className="quantity-control">
                        <button type="button" aria-label={`Reduce ${line.name} quantity`} onClick={() => setQuantity(line.productId, line.size, line.quantity - 1)} disabled={line.quantity <= 1 || Boolean(unavailable)}>−</button>
                        <output aria-label={`${line.name} quantity`}>{line.quantity}</output>
                        <button type="button" aria-label={`Increase ${line.name} quantity`} onClick={() => setQuantity(line.productId, line.size, line.quantity + 1)} disabled={Boolean(unavailable)}>+</button>
                      </span>
                    </label>
                    <button className="remove-button" type="button" onClick={() => removeCartLine(line.productId, line.size)}>Remove</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="order-summary" aria-labelledby="summary-title">
          <p className="eyebrow">WhatsApp checkout</p>
          <h2 id="summary-title">Order summary</h2>
          <div className="summary-total"><p>Selected subtotal</p><strong>{formatNaira(subtotalKobo)}</strong></div>
          <p className="summary-note">Delivery is calculated and confirmed with you on WhatsApp.</p>
          <label>Your name <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="e.g. Ada" autoComplete="name" /></label>
          <label>Delivery location <input value={deliveryLocation} onChange={(event) => setDeliveryLocation(event.target.value)} placeholder="Area, city and state" autoComplete="street-address" /></label>
          {validationError ? <p className="summary-error" role="alert">We couldn’t confirm availability. Check your connection and try changing your selection.</p> : null}
          {!resolvedWhatsAppNumber ? <p className="summary-error" role="status">The store WhatsApp number needs to be configured before orders can be sent.</p> : null}
          {ready ? (
            <a className="button button--whatsapp" href={whatsAppUrl} target="_blank" rel="noreferrer">
              Order {validatedItems.length} selected {validatedItems.length === 1 ? "item" : "items"} on WhatsApp
            </a>
          ) : (
            <button className="button button--whatsapp" type="button" disabled>
              {checking ? "Confirming availability…" : selected.length ? `Order ${selected.length} selected ${selected.length === 1 ? "item" : "items"} on WhatsApp` : "Select items to order"}
            </button>
          )}
          <p className="summary-fineprint">Opening WhatsApp does not reserve stock. Your order is confirmed only after Joygiver replies.</p>
        </aside>
      </div>
    </div>
  );
}
