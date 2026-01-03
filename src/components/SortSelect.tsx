import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortOption = "relevance" | "newest" | "oldest" | "price-asc" | "price-desc" | "source";

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
      <SelectTrigger className="w-[160px] h-10 text-sm">
        <SelectValue placeholder="Sortera" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="relevance">Mest relevanta</SelectItem>
        <SelectItem value="newest">Senaste först</SelectItem>
        <SelectItem value="oldest">Äldsta först</SelectItem>
        <SelectItem value="price-asc">Pris lågt–högt</SelectItem>
        <SelectItem value="price-desc">Pris högt–lågt</SelectItem>
        <SelectItem value="source">Källa A–Ö</SelectItem>
      </SelectContent>
    </Select>
  );
}
