import React from "react";

type Props = {
  ariaLabel: string;
  value: number;
  onQuantityChange: (quantity: number) => void;
};

export function QuantityInput({ ariaLabel, value, onQuantityChange }: Props) {
  const [draftValue, setDraftValue] = React.useState(String(value));

  React.useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const commit = () => {
    const quantity = Number(draftValue);
    if (!draftValue || !Number.isFinite(quantity) || quantity <= 0) {
      onQuantityChange(0);
      return;
    }
    onQuantityChange(Math.floor(quantity));
  };

  return (
    <input
      aria-label={ariaLabel}
      className="w-16 rounded-lg border px-2 py-1"
      type="number"
      min="0"
      value={draftValue}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraftValue(nextValue);
        const quantity = Number(nextValue);
        if (nextValue && Number.isFinite(quantity) && quantity > 0) onQuantityChange(Math.floor(quantity));
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
