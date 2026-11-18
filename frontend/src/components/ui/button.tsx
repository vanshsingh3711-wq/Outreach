import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 cursor-pointer active:scale-[0.99]";

    const variantStyles = {
      primary:
        "bg-primary text-primary-foreground hover:opacity-90 shadow-2xs",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-2xs",
      outline:
        "border border-border bg-background text-foreground hover:bg-muted/70 hover:text-foreground shadow-2xs",
      ghost:
        "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      destructive:
        "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-2xs",
      link:
        "text-primary underline-offset-4 hover:underline p-0 h-auto cursor-pointer",
    };

    const sizeStyles = {
      xs: "h-6 px-2 text-[11px] rounded-md gap-1",
      sm: "h-7.5 px-2.5 text-xs rounded-lg gap-1.5",
      md: "h-8.5 px-3.5 text-xs rounded-lg gap-2",
      lg: "h-10 px-4 text-sm rounded-lg gap-2",
      icon: "h-8.5 w-8.5 rounded-lg p-0",
      "icon-sm": "h-7 w-7 rounded-lg p-0",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
