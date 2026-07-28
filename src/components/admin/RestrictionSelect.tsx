"use client";
import type { Restriction } from "@/lib/permissions/types";
import { Select } from "./primitives";
import { RESTRICTION_LABEL } from "./PermBadge";

const RESTRICTIONS: Restriction[] = ["none", "warning", "ban"];

export function RestrictionSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: Restriction;
  onChange: (restriction: Restriction) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      className={className}
      onChange={(e) => onChange(e.target.value as Restriction)}
    >
      {RESTRICTIONS.map((r) => (
        <option key={r} value={r}>
          {RESTRICTION_LABEL[r]}
        </option>
      ))}
    </Select>
  );
}
