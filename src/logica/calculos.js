// Cálculos de notas de NotaClara. Funciones puras: no usan la base de datos ni la interfaz.
//
// Para no depender de decimales flotantes se trabaja SIEMPRE con enteros:
//   - una nota se guarda en décimas:          4,5  -> 45
//   - un porcentaje es un entero:             30 % -> 30
//   - nota × porcentaje queda en milésimas:   45 × 30 = 1350 -> 1,350
// Si los porcentajes suman 100, la suma de los aportes es el promedio ponderado exacto en milésimas.

const NOTA_MINIMA = 10; // 1,0
const NOTA_MAXIMA = 70; // 7,0

// Umbrales internos en milésimas. Nunca se muestran en la interfaz.
const APROBAR = 3945; // con el redondeo chileno equivale a un 4,0 final
const EXIMIRSE = 4945; // equivale a un 5,0 final (solo lectivas)

// Peso de la presentación y del examen en la nota final de una lectiva
const PESO_PRESENTACION = 75;
const PESO_EXAMEN = 25;

const MENSAJE_RANGO = "Nota inválida. Ingrese una nota entre 1,0 y 7,0.";
const MENSAJE_DECIMALES = "Nota inválida. Ingrese un número con UN solo decimal.";
const MENSAJE_PORCENTAJES = "Los porcentajes deben sumar 100%.";

// ---------- Notas escritas por el usuario ----------

/**
 * Valida lo que el usuario escribe en una casilla de nota. Acepta coma o punto.
 * Devuelve { valida, valor, mensaje, incompleta }:
 *   - valor: la nota en décimas, o null si la casilla quedó vacía (evaluación pendiente).
 *   - incompleta: true si el usuario todavía está escribiendo (ej: "4,"), para no mostrar el error aún.
 */
function validarNota(texto) {
  const limpio = String(texto ?? "").trim();
  if (limpio === "") {
    return { valida: true, valor: null, mensaje: "", incompleta: false };
  }
  if (/^\d+[.,]$/.test(limpio)) {
    return { valida: false, valor: null, mensaje: MENSAJE_RANGO, incompleta: true };
  }
  if (/^\d+[.,]\d{2,}$/.test(limpio)) {
    return { valida: false, valor: null, mensaje: MENSAJE_DECIMALES, incompleta: false };
  }
  const partes = /^(\d+)(?:[.,](\d))?$/.exec(limpio);
  if (!partes) {
    return { valida: false, valor: null, mensaje: MENSAJE_RANGO, incompleta: false };
  }
  const valor = Number(partes[1]) * 10 + Number(partes[2] ?? 0);
  if (valor < NOTA_MINIMA || valor > NOTA_MAXIMA) {
    return { valida: false, valor: null, mensaje: MENSAJE_RANGO, incompleta: false };
  }
  return { valida: true, valor, mensaje: "", incompleta: false };
}

/** Valida un porcentaje escrito por el usuario: número entero de 0 a 100. */
function validarPorcentaje(texto) {
  const limpio = String(texto ?? "").trim().replace(/%$/, "").trim();
  if (!/^\d{1,3}$/.test(limpio) || Number(limpio) > 100) {
    return { valido: false, valor: null, mensaje: "El porcentaje debe ser un número entero entre 0 y 100." };
  }
  return { valido: true, valor: Number(limpio), mensaje: "" };
}

/** Décimas -> texto con coma y un decimal. Ej: 45 -> "4,5". null -> "". */
function formatearNota(decimas) {
  if (decimas === null || decimas === undefined) return "";
  return `${Math.floor(decimas / 10)},${decimas % 10}`;
}

// ---------- Redondeo ----------

/**
 * Redondeo chileno de un valor en milésimas expresado como fracción (numerador / denominador).
 * Primero a 2 decimales (mitad hacia arriba) y luego a 1 decimal (mitad hacia arriba).
 * Devuelve décimas. Ej: 4,945 -> 4,95 -> 5,0 ; 3,945 -> 3,95 -> 4,0 ; 4,944 -> 4,94 -> 4,9.
 */
function redondearFraccion(numerador, denominador) {
  const centesimas = Math.floor((numerador + 5 * denominador) / (10 * denominador));
  return Math.floor((centesimas + 5) / 10);
}

/** Redondeo chileno de un valor entero en milésimas. Devuelve décimas. */
function redondear(milesimas) {
  return redondearFraccion(milesimas, 1);
}

/**
 * División entera hacia arriba. Con enteros de este tamaño la división en coma flotante es exacta
 * cuando el resultado es entero, así que Math.ceil no se equivoca.
 */
function dividirHaciaArriba(numerador, denominador) {
  return Math.ceil(numerador / denominador);
}

