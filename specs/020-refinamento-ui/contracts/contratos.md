# Contratos — 020
- Remover PUT /conta/nome-de-usuario do registro local e Lambda, schema e handler exclusivos; chamada autenticada retorna 404 pelo roteador.
- Remover OPTIONS exclusivo desse caminho; não anunciar autorização CORS específica para rota inexistente.
- Remover alterarNomeDeUsuario das Interfaces ClienteDoAcervo e Identidade e operação correspondente da Interface Armazenamento/Adapters.
- Preservar GET /conta, PUT /conta/senha, DELETE /conta, cadastro, Entrar e Acesso. Resultados incertos ficam limitados às operações restantes.
- Preservar #/preferencias com rótulo e h1 Perfil.
- Mensagens literais e medidas: FR-327–FR-335. Checkboxes 19/37 px dentro de alvos >=44 px, radios 44 px; Mostrar/Ocultar 7 rem; separação de seções 32 px.
- Início: cabeçalho, Revisão, Agenda em coluna. Contagem de revisão usa total, não vencidos. Dia vazio tem uma mensagem.
- Agenda preserva fuso nos pedidos, sem exibi-lo na UI.
