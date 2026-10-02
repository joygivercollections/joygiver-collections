export const storeConfig = {
  whatsAppNumber: import.meta.env.VITE_WHATSAPP_NUMBER ?? "",
  // Replace these file paths or overwrite the matching files in public/brand.
  logoUrl: "/brand/joygiver-logo.jpeg",
  heroArtUrl: "/brand/family-hero.png",
  // Keep unavailable social profiles blank so they are not displayed.
  socialLinks: {
    facebook: "",
    instagram: "https://www.instagram.com/joygivercollections001/",
    tiktok: "https://www.tiktok.com/@joygivercollections",
  },
};

export const defaultSiteSettings = {
  logoUrl: storeConfig.logoUrl,
  heroUrl: storeConfig.heroArtUrl,
  heroHeading: "Style for every story.",
  heroCopy: "Discover new and thrifted fashion for women, men, and kids—thoughtfully selected in Abuja and delivered nationwide.",
};
