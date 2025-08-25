import { cn } from "@/lib/utils";

interface ChickenAvatarProps {
  emoji: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  className?: string;
  onClick?: () => void;
}

export const ChickenAvatar = ({ 
  emoji, 
  name, 
  size = "md", 
  animated = false,
  className,
  onClick
}: ChickenAvatarProps) => {
  const sizes = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-lg", 
    lg: "w-16 h-16 text-2xl",
    xl: "w-20 h-20 text-3xl"
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className={cn(
        "rounded-full bg-gradient-to-br from-egg-shell to-primary/10 border-2 border-primary/20 flex items-center justify-center shadow-soft",
        sizes[size],
        animated && "hover:animate-egg-bounce cursor-pointer transition-transform hover:scale-110",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
      >
        <span className={cn(animated && "hover:animate-chicken-walk")}>
          {emoji}
        </span>
      </div>
      {name && (
        <span className="text-xs font-medium text-muted-foreground text-center max-w-16 truncate">
          {name}
        </span>
      )}
    </div>
  );
};