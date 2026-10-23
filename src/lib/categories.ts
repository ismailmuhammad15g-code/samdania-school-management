const STORAGE_KEY = 'samdani_categories_v2';

import { dbGet, dbSet, isDbReady } from './localDb';

export interface Category {
  id: string;
  type: 'Income' | 'Expense';
  nameEn: string;
  nameBn: string;
}

export function getCategories(): Category[] {
  try {
    if (isDbReady()) {
      const v = dbGet(STORAGE_KEY);
      if (v) return v as Category[];
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return [];
}

export function saveCategories(categories: Category[]): void {
  if (isDbReady()) {
    dbSet(STORAGE_KEY, categories);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }
}

export function addCategory(type: 'Income' | 'Expense', nameEn: string, nameBn: string): Category {
  const categories = getCategories();
  const newCat: Category = {
    id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    nameEn,
    nameBn,
  };
  categories.push(newCat);
  saveCategories(categories);
  return newCat;
}

export function deleteCategory(id: string): void {
  const categories = getCategories().filter(c => c.id !== id);
  saveCategories(categories);
}

export function getCategoriesByType(type: 'Income' | 'Expense'): Category[] {
  return getCategories().filter(c => c.type === type);
}
