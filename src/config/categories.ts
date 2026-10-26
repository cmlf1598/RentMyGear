import type { CategoryId } from "@/types/gear";

export interface Category {
  id: CategoryId;
  name: string;
  tagline: string;
  description: string;
  /** Used to steer Nano Banana towards a coherent visual style per category. */
  imagePromptContext: string;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  "fotografia-video": {
    id: "fotografia-video",
    name: "Fotografía y Video",
    tagline: "Cámaras, lentes y estabilizadores profesionales",
    description:
      "Equipo de cine y fotografía de gama alta para producciones, viajes y proyectos creativos.",
    imagePromptContext: "professional camera and filmmaking equipment",
  },
  "montana-camping": {
    id: "montana-camping",
    name: "Montaña y Camping",
    tagline: "Tiendas, mochilas y equipo técnico de altura",
    description: "Todo lo necesario para expediciones, trekking y noches bajo las estrellas.",
    imagePromptContext: "technical mountaineering and camping gear",
  },
  "deportes-acuaticos": {
    id: "deportes-acuaticos",
    name: "Deportes Acuáticos",
    tagline: "Tablas, kayaks y equipo de buceo",
    description: "Equipo premium para surf, paddle, kayak y exploración submarina.",
    imagePromptContext: "premium water sports equipment",
  },
};

export const CATEGORY_LIST: Category[] = Object.values(CATEGORIES);

export function getCategory(id: string): Category | undefined {
  return (CATEGORIES as Record<string, Category>)[id];
}
