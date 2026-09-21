export const storeConfig = {
  whatsAppNumber: import.meta.env.VITE_WHATSAPP_NUMBER ?? "",
  // Replace these file paths or overwrite the matching files in public/brand.
  logoUrl: "/brand/joygiver-logo.jpeg",
  heroArtUrl: "/brand/family-hero.png",
  // Add the real profile URLs when they are available.
  socialLinks: {
    facebook: "",
    instagram: "",
    tiktok: "",
  },
};

export const defaultSiteSettings = {
  logoUrl: storeConfig.logoUrl,
  heroUrl: storeConfig.heroArtUrl,
  heroHeading: "Style for every story.",
  heroCopy: "Discover new and thrifted fashion for women, men, and kids—thoughtfully selected in Abuja and delivered nationwide.",
};
