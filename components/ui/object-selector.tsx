import { useMemo } from "react";

import { Select } from "@/components/ui/select";

export type ObjectSelectorItem = {
  value: number;
  name: string;
  icon?: string;
  qty?: number;
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
}: ObjectSelectorProps) {
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