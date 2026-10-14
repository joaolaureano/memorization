/**
 * Duração de um Áudio no Idioma da interface (028, FR-441, FR-458, research R7).
 *
 * O texto visível usa `m:ss`; a frase falada usa unidades e lista do locale.
 * `Intl.DurationFormat` não entra por suporte incompleto nos navegadores-alvo.
 */

/** Os segundos inteiros e a sua divisão em minutos e segundos. */
function partesDaDuracao(ms: number): { minutos: number; segundos: number } {
  const totalDeSegundos = Math.floor(ms / 1000);

  return {
    minutos: Math.floor(totalDeSegundos / 60),
    segundos: totalDeSegundos % 60,
  };
}

/** Formata `m:ss`, com os algarismos do locale. */
export function formatarDuracao(ms: number, locale: string): string {
  const { minutos, segundos } = partesDaDuracao(ms);
  const numero = new Intl.NumberFormat(locale, { useGrouping: false });
  const dosSegundos = new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumIntegerDigits: 2,
  });

  return `${numero.format(minutos)}:${dosSegundos.format(segundos)}`;
}

/** Fala a duração por extenso, como "1 minuto e 4 segundos". */
export function duracaoFalada(ms: number, locale: string): string {
  const { minutos, segundos } = partesDaDuracao(ms);
  const partes: string[] = [];

  if (minutos > 0) {
    partes.push(
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit: "minute",
        unitDisplay: "long",
      }).format(minutos),
    );
  }

  // Sem minutos, os segundos sempre entram (0 ms vira "0 segundos");
  // com minutos, os segundos só entram quando não são zero.
  if (minutos === 0 || segundos > 0) {
    partes.push(
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit: "second",
        unitDisplay: "long",
      }).format(segundos),
    );
  }

  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(partes);
}
