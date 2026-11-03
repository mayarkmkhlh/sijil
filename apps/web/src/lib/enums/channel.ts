export const channels = ["instagram_dm", "whatsapp"] as const;

export type Channel = (typeof channels)[number];
