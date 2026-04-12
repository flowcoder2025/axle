"use client";

const ROLES = [
  { value: "LEAD", label: "리더" },
  { value: "MEMBER", label: "멤버" },
  { value: "VIEWER", label: "뷰어" },
] as const;

interface MemberRoleSelectProps {
  value: string;
  onChange: (role: string) => void;
  disabled?: boolean;
}

export function MemberRoleSelect({ value, onChange, disabled }: MemberRoleSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
    >
      {ROLES.map((role) => (
        <option key={role.value} value={role.value}>
          {role.label}
        </option>
      ))}
    </select>
  );
}
