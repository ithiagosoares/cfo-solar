// Paleta editorial centralizada — espelha os tokens de globals.css (:root).
// Usar aqui (não hex literal) em qualquer lugar que não possa consumir var()
// diretamente — principalmente props de cor do Recharts (fill/stroke).
export const CORES = {
  bg:         '#EFEDE8',
  paper:      '#F7F6F3',
  ink:        '#1C1C1A',
  ink2:       '#5C5752',
  ink3:       '#8A857C',
  line:       '#E4E0D8',
  line2:      '#DCD8D0',
  marca:      '#C78A2E',
  destaque:   '#C78A2E',
  pendente:   '#A07830',
  positivo:   '#3E6B63',
  info:       '#3A6080',
  fornecedor: '#5A4070',
  critico:    '#A8452F',
  baixo:      '#8A6A1F',
} as const

export const FONTE_SERIF = "'EB Garamond', Georgia, 'Times New Roman', serif"
export const FONTE_SANS  = "'IBM Plex Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif"
export const FONTE_MONO  = "'IBM Plex Mono', monospace"
