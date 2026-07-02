// Paleta editorial centralizada — única fonte de cores/tipografia do app,
// espelhando as mesmas variáveis CSS definidas em globals.css e em
// src/styles/editorial.module.css. Usar isso (não hex literal) em qualquer
// lugar que não possa consumir var() diretamente — principalmente props de
// cor do recharts (fill/stroke), que esperam string, não CSS custom property
// resolvida via classe.
export const CORES = {
  bg: '#ffffff',
  paper: '#fafaf8',
  ink: '#1a1a1a',
  ink2: '#5c5c54',
  ink3: '#8a8a80',
  line: '#e5e5e0',
  line2: '#d8d8d2',
  // Identidade visual — usados em abas ativas, botões primários e gráficos
  marca: '#1e0e62',    // azul-roxo da marca
  destaque: '#f78b26', // laranja de destaque
  // Paleta semântica — mesmas cores usadas nos pontos de status da tela
  // Comercial (pendente/faturado/em produção/fornecedor), reaproveitada como
  // o vocabulário de cor do app inteiro em vez de uma paleta saturada nova
  // por componente.
  pendente: '#b8860b',
  positivo: '#3f7d4f',
  info: '#3a5a8c',
  fornecedor: '#6b4a86',
  critico: '#9a2d22',
  baixo: '#8a6a1f',
} as const

export const FONTE_SERIF = "Georgia, 'Times New Roman', serif"
export const FONTE_SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
