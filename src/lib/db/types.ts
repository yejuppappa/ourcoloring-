export interface Category {
  id: string;
  slug: string;
  name_ko: string;
  name_en: string;
  description_ko: string;
  description_en: string;
  icon: string;
  sort_order: number;
}

export interface Subcategory {
  id: string;
  category_id: string;
  slug: string;
  name_ko: string;
  name_en: string;
  description_ko: string;
  description_en: string;
  sort_order: number;
}

export interface Drawing {
  id: string;
  subcategory_id: string;
  slug: string;
  name_ko: string;
  name_en: string;
  description_ko: string;
  description_en: string;
  difficulty: "easy" | "medium" | "hard";
  age_min: number;
  age_max: number;
  image_key: string;
  thumbnail_key: string;
  download_count: number;
  is_published: number;
  created_at: string;
  updated_at: string;
}

/** Drawing with joined category/subcategory info for display */
export interface DrawingWithMeta extends Drawing {
  category_slug: string;
  category_name_ko: string;
  category_name_en: string;
  subcategory_slug: string;
  subcategory_name_ko: string;
  subcategory_name_en: string;
}

export type Locale = "ko" | "en";

export function localizedName<T extends { name_ko: string; name_en: string }>(
  item: T,
  locale: Locale
): string {
  return locale === "ko" ? item.name_ko : item.name_en;
}

export function localizedDesc<
  T extends { description_ko: string; description_en: string },
>(item: T, locale: Locale): string {
  return locale === "ko" ? item.description_ko : item.description_en;
}
