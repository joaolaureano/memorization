import { criarArmazemS3 } from "./armazem-s3.ts";
import type { ArmazemDeMidia } from "./armazem.ts";

/**
 * O armazém de Imagens da nuvem, pela configuração do ambiente (`026`,
 * research R10). `NOME_DO_BUCKET_DE_IMAGENS` não é segredo: as assinaturas
 * usam as credenciais da role. Sem ele, o tipo Imagem fica indisponível e o
 * restante da aplicação segue igual.
 */
export function armazemDaNuvem(
  env: NodeJS.ProcessEnv,
): ArmazemDeMidia | undefined {
  const bucket = env.NOME_DO_BUCKET_DE_IMAGENS?.trim();

  return bucket ? criarArmazemS3({ bucket }) : undefined;
}
