import React from 'react';
import type { EstadoGeneral } from '../../types';
import { ESTADO_COLORS, ESTADO_LABELS } from '../../utils/calculations';

interface StatusBadgeProps {
  status: string;
  color: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, color }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 600,
      lineHeight: '18px',
      color: color,
      backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
      whiteSpace: 'nowrap',
    }}
  >
    {status}
  </span>
);

interface EstadoGeneralBadgeProps {
  estado: EstadoGeneral;
}

export const EstadoGeneralBadge: React.FC<EstadoGeneralBadgeProps> = ({ estado }) => (
  <StatusBadge status={ESTADO_LABELS[estado]} color={ESTADO_COLORS[estado]} />
);

interface DocStatusBadgeProps {
  complete: boolean;
}

export const DocStatusBadge: React.FC<DocStatusBadgeProps> = ({ complete }) => (
  <StatusBadge
    status={complete ? 'COMPLETO' : 'PENDIENTE'}
    color={complete ? 'var(--success)' : 'var(--warning)'}
  />
);
