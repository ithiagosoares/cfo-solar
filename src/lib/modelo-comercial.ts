import fs from 'fs'
import path from 'path'

// Server-only — reads the static markdown doc once at module load and caches it
// as a string. Never import this from a 'use client' component.
const caminhoArquivo = path.join(process.cwd(), 'src/lib/modelo-comercial.md')

export const MODELO_COMERCIAL = fs.readFileSync(caminhoArquivo, 'utf-8')
