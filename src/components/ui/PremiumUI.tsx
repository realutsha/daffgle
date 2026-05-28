"use client";
 
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
 
// Spring Physics Preset for High-End Transitions
export const premiumSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 28,
  mass: 0.75
};
 
/* ==========================================
   1. PREMIUM CARD (rounded-3xl / 24px)
   ========================================== */
interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  activeBorder?: boolean;
  style?: React.CSSProperties;
}
 
export function PremiumCard({
  children,
  className,
  onClick,
  hoverable = false,
  activeBorder = false,
  style
}: PremiumCardProps) {
  const isClickable = !!onClick;
 
  return (
    <motion.div
      whileHover={hoverable && isClickable ? { y: -4, scale: 1.012 } : hoverable ? { y: -2 } : undefined}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      transition={premiumSpring}
      onClick={onClick}
      style={style}
      className={cn(
        "rounded-[28px] border p-6 transition-all duration-300",
        "bg-brand-surface/75 border-brand-border text-brand-text-primary backdrop-blur-md shadow-2xl relative overflow-hidden",
        activeBorder && "border-brand-accent/40 shadow-[0_0_20px_rgba(124,255,107,0.12)]",
        isClickable && "cursor-pointer hover:bg-brand-surface/90 hover:border-brand-accent/30",
        className
      )}
    >
      {/* Soft internal gloss overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.005] via-transparent to-white/[0.015] pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
 
/* ==========================================
   2. PREMIUM BUTTON (rounded-2xl / 18px)
   ========================================== */
interface PremiumButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "accent";
  isLoading?: boolean;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  withNeonGlow?: boolean;
}
 
export function PremiumButton({
  children,
  variant = "primary",
  isLoading = false,
  className,
  disabled,
  onClick,
  type = "button",
  withNeonGlow = false
}: PremiumButtonProps) {
  const [isGlowing, setIsGlowing] = useState(false);
 
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;
    setIsGlowing(true);
    setTimeout(() => {
      setIsGlowing(false);
    }, 600);
    if (onClick) onClick(e);
  };
 
  return (
    <motion.button
      type={type}
      whileHover={!disabled && !isLoading ? { scale: 1.02, y: -0.75 } : undefined}
      whileTap={!disabled && !isLoading ? { scale: 0.97 } : undefined}
      transition={premiumSpring}
      disabled={disabled || isLoading}
      onClick={handleClick}
      className={cn(
        "relative flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-[0.18em] transition-all duration-300 select-none cursor-pointer focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed group border",
        
        // Variant: Primary (Futuristic cyber emerald glow CTA)
        variant === "primary" && "bg-[#0B120B]/90 border-brand-accent/40 text-brand-accent shadow-[0_0_20px_rgba(124,255,107,0.12)] hover:border-brand-accent hover:text-white hover:shadow-[0_0_35px_rgba(124,255,107,0.35)]",
        
        // Variant: Secondary (High-transparency clean glass)
        variant === "secondary" && "bg-brand-secondary/40 border-brand-border hover:bg-brand-secondary/85 hover:border-brand-accent/30 text-brand-text-secondary hover:text-white",
        
        // Variant: Danger (Crimson laser high-tech glow)
        variant === "danger" && "bg-[#FF4D4D]/10 border-[#FF4D4D]/35 hover:bg-[#FF4D4D]/25 hover:border-[#FF4D4D] text-[#FF4D4D] shadow-[0_0_15px_rgba(255,77,77,0.12)] hover:shadow-[0_0_28px_rgba(255,77,77,0.35)]",
        
        // Variant: Ghost (Low profile glow-in indicators)
        variant === "ghost" && "bg-transparent border-transparent text-brand-text-secondary hover:text-brand-accent",
        
        // Variant: Accent (Accent Lime dynamic glow board)
        variant === "accent" && "bg-[#101910]/75 border-brand-accent-lime/30 text-[#C7FF6B] shadow-[0_0_12px_rgba(199,255,107,0.08)] hover:border-brand-accent-lime hover:text-white hover:shadow-[0_0_25px_rgba(199,255,107,0.25)]",
        
        className
      )}
    >
      {/* Animated diagonal moving green energy shimmer */}
      {!disabled && !isLoading && (
        <div className="absolute inset-0 rounded-2xl shimmer-green opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 pointer-events-none" />
      )}
 
      {/* Emerald Green Neon Aura Backdrop */}
      <div
        className={cn(
          "absolute -inset-[1.5px] rounded-2xl bg-gradient-to-r from-brand-accent to-brand-accent-secondary opacity-0 blur-[4px] transition-all pointer-events-none duration-500 ease-out z-0",
          !disabled && !isLoading && "group-hover:opacity-15 group-hover:blur-[6px]",
          isGlowing && "opacity-85 blur-[10px] scale-[1.02] duration-75 ease-in",
        )}
      />
      {/* Liquid Glass border glow */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl border border-transparent transition-all pointer-events-none duration-500 z-0",
          !disabled && !isLoading && "group-hover:border-brand-accent/50",
          isGlowing && "border-brand-accent/90 duration-75",
        )}
      />
 
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-current" />
            <span className="opacity-80">Connecting...</span>
          </>
        ) : (
          children
        )}
      </span>
    </motion.button>
  );
}
 
