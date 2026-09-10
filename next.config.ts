import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist resolve seu worker (pdf.worker.mjs) via import() dinâmico relativo
  // ao próprio pacote em tempo de execução. Se o Next empacotar o pacote (Turbopack
  // ou webpack), esse import relativo aponta pra dentro do bundle em vez do arquivo
  // real em node_modules, e o worker nunca é encontrado. serverExternalPackages
  // mantém o pacote fora do bundle do servidor, resolvido via Node normalmente.
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas'],
  // pdfjs-dist carrega @napi-rs/canvas (polyfill de DOMMatrix/Path2D em Node) via
  // require() dinâmico (createRequire), padrão que o file-tracing da Vercel não
  // detecta sozinho — sem isso o binário nativo fica de fora da function e dá
  // "Cannot find module '@napi-rs/canvas'" só em produção (funciona local por já
  // estar em node_modules sem passar por trace).
  // pdfjs-dist também resolve o worker (pdf.worker.mjs) e as fontes padrão
  // (standard_fonts/) via caminho relativo ao próprio pacote em tempo de execução
  // — mesmo problema de file-tracing do @napi-rs/canvas acima, então inclui o
  // pacote inteiro em vez de tentar adivinhar quais arquivos internos ele usa.
  outputFileTracingIncludes: {
    '/api/comercial-pedidos/**': [
      './node_modules/@napi-rs/canvas*/**/*',
      './node_modules/pdfjs-dist/**/*',
    ],
  },
};

export default nextConfig;
