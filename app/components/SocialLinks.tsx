import { storeConfig } from "../config";

type SocialName = "whatsapp" | "facebook" | "instagram" | "tiktok";

const labels: Record<SocialName, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

function SocialIcon({ name }: { name: SocialName }) {
  if (name === "whatsapp") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.6 4.2 1.7 6L.2 24l6.4-1.7a11.9 11.9 0 0 0 5.5 1.4h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.3-6.1-3.5-8.4Zm-8.4 18.1c-1.7 0-3.5-.5-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.7 9.7 0 1 1 8.4 4.7Zm5.3-7.2c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.2l-.9 1.1c-.2.2-.4.2-.7.1-1.7-.8-2.8-1.5-4-3.4-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.6l-.9-2.2c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.6c.2.2 2.4 3.7 5.9 5.2 2.2.9 3.1 1 4.2.8.7-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4Z" /></svg>;
  if (name === "facebook") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8.5V6.8c0-.8.5-1 1-1h2.6V1.2L14 1c-4 0-5 2.5-5 5.3v2.2H6.5V13H9v10h5V13h3.3l.6-4.5H14Z" /></svg>;
  if (name === "instagram") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 1h10a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H7a6 6 0 0 1-6-6V7a6 6 0 0 1 6-6Zm0 2a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7Zm11.5 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.6 1c.4 3.2 2.2 5.1 5.4 5.3v4.1a12.4 12.4 0 0 1-5.3-1.2v7.6c0 9.6-10.5 8-13.4 3.7-1.9-2.8-.7-7.8 4.7-9v4.4c-.6.2-1.2.5-1.5 1-1.2 2.1 1.4 4.4 3.5 3 1.3-.8 1.2-2.4 1.2-3.9V1h5.4Z" /></svg>;
}

export function SocialLinks({ className = "", whatsAppNumber = storeConfig.whatsAppNumber }: { className?: string; whatsAppNumber?: string }) {
  const links: Array<{ name: SocialName; href: string }> = [
    { name: "whatsapp", href: whatsAppNumber ? `https://wa.me/${whatsAppNumber.replace(/\D/g, "")}` : "" },
    { name: "facebook", href: storeConfig.socialLinks.facebook },
    { name: "instagram", href: storeConfig.socialLinks.instagram },
    { name: "tiktok", href: storeConfig.socialLinks.tiktok },
  ];

  return <div className={`social-links ${className}`.trim()}>{links.map(({ name, href }) => (
    <a key={name} aria-label={labels[name]} aria-disabled={!href} href={href || "#"} onClick={(event) => { if (!href) event.preventDefault(); }} target={href ? "_blank" : undefined} rel={href ? "noreferrer" : undefined} title={href ? labels[name] : `${labels[name]} link coming soon`}>
      <SocialIcon name={name} />
    </a>
  ))}</div>;
}
