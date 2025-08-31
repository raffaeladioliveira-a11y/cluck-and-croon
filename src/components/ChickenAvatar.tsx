import { cn } from "@/lib/utils";

interface ChickenAvatarProps {
  emoji: string;
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  sm: "w-8 h-8 text-2xl",
  md: "w-12 h-12 text-3xl",
  lg: "w-16 h-16 text-4xl",
  xl: "w-20 h-20 text-5xl"
};

export function ChickenAvatar({
    emoji,
    size = "md",
    animated = false,
    className,
    onClick
}: ChickenAvatarProps) {

  // Detecta se é uma URL de imagem ou emoji
  const isImageUrl = emoji?.startsWith("/") || emoji?.startsWith("http");

  if (isImageUrl) {
    // Renderiza como imagem
    return (
        <img
            src={emoji}
            alt="Avatar"
            className={cn(
          sizeClasses[size],
          "rounded-full object-cover cursor-pointer transition-all duration-200",
          animated && "hover:scale-105",
          className
        )}
            onClick={onClick}
        />
    );
  }

  // Renderiza como emoji (comportamento original)
  return (
      <div
          className={cn(
        sizeClasses[size],
        "rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center cursor-pointer transition-all duration-200 border-2 border-yellow-300 shadow-md",
        animated && "hover:scale-105 hover:rotate-6",
        className
      )}
          onClick={onClick}
      >
        <span className="select-none">{emoji}</span>
      </div>
  );
}