import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type ObjectSelectorItem = {
  value: number;
  name: string;
  icon?: string;
  qty?: number;
  searchText?: string;
  fueComerciado?: boolean;
  publicadoEnTrade?: boolean;
};

type ObjectSelectorFilters = {
  excludeTraded?: boolean;
  excludePublished?: boolean;
};

type ObjectSelectorProps = {
  items: ObjectSelectorItem[];
  value: number | null;
  onChange: (value: number | null) => void;
  filters?: ObjectSelectorFilters;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
  placeholder?: string;
  showQuantity?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  noSearchResultsLabel?: string;
};

export function ObjectSelector({
  items,
  value,
  onChange,
  filters,
  disabled,
  className,
  emptyLabel = "Sin objetos disponibles",
  placeholder,
  showQuantity = false,
  searchable = false,
  searchPlaceholder = "Buscar objeto...",
  noSearchResultsLabel = "No se encontraron objetos",
}: ObjectSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters?.excludeTraded && item.fueComerciado) {
        return false;
      }
      if (filters?.excludePublished && item.publicadoEnTrade) {
        return false;
      }
      return true;
    });
  }, [items, filters?.excludePublished, filters?.excludeTraded]);

  const handleChange = (rawValue: string) => {
    if (!rawValue) {
      onChange(null);
      return;
    }
    onChange(Number(rawValue));
  };

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.value === value) ?? null,
    [filteredItems, value],
  );

  const visibleItems = useMemo(() => {
    if (!searchable) {
      return filteredItems;
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return filteredItems;
    }

    return filteredItems.filter((item) => {
      const haystack = `${item.name} ${item.searchText ?? ""}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [filteredItems, searchable, searchTerm]);

  if (searchable) {
    return (
      <div className="relative">
        {selectedItem ? (
          <div className="flex items-center justify-between bg-black/20 border border-gold/50 rounded-lg px-3 py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              {selectedItem.icon ? <span>{selectedItem.icon}</span> : null}
              <span className="font-medium text-foreground truncate">{selectedItem.name}</span>
              {showQuantity && typeof selectedItem.qty === "number" ? (
                <span className="text-muted-foreground text-xs shrink-0">x{selectedItem.qty}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setSearchTerm("");
                setShowDropdown(true);
              }}
              className="text-muted-foreground hover:text-destructive"
              disabled={disabled}
              aria-label="Limpiar selección"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <Input
              type="text"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setShowDropdown(true);
              }}
              placeholder={searchPlaceholder}
              className={className}
              disabled={disabled || filteredItems.length === 0}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            />

            {showDropdown ? (
              <div className="absolute z-50 top-full mt-1 left-0 w-full bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</div>
                ) : visibleItems.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">{noSearchResultsLabel}</div>
                ) : (
                  visibleItems.map((item) => {
                    const quantitySuffix =
                      showQuantity && typeof item.qty === "number" ? ` x${item.qty}` : "";
                    const iconPrefix = item.icon ? `${item.icon} ` : "";

                    return (
                      <button
                        key={item.value}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-secondary cursor-pointer"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onChange(item.value);
                          setShowDropdown(false);
                        }}
                      >
                        {iconPrefix}
                        {item.name}
                        {quantitySuffix}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <Select
      value={value?.toString() ?? ""}
      onChange={(event) => handleChange(event.target.value)}
      disabled={disabled || filteredItems.length === 0}
      className={className}
    >
      {filteredItems.length === 0 ? (
        <option value="">{emptyLabel}</option>
      ) : (
        <>
          {placeholder ? <option value="">{placeholder}</option> : null}
          {filteredItems.map((item) => {
            const quantitySuffix =
              showQuantity && typeof item.qty === "number" ? ` x${item.qty}` : "";
            const iconPrefix = item.icon ? `${item.icon} ` : "";

            return (
              <option key={item.value} value={item.value}>
                {iconPrefix}
                {item.name}
                {quantitySuffix}
              </option>
            );
          })}
        </>
      )}
    </Select>
  );
}