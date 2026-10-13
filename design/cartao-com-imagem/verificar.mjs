import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = new URL('./index.html', import.meta.url).href;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG6sAAAAASUVORK5CYII=', 'base64');

  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(url);
    await expect(page.getByLabel('Tipo de cartão')).toHaveValue('frente-verso');
    await expect(page.getByLabel('Frente', { exact: true })).toBeVisible();
    await page.getByLabel('Tipo de cartão').selectOption('imagem');
    await expect(page.locator('#anuncio')).toHaveText('Campos do tipo Imagem');
    await expect(page.getByLabel('Texto da frente (opcional)')).toBeVisible();
    await expect(page.getByLabel('Frente', { exact: true })).toBeHidden();
    await page.locator('#arquivo').setInputFiles({ name: 'mapa.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('#previa')).toBeVisible();
    await page.getByRole('button', { name: 'Remover imagem' }).click();
    await expect(page.locator('#previa')).toBeHidden();
    await page.locator('#arquivo').setInputFiles({ name: 'mapa.png', mimeType: 'image/png', buffer: png });
    await page.getByLabel('Texto da frente (opcional)').fill('Mapa do bioma');
    await page.getByLabel('Descrição da imagem (opcional)').fill('Mapa colorido');
    await page.getByLabel('Verso').fill('O bioma ocupa a região central.');
    await page.getByRole('button', { name: 'Salvar cartão' }).click();
    const imagemCard = page.locator('.ci-cartao').filter({ hasText: 'Mapa do bioma' });
    await expect(imagemCard.locator('.ci-etiqueta')).toHaveText('Imagem');
    await expect(imagemCard.locator('img')).toHaveAttribute('alt', 'Mapa colorido');
    await page.getByRole('button', { name: 'Estudar exemplo' }).click();
    await expect(page.locator('#face img')).toBeVisible();
    await page.getByRole('button', { name: 'Revelar verso' }).click();
    await expect(page.locator('#face')).toHaveText('O bioma ocupa a região central.');
    await page.evaluate(() => document.body.style.zoom = '200%');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow at ${width}px`);
  }

  await page.goto(url);
  await page.getByLabel('Tipo de cartão').selectOption('imagem');
  await page.locator('#arquivo').setInputFiles({ name: 'not-image.txt', mimeType: 'text/plain', buffer: Buffer.from('plain text') });
  await expect(page.locator('#erro-arquivo')).toContainText('Formato não aceito');
  await page.locator('#arquivo').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.locator('#erro-arquivo')).toContainText('até 5 MB');
  await page.locator('#arquivo').setInputFiles([]);
  await page.getByLabel('Verso').fill('Resposta de teste');
  await page.getByRole('button', { name: 'Salvar cartão' }).click();
  await expect(page.locator('#erro-arquivo')).toContainText('Escolha uma imagem');
  await expect(page.locator('.ci-cartao')).toHaveCount(1);

  await page.goto(url);
  await page.getByLabel('Tipo de cartão').selectOption('imagem');
  await page.locator('#arquivo').setInputFiles({ name: 'mapa.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Verso').fill('Resposta preservada');
  await page.getByRole('button', { name: 'Salvar cartão' }).click();
  await page.getByRole('button', { name: 'Estudar exemplo' }).click();
  await page.locator('#face img').evaluate(img => { img.src = '/imagem-ausente.png'; });
  await expect(page.locator('#face')).toContainText('Imagem indisponível');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Protótipo Cartão com Imagem validado em 360, 390, 768 e 1440 px, com zoom 200%: tipo padrão, anúncio de campos, prévia e remoção, recusa de formato e tamanho, cartão com rótulo e miniatura, estudo e revelação.');
} finally {
  await browser.close();
}
