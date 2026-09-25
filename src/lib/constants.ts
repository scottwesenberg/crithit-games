export const SITE_NAME = "CritHit Games";
export const SITE_TAGLINE = "Singles, sealed product & tabletop gear for people who read the rules twice.";

export const CONDITIONS = [
  { value: "NEAR_MINT", label: "Near Mint", short: "NM" },
  { value: "LIGHTLY_PLAYED", label: "Lightly Played", short: "LP" },
  { value: "MODERATELY_PLAYED", label: "Moderately Played", short: "MP" },
  { value: "HEAVILY_PLAYED", label: "Heavily Played", short: "HP" },
  { value: "DAMAGED", label: "Damaged", short: "DMG" },
] as const;

export type ConditionValue = (typeof CONDITIONS)[number]["value"];

export function conditionLabel(value: string) {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value;
}

export function conditionShort(value: string) {
  return CONDITIONS.find((c) => c.value === value)?.short ?? value;
}

export const COMMON_FINISHES = [
  "Normal",
  "Foil",
  "Holofoil",
  "Reverse Holo",
  "1st Edition",
  "Etched Foil",
  "Extended Art",
];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Payment pending",
  PAID: "Paid",
  FULFILLED: "Shipped",
  CANCELED: "Canceled",
  REFUNDED: "Refunded",
};

export const PAGE_SIZE = 24;
