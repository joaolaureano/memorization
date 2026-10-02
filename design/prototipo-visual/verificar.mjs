import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=new URL('./',import.meta.url), url=new URL('index.html',root).href;
const browser=await chromium.launch();
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const shot=async name=>page.screenshot({path:fileURLToPath(new URL('capturas/'+name+'.png',root)),fullPage:true});
await mkdir(new URL('capturas/',root),{recursive:true});
const gallery=async()=>{if(await page.locator('dialog').isVisible())await page.locator('#dialog-cancel').click();await page.getByRole('link',{name:'Galeria de revisão',exact:true}).last().click();if(await page.locator('dialog').isVisible())await page.locator('#dialog-confirm').click();await expect(page.locator('h1')).toHaveText('Galeria de telas e estados');};
const scenario=async name=>{await gallery();await page.getByRole('button',{name,exact:true}).click();};
try {
await page.goto(url);
await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page.locator('h1')).toHaveText('Baralhos');
await page.getByRole('link',{name:'Criar baralho',exact:true}).click();await page.locator('#deck-name').fill('Percurso completo');await page.getByRole('button',{name:'Criar baralho',exact:true}).click();await expect(page.locator('h1')).toHaveText('Percurso completo');await page.getByRole('link',{name:'Cartões',exact:true}).click();await page.getByRole('link',{name:'Criar cartão',exact:true}).click();await page.locator('#card-front').fill('Pergunta do percurso');await page.locator('#card-back').fill('Resposta do percurso');await page.getByRole('button',{name:'Criar cartão',exact:true}).click();await expect(page.locator('h1')).toHaveText('Cartões');await page.getByRole('link',{name:'Baralhos',exact:true}).click();await page.getByRole('link',{name:'Percurso completo',exact:true}).click();await page.getByRole('link',{name:'Adicionar cartões existentes',exact:true}).first().click();await page.locator('article').filter({hasText:'Pergunta do percurso'}).getByRole('button',{name:'Adicionar ao baralho'}).click();await expect(page.locator('article').filter({hasText:'Pergunta do percurso'})).toHaveCount(0);await page.getByRole('link',{name:'← Voltar ao baralho',exact:true}).click();await page.getByRole('link',{name:'Estudar',exact:true}).click();await page.getByRole('button',{name:'Começar estudo'}).click();await page.locator('#study-reveal').click();await expect(page.locator('.study-card')).toContainText('Resposta do percurso');await page.locator('#study-correct').click();await expect(page.locator('h1')).toHaveText('Sessão concluída');await expect(page.getByText('100%',{exact:true})).toBeVisible();
await scenario('Cadastro');await page.locator('[name=username]').fill('nova.pessoa');await page.locator('[name=password]').fill('senha12345');await page.locator('[name=confirmation]').fill('senha12345');await page.getByRole('button',{name:'Criar conta',exact:true}).click();await expect(page.locator('h1')).toHaveText('Conta criada');await page.getByRole('link',{name:'Ir para entrar'}).click();await page.locator('[name=username]').fill('nova.pessoa');await page.locator('[name=password]').fill('senha12345');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page.getByText('Seu primeiro baralho começa aqui')).toBeVisible();
await scenario('Falha ao salvar cartão');await page.locator('#card-front').fill('Texto preservado após falha');await page.getByRole('button',{name:'Salvar alterações'}).click();await expect(page.locator('#feedback')).toContainText('Não foi possível concluir');await expect(page.locator('#card-front')).toHaveValue('Texto preservado após falha');await page.getByRole('button',{name:'Salvar alterações'}).click();await expect(page.locator('h1')).toHaveText('Cartões');await expect(page.getByRole('heading',{name:'Texto preservado após falha'})).toBeVisible();
await scenario('Operação pendente');await page.getByRole('button',{name:'Salvar alterações'}).click();await expect(page.getByRole('button',{name:'Aguarde…'})).toBeDisabled();await expect(page.locator('h1')).toHaveText('Cartões');
await scenario('Configurar quantidade');await page.locator('#study-quantity').fill('99');await expect(page.locator('#quantity-notice')).toContainText('2');await page.getByRole('button',{name:'Começar estudo'}).click();await expect(page.locator('#study-reveal')).toBeVisible();await page.getByRole('link',{name:'Interromper estudo',exact:true}).click();await expect(page.locator('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('link',{name:'Interromper estudo',exact:true})).toBeFocused();for(let i=0;i<2;i++){await page.locator('#study-reveal').click();await page.locator(i===0?'#study-correct':'[data-answer=wrong]').click();await expect(page.locator(i===0?'#study-reveal':'h1')).toBeVisible();}await expect(page.locator('h1')).toHaveText('Sessão concluída');await expect(page.getByText('50%',{exact:true})).toBeVisible();
await scenario('Confirmação de descarte');await expect(page.locator('#dialog-cancel')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#dialog-confirm')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#dialog-cancel')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#card-front')).toBeVisible();await page.getByRole('link',{name:'Cancelar',exact:true}).click();await page.locator('#dialog-confirm').click();await expect(page.locator('h1')).toHaveText('Cartões');
const samples={'Entrada':'entrar','Baralhos':'baralhos','Detalhe do baralho':'baralho','Cartões':'cartoes','Novo cartão':'novo-cartao','Frente · resposta oculta':'estudo','Resposta revelada':'resposta','Resumo da sessão':'resumo','Explorações futuras':'exploracoes'};
let checks=0;
for(const width of [360,390,768,1440]){
 await page.setViewportSize({width,height:900});await gallery();const count=await page.locator('[data-case]').count();
 for(let i=0;i<count;i++){
  await gallery();const trigger=page.locator('[data-case]').nth(i);const name=await trigger.textContent();await trigger.click();
  await expect(page.locator('h1')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw Error(`Rolagem horizontal: ${width} / ${name}`);
  if([390,1440].includes(width)&&samples[name])await shot(`${samples[name]}-${width}`);
  if(await page.locator('dialog').isVisible())await page.locator('#dialog-cancel').click();checks++;
 }
}
await page.setViewportSize({width:1440,height:1000});
for(const name of ['Entrada','Baralhos','Novo cartão','Resposta revelada','Conteúdo longo e acervo extenso']){await scenario(name);await page.evaluate(()=>document.documentElement.style.zoom='2');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow zoom 200% '+name);}
await page.evaluate(()=>document.documentElement.style.zoom='1');await scenario('Resposta revelada');await shot('resposta-desktop');
await page.getByRole('button',{name:'Sair',exact:true}).click();await page.locator('#dialog-confirm').click();await expect(page.locator('h1')).toHaveText('Entre para continuar');await page.goBack();await expect(page.locator('h1')).toHaveText('Entre para continuar');
expect(errors).toEqual([]);
const result=`Validação Chromium: ${checks} combinações cenário/largura; 5 telas com CSS zoom 200%; acesso, cadastro, isolamento, falha/retry, pending, estudo, diálogo, teclado e saída verificados. Nenhum erro JavaScript. Capturas em 390 e 1440 px.\n`;
await writeFile(new URL('VALIDACAO.txt',root),result);console.log(result);
}finally{await browser.close();}
