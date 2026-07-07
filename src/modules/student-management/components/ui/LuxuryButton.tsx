import { motion, HTMLMotionProps } from 'motion/react';
import { cn } from '../../lib/utils';

interface LuxuryButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function LuxuryButton({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: LuxuryButtonProps) {
  const variants = {
    primary: 'bg-stone-900 text-stone-50 hover:bg-stone-800 shadow-xl shadow-stone-200/50',
    secondary: 'bg-emerald-800 text-emerald-50 hover:bg-emerald-700 shadow-xl shadow-emerald-200/50',
    outline: 'border border-stone-200 bg-transparent text-stone-900 hover:bg-stone-50',
    ghost: 'bg-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-base',
  };

  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
