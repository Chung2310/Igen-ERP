import {
  FOOD_DATABASE,
  DEFAULT_AVAILABLE_FOODS,
  STORAGE_KEY_CUSTOM_FOODS,
  type CustomFoodItem,
} from '../components/nutrition/MealSwapperModal';
import type { FoodItem, FoodCategory } from '../types';

export const STORAGE_KEY_DELETED_FOODS = '3s_gym_deleted_food_ids';

export { FOOD_DATABASE, DEFAULT_AVAILABLE_FOODS, STORAGE_KEY_CUSTOM_FOODS };
export type { CustomFoodItem, FoodItem, FoodCategory };

export function getCustomFoods(): CustomFoodItem[] {
  if (typeof window === 'undefined') return DEFAULT_AVAILABLE_FOODS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_FOODS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to get custom foods', e);
  }
  return DEFAULT_AVAILABLE_FOODS;
}

export function getDeletedFoodIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_FOODS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to get deleted food ids', e);
  }
  return [];
}

export function saveCustomFoods(foods: CustomFoodItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_FOODS, JSON.stringify(foods));
    window.dispatchEvent(new CustomEvent('3s-food-db-updated'));
  } catch (e) {
    console.error('Failed to save custom foods', e);
  }
}

export function getAllCombinedFoods(): FoodItem[] {
  const custom = getCustomFoods();
  const deletedIds = new Set(getDeletedFoodIds());
  const filteredCustom = custom.filter((f) => !deletedIds.has(f.id));
  const filteredDefaults = FOOD_DATABASE.filter((f) => !deletedIds.has(f.id));
  return [...filteredCustom, ...filteredDefaults];
}

export function addCustomFood(food: Omit<CustomFoodItem, 'id'>): CustomFoodItem {
  const newFood: CustomFoodItem = {
    ...food,
    id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    isCustom: true,
  };
  const list = [newFood, ...getCustomFoods()];
  saveCustomFoods(list);
  return newFood;
}

export function updateCustomFood(id: string, updates: Partial<CustomFoodItem>): void {
  const list = getCustomFoods();
  const exists = list.some((f) => f.id === id);
  if (exists) {
    const nextList = list.map((f) => (f.id === id ? { ...f, ...updates } : f));
    saveCustomFoods(nextList);
  } else {
    // If it's a default food being edited, save as an overridden custom food
    const defaultFood = FOOD_DATABASE.find((f) => f.id === id);
    if (defaultFood) {
      const newCustom: CustomFoodItem = {
        ...defaultFood,
        ...updates,
        id: `custom_override_${id}_${Date.now()}`,
        isCustom: true,
      };
      saveCustomFoods([newCustom, ...list]);
    }
  }
}

export function deleteCustomFood(id: string): void {
  const list = getCustomFoods();
  const nextList = list.filter((f) => f.id !== id && f.id !== `custom_override_${id}`);
  saveCustomFoods(nextList);

  // Also track deleted id so default 3S items can also be deleted
  const deleted = getDeletedFoodIds();
  if (!deleted.includes(id)) {
    deleted.push(id);
    try {
      localStorage.setItem(STORAGE_KEY_DELETED_FOODS, JSON.stringify(deleted));
    } catch (e) {
      console.error('Failed to save deleted food ids', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('3s-food-db-updated'));
  }
}

export function resetCustomFoods(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_DELETED_FOODS);
  } catch (e) {
    console.error('Failed to reset deleted food ids', e);
  }
  saveCustomFoods(DEFAULT_AVAILABLE_FOODS);
}
