# Contrato: rotas da interface e moldura

As rotas são por hash e interpretadas por `interpretarRota(hash, temCredencial)`.
Segmentos vazios são ignorados (`#/baralhos/` = `#/baralhos`).

| Hash | `Rota.nome` | Tela | Credencial |
| --- | --- | --- | --- |
| `#/entrar` | `entrar` | Entrar | sem; com Credencial → `baralhos` |
| `#/criar-conta` | `cadastro` | Criar conta | sem ou com |
| `#/baralhos` (padrão) | `baralhos` | Lista de Baralhos | com |
| `#/baralhos/novo` | `novo-baralho` | Criar baralho | com |
| `#/baralhos/:id` | `baralho` | Detalhe do Baralho | com |
| `#/baralhos/:id/editar` | `editar-baralho` | Renomear Baralho | com |
| `#/baralhos/:id/adicionar` | `adicionar-cartoes` | Adicionar Cartões existentes | com |
| `#/baralhos/:id/estudo` | `estudo` | Configuração → Sessão → Resumo | com |
| `#/cartoes` | `cartoes` | Lista de Cartões | com |
| `#/cartoes/novo` | `novo-cartao` | Criar cartão | com |
| `#/cartoes/:id/editar` | `editar-cartao` | Editar Cartão | com |
| qualquer outro | `baralhos` | Lista de Baralhos | com |

Regras:
- Sem Credencial, toda rota resolve em `entrar`, exceto `cadastro` (FR-097, mantido).
- `novo` é palavra reservada: `#/baralhos/novo` nunca é tratado como Baralho de id "novo".
- Um id inexistente, excluído ou de outro Usuário mostra a mesma tela de "recurso não
  encontrado" com acesso de volta à lista (FR-156). Quem decide isso é a página, não o mapa.
- A troca de rota passa pela proteção de saída (research R4). Quando a troca se
  efetiva, o foco vai ao `h1` da tela de destino (comportamento atual).

## Moldura (com Credencial)

- O cabeçalho tem a marca "memorization", com link para `#/baralhos`, e o
  `<nav aria-label="Principal">` com Cartões e Baralhos e o botão Sair.
- O destino ativo usa `aria-current="page"` e também se distingue por forma
  (sublinhado ou barra), não só por cor.
- Em larguras ≤ 600 px, o mesmo `nav` é posicionado fixo na base. Marca e Sair
  ficam no cabeçalho.
- Sem Credencial (Entrar e Criar conta) não há moldura de navegação, só a marca.
