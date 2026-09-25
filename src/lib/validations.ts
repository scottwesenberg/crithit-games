import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name is too short").max(80),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const addressSchema = z.object({
  label: z.string().min(1).max(40).default("Home"),
  fullName: z.string().min(2).max(120),
  line1: z.string().min(2).max(160),
  line2: z.string().max(160).optional().or(z.literal("")),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2).default("US"),
  phone: z.string().max(30).optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});

export const cardVariantSchema = z.object({
  finish: z.string().min(1).max(40),
  condition: z.enum([
    "NEAR_MINT",
    "LIGHTLY_PLAYED",
    "MODERATELY_PLAYED",
    "HEAVILY_PLAYED",
    "DAMAGED",
  ]),
  language: z.string().min(1).max(30).default("English"),
  priceCents: z.number().int().nonnegative(),
  quantity: z.number().int().nonnegative(),
});

export const cardSchema = z.object({
  setId: z.string().min(1),
  name: z.string().min(1).max(200),
  collectorNumber: z.string().max(30).optional().or(z.literal("")),
  rarity: z.string().max(60).optional().or(z.literal("")),
  cardType: z.string().max(80).optional().or(z.literal("")),
  subType: z.string().max(80).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  variants: z.array(cardVariantSchema).min(1, "Add at least one variant"),
});

export const checkoutItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive().max(99),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1),
  addressId: z.string().optional(),
});
