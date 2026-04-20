import { Input } from "@/components/ui/input";

type GoldAmountInputProps = {
  value: string | number;
  onChangeValue: (value: string) => void;
  min?: number;
  allowZero?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  emptyWhenZero?: boolean;
};

export function GoldAmountInput({
  value,
  onChangeValue,
  min = 1,
  allowZero = false,
  required,
  disabled,
  className,
  placeholder,
  emptyWhenZero = false,
}: GoldAmountInputProps) {
  const minValue = allowZero ? Math.max(0, min) : Math.max(1, min);

  const resolvedValue =
    typeof value === "number"
      ? emptyWhenZero && value === 0
        ? ""
        : String(value)
      : value;

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={minValue}
      value={resolvedValue}
      className={className}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (nextValue === "" || /^\d+$/.test(nextValue)) {
          onChangeValue(nextValue);
        }
      }}
    />
  );
}