import { motion } from "framer-motion";

export function AnimatedBg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full blur-[120px]"
        style={{ background: "oklch(0.88 0.18 130 / 0.22)" }}
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -right-24 w-[420px] h-[420px] rounded-full blur-[120px]"
        style={{ background: "oklch(0.6 0.22 280 / 0.22)" }}
        animate={{ x: [0, -50, 30, 0], y: [0, -30, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 left-1/3 w-[380px] h-[380px] rounded-full blur-[120px]"
        style={{ background: "oklch(0.75 0.18 160 / 0.2)" }}
        animate={{ x: [0, 40, -40, 0], y: [0, -20, 20, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}