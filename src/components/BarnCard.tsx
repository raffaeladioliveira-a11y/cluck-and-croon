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
    coop: "bg-gradient-to-br from-barn-brown/10 to-barn-brown/5 border-barn-brown/20 shadow-barn",
    nest: "bg-gradient-to-br from-primary/10 to-corn-golden/5 border-primary/20 shadow-soft",
    golden: "bg-gradient-sunrise border-corn-golden shadow-barn text-white"
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