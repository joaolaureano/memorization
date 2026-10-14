import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch();
const falhas = [];
const erros = [];
let aprovados = 0;

try {
  const url = new URL('./index.html', import.meta.url).href;
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => erros.push(error.message));

  const demo = page.locator('#tocador-demo');
  const demoTocar = demo.getByRole('button', { name: 'Tocar áudio', exact: true });
  const demoPausar = demo.getByRole('button', { name: 'Pausar áudio', exact: true });
  const face = page.locator('#face');

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

  await verificar('Seletor de tipo com 3 opções e Frente-Verso selecionado', async () => {
    await page.goto(url);
    await expect(page.locator('#tipo option')).toHaveCount(3);
    await expect(page.getByLabel('Tipo de cartão')).toHaveValue('frente-verso');
    await expect(page.locator('#tipo option:checked')).toHaveText('Frente-Verso');
  });

  await verificar('Trocar para Áudio anuncia "Campos do tipo Áudio" na região ao vivo', async () => {
    await page.goto(url);
    await expect(page.locator('#anuncio')).toHaveAttribute('aria-live', 'polite');
    await page.getByLabel('Tipo de cartão').selectOption('audio');
    await expect(page.locator('#anuncio')).toHaveText('Campos do tipo Áudio');
    await expect(page.getByLabel('Mensagem (opcional)')).toBeVisible();
    await expect(page.getByLabel('Frente', { exact: true })).toBeHidden();
  });

  await verificar('Tocador: nome do botão alterna com o clique', async () => {
    await page.goto(url);
    await demoTocar.click();
    await expect(demoPausar).toBeVisible();
    await demoPausar.click();
    await expect(demoTocar).toBeVisible();
  });

  await verificar('Tocador: nome do botão alterna com Enter e Espaço', async () => {
    await page.goto(url);
    await demoTocar.focus();
    await page.keyboard.press('Enter');
    await expect(demoPausar).toBeVisible();
    await page.keyboard.press(' ');
    await expect(demoTocar).toBeVisible();
  });

  await verificar('Tocador: seta direita avança 5 s e End vai ao fim', async () => {
    await page.goto(url);
    const posicao = demo.locator('input[type=range]');
    await posicao.focus();
    await page.keyboard.press('ArrowRight');
    await expect(posicao).toHaveAttribute('aria-valuetext', '5 segundos de 1 minuto e 4 segundos');
    await expect(demo.locator('.ca-tempo')).toHaveText('0:05 / 1:04');
    await page.keyboard.press('End');
    await expect(posicao).toHaveAttribute('aria-valuetext', '1 minuto e 4 segundos de 1 minuto e 4 segundos');
    await page.keyboard.press('Home');
    await expect(posicao).toHaveAttribute('aria-valuetext', '0 segundo de 1 minuto e 4 segundos');
  });

  await verificar('Sessão de estudo: o tocador continua após Revelar e sai com Próximo', async () => {
    await page.goto(url);
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await face.getByRole('button', { name: 'Tocar áudio', exact: true }).click();
    await expect(face.getByRole('button', { name: 'Pausar áudio', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Revelar', exact: true }).click();
    await expect(face).toContainText('Violoncelo.');
    await expect(face.getByRole('button', { name: 'Pausar áudio', exact: true })).toBeVisible();
    const tocando = await face.locator('audio').evaluate(audio => !audio.paused);
    if (!tocando) throw new Error('o áudio parou ao revelar o verso');
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await expect(face.locator('audio')).toHaveCount(0);
    await expect(face).not.toContainText('Violoncelo.');
  });

  await verificar('Idioma EN troca o botão para "Play audio"', async () => {
    await page.goto(url);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(demo.getByRole('button', { name: 'Play audio', exact: true })).toBeVisible();
    await expect(page.locator('#tipo option:checked')).toHaveText('Front-Back');
  });

  for (const largura of [360, 390, 768, 1440]) {
    await verificar(`Sem rolagem horizontal com Áudio em ${largura} px`, async () => {
      await page.setViewportSize({ width: largura, height: 1000 });
      await page.goto(url);
      await page.getByLabel('Tipo de cartão').selectOption('audio');
      const { largura: total, visivel } = await medirRolagem();
      if (total > visivel) throw new Error(`scrollWidth ${total} > clientWidth ${visivel}`);
    });
  }

  await verificar('Sem rolagem horizontal com Áudio em 640 px e zoom equivalente a 200% (320 px)', async () => {
    await page.setViewportSize({ width: 640, height: 1000 });
    await page.goto(url);
    await page.getByLabel('Tipo de cartão').selectOption('audio');
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    const { largura: total, visivel } = await medirRolagem();
    if (total > visivel) throw new Error(`scrollWidth ${total} > clientWidth ${visivel}`);
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
console.log('Protótipo Cartão com Áudio validado: seletor de tipo e anúncio, tocador por clique e teclado, posição com setas e End, estudo com Revelar e Próximo, idioma EN e larguras 360, 390, 768, 1440 px com zoom de 200%.');
