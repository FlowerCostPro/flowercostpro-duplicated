import type { ComponentType } from 'react';
import { Settings, Sprout, BookOpen, ShoppingCart } from 'lucide-react';

export interface GuideStep {
  number: number;
  title: string;
  description: string;
  buttonLabel: string;
  section: string;
  reminder: string;
  icon: ComponentType<{ className?: string }>;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    number: 1,
    title: 'Set your default markup',
    description: 'Go to Settings and enter your default markup. This is the percentage the app uses to price arrangements unless you choose a different pricing profile. Then fill in your shop details and tap Save Settings.',
    buttonLabel: 'Open Settings',
    section: 'settings',
    reminder: 'Enter your default markup and shop details, then tap Save Settings.',
    icon: Settings
  },
  {
    number: 2,
    title: 'Add pricing profiles',
    description: "Not every order should be priced the same way. Create a separate profile for each type of order, for example Everyday / walk-in, Weddings, and Holidays (Valentine's Day, Mother's Day). The right markup is applied automatically, with no adjusting by hand.",
    buttonLabel: 'Set up pricing profiles',
    section: 'settings',
    reminder: 'Create a profile for each order type — Everyday, Weddings, Holidays.',
    icon: Settings
  },
  {
    number: 3,
    title: 'Add your flowers and supplies',
    description: 'Start with something you already know the price of: a dozen roses. In the Product Library, add each item that goes into it with your wholesale cost: roses, greens, filler, vase, ribbon.',
    buttonLabel: 'Open Product Library',
    section: 'products',
    reminder: 'Add each item with your wholesale cost — roses, greens, filler, vase, ribbon.',
    icon: Sprout
  },
  {
    number: 4,
    title: 'Build your Dozen Roses recipe',
    description: 'Go to Arrangement Recipes, create a recipe called "Dozen Roses," and add the items from Step 3. Watch the price build as you go. Compare it to what you charge today. Is your margin where you want it?',
    buttonLabel: 'Open Arrangement Recipes',
    section: 'recipes',
    reminder: 'Create a recipe called "Dozen Roses" and add items from Step 3.',
    icon: BookOpen
  },
  {
    number: 5,
    title: 'Create your first order',
    description: 'Create an order using your Dozen Roses recipe. This is where it clicks: anyone on your team can pull up the arrangement and have it priced instantly. Your margin stays protected, and your wholesale costs are never shown to staff.',
    buttonLabel: 'Create an Order',
    section: 'create-order',
    reminder: 'Create an order using your Dozen Roses recipe.',
    icon: ShoppingCart
  }
];

export const TOTAL_GUIDE_STEPS = 5;

export function loadGuideProgress(userId: string): { completedSteps: number[]; guideHidden: boolean } {
  try {
    const raw = localStorage.getItem(`guide_progress_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { completedSteps: [], guideHidden: false };
}

export function saveGuideProgress(userId: string, completedSteps: number[], guideHidden: boolean) {
  try {
    localStorage.setItem(`guide_progress_${userId}`, JSON.stringify({ completedSteps, guideHidden }));
  } catch { /* ignore */ }
}
