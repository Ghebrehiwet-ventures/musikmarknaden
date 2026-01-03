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
}

export function SourceFilter({ value, onChange, sources }: SourceFilterProps) {
  return (
    <Select 
      value={value || "all"} 
      onValueChange={(v) => onChange(v === "all" ? null : v)}
    >
      <SelectTrigger className="w-[160px] h-10 text-sm">
        <SelectValue placeholder="Alla källor" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Alla källor</SelectItem>
        {sources.map((source) => (
          <SelectItem key={source} value={source}>
            {source}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
