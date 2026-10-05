import { useState } from "react";
import type { ReactNode, Ref } from "react";

/**
 * Campo de senha com o botão Mostrar/Ocultar (FR-142).
 *
 * É um componente controlado: o texto vem em `valor` e cada digitação sai por
 * `aoMudar`. A visibilidade é o único estado local, começa mascarada e nunca é
 * persistida — recarregar a tela volta a esconder a senha.
 *
 * O botão não move o foco nem o valor: alternar só troca `type` entre
 * "password" e "text", anuncia o estado em `aria-pressed` e nomeia a próxima
 * ação, de modo que o foco permaneça onde estava e o texto digitado siga o
 * mesmo.
 *
 * O texto visível é curto ("Mostrar"/"Ocultar") para não espremer o campo em
 * telas estreitas; o nome acessível, via `aria-label`, continua completo
 * ("Mostrar Senha"), com a palavra visível contida nele (WCAG 2.5.3).
 *
 * `descritoPor`, `invalido` e `obrigatorio` só aparecem no DOM quando
 * informados: um campo comum não carrega `aria-describedby`, `aria-invalid`
 * nem `required` vazios. A referência é encaminhada para o `<input>`, o alvo
 * que quem foca precisa alcançar.
 *
 * `children` entra no mesmo `.campo`, logo abaixo do campo: é onde ficam as
 * regras, o contador e os avisos, com o mesmo estilo dos demais campos.
 */
export function CampoDeSenha({
  id,
  rotulo,
  valor,
  aoMudar,
  autoComplete,
  descritoPor,
  invalido,
  referencia,
  obrigatorio,
  children,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  autoComplete: "current-password" | "new-password";
  descritoPor?: string;
  invalido?: boolean;
  referencia?: Ref<HTMLInputElement>;
  obrigatorio?: boolean;
  children?: ReactNode;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="campo">
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>

      <div className="campo-de-senha">
        <input
          ref={referencia}
          id={id}
          type={visivel ? "text" : "password"}
          value={valor}
          autoComplete={autoComplete}
          aria-describedby={descritoPor}
          aria-invalid={invalido ? true : undefined}
          required={obrigatorio}
          onChange={(evento) => aoMudar(evento.target.value)}
        />

        <button
          type="button"
          className="botao botao--secundario"
          aria-pressed={visivel}
          aria-controls={id}
          aria-label={`${visivel ? "Ocultar" : "Mostrar"} ${rotulo}`}
          onClick={() => setVisivel((atual) => !atual)}
        >
          {visivel ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      {children}
    </div>
  );
}
