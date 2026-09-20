import { SocialLinks } from "../components/SocialLinks";

export function ContactPage() {
  return <div className="info-page contact-page page-width">
    <section className="contact-intro">
      <p className="eyebrow">Contact us</p>
      <h1>Let's talk style.</h1>
      <p>Questions about fit, condition, availability, or delivery? Reach out and we’ll help you choose with confidence.</p>
      <SocialLinks />
    </section>
    <section className="contact-details" aria-label="Store information">
      <article><p className="eyebrow">Location</p><h2>Abuja, FCT</h2><p>Local pickup details are confirmed privately after your order.</p></article>
      <article><p className="eyebrow">Delivery</p><h2>Across Nigeria</h2><p>Nationwide delivery is available. The final fee and timeline are confirmed on WhatsApp.</p></article>
      <article><p className="eyebrow">Ordering</p><h2>Your cart, your choice</h2><p>Select only the cart items you want, then send the pre-filled order to WhatsApp.</p></article>
    </section>
  </div>;
}