/* ==========================================
   3. PREMIUM INPUT (rounded-2xl / 16px)
   ========================================== */
interface PremiumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}
 
export const PremiumInput = React.forwardRef<HTMLInputElement, PremiumInputProps>(
  ({ label, error, leftIcon, rightIcon, className, containerClassName, type = "text", ...props }, ref) => {
    return (
      <div className={cn("space-y-2 flex flex-col w-full", containerClassName)}>
        {label && (
          <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-[0.25em] ml-1 select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-4 text-brand-text-secondary/60 pointer-events-none flex items-center justify-center transition-colors duration-200">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              "w-full rounded-2xl border bg-brand-secondary/60 px-4 py-4 text-sm text-brand-text-primary outline-none transition duration-300 placeholder:text-brand-text-secondary/30 font-semibold tracking-wide",
              "border-brand-border focus:border-brand-accent/60 focus:bg-brand-secondary/90 focus:shadow-[0_0_15px_rgba(124,255,107,0.12)]",
              leftIcon && "pl-12",
              rightIcon && "pr-12",
              error && "border-brand-danger/55 focus:border-brand-danger/80 focus:shadow-[0_0_12px_rgba(255,77,77,0.15)]",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 text-brand-text-secondary/60 flex items-center justify-center transition-colors duration-200">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-brand-danger font-black uppercase tracking-wider ml-1.5 animate-pulse">
            ⚠️ {error}
          </p>
        )}
      </div>
    );
  }
);
PremiumInput.displayName = "PremiumInput";
 
/* ==========================================
   4. PREMIUM SELECT dropdown
   ========================================== */
interface PremiumSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  containerClassName?: string;
}
 
