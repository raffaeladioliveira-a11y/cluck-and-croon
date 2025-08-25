import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const chickenButtonVariants = cva(
  "relative overflow-hidden transition-all duration-300 hover:scale-105 active:animate-peck font-semibold text-lg",
  {
    variants: {
      variant: {
        barn: "bg-gradient-barn text-white shadow-barn hover:shadow-xl border-2 border-barn-brown/20",
        corn: "bg-primary text-primary-foreground shadow-soft hover:bg-corn-golden hover:shadow-barn",
        grass: "bg-gradient-grass text-white shadow-soft hover:shadow-barn border border-accent/30",
        egg: "bg-egg-shell text-foreground border-2 border-primary/20 hover:bg-primary hover:text-primary-foreground shadow-soft",
        feather: "bg-feather-white text-foreground border-2 border-muted hover:bg-muted hover:text-muted-foreground shadow-soft"
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-12 px-6 text-base", 
        lg: "h-14 px-8 text-lg",
        xl: "h-16 px-10 text-xl"
      },
      chickenStyle: {
        default: "",
        bounce: "hover:animate-egg-bounce",
        walk: "hover:animate-chicken-walk"
      }
    },
    defaultVariants: {
      variant: "corn",
      size: "md",
      chickenStyle: "default"
    }
  }
);

export interface ChickenButtonProps 
  extends Omit<ButtonProps, 'variant' | 'size'>, 
    VariantProps<typeof chickenButtonVariants> {
  emoji?: string;
}

export const ChickenButton = ({ 
  className, 
  variant = "corn", 
  size = "md", 
  chickenStyle = "default",
  emoji,
  children,
  ...props 
}: ChickenButtonProps) => {
  return (
    <Button 
      className={cn(chickenButtonVariants({ variant, size, chickenStyle }), className)}
      {...props}
    >
      {emoji && <span className="mr-2 text-xl">{emoji}</span>}
      {children}
      {/* Floating feathers effect on hover */}
      <div className="absolute inset-0 pointer-events-none">
        <span className="absolute top-1 right-2 text-xs opacity-0 group-hover:opacity-100 group-hover:animate-feather-float">🪶</span>
      </div>
    </Button>
  );
};