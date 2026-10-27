'use client';

import { cn } from '../../lib/utils';
import { Subcategory } from '../../types';
import { Skeleton } from '../ui/Skeleton';

interface SubcategoryListProps {
  subcategories?: Subcategory[];
  isLoading?: boolean;
  activeSlug?: string | null;
  onSelect: (slug: string | null) => void;
  categoryName?: string;
}

export function SubcategoryList({
  subcategories,
  isLoading,
  activeSlug,
  onSelect,
  categoryName,
}: SubcategoryListProps) {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full shrink-0" />
        ))}
      </div>
    );
  }

  if (!subcategories || subcategories.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide py-1">
      <span className="text-xs font-semibold text-neutral-500 shrink-0 uppercase tracking-wider">
        Subcategory:
      </span>
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 border',
          activeSlug === null
            ? 'bg-navy text-white border-navy shadow-sm'
            : 'bg-white text-neutral-600 border-neutral-200 hover:border-orange hover:text-orange'
        )}
      >
        All {categoryName ? `in ${categoryName}` : ''}
      </button>
      {subcategories.map((sub) => (
        <button
          key={sub.id}
          onClick={() => onSelect(sub.slug)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 border',
            activeSlug === sub.slug
              ? 'bg-navy text-white border-navy shadow-sm'
              : 'bg-white text-neutral-600 border-neutral-200 hover:border-orange hover:text-orange'
          )}
        >
          {sub.name}
        </button>
      ))}
    </div>
  );
}
