import React, { useState, useEffect, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { Heart, Share2, Info, Star, ArrowRight } from "lucide-react";
import { Product } from "../types/product";
import { useFeedStore } from "../store/feed";
import { MOTION } from "../lib/motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProductCardProps {
  key?: React.Key;
  product: Product;
  index: number;
}

export default function ProductCard({ product, index }: ProductCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleLike = useFeedStore((state) => state.toggleLike);
  const isLiked = useFeedStore((state) => state.likedIds.has(product.id));

  const [imgMeta, setImgMeta] = useState<{
    hasBg: boolean;
    dominantColor: string;
    aspectRatio: number;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/image?url=${encodeURIComponent(product.imageUrl)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject("Not ok")))
      .then((data) => {
        if (data && data.dominantColor) setImgMeta(data);
        else throw new Error("No color");
      })
      .catch(() =>
        setImgMeta({
          hasBg: true,
          dominantColor: "rgb(255, 255, 255)",
          aspectRatio: 1,
        }),
      );
  }, [product.imageUrl]);

  const handleShopNow = async () => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        timestamp: Date.now(),
        source: "feed",
      }),
    });
    window.open(product.affiliateUrl, "_blank", "noopener");
  };

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const particles = Array.from({ length: 6 });

  const [lastTap, setLastTap] = useState(0);
  const [showSheet, setShowSheet] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      setShowSheet(true);
    }, 600);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  const handleImageTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      if (!isLiked) toggleLike(product.id);
    }
    setLastTap(now);
  };

  return (
    <div
      ref={containerRef}
      className="snap-section relative bg-black overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
    >
      {/* Background Layer */}
      <div
        className="absolute inset-0 z-0 cursor-pointer"
        onClick={handleImageTap}
      >
        <motion.div
          className="w-full h-full relative"
          style={{ y }}
          initial={{ scale: 1.04 }}
          whileInView={{ scale: 1.0 }}
          transition={MOTION.easeSlow}
        >
          {imgMeta && !imgMeta.hasBg ? (
            <div
              className="w-full h-full flex items-center justify-center p-8"
              style={{
                backgroundColor: imgMeta.dominantColor
                  ? imgMeta.dominantColor
                      .replace("rgb", "rgba")
                      .replace(")", ", 0.15)")
                  : "rgba(255, 255, 255, 0.05)",
              }}
            >
              <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, white 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-3/4 max-h-[60%] object-contain drop-shadow-2xl"
              />
            </div>
          ) : (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 vignette" />
        </motion.div>
      </div>

      {/* Bottom Content Panel */}
      <motion.div
        className="absolute bottom-0 left-0 w-full px-[20px] pb-[32px] pt-[24px] z-10 safe-bottom flex flex-col"
        initial={{ y: 24, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ ...MOTION.easeSlow, delay: 0.3 }}
      >
        <motion.div
          className="text-[10px] uppercase font-normal tracking-[0.12em] text-white/60 mb-2"
          initial={{ letterSpacing: "0.08em" }}
          whileInView={{ letterSpacing: "0.12em" }}
          transition={{ duration: 0.4 }}
        >
          {product.category}
        </motion.div>

        <h1 className="text-[22px] font-light leading-[1.2] text-white max-w-[80%] mb-4 line-clamp-2">
          {product.name}
        </h1>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-[16px] font-normal">${product.price}</span>
          {product.originalPrice && (
            <>
              <span className="text-[13px] font-normal text-white/45 line-through">
                ${product.originalPrice}
              </span>
              <span className="text-[10px] font-normal px-[7px] py-[2px] bg-white/15 rounded-[100px] text-white">
                -
                {Math.round(
                  ((product.originalPrice - product.price) /
                    product.originalPrice) *
                    100,
                )}
                %
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-white/70">
              {product.rating} ★
            </span>
            <div className="w-[1px] h-3 bg-white/20" />
            <span className="text-[12px] text-white/70">
              {product.reviewCount > 999
                ? `${(product.reviewCount / 1000).toFixed(1)}k`
                : product.reviewCount}{" "}
              reviews
            </span>
            <div className="w-[1px] h-3 bg-white/20" />
            <span className="text-[12px] text-white/70 truncate max-w-[100px]">
              {product.specs[0] || "Premium Gear"}
            </span>
          </div>
        </div>

        <motion.button
          onClick={handleShopNow}
          className="w-full h-[48px] rounded-[100px] bg-white/15 backdrop-blur-xl border-[0.5px] border-white/30 text-[14px] font-normal text-white flex items-center justify-center gap-2"
          whileHover={{ backgroundColor: "rgba(255,255,255,0.22)" }}
          whileTap={{ scale: 0.97 }}
          transition={MOTION.springFast}
        >
          Shop Now
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.div>

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-[160px] flex flex-col gap-4 z-20">
        <div className="relative">
          <motion.button
            onClick={() => toggleLike(product.id)}
            className="w-11 h-11 rounded-full flex items-center justify-center glass"
            whileTap={{ scale: 1.4 }}
            transition={MOTION.springFast}
          >
            <Heart
              className={cn(
                "w-[18px] transition-colors",
                isLiked ? "fill-white text-white" : "text-white",
              )}
            />
          </motion.button>

          <AnimatePresence>
            {isLiked && (
              <div className="absolute inset-0 pointer-events-none">
                {particles.map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-white rounded-full"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{
                      scale: [0, 1, 0],
                      x: [0, Math.cos((i * 60 * Math.PI) / 180) * 40],
                      y: [0, Math.sin((i * 60 * Math.PI) / 180) * 40],
                      opacity: [1, 1, 0],
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        <motion.button className="w-11 h-11 rounded-full flex items-center justify-center glass">
          <Share2 className="w-[18px] text-white" />
        </motion.button>

        <motion.button
          onClick={() => setShowSheet(true)}
          className="w-11 h-11 rounded-full flex items-center justify-center glass"
        >
          <Info className="w-[18px] text-white" />
        </motion.button>
      </div>

      {/* Detail Bottom Sheet */}
      <AnimatePresence>
        {showSheet && (
          <>
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSheet(false)}
            />
            <motion.div
              className="absolute bottom-0 left-0 w-full bg-[#0A0A0A]/95 backdrop-blur-[20px] rounded-t-[24px] p-8 pb-12 z-50 border-t border-white/10"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={MOTION.spring}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
              <div className="text-[10px] text-white/50 uppercase tracking-widest mb-2">
                {product.category}
              </div>
              <h3 className="text-xl font-light mb-6 pr-8">{product.name}</h3>

              <div className="space-y-6">
                <div>
                  <div className="text-[11px] text-white/40 uppercase mb-3">
                    Specifications
                  </div>
                  <ul className="space-y-2">
                    {product.specs.map((spec, i) => (
                      <li
                        key={i}
                        className="text-[13px] font-light text-white/80 flex items-center gap-2"
                      >
                        <div className="w-1 h-1 bg-white/30 rounded-full" />
                        {spec}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-4">
                  <motion.button
                    onClick={handleShopNow}
                    className="flex-1 h-12 rounded-full bg-white text-black text-[14px] font-medium"
                    whileTap={{ scale: 0.97 }}
                  >
                    View on site
                  </motion.button>
                  <motion.button
                    className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"
                    whileTap={{ scale: 0.97 }}
                  >
                    <Share2 className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Feed Snap Indicator (Side) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
        <div className="w-[2px] h-8 bg-white" />
        <div className="w-[2px] h-2 bg-white/20" />
        <div className="w-[2px] h-2 bg-white/20" />
        <div className="w-[2px] h-2 bg-white/20" />
      </div>
    </div>
  );
}
