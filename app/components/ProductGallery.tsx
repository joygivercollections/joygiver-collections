import { useEffect, useState } from "react";
import type { ProductImage } from "../../shared/contracts";

interface ProductGalleryProps {
  images: ProductImage[];
  label?: string;
}

export function ProductGallery({ images, label = "Product images" }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [images]);

  if (images.length === 0) {
    return (
      <section className="product-gallery" role="region" aria-label={label}>
        <div className="product-gallery__placeholder"><span aria-hidden="true">J</span></div>
      </section>
    );
  }

  const safeIndex = Math.min(activeIndex, images.length - 1);
  const activeImage = images[safeIndex];
  const selectRelative = (offset: number) => {
    setActiveIndex((current) => (current + offset + images.length) % images.length);
  };

  return (
    <section className="product-gallery" role="region" aria-label={label}>
      <div className="product-gallery__stage">
        <img src={activeImage.url} alt={activeImage.alt} />
        {images.length > 1 ? (
          <div className="product-gallery__controls">
            <button type="button" aria-label="Previous image" onClick={() => selectRelative(-1)}>←</button>
            <button type="button" aria-label="Next image" onClick={() => selectRelative(1)}>→</button>
          </div>
        ) : null}
        <span className="product-gallery__counter" aria-live="polite">{safeIndex + 1} / {images.length}</span>
      </div>
      {images.length > 1 ? (
        <div className="product-gallery__thumbnails" aria-label="Choose product image">
          {images.map((image, index) => (
            <button
              className={index === safeIndex ? "active" : ""}
              type="button"
              key={image.id}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-pressed={index === safeIndex}
              onClick={() => setActiveIndex(index)}
            >
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
