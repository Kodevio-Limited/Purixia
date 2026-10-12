'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { useSubmitReview } from '../../hooks/useProducts';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
}

export function ReviewModal({ open, onClose, productId, productName }: ReviewModalProps) {
  const submitReview = useSubmitReview();

  // The parent mounts this component only while the modal is open, so a fresh
  // mount already starts from these defaults — no reset effect needed.
  const [rating, setRating] = React.useState(5);
  const [hoveredRating, setHoveredRating] = React.useState(0);
  const [title, setTitle] = React.useState('');
  const [comment, setComment] = React.useState('');

  const activeRating = hoveredRating > 0 ? hoveredRating : rating;
  const canSubmit = rating > 0 && (comment.trim().length > 0 || title.trim().length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitReview.isPending) return;
    submitReview.mutate(
      { productId, payload: { rating, title: title.trim(), comment: comment.trim() } },
      { onSuccess: onClose },
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Write a review for ${productName}`}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 font-poppins"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close review form"
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-neutral-500 hover:text-navy hover:bg-surface transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-extrabold text-navy tracking-tight pr-8">
              Write a Review
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5 truncate">{productName}</p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Star picker */}
              <div>
                <label className="text-xs font-semibold text-neutral-700 tracking-wide select-none">
                  Your rating <span className="text-error">*</span>
                </label>
                <div className="flex items-center gap-1 mt-1.5" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="p-1 transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={cn(
                          'w-7 h-7 transition-colors',
                          star <= activeRating
                            ? 'fill-orange text-orange'
                            : 'fill-neutral-300 text-neutral-300'
                        )}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-bold text-navy">{activeRating}/5</span>
                </div>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="review-title" className="text-xs font-semibold text-neutral-700 tracking-wide select-none">
                  Title <span className="text-neutral-500 font-normal">(optional)</span>
                </label>
                <input
                  id="review-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={300}
                  placeholder="Sum up your experience"
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
                />
              </div>

              {/* Comment */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="review-comment" className="text-xs font-semibold text-neutral-700 tracking-wide select-none">
                  Review <span className="text-neutral-500 font-normal">(required)</span>
                </label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="How was the product? Share details of your experience."
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm resize-none transition-all focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="md" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="md"
                  loading={submitReview.isPending}
                  disabled={!canSubmit}
                  className="bg-orange hover:bg-orange-700 text-white shadow-md shadow-orange/30 focus:ring-orange border-transparent"
                >
                  Submit Review
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
