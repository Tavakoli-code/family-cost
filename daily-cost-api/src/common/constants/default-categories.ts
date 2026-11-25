import { CategoryType, RecordStatus } from '@prisma/client';

const defaultCategoryKeys = {
  [CategoryType.EXPENSE]: [
    'category.food',
    'category.health',
    'category.education',
    'category.fun',
    'category.transport',
    'category.internet_phone',
    'category.housing',
    'category.utilities',
    'category.clothing',
    'category.kids',
    'category.gifts_guests',
    'category.charity',
    'category.other',
  ],
  [CategoryType.INCOME]: [
    'category.salary',
    'category.business',
    'category.remittance',
    'category.gift',
    'category.income_other',
  ],
};

export const DEFAULT_CATEGORIES = Object.values(CategoryType).flatMap((type) =>
  defaultCategoryKeys[type].map((nameKey, sortOrder) => ({
    type,
    nameKey,
    name: null,
    sortOrder,
    status: RecordStatus.ACTIVE,
  })),
);
