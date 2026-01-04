import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SourceFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
  sources: string[];
  sourceCounts?: Record<string, number>;
  totalCount?: number;
}

export function SourceFilter({ value, onChange, sources, sourceCounts, totalCount }: SourceFilterProps) {
  return (
    <Select 
      value={value || "all"} 
      onValueChange={(v) => onChange(v === "all" ? null : v)}
    >
      <SelectTrigger className="w-[140px] sm:w-[180px] h-9 sm:h-10 text-xs sm:text-sm">
        <SelectValue placeholder="Alla källor" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          Alla källor{totalCount !== undefined && ` (${totalCount})`}
        </SelectItem>
        {sources.map((source) => (
          <SelectItem key={source} value={source}>
            {source}{sourceCounts?.[source] !== undefined && ` (${sourceCounts[source]})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
