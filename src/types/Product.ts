export interface Product {
  id: string;
  name: string;
  wholesaleCost: number;
  quantity: number;
  type: 'stem' | 'vase' | 'accessory' | 'other';
  inventoryCount?: number;
  lowStockThreshold?: number;
}

export interface MarkupSettings {
  stem: number;
  vase: number;
  accessory: number;
  other: number;
}

export interface ProductTemplate {
  id: string;
  name: string;
  wholesaleCost: number;
  type: 'stem' | 'vase' | 'accessory' | 'other';
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