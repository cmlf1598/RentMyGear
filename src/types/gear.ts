import { z } from "zod";

export const CATEGORY_IDS = ["fotografia-video", "montana-camping", "deportes-acuaticos"] as const;

export const CategoryIdSchema = z.enum(CATEGORY_IDS);
export type CategoryId = z.infer<typeof CategoryIdSchema>;

/** Booked window relative to "today", so mock availability never goes stale. */
export const BookedOffsetSchema = z.object({
  startInDays: z.int().min(0),
  lengthDays: z.int().min(1),
});

export const ImageCreditSchema = z.object({
  name: z.string().min(1),
  profileUrl: z.url(),
  photoUrl: z.url(),
});

export const GearItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be a lowercase slug"),
  name: z.string().min(2),
  brand: z.string().min(1),
  category: CategoryIdSchema,
  tagline: z.string().min(1),
  description: z.string().min(1),
  dailyRate: z.number().positive(),
  deposit: z.number().nonnegative(),
  rating: z.number().min(0).max(5),
  reviewCount: z.int().nonnegative(),
  location: z.string().min(1),
  specs: z.record(z.string(), z.string()),
  imageURL: z.url().nullable(),
  imageCredit: ImageCreditSchema.nullable(),
  bookedOffsets: z.array(BookedOffsetSchema),
});

export const InventorySchema = z.array(GearItemSchema).min(1);

export type GearItem = z.infer<typeof GearItemSchema>;
export type ImageCredit = z.infer<typeof ImageCreditSchema>;

/** Concrete booked date range (inclusive), resolved at request time. */
export interface BookedRange {
  from: Date;
  to: Date;
}

/** Serializable variant safe to pass from Server to Client Components. */
export interface BookedRangeISO {
  from: string;
  to: string;
}

export type ImageSource = "origin" | "memory" | "gcs" | "generated";

export interface ResolvedImage {
  url: string;
  source: ImageSource;
  isAiGenerated: boolean;
}
