export type ProductUnit = 'stem' | 'bunch';
export type BunchPortion = 1 | 2 | 3 | 4;

export interface Product {
  id: string;
  templateId?: string;
  name: string;
  wholesaleCost: number;
  quantity: number;
  type: 'stem' | 'vase' | 'accessory' | 'other';
  unit: ProductUnit;
  portionDivisor?: BunchPortion;
  inventoryCount?: number;
  lowStockThreshold?: number;
  retailPrice?: number;
}

export interface MarkupSettings {
  stem: number;
  vase: number;
  accessory: number;
  other: number;
  bunch: number;
  laborPercent?: number | null;
}

export interface ProductTemplate {
  id: string;
  name: string;
  wholesaleCost: number;
  retailPrice?: number;
  type: 'stem' | 'vase' | 'accessory' | 'other';
  unit: ProductUnit;
  lastUsed: Date;
  inventoryCount?: number;
  lowStockThreshold?: number;
}

export interface OrderRecord {
  id: string;
  name: string;
  date: Date;
  products: Product[];
  totalWholesale: number;
  totalRetail: number;
  profit: number;
  photo?: string;
  notes?: string;
  staffName?: string;
  staffId?: string;
  customerPrice?: number | null;
  laborAmount?: number | null;
}

export interface ArrangementRecipe {
  id: string;
  name: string;
  description?: string;
  websitePrice: number;
  ingredients: RecipeIngredient[];
  photo?: string;
  websiteUrl?: string;
  lastUpdated: Date;
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  type: 'stem' | 'vase' | 'accessory' | 'other';
  notes?: string;
}

export interface POSSettings {
  system?: string;
  storeName: string;
  isConfigured: boolean;
}