import React from 'react';
import type { PageId } from '../../types';
import { useStore } from '../../store/useStore';

interface NavItem {
  id: PageId;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'procesos', icon: '\u{1F4CB}', label: 'Procesos' },
  { id: 'evaluaciones', icon: '\u{1F4DD}', label: 'Evaluaciones' },
  { id: 'insights', icon: '\u{1F4A1}', label: 'Insights de Procesos' },
  { id: 'encuestas', icon: '\u{1F4E8}', label: 'Encuestas' },
  { id: 'dashboard', icon: '\u{1F4CA}', label: 'Dashboard' },
];

export const Sidebar: React.FC = () => {
  const activePage = useStore((s) => s.activePage);
  const setActivePage = useStore((s) => s.setActivePage);

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '240px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        zIndex: 50,
      }}
      className="flex flex-col"
    >
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px' }}>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--primary)',
            letterSpacing: '-0.02em',
          }}
        >
          ATS Codelco
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '2px',
          }}
        >
          Transearch
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1" style={{ padding: '8px 12px', overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 12px',
                marginBottom: '2px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                backgroundColor: isActive
                  ? 'color-mix(in srgb, var(--primary) 12%, transparent)'
                  : 'transparent',
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor =
                    'color-mix(in srgb, var(--primary) 6%, transparent)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User profile */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
        }}
        className="flex items-center"
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: 'var(--text)',
            fontSize: '13px',
            fontWeight: 600,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '10px',
          }}
        >
          EC
        </div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
            Especialista Codelco
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Supervisión de Procesos
          </div>
        </div>
      </div>
    </aside>
  );
};
