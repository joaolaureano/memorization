import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// Servidor mínimo que entrega e2e/fixtures em loopback. Existe apenas para
// que o teste de T003 navegue a uma página local real, sem tocar backend/ ou
// frontend/.
const PORTA = Number(process.env.E2E_PORTA ?? 4173);
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const servidor = createServer(async (requisicao, resposta) => {
  const caminho = new URL(requisicao.url ?? '/', 'http://127.0.0.1').pathname;
  const alvo = caminho === '/' ? '/index.html' : caminho;
  const relativo = normalize(alvo).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');

  try {
    const conteudo = await readFile(join(RAIZ, relativo));
    resposta.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    resposta.end(conteudo);
  } catch {
    resposta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    resposta.end('não encontrado');
  }
});

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`servidor e2e escutando em http://127.0.0.1:${PORTA}`);
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => servidor.close(() => process.exit(0)));
}
