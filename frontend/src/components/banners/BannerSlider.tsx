'use client';

import * as React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getImageUrl } from '../../lib/utils';
import { useBanners } from '../../hooks/useBanners';
import { Skeleton } from '../ui/Skeleton';

export function BannerSlider() {
  const { data: banners, isLoading } = useBanners();
  const [current, setCurrent] = React.useState(0);

  const activeBanners = banners?.filter((b) => b.is_active) || [];
  const total = activeBanners.length;

  // Auto-play
  React.useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % total);
    }, 4000);
    return () => clearInterval(timer);
  }, [total]);

  const prev = () => setCurrent((c) => (c - 1 + total) % total);
  const next = () => setCurrent((c) => (c + 1) % total);

  if (isLoading) {
    return (
      <div className="w-full h-[220px] md:h-[400px] rounded-3xl overflow-hidden">
        <Skeleton variant="image" className="w-full h-full" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="w-full h-[220px] md:h-[400px] rounded-3xl bg-grad-orange-black flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2 font-raleway">Purixia</h2>
          <p className="text-orange-100 text-sm md:text-base">Best gadgets in Bangladesh</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[220px] md:h-[400px] rounded-3xl overflow-hidden group">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <Image
            src={getImageUrl(activeBanners[current].image)}
            alt={activeBanners[current].title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          {/* Text */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl md:text-4xl font-extrabold text-white tracking-tight mb-1"
            >
              {activeBanners[current].title}
            </motion.h2>
            {activeBanners[current].subtitle && (
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="text-sm md:text-base text-white/80 max-w-lg"
              >
                {activeBanners[current].subtitle}
              </motion.p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Arrows */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {activeBanners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
