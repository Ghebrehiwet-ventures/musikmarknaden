import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortOption = "newest" | "price-asc" | "price-desc";

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
      <SelectTrigger className="w-[140px] h-8 text-sm">
        <SelectValue placeholder="Sortera" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">Nyast</SelectItem>
        <SelectItem value="price-asc">Pris (lägst)</SelectItem>
        <SelectItem value="price-desc">Pris (högst)</SelectItem>
      </SelectContent>
    </Select>
  );
}
