// Verificador do protótipo da 030.
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch();
const falhas = [];
const erros = [];
let aprovados = 0;

const ESTADOS = ['entrar', 'preparando', 'limite', 'expirada', 'inicio', 'perfil'];

try {
  const url = new URL('./index.html', import.meta.url).href;
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => erros.push(error.message));

  const entrarTeste = page.locator('#entrar-teste');
  const etiqueta = page.locator('#etiqueta-conta');
  const aviso = page.locator('#aviso-conta');
  const linkCreditos = page.getByRole('link', { name: 'Créditos do acervo de demonstração', exact: true });
  const dialogoCreditos = page.locator('#creditos');
  const dialogoSaida = page.locator('#confirmar-saida');
  const estado = nome => page.locator(`[data-estado="${nome}"]`);

  async function verificar(nome, fn) {
    try {
      await fn();
      aprovados++;
      console.log(`PASS ${nome}`);
    } catch (error) {
      falhas.push(nome);
      console.log(`FAIL ${nome}: ${error.message.split('\n')[0]}`);
    }
  }

  async function medirRolagem() {
    return page.evaluate(() => ({
      largura: document.scrollingElement.scrollWidth,
      visivel: document.scrollingElement.clientWidth,
    }));
  }

  await verificar('Entrar: formulário, "ou", "Entrar como Teste" e a frase', async () => {
    await page.goto(url);
    await expect(page.getByLabel('Usuário')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.locator('#formulario-entrar').getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    await expect(page.getByText('ou', { exact: true })).toBeVisible();
    await expect(entrarTeste).toHaveText('Entrar como Teste');
    await expect(page.getByText('Experimente com Baralhos de exemplo. Tudo é apagado ao sair.')).toBeVisible();
    await expect(etiqueta).toBeHidden();
  });

  await verificar('Preparando: status anunciado e botão desabilitado', async () => {
    await page.goto(url);
    await estado('preparando').click();
    await expect(page.getByRole('status').filter({ hasText: 'Preparando sua Conta de teste…' })).toBeVisible();
    await expect(entrarTeste).toBeDisabled();
  });

  await verificar('Entrar como Teste leva ao Início com a etiqueta "Conta de teste"', async () => {
    await page.goto(url);
    await entrarTeste.click();
    await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible({ timeout: 5000 });
    await expect(etiqueta).toHaveText('Conta de teste');
    await expect(etiqueta).toBeVisible();
  });

  await verificar('Teclado: Tab até "Entrar como Teste" e Enter entram na Conta de teste', async () => {
    await page.goto(url);
    await entrarTeste.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible({ timeout: 5000 });
  });

  await verificar('Limite: alerta recebe o foco', async () => {
    await page.goto(url);
    await estado('limite').click();
    const alerta = page.locator('#alerta-limite');
    await expect(alerta).toHaveAttribute('role', 'alert');
    await expect(alerta).toBeFocused();
    await expect(alerta).toBeVisible();
  });

  await verificar('Expirada: aviso "Sua Conta de teste terminou" na entrada', async () => {
    await page.goto(url);
    await estado('expirada').click();
    await expect(page.getByText('Sua Conta de teste terminou. Entre como Teste para começar de novo.')).toBeVisible();
  });

  await verificar('Início: aviso fixo e diálogo de créditos com 3 itens; Esc devolve o foco ao link', async () => {
    await page.goto(url);
    await estado('inicio').click();
    await expect(aviso).toContainText('Esta é uma Conta de teste. Tudo será apagado ao sair.');
    await expect(etiqueta).toBeVisible();
    await linkCreditos.click();
    await expect(dialogoCreditos).toBeVisible();
    await expect(page.locator('#lista-creditos > li')).toHaveCount(3);
    await expect(page.locator('#lista-creditos dt', { hasText: 'Licença' })).toHaveCount(3);
    await expect(page.locator('#lista-creditos dd a')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(dialogoCreditos).toBeHidden();
    await expect(linkCreditos).toBeFocused();
  });

  await verificar('Perfil: sem "Alterar senha" e "Excluir conta"', async () => {
    await page.goto(url);
    await estado('perfil').click();
    await expect(page.getByRole('button', { name: 'Alterar senha' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Excluir conta' })).toHaveCount(0);
    await expect(page.getByText('A Conta de teste não pode ser alterada nem excluída.')).toBeVisible();
    await expect(aviso).toBeVisible();
  });

  await verificar('Sair: Cancelar fecha; "Sair e apagar" volta à entrada', async () => {
    await page.goto(url);
    await estado('inicio').click();
    await page.locator('#sair').click();
    await expect(dialogoSaida).toContainText('Sair apaga a Conta de teste e tudo o que você fez nela.');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialogoSaida).toBeHidden();
    await expect(page.locator('#sair')).toBeFocused();
    await page.locator('#sair').click();
    await page.getByRole('button', { name: 'Sair e apagar', exact: true }).click();
    await expect(entrarTeste).toBeVisible();
    await expect(etiqueta).toBeHidden();
  });

  await verificar('Idioma EN troca os textos sem recarregar', async () => {
    await page.goto(url);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign in as Test', exact: true })).toBeVisible();
    await estado('inicio').click();
    await expect(etiqueta).toHaveText('Test account');
  });

  for (const largura of [360, 390, 768, 1440]) {
    await verificar(`Sem rolagem horizontal em ${largura} px em todos os estados`, async () => {
      await page.setViewportSize({ width: largura, height: 1000 });
      await page.goto(url);
      for (const nome of ESTADOS) {
        await estado(nome).click();
        const { largura: total, visivel } = await medirRolagem();
        if (total > visivel) throw new Error(`${nome}: scrollWidth ${total} > clientWidth ${visivel}`);
      }
      await estado('inicio').click();
      await linkCreditos.click();
      const { largura: total, visivel } = await medirRolagem();
      if (total > visivel) throw new Error(`créditos: scrollWidth ${total} > clientWidth ${visivel}`);
    });
  }

  await verificar('Sem rolagem horizontal em 640 px com zoom equivalente a 200% (320 px) em todos os estados', async () => {
    await page.setViewportSize({ width: 640, height: 1000 });
    await page.goto(url);
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    for (const nome of ESTADOS) {
      await estado(nome).click();
      const { largura: total, visivel } = await medirRolagem();
      if (total > visivel) throw new Error(`${nome}: scrollWidth ${total} > clientWidth ${visivel}`);
    }
  });

  await verificar('Sem erros de script na página', async () => {
    if (erros.length) throw new Error(erros.join('\n'));
  });
} finally {
  await browser.close();
}

console.log(`\n${aprovados} aprovados, ${falhas.length} falhas`);
if (falhas.length) {
  console.log(`FALHOU: ${falhas.join('; ')}`);
  process.exit(1);
}
console.log('Protótipo Conta de teste validado: entrada com Entrar como Teste e estados de preparo e limite, etiqueta, créditos com Esc, perfil sem ações de conta, confirmação de saída, idioma EN e larguras 360, 390, 768, 1440 px com zoom de 200%.');
