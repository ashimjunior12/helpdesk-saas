import type { Role } from '@/lib/types';

const COLORS = ['#4f46e5', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#059669', '#2563eb', '#c026d3'];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ background: colorFor(name), width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const label = role === 'SUPER_ADMIN' ? 'Super admin' : role.charAt(0) + role.slice(1).toLowerCase();
  return <span className={`role-badge role-${role}`}>{label}</span>;
}
