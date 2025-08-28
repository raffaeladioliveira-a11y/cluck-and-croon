import { Link } from "react-router-dom";
import { UserMenu } from "@/components/UserMenu";

export function AppHeader() {
  return (
    <header className="w-full sticky top-0 z-20 bg-background/70 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg">🐔® Cocoli️</Link>
        <UserMenu />
      </div>
    </header>
  );
}