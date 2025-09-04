import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BarnCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "coop" | "nest" | "golden";
  animated?: boolean;
  onClick?: () => void;
}

export const BarnCard = ({ 
  children, 
  className, 
  variant = "default",
  animated = false,
  onClick
}: BarnCardProps) => {
  const variants = {
    default: "bg-card border-border shadow-soft",
    coop: "bg-surface-elevated border-neon-purple/30 shadow-barn",
    nest: "bg-gradient-to-br from-neon-orange/10 to-neon-purple/5 border-neon-orange/30 shadow-soft",
    golden: "bg-gradient-to-br from-neon-orange to-neon-purple border-neon-orange shadow-barn text-foreground"
  };

  return (
    <Card className={cn(
      "transition-all duration-300 hover:shadow-xl border-2",
      variants[variant],
      animated && "hover:scale-105 hover:-translate-y-1",
      onClick && "cursor-pointer",
      className
    )}
    onClick={onClick}
    >
      <CardContent className="p-6">
        {children}
      </CardContent>
    </Card>
  );
};