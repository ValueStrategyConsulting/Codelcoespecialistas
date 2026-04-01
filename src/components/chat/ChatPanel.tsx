import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { processQuery, type ChatMessage } from '../../utils/chatEngine';
import { ChatResults } from './ChatResults';

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hola, soy el asistente ATS Codelco. Puedes consultarme por:\n\n' +
    '- **ID de proceso**: ej. `84200`\n' +
    '- **Nombre de candidato**: ej. `Cerda Berrios`\n' +
    '- **RUT**: ej. `11.527.928-9`\n\n' +
    'Te entregaré un resumen estructurado con estado, progreso y alertas.',
  timestamp: new Date(),
};

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const procesos = useStore(s => s.procesos);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  function handleSend() {
    const q = input.trim();
    if (!q) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: q, timestamp: new Date() }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const { text, data } = processQuery(q, procesos);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text, data, timestamp: new Date() }]);
      setTyping(false);
    }, 400);
  }

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 24, width: 440,
      maxWidth: 'calc(100vw - 48px)', height: 600, maxHeight: 'calc(100vh - 120px)',
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 12, display: 'flex', flexDirection: 'column',
      zIndex: 1000, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      animation: 'chatSlideUp 0.25s ease-out',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--primary)', color: '#fff' }}>C</div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Consulta ATS</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Busca por proceso, candidato o RUT</div>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>&times;</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map(msg => (
          <div key={msg.id} className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div style={{
              maxWidth: '92%', padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-elevated)',
              color: msg.role === 'user' ? '#fff' : 'var(--text)', fontSize: '0.85rem', lineHeight: 1.5,
            }}>
              <MessageText text={msg.text} />
              {msg.data && <ChatResults data={msg.data} />}
            </div>
          </div>
        ))}
        {typing && (
          <div className="mb-3 flex justify-start">
            <div className="flex gap-1 items-center px-4 py-3" style={{ background: 'var(--bg-elevated)', borderRadius: '12px 12px 12px 2px' }}>
              {[0, 0.15, 0.3].map(d => <span key={d} className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--primary)', animationDelay: `${d}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex gap-2">
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ej: 84200, Cerda Berrios, 11.527.928-9" className="flex-1"
            style={{ borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem' }} />
          <button onClick={handleSend} className="px-4 py-2 font-medium"
            style={{ background: 'var(--primary)', color: '#fff', borderRadius: 8, opacity: input.trim() ? 1 : 0.5 }}>
            Enviar
          </button>
        </div>
        <div className="mt-2 flex gap-1 flex-wrap">
          {['84200', '83992', 'Cerda', '11.527.928-9'].map(hint => (
            <button key={hint} onClick={() => { setInput(hint); inputRef.current?.focus(); }}
              className="px-2 py-1 text-xs rounded-md"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {hint}
            </button>
          ))}
        </div>
      </div>
      <style>{`@keyframes chatSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}

function MessageText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part === '\n') return <br key={i} />;
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: 'rgba(59,130,246,0.15)', padding: '1px 5px', borderRadius: 3, fontSize: '0.8rem' }}>{part.slice(1, -1)}</code>;
        if (part.startsWith('- ')) return <span key={i}>&bull; {part.slice(2)}</span>;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