export function PremiumSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select options...",
  disabled = false,
  error,
  containerClassName
}: PremiumSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
 
  const selectedOption = options.find((o) => o.value === value);
 
  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);
 
  return (
    <div className={cn("space-y-2 flex flex-col relative w-full", containerClassName)} ref={dropdownRef}>
      {label && (
        <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-[0.25em] ml-1 select-none">
          {label}
        </label>
      )}
      
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border bg-brand-secondary/60 px-4 py-4 text-sm text-brand-text-primary outline-none transition duration-300 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-semibold tracking-wide",
          "border-brand-border focus:border-brand-accent/50 focus:shadow-[0_0_15px_rgba(124,255,107,0.1)]",
          isOpen && "border-brand-accent/60 bg-brand-secondary/90 shadow-[0_0_15px_rgba(124,255,107,0.12)]",
          error && "border-brand-danger/40 focus:border-brand-danger/60"
        )}
      >
        <span className={cn(!selectedOption && "text-brand-text-secondary/30")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-brand-text-secondary transition duration-300", isOpen && "rotate-180")} />
      </button>
 
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-0 right-0 z-50 mt-20 max-h-60 overflow-y-auto rounded-2xl border border-brand-accent/25 bg-brand-surface/95 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.8)] backdrop-blur-md no-scrollbar"
          >
            {options.length === 0 ? (
              <div className="px-4 py-3 text-xs text-brand-text-secondary italic">No options available</div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-xl px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider transition cursor-pointer select-none",
                      isSelected
                        ? "bg-brand-accent text-brand-primary font-black shadow-[0_0_12px_rgba(124,255,107,0.25)]"
                        : "text-brand-text-secondary hover:bg-brand-secondary hover:text-white"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
 
      {error && (
        <p className="text-xs text-brand-danger font-black uppercase tracking-wider ml-1.5 animate-pulse">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
 
/* ==========================================
   5. PREMIUM DIALOG / MODAL (rounded-[28px])
   ========================================== */
interface PremiumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}
 
export function PremiumDialog({
  isOpen,
  onClose,
  title,
  description,
  children
}: PremiumDialogProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);
 
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-safe pb-safe">
          {/* Backdrop Blur with high opacity dark-green depth */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#050805]/85 backdrop-blur-md cursor-pointer"
          />
 
          {/* Dialog Container styled with cyber forest tech */}
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 15 }}
            transition={premiumSpring}
            className="w-full max-w-md overflow-hidden rounded-[28px] border border-brand-accent/25 bg-brand-secondary p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),_0_0_30px_rgba(124,255,107,0.15)] z-10 space-y-6 relative"
          >
            {/* Ambient subtle green header glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-10 bg-brand-accent/5 blur-md pointer-events-none rounded-full" />
            
            <div className="relative">
              <h3 className="text-xl font-black uppercase tracking-wider text-white border-b border-brand-border pb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-accent animate-ping" />
                {title}
              </h3>
              {description && (
                <p className="text-xs text-brand-text-secondary mt-3 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
 
            <div className="space-y-4 relative z-10">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
 
/* ==========================================
   6. FLOATING BOTTOM NAVIGATION (fully rounded)
   ========================================== */
interface FloatingNavItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isActive: boolean;
  badge?: number;
}
 
interface FloatingBottomNavProps {
  items: FloatingNavItem[];
}
 
export function FloatingBottomNav({ items }: FloatingBottomNavProps) {
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex justify-center pb-safe w-[92%] max-w-md pointer-events-none">
      <div className="flex w-full items-center justify-around rounded-[24px] border border-brand-accent/25 bg-[#0B120B]/85 px-3 py-2 shadow-[0_12px_45px_rgba(0,0,0,0.8),_0_0_25px_rgba(124,255,107,0.12)] backdrop-blur-xl pointer-events-auto relative overflow-hidden">
        {/* Subtle holographic grid lines indicator inside navbar */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(124,255,107,0.015)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />
 
        {items.map(({ label, icon, onClick, isActive, badge }) => {
          return (
            <button
              key={label}
              onClick={onClick}
              className={cn(
                "relative flex flex-col items-center gap-1 py-1.5 px-3.5 rounded-2xl text-brand-text-secondary transition duration-300 select-none cursor-pointer focus:outline-none outline-none group",
                isActive ? "text-brand-accent font-black" : "hover:text-white"
              )}
            >
              {/* Badge indicator with high intensity emerald green glow */}
              {badge !== undefined && badge > 0 && (
                <span className="absolute top-0.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent-secondary px-1 text-[8px] font-black text-black leading-none shadow-[0_0_8px_rgba(57,255,136,0.8)] animate-pulse">
                  {badge}
                </span>
              )}
 
              <span className={cn("text-lg transition duration-300 group-hover:scale-115 group-hover:-translate-y-0.5", isActive && "scale-120 text-brand-accent drop-shadow-[0_0_8px_rgba(124,255,107,0.6)]")}>
                {icon}
              </span>
              <span className="text-[8px] font-black tracking-widest uppercase transition duration-300 select-none">{label}</span>
 
              {/* Elegant Tab Accent Dot Indicator */}
              {isActive && (
                <motion.span
                  layoutId="activeTabIndicator"
                  className="absolute bottom-[-2px] h-1 w-4 rounded-full bg-brand-accent shadow-[0_0_8px_rgba(124,255,107,0.8)]"
                  transition={premiumSpring}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
 
/* ==========================================
   7. SKELETON LOADER (Rounded micro-containers)
   ========================================== */
interface SkeletonProps {
  className?: string;
  variant?: "text" | "avatar" | "card";
}
 
export function Skeleton({ className, variant = "text" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-brand-surface border border-brand-border/60",
        variant === "text" && "h-4 rounded-lg w-full",
        variant === "avatar" && "h-12 w-12 rounded-2xl shrink-0",
        variant === "card" && "h-32 rounded-[28px] p-5 w-full",
        className
      )}
    />
  );
}
 
/* ==========================================
   8. POLISHED EMPTY STATE
   ========================================== */
interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onActionClick?: () => void;
}
 
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onActionClick
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 rounded-[28px] border border-dashed border-brand-accent/20 bg-brand-surface/40 cyber-glass">
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: [0.9, 1.03, 1] }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-secondary border border-brand-border text-3xl shadow-inner select-none animate-star-twinkle"
      >
        {icon}
      </motion.div>
      <h3 className="text-base font-black text-white/90 uppercase tracking-wider">{title}</h3>
      <p className="mt-2 text-xs text-brand-text-secondary max-w-sm mx-auto leading-relaxed font-semibold">
        {description}
      </p>
      {actionLabel && onActionClick && (
        <PremiumButton
          onClick={onActionClick}
          variant="accent"
          className="mt-6 py-3 px-6 rounded-xl text-[10px] font-black"
        >
          {actionLabel}
        </PremiumButton>
      )}
    </div>
  );
}
