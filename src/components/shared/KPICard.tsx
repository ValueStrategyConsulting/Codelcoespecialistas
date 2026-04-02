import React from 'react';

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  onClick?: () => void;
  active?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  subtitle,
  color = 'var(--primary)',
  onClick,
  active = false,
}) => (
  <div
    onClick={onClick}
    style={{
      position: 'relative',
      backgroundColor: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
      border: active ? `1.5px solid ${color}` : '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px 20px 20px 24px',
      overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.15s',
      boxShadow: active ? `0 0 12px ${color}22` : 'none',
    }}
  >
    {/* Left accent bar */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: active ? '5px' : '4px',
        backgroundColor: color,
        borderRadius: '12px 0 0 12px',
      }}
    />

    <div style={{ fontSize: '28px', fontWeight: 700, color: active ? color : 'var(--text)', lineHeight: 1.2 }}>
      {value}
    </div>
    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '4px' }}>
      {label}
    </div>
    {subtitle && (
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
        {subtitle}
      </div>
    )}
  </div>
);
