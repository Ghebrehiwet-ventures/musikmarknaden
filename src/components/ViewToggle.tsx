import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "grid" | "list";

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 border border-border rounded-lg p-1">
      <Button
        variant={viewMode === "grid" ? "default" : "ghost"}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onViewModeChange("grid")}
        aria-label="Rutnätsvy"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === "list" ? "default" : "ghost"}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onViewModeChange("list")}
        aria-label="Listvy"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