// ---------- Aportes y nota necesaria ----------

/** Cuánto suma una evaluación, en milésimas. Ej: 7,0 al 50 % -> 70 × 50 = 3500 (3,5). */
function aporte(nota, porcentaje) {
  return nota * porcentaje;
}

/** Suma de los porcentajes de todas las evaluaciones. */
function sumaPorcentajes(evaluaciones) {
  return evaluaciones.reduce((total, evaluacion) => total + evaluacion.porcentaje, 0);
}

/** Suma de los porcentajes de las evaluaciones que ya tienen nota. */
function porcentajeEvaluado(evaluaciones) {
  return evaluaciones
    .filter((evaluacion) => evaluacion.nota !== null && evaluacion.nota !== undefined)
    .reduce((total, evaluacion) => total + evaluacion.porcentaje, 0);
}

/** Suma de los aportes de las evaluaciones que ya tienen nota, en milésimas. */
function notaAcumulada(evaluaciones) {
  return evaluaciones
    .filter((evaluacion) => evaluacion.nota !== null && evaluacion.nota !== undefined)
    .reduce((total, evaluacion) => total + aporte(evaluacion.nota, evaluacion.porcentaje), 0);
}

/**
 * Nota (en décimas, redondeada hacia arriba) que se necesita en el porcentaje pendiente
 * para llegar a la meta (en milésimas). null si no queda nada pendiente.
 * Puede ser menor que 1,0 (meta asegurada) o mayor que 7,0 (meta imposible).
 */
function notaNecesaria(acumulada, porcentajePendiente, meta) {
  if (porcentajePendiente <= 0) return null;
  return dividirHaciaArriba(meta - acumulada, porcentajePendiente);
}

/** Interpreta una nota necesaria: "asegurada", "posible" o "imposible". */
function estadoNotaNecesaria(necesaria) {
  if (necesaria <= NOTA_MINIMA) return "asegurada";
  if (necesaria > NOTA_MAXIMA) return "imposible";
  return "posible";
}

/** Nota mínima de examen (décimas, hacia arriba) para aprobar con una presentación (décimas). */
function examenNecesario(presentacion) {
  const necesaria = dividirHaciaArriba(APROBAR - presentacion * PESO_PRESENTACION, PESO_EXAMEN);
  return Math.max(NOTA_MINIMA, necesaria);
}

/** Nota final con examen, en milésimas: presentación × 0,75 + examen × 0,25. */
function notaFinalConExamen(presentacion, examen) {
  return presentacion * PESO_PRESENTACION + examen * PESO_EXAMEN;
}

// ---------- Estado de una asignatura ----------

const COLOR = { aprobado: "verde", eximido: "verde", examen: "amarillo", reprobado: "rojo", "en-curso": "gris", "sin-notas": "gris", porcentajes: "gris" };

const TITULO = {
  aprobado: "Aprobado",
  eximido: "Eximido",
  examen: "Vas a examen",
  reprobado: "Reprobado",
  "en-curso": "En curso",
  "sin-notas": "Sin notas",
  porcentajes: "Revisa los porcentajes",
};

function resultado(estado, mensaje, extra) {
  return {
    estado,
    color: COLOR[estado],
    titulo: TITULO[estado],
    mensaje,
    promedio: null,
    completo: false,
    porcentajeTotal: 100,
    notaNecesaria: null,
    examen: null,
    ...extra,
  };
}

/**
 * Calcula el estado de una asignatura.
 * datos = {
 *   tipo: "practica" | "lectiva",
 *   evaluaciones: [{ porcentaje, nota }]   (nota en décimas o null si está pendiente)
 *   notaExamen: décimas | null,
 * }
 * Todo lo numérico del resultado viene en décimas y ya redondeado.
 */
function calcularAsignatura(datos) {
  const evaluaciones = datos.evaluaciones ?? [];
  const total = sumaPorcentajes(evaluaciones);
  if (evaluaciones.length === 0 || total !== 100) {
    return resultado("porcentajes", MENSAJE_PORCENTAJES, { porcentajeTotal: total });
  }

  const acumulada = notaAcumulada(evaluaciones);
  const evaluado = porcentajeEvaluado(evaluaciones);
  const pendiente = 100 - evaluado;
  const base = {
    completo: pendiente === 0,
    promedio: evaluado > 0 ? redondearFraccion(acumulada * 100, evaluado) : null,
  };

  if (datos.tipo === "lectiva") {
    return calcularLectiva(acumulada, evaluado, pendiente, datos.notaExamen ?? null, base);
  }
  return calcularSinExamen(acumulada, evaluado, pendiente, base);
}

