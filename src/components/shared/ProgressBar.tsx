import React from 'react';

interface ProgressBarProps {
  value: number;
  size?: 'sm' | 'md';
}

function getBarColor(value: number): string {
  if (value >= 80) return 'var(--success)';
  if (value >= 50) return 'var(--primary)';
  if (value >= 30) return 'var(--warning)';
  return 'var(--danger)';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value, size = 'sm' }) => {
  const clamped = Math.max(0, Math.min(100, value));
  const height = size === 'sm' ? 4 : 6;
  const color = getBarColor(clamped);

  return (
    <div className="flex items-center" style={{ gap: '8px' }}>
      <div
        style={{
          flex: 1,
          height,
          borderRadius: height / 2,
          backgroundColor: 'var(--bg-base)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            borderRadius: height / 2,
            backgroundColor: color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: color,
          minWidth: '32px',
          textAlign: 'right',
        }}
      >
        {clamped}%
      </span>
    </div>
  );
};
