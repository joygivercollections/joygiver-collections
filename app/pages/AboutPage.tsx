import { Link } from "react-router-dom";
import { storeConfig } from "../config";

export function AboutPage() {
  return <div className="info-page">
    <section className="info-hero page-width">
      <div>
        <p className="eyebrow">Our story</p>
        <h1>Fashion with intention.</h1>
        <p>Joygiver Collections is an Abuja-based fashion store bringing together polished new pieces and carefully selected thrifted finds for women who want style with character.</p>
        <Link className="button button--dark" to="/search">Explore the collection</Link>
      </div>
      <img src={storeConfig.heroArtUrl} alt="Joygiver, curated in Abuja" />
    </section>
    <section className="brand-values page-width" aria-label="What we value">
      <article><span>01</span><h2>New confidence</h2><p>Current, versatile pieces chosen to feel effortless now and useful beyond one season.</p></article>
      <article><span>02</span><h2>Thrifted character</h2><p>Distinctive finds with their own story, clearly labelled so you always know what you are choosing.</p></article>
      <article><span>03</span><h2>Personal service</h2><p>Ask questions and confirm your selected cart pieces directly with us on WhatsApp.</p></article>
    </section>
    <section className="info-banner"><div className="page-width"><p className="eyebrow">From Abuja, with care</p><h2>For wardrobes across Nigeria.</h2><p>Shop locally in Abuja FCT or choose nationwide delivery to your state.</p></div></section>
  </div>;
}