/** Práctica: aprueba con el promedio y no tiene examen final. */
function calcularSinExamen(acumulada, evaluado, pendiente, base) {
  if (pendiente === 0) {
    if (acumulada >= APROBAR) {
      return resultado("aprobado", "¡Felicitaciones! Aprobaste la asignatura.", base);
    }
    return resultado("reprobado", "Tu promedio no alcanza el 4,0 necesario para aprobar.", base);
  }

  const necesaria = notaNecesaria(acumulada, pendiente, APROBAR);
  const estado = estadoNotaNecesaria(necesaria);
  const extra = { ...base, notaNecesaria: Math.max(NOTA_MINIMA, necesaria) };

  if (estado === "imposible") {
    return resultado("reprobado", "Aunque saques 7,0 en lo que falta, no alcanzas a aprobar.", extra);
  }
  if (estado === "asegurada" && evaluado > 0) {
    return resultado("aprobado", "Ya aseguraste la aprobación, aunque falten notas.", extra);
  }
  if (evaluado === 0) {
    return resultado("sin-notas", "Ingresa tus notas a medida que las tengas. Para aprobar necesitas un promedio de 4,0.", extra);
  }
  return resultado("en-curso", `Necesitas al menos un ${formatearNota(extra.notaNecesaria)} en lo que falta para aprobar.`, extra);
}

/** Lectiva: se exime con 5,0; si no, va a examen (presentación 75 % + examen 25 %). */
function calcularLectiva(acumulada, evaluado, pendiente, notaExamen, base) {
  if (pendiente === 0) {
    const presentacion = redondear(acumulada);
    if (acumulada >= EXIMIRSE) {
      return resultado("eximido", "¡Felicitaciones! Te eximiste del examen y aprobaste la asignatura.", base);
    }

    const necesaria = examenNecesario(presentacion);
    const examen = { necesaria, nota: notaExamen, final: null };
    if (notaExamen !== null) {
      const final = notaFinalConExamen(presentacion, notaExamen);
      examen.final = redondear(final);
      if (final >= APROBAR) {
        return resultado("aprobado", `Aprobaste con examen. Tu nota final es ${formatearNota(examen.final)}.`, { ...base, examen });
      }
      return resultado("reprobado", `Tu nota final con examen es ${formatearNota(examen.final)} y no alcanza para aprobar.`, { ...base, examen });
    }
    if (necesaria > NOTA_MAXIMA) {
      return resultado("reprobado", "Aunque saques 7,0 en el examen, no alcanzas a aprobar.", { ...base, examen });
    }
    return resultado("examen", `Necesitas al menos un ${formatearNota(necesaria)} en el examen para aprobar.`, {
      ...base,
      examen,
    });
  }

  const necesariaEximirse = notaNecesaria(acumulada, pendiente, EXIMIRSE);
  const estado = estadoNotaNecesaria(necesariaEximirse);
  const extra = { ...base, notaNecesaria: Math.max(NOTA_MINIMA, necesariaEximirse) };

  if (estado === "asegurada" && evaluado > 0) {
    return resultado("eximido", "Ya aseguraste la eximición, aunque falten notas.", extra);
  }
  if (estado !== "imposible") {
    if (evaluado === 0) {
      return resultado(
        "sin-notas",
        "Ingresa tus notas a medida que las tengas. Con un promedio de 5,0 o más te eximes del examen.",
        extra,
      );
    }
    return resultado("en-curso", `Necesitas al menos un ${formatearNota(extra.notaNecesaria)} en lo que falta para eximirte.`, extra);
  }

  // Eximirse ya no es posible: ¿alcanza aprobando con 7,0 en todo lo pendiente y en el examen?
  const mejorPresentacion = redondear(acumulada + NOTA_MAXIMA * pendiente);
  if (notaFinalConExamen(mejorPresentacion, NOTA_MAXIMA) < APROBAR) {
    return resultado("reprobado", "Aunque saques 7,0 en todo lo que falta y en el examen, no alcanzas a aprobar.", {
      ...base,
      notaNecesaria: null,
    });
  }
  return resultado("examen", "Ya no alcanzas a eximirte, pero puedes aprobar en el examen cuando completes tus notas.", {
    ...base,
    notaNecesaria: null,
  });
}

module.exports = {
  NOTA_MINIMA,
  NOTA_MAXIMA,
  APROBAR,
  EXIMIRSE,
  MENSAJE_RANGO,
  MENSAJE_DECIMALES,
  MENSAJE_PORCENTAJES,
  validarNota,
  validarPorcentaje,
  formatearNota,
  redondear,
  redondearFraccion,
  aporte,
  sumaPorcentajes,
  porcentajeEvaluado,
  notaAcumulada,
  notaNecesaria,
  estadoNotaNecesaria,
  examenNecesario,
  notaFinalConExamen,
  calcularAsignatura,
};
