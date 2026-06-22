'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, User, MessageCircle, AlertTriangle } from 'lucide-react'
import type { MensagemChat, RelatorioCompleto } from '@/types/financeiro'

const SUGESTOES = [
  'Por que a margem caiu?',
  'Qual empresa está performando melhor?',
  'Como reduzir a dependência do FGI?',
]

interface ChatPanelProps {
  relatorio: RelatorioCompleto | null
  mensagens: MensagemChat[]
  onMensagensChange: (mensagens: MensagemChat[]) => void
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ background: '#64748b', animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

function Avatar({ tipo }: { tipo: 'user' | 'assistant' }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      style={{
        background: tipo === 'user' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.12)',
      }}
    >
      {tipo === 'user'
        ? <User className="h-4 w-4" style={{ color: '#3b82f6' }} />
        : <Sparkles className="h-4 w-4" style={{ color: '#22c55e' }} />
      }
    </div>
  )
}

export function ChatPanel({ relatorio, mensagens, onMensagensChange }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensagens])

  async function enviarPergunta(texto: string) {
    const pergunta = texto.trim()
    if (!pergunta || enviando || !relatorio) return

    const historico: MensagemChat[] = [...mensagens, { role: 'user', content: pergunta }]
    onMensagensChange([...historico, { role: 'assistant', content: '' }])
    setInput('')
    setEnviando(true)
    setErro(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: historico, relatorio }),
      })

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Erro ao consultar o assistente')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        onMensagensChange([...historico, { role: 'assistant', content: acumulado }])
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar o assistente.')
      onMensagensChange(historico)
    } finally {
      setEnviando(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    enviarPergunta(input)
  }

  if (!relatorio) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fadeIn">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'rgba(59,130,246,0.1)' }}
        >
          <MessageCircle className="h-7 w-7" style={{ color: '#3b82f6' }} />
        </div>
        <div className="text-center max-w-sm">
          <p className="font-semibold" style={{ color: '#e2e8f0' }}>Nenhuma planilha carregada</p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: '#64748b' }}>
            Carregue um arquivo Excel e gere a análise antes de conversar com o assistente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col rounded-xl border animate-fadeIn"
      style={{ background: '#1a1d27', borderColor: '#2d3148', height: 'calc(100vh - 220px)', minHeight: 420 }}
    >
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        {mensagens.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(34,197,94,0.1)' }}>
              <Sparkles className="h-6 w-6" style={{ color: '#22c55e' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#e2e8f0' }}>Pergunte sobre os dados do período</p>
              <p className="mt-1 text-sm" style={{ color: '#64748b' }}>{relatorio.periodo}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {SUGESTOES.map(sugestao => (
                <button
                  key={sugestao}
                  onClick={() => enviarPergunta(sugestao)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ borderColor: '#2d3148', color: '#94a3b8' }}
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        ) : (
          mensagens.map((msg, i) => {
            const isUltimaAssistantVazia = enviando && i === mensagens.length - 1 && msg.role === 'assistant' && msg.content === ''
            return (
              <div
                key={i}
                className="flex gap-3"
                style={{ flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}
              >
                <Avatar tipo={msg.role} />
                <div
                  className="max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: msg.role === 'user' ? '#3b82f6' : '#161925',
                    color: msg.role === 'user' ? '#fff' : '#cbd5e1',
                    border: msg.role === 'assistant' ? '1px solid #2d3148' : 'none',
                  }}
                >
                  {isUltimaAssistantVazia ? <TypingIndicator /> : msg.content}
                </div>
              </div>
            )
          })
        )}

        {erro && (
          <div
            className="flex items-start gap-2.5 rounded-lg border-l-4 px-4 py-3 text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', borderLeftColor: '#ef4444', border: '1px solid rgba(127,29,29,0.4)', borderLeftWidth: 4 }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#ef4444' }} />
            <span style={{ color: '#fca5a5' }}>{erro}</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t px-4 py-3"
        style={{ borderColor: '#2d3148' }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pergunte algo sobre os dados financeiros…"
          disabled={enviando}
          className="flex-1 rounded-lg border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-colors disabled:opacity-60"
          style={{ borderColor: '#2d3148', color: '#e2e8f0' }}
        />
        <button
          type="submit"
          disabled={enviando || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all disabled:opacity-40"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
