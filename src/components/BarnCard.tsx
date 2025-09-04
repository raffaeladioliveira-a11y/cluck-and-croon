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
    default: "bg-glass backdrop-blur-md border-glass-border/30 shadow-soft",
    coop: "bg-glass backdrop-blur-md border-neon-purple/30 shadow-barn",
    nest: "bg-glass backdrop-blur-md border-neon-orange/40 shadow-soft",
    golden: "bg-gradient-to-br from-neon-orange/20 to-neon-yellow/20 backdrop-blur-md border-neon-orange/50 shadow-barn text-foreground"
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