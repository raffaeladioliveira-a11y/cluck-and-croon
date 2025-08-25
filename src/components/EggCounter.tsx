import { cn } from "@/lib/utils";

interface EggCounterProps {
  count: number;
  label?: string;
  variant?: "default" | "golden" | "bonus";
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
}

export const EggCounter = ({ 
  count, 
  label = "Ovos", 
  variant = "default", 
  size = "md",
  animated = true,
  className 
}: EggCounterProps) => {
  const variants = {
    default: "bg-primary/10 text-primary border-primary/20",
    golden: "bg-gradient-sunrise text-white border-corn-golden shadow-barn",
    bonus: "bg-accent/20 text-accent border-accent/30"
  };

  const sizes = {
    sm: "px-2 py-1 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg"
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-2 rounded-full border-2 font-semibold transition-all duration-300",
      variants[variant],
      sizes[size],
      animated && "hover:scale-105",
      className
    )}>
      <span className={cn(animated && "animate-egg-bounce")}>🥚</span>
      <span className="font-bold">{count.toLocaleString()}</span>
      <span className="font-medium opacity-80">{label}</span>
    </div>
  );
};