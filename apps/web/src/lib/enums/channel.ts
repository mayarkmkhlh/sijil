export const channels = ["instagram_dm", "whatsapp", "shop_link"] as const;

export type Channel = (typeof channels)[number];
