import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface FlickVerifiedBadgeProps {
  size?: number;
  className?: string;
  tooltip?: string;
  animated?: boolean;
  category?: string;
}

export function FlickVerifiedBadge({
  size = 16,
  className = "",
  tooltip = "Flick Verified Account ✦ Authenticity Confirmed",
  animated = true,
  category,
}: FlickVerifiedBadgeProps) {
  const shouldReduceMotion = useReducedMotion();
  const titleText = category ? `Flick Verified ${category} ✦` : tooltip;

  return (
    <span
      className={`inline-flex items-center justify-center align-middle relative select-none shrink-0 group ${className}`}
      title={titleText}
      role="img"
      aria-label="Verified account tick"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_1px_3px_rgba(5,150,105,0.45)] dark:drop-shadow-[0_1px_4px_rgba(16,185,129,0.5)] transition-transform group-hover:scale-110 duration-200"
      >
        <defs>
          {/* Rich Emerald Gradient */}
          <linearGradient id="emeraldBadgeBase" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="35%" stopColor="#10b981" />
            <stop offset="70%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          {/* Top Specular Arc Highlight */}
          <linearGradient id="emeraldHighlightArc" x1="12" y1="2" x2="12" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Subtle Outer Bevel Rim */}
          <linearGradient id="emeraldRim" x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#064e3b" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Outer Bevel Contrast Ring (Guarantees contrast on light and dark surfaces) */}
        <path
          d="M12 1.8C12.5 1.8 12.9 2 13.2 2.3L14.8 3.7C15.1 4 15.6 4.1 16 4.1L18.2 4C19 4 19.6 4.6 19.8 5.4L20.4 7.5C20.5 7.9 20.8 8.3 21.2 8.5L23.1 9.6C23.8 10 24.1 10.8 23.9 11.5L23.3 13.7C23.2 14.1 23.3 14.6 23.5 14.9L24.8 16.8C25.2 17.5 25.1 18.3 24.6 18.9L22.9 20.4C22.6 20.7 22.4 21.1 22.4 21.6L22.4 23.8C22.4 24.6 21.8 25.2 21 25.3L18.8 25.5C18.4 25.5 18 25.8 17.6 26.1L16 27.6C15.4 28.1 14.6 28.2 13.9 27.8L12.1 26.7C11.7 26.5 11.3 26.5 10.9 26.6L8.7 27.3C8 27.5 7.2 27.2 6.8 26.5L5.7 24.6C5.5 24.2 5.1 23.9 4.7 23.8L2.5 23.4C1.7 23.3 1.2 22.6 1.2 21.8L1.4 19.6C1.4 19.1 1.3 18.7 1 18.4L-0.3 16.6C-0.8 16 -0.7 15.1 -0.1 14.5L1.3 13C1.6 12.7 1.7 12.2 1.6 11.8L1.1 9.7C0.9 8.9 1.4 8.2 2.1 7.9L4.2 7C4.6 6.8 4.9 6.5 5 6L5.9 4C6.2 3.2 6.9 2.8 7.7 2.9L9.9 3.2C10.4 3.3 10.8 3.1 11.1 2.9L12 1.8Z"
          fill="url(#emeraldRim)"
          transform="scale(0.88) translate(1.4, 1.2)"
        />

        {/* 12-pointed Scalloped Emerald Seal Base */}
        <path
          d="M12 2.2C12.4 2.2 12.8 2.4 13.1 2.7L14.7 4.1C15 4.3 15.4 4.4 15.8 4.4L18 4.3C18.7 4.3 19.3 4.8 19.5 5.5L20.1 7.6C20.2 8 20.5 8.3 20.8 8.5L22.7 9.6C23.3 10 23.6 10.7 23.4 11.4L22.9 13.5C22.8 13.9 22.9 14.3 23.1 14.7L24.3 16.5C24.7 17.1 24.6 17.9 24.1 18.4L22.5 19.9C22.2 20.2 22 20.6 22 21L22 23.2C22 23.9 21.4 24.5 20.7 24.6L18.5 24.8C18.1 24.8 17.7 25 17.4 25.3L15.8 26.8C15.3 27.3 14.5 27.4 13.9 27L12.1 25.9C11.8 25.7 11.4 25.7 11 25.8L8.9 26.5C8.2 26.7 7.5 26.4 7.1 25.8L6 23.9C5.8 23.6 5.5 23.3 5.1 23.2L2.9 22.8C2.2 22.7 1.7 22.1 1.7 21.4L1.9 19.2C1.9 18.8 1.8 18.4 1.5 18.1L0.2 16.4C-0.2 15.8 -0.1 15 0.4 14.5L1.8 13C2.1 12.7 2.2 12.3 2.1 11.9L1.6 9.8C1.4 9.1 1.8 8.4 2.5 8.1L4.5 7.2C4.9 7 5.2 6.7 5.3 6.3L6.1 4.3C6.4 3.6 7 3.2 7.7 3.3L9.9 3.6C10.3 3.7 10.7 3.5 11 3.3L12 2.2Z"
          fill="url(#emeraldBadgeBase)"
          transform="scale(0.88) translate(1.4, 1.2)"
        />

        {/* Specular Curved Highlight Arc */}
        <path
          d="M4 11.5C4 7.4 7.3 4 11.5 4C15.7 4 19 7.4 19 11.5C19 12 18.9 12.5 18.8 13C17.2 9.2 13.4 6.7 9.2 7.4C6.7 7.8 4.7 9.4 4.1 11.6C4.05 11.55 4 11.52 4 11.5Z"
          fill="url(#emeraldHighlightArc)"
        />

        {/* Crisp, Bold Checkmark (Optical Centering & High Contrast) */}
        <path
          d="M8.5 12.4L11 15L16.2 9.4"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
        />
      </svg>

      {/* Restrained Reflective Shine Animation (Disables if reduced-motion preferred) */}
      {animated && !shouldReduceMotion && (
        <motion.span
          className="absolute inset-0 overflow-hidden pointer-events-none rounded-full"
          initial={{ x: "-120%", opacity: 0 }}
          animate={{
            x: ["-120%", "220%"],
            opacity: [0, 0.7, 0.7, 0],
          }}
          transition={{
            repeat: Infinity,
            repeatDelay: 5.2,
            duration: 1.2,
            ease: "easeInOut",
          }}
          aria-hidden="true"
        >
          <span className="w-2 h-full block bg-gradient-to-r from-transparent via-white/50 to-transparent blur-[0.5px] rotate-20 transform" />
        </motion.span>
      )}
    </span>
  );
}
