'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, AlertTriangle, MessageSquare } from 'lucide-react'
import type { MensagemChat, RelatorioCompleto } from '@/types/financeiro'
import styles from '@/styles/editorial.module.css'

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

function sanitizarMensagens(input: MensagemChat[]): MensagemChat[] {
  return input.filter(m => m.content.trim() !== '')
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

    const historico: MensagemChat[] = [...sanitizarMensagens(mensagens), { role: 'user', content: pergunta }]
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
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center animate-fadeIn">
        <MessageSquare className="h-7 w-7" style={{ color: 'var(--ink3)' }} />
        <div>
          <p style={{ fontWeight: 600 }}>Nenhuma planilha carregada</p>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--ink2)' }}>
            Carregue um arquivo Excel e gere a análise antes de conversar com o assistente.
          </p>
        </div>
      </div>
    )
  }

  const mensagensFiltradas = sanitizarMensagens(mensagens)
  const todaVazia = mensagens.length > 0 && mensagens.every(m => m.content === '')
  const vazio = mensagensFiltradas.length === 0 && !todaVazia

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 210px)', minHeight: 440 }}>

      {/* Cabeçalho */}
      <div className={styles.shead} style={{ paddingBottom: 16, flexShrink: 0, borderBottom: '1px solid var(--line)' }}>
        <div className={`${styles.stitle} ${styles.serif}`}>Assistente</div>
        <div className={styles.over}>{relatorio.periodo}</div>
      </div>

      {/* Área de mensagens */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}
      >
        {vazio ? (
          <div style={{ paddingTop: 32 }}>
            <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>
              Pergunte qualquer coisa sobre os dados de {relatorio.periodo}.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUGESTOES.map(sugestao => (
                <button
                  key={sugestao}
                  onClick={() => enviarPergunta(sugestao)}
                  className={styles.btn}
                  style={{ fontSize: 12.5 }}
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {mensagens.map((msg, i) => {
              const isUltimaAssistantVazia = enviando && i === mensagens.length - 1 && msg.role === 'assistant' && msg.content === ''
              const isUser = msg.role === 'user'
              return (
                <div
                  key={i}
                  className={`${styles.chatMsg} ${isUser ? styles.chatMsgUser : styles.chatMsgAssistant}`}
                >
                  <p className={styles.chatRole} style={{ color: isUser ? 'var(--marca)' : 'var(--ink3)' }}>
                    {isUser ? 'Você' : 'Assistente'}
                  </p>
                  {isUltimaAssistantVazia ? (
                    <span style={{ color: 'var(--ink3)', fontStyle: 'italic' }}>Digitando…</span>
                  ) : (
                    <span className={isUser ? styles.chatUser : styles.chatAssistant}>
                      {msg.content}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {erro && (
          <div className={`${styles.notice} ${styles.alertaDanger}`} style={{ marginTop: 8 }}>
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{erro}</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingTop: 14,
          borderTop: '1px solid var(--line)',
          flexShrink: 0,
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pergunte algo sobre os dados financeiros…"
          disabled={enviando}
          className={`${styles.input} flex-1`}
          style={{ flex: 1, borderBottom: '1px solid var(--line2)', paddingLeft: 0 }}
        />
        <button
          type="submit"
          disabled={enviando || !input.trim()}
          className={styles.btnPrimary}
          style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  )
}
