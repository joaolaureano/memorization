// Placeholder ate backend/src/lambda.ts existir (aws_pendencias.md, item 3).
// Cumpre o contrato minimo da infra: confere o segredo de origem que so o
// CloudFront injeta, responde /health e devolve 503 para o resto - a API real
// ainda nao foi publicada.
import { timingSafeEqual } from "node:crypto";

// O SDK v3 ja vem no runtime nodejs24.x; a stub nao precisa de node_modules.
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});

// Uma leitura por container. Se falhar, a promise sai do cache: sem isso um
// cold start que falha envenena o container e toda invocacao herda o erro.
let segredo = null;

const lerSegredo = () => {
  if (!segredo) {
    segredo = ssm
      .send(
        new GetParameterCommand({
          Name: `${process.env.SSM_PREFIX}/ORIGIN_SECRET`,
          WithDecryption: true,
        }),
      )
      .then(({ Parameter }) => {
        if (!Parameter?.Value) throw new Error("ORIGIN_SECRET vazio ou ilegivel");
        return Parameter.Value;
      })
      .catch((erro) => {
        segredo = null;
        throw erro;
      });
  }
  return segredo;
};

const json = (statusCode, corpo) => ({
  statusCode,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(corpo),
});

const veioDoCloudFront = (recebido, esperado) => {
  const a = Buffer.from(recebido ?? "");
  const b = Buffer.from(esperado);
  // tamanho antes de conteudo: timingSafeEqual lanca com buffers desiguais
  return a.length === b.length && timingSafeEqual(a, b);
};

export const handler = async (event) => {
  const esperado = await lerSegredo();

  if (!veioDoCloudFront(event.headers?.["x-origin-secret"], esperado)) {
    return json(403, { sucesso: false, mensagem: "Proibido" });
  }

  if (event.rawPath === "/health") {
    return json(200, { status: "ok" });
  }

  return json(503, { mensagem: "API ainda nao publicada" });
};
