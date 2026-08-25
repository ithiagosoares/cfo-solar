import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist resolve seu worker (pdf.worker.mjs) via import() dinâmico relativo
  // ao próprio pacote em tempo de execução. Se o Next empacotar o pacote (Turbopack
  // ou webpack), esse import relativo aponta pra dentro do bundle em vez do arquivo
  // real em node_modules, e o worker nunca é encontrado. serverExternalPackages
  // mantém o pacote fora do bundle do servidor, resolvido via Node normalmente.
  serverExternalPackages: ['pdfjs-dist'],
};

export default nextConfig;
