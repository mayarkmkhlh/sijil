export const uiLanguages = ["ar", "en"] as const;

export type Language = (typeof uiLanguages)[number];
