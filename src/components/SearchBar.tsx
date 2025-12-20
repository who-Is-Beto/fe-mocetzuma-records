import type { FormEvent } from "react";
import { Button } from "./Button";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

export function SearchBar({ value, onChange, onSubmit, placeholder = "Buscar vinilo...", className = "", autoFocus = false }: SearchBarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(value);
  };

  return (
    <form
      role="search"
      className={`flex items-center gap-3 rounded-xl border border-navy/10 bg-cream px-3 py-2 shadow-sm backdrop-blur focus-within:border-orange ${className}`}
      onSubmit={handleSubmit}
    >
      <span className="text-lg">🔎</span>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm text-navy placeholder:text-navy/50 focus:outline-none"
        placeholder={placeholder}
      />
      <Button type="submit" tone="navy" className="px-3 py-1 text-xs">
        Buscar
      </Button>
    </form>
  );
}

export default SearchBar;
