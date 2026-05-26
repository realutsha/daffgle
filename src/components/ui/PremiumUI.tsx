"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Spring Physics Preset
export const premiumSpring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 30,
  mass: 0.8
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
      whileHover={hoverable && isClickable ? { y: -3, scale: 1.008 } : undefined}
      whileTap={isClickable ? { scale: 0.985 } : undefined}
      transition={premiumSpring}
      onClick={onClick}
      style={style}
      className={cn(
        "rounded-3xl border p-5 shadow-xl transition-colors duration-200",
        "bg-brand-surface border-brand-border/80 text-brand-text-primary",
        activeBorder && "border-brand-accent/30 shadow-[0_0_15px_rgba(201,215,242,0.08)]",
        isClickable && "cursor-pointer hover:bg-brand-elevated/70",
        className
      )}
    >
      {children}
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
}

export function PremiumButton({
  children,
  variant = "primary",
  isLoading = false,
  className,
  disabled,
  onClick,
  type = "button"
}: PremiumButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={!disabled && !isLoading ? { scale: 1.015, y: -0.5 } : undefined}
      whileTap={!disabled && !isLoading ? { scale: 0.975 } : undefined}
      transition={premiumSpring}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold tracking-wide transition duration-200 select-none cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
        
        // Variant: Primary (Elegant accent outline/glow)
        variant === "primary" && "bg-brand-accent text-brand-primary shadow-lg shadow-brand-accent/15 hover:bg-brand-accent/95",
        
        // Variant: Secondary (Sophisticated surface border)
        variant === "secondary" && "bg-brand-elevated/40 border border-brand-border hover:bg-brand-elevated/80 text-brand-text-primary",
        
        // Variant: Danger (Subtle high-end crimson)
        variant === "danger" && "bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400",
        
        // Variant: Ghost (Low profile inline highlight)
        variant === "ghost" && "bg-transparent text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface/40",
        
        // Variant: Accent (Glow border with dark backdrop)
        variant === "accent" && "bg-brand-surface border border-brand-accent/20 hover:border-brand-accent/50 text-[#C9D7F2] shadow-inner",
        
        className
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-current" />
          <span className="opacity-80">Syncing...</span>
        </>
      ) : (
        children
      )}
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
      <div className={cn("space-y-1.5 flex flex-col", containerClassName)}>
        {label && (
          <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest ml-1 select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-4 text-brand-text-secondary pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              "w-full rounded-2xl border bg-brand-secondary px-4 py-3.5 text-sm text-brand-text-primary outline-none transition duration-200 placeholder:text-brand-text-secondary/40",
              "border-brand-border focus:border-brand-accent/35 focus:ring-1 focus:ring-brand-accent/15",
              leftIcon && "pl-11",
              rightIcon && "pr-11",
              error && "border-red-500/40 focus:border-red-500/60 focus:ring-red-500/10",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 text-brand-text-secondary flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-400 font-medium ml-1.5 animate-shake">
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
    <div className={cn("space-y-1.5 flex flex-col relative", containerClassName)} ref={dropdownRef}>
      {label && (
        <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest ml-1 select-none">
          {label}
        </label>
      )}
      
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border bg-brand-secondary px-4 py-3.5 text-sm text-brand-text-primary outline-none transition duration-200 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          "border-brand-border focus:border-brand-accent/35",
          isOpen && "border-brand-accent/40 ring-1 ring-brand-accent/15",
          error && "border-red-500/40 focus:border-red-500/60"
        )}
      >
        <span className={cn(!selectedOption && "text-brand-text-secondary/40")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-brand-text-secondary transition duration-200", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 right-0 z-50 mt-16 max-h-60 overflow-y-auto rounded-2xl border border-brand-border bg-brand-elevated/95 p-1.5 shadow-2xl backdrop-blur-md no-scrollbar"
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
                      "flex w-full items-center rounded-xl px-3.5 py-2.5 text-left text-xs font-medium transition cursor-pointer select-none",
                      isSelected
                        ? "bg-brand-accent text-brand-primary"
                        : "text-brand-text-secondary hover:bg-brand-surface/70 hover:text-brand-text-primary"
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
        <p className="text-xs text-red-400 font-medium ml-1.5 animate-shake">
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
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm cursor-pointer"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 10 }}
            transition={premiumSpring}
            className="w-full max-w-md overflow-hidden rounded-[28px] border border-brand-border bg-brand-secondary p-6 shadow-2xl z-10 space-y-5"
          >
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white">{title}</h3>
              {description && (
                <p className="text-xs text-brand-text-secondary mt-1 leading-normal">
                  {description}
                </p>
              )}
            </div>

            <div className="space-y-4">
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
    <nav className="fixed bottom-4 left-4 right-4 z-40 flex justify-center pb-safe md:hidden pointer-events-none">
      <div className="mx-auto flex w-full max-w-md items-center justify-around rounded-full border border-brand-border bg-brand-surface/85 px-2.5 py-2 shadow-2xl backdrop-blur-lg pointer-events-auto">
        {items.map(({ label, icon, onClick, isActive, badge }) => {
          return (
            <button
              key={label}
              onClick={onClick}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-full text-brand-text-secondary transition duration-200 select-none cursor-pointer focus:outline-none outline-none",
                isActive ? "text-brand-accent bg-brand-accent/10 font-bold" : "hover:bg-brand-secondary/40"
              )}
            >
              {/* Badge indicator */}
              {badge !== undefined && badge > 0 && (
                <span className="absolute top-1 right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white leading-none shadow-sm animate-pulse">
                  {badge}
                </span>
              )}

              <span className={cn("text-lg transition duration-200", isActive && "scale-110")}>
                {icon}
              </span>
              <span className="text-[8px] font-bold tracking-wide uppercase">{label}</span>

              {/* Elegant Accent Dot */}
              {isActive && (
                <motion.span
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 h-1 w-3 rounded-full bg-brand-accent"
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
        "animate-pulse bg-brand-elevated/40 border border-brand-border/40",
        variant === "text" && "h-4 rounded-md w-full",
        variant === "avatar" && "h-12 w-12 rounded-2xl shrink-0",
        variant === "card" && "h-32 rounded-3xl p-5 w-full",
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
    <div className="flex flex-col items-center justify-center text-center p-8 rounded-3xl border border-dashed border-brand-border/60 bg-brand-surface/30">
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: [0.9, 1.02, 1] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-elevated/55 border border-brand-border text-3xl shadow-inner select-none"
      >
        {icon}
      </motion.div>
      <h3 className="text-base font-bold text-white/90">{title}</h3>
      <p className="mt-1.5 text-xs text-brand-text-secondary max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      {actionLabel && onActionClick && (
        <PremiumButton
          onClick={onActionClick}
          variant="accent"
          className="mt-4 py-2 px-4 rounded-xl text-xs"
        >
          {actionLabel}
        </PremiumButton>
      )}
    </div>
  );
}
