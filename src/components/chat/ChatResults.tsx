import type { ChatResultData, CandidatoResumen, ProcesoGroupResumen } from '../../utils/chatEngine';

export function ChatResults({ data }: { data: ChatResultData }) {
  if (data.type === 'proceso' && data.procesos) {
    return <div className="mt-3 flex flex-col gap-2">{data.procesos.map(g => <GroupCard key={g.id} g={g} />)}</div>;
  }
  if ((data.type === 'candidato' || data.type === 'multi') && data.candidatos) {
    return <div className="mt-3 flex flex-col gap-2">{data.candidatos.map((c, i) => <CandCard key={i} c={c} />)}</div>;
  }
  return null;
}

function GroupCard({ g }: { g: ProcesoGroupResumen }) {
  return (
    <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 12 }}>#{g.id}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{g.division}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{g.cargo}</div>
      <MiniBar value={g.avgProgreso} />
      <div className="grid grid-cols-4 gap-1 text-center mt-2">
        <Num label="Total" value={g.total} color="var(--text)" />
        <Num label="Cerrados" value={g.cerrados} color="var(--success)" />
        <Num label="Riesgo" value={g.enRiesgo} color="var(--danger)" />
        <Num label="Avance" value={`${g.avgProgreso}%`} color="var(--primary)" />
      </div>
      {g.candidatos.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Candidatos</div>
          {g.candidatos.map((c, i) => (
            <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: '1px solid rgba(31,41,55,0.5)', fontSize: 11 }}>
              <span style={{ color: 'var(--text)' }}>{c.nombre}</span>
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--text-muted)' }}>{c.estado_general}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{c.progreso}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CandCard({ c }: { c: CandidatoResumen }) {
  return (
    <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      <div className="flex justify-between items-start mb-1">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.nombre}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.rut}</div>
        </div>
        <Pill text={c.estado_general} />
      </div>
      <MiniBar value={c.progreso} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2" style={{ fontSize: 11 }}>
        <Row label="Cargo" value={c.cargo} />
        <Row label="División" value={c.division || '—'} />
        <Row label="Categoría" value={c.categoria || '—'} />
        <Row label="Documentos" value={c.estado_documental} />
        <Row label="Evaluación" value={c.estado_evaluacion} />
        <Row label="Entrevista" value={c.estado_entrevista} />
        <Row label="Cierre" value={c.estado_cierre} />
        <Row label="Días s/mov." value={String(c.dias_sin_movimiento)} />
      </div>
      {c.observacion && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}><strong>Obs:</strong> {c.observacion.slice(0, 100)}</div>}
    </div>
  );
}

function MiniBar({ value }: { value: number }) {
  const color = value >= 80 ? 'var(--success)' : value >= 50 ? 'var(--primary)' : value >= 30 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="flex items-center gap-2">
      <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{value}%</span>
    </div>
  );
}

function Num({ label, value, color }: { label: string; value: string | number; color: string }) {
  return <div><div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>{label}</span><span style={{ color: 'var(--text)', fontWeight: 500 }}>{value}</span></div>;
}

function Pill({ text }: { text: string }) {
  const isRisk = text.includes('Riesgo');
  const isClosed = text.includes('Cerrado');
  const bg = isRisk ? 'rgba(239,68,68,0.15)' : isClosed ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)';
  const color = isRisk ? 'var(--danger)' : isClosed ? 'var(--success)' : 'var(--primary)';
  return <span style={{ background: bg, color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{text}</span>;
}
