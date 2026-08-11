export type SocialNetworkKey = "facebook" | "instagram" | "tiktok";

export type SocialNetworkLink = {
  enabled: boolean;
  url: string;
};

export type SocialNetworksStore = Record<SocialNetworkKey, SocialNetworkLink> & {
  updatedAt: string | null;
};

export type PublicSocialNetworkLink = {
  key: SocialNetworkKey;
  label: string;
  icon: string;
  url: string;
};

export const SOCIAL_NETWORK_META: Record<SocialNetworkKey, { label: string; icon: string; placeholder: string }> = {
  facebook: {
    label: "Facebook",
    icon: "f",
    placeholder: "https://www.facebook.com/your-page",
  },
  instagram: {
    label: "Instagram",
    icon: "◎",
    placeholder: "https://www.instagram.com/your-profile",
  },
  tiktok: {
    label: "TikTok",
    icon: "♪",
    placeholder: "https://www.tiktok.com/@your-profile",
  },
};
