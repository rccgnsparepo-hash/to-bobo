import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
    scale: 0.995,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.28,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.995,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <motion.div
      key={pathname}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-full w-full flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  );
}