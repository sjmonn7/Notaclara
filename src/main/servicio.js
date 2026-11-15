// Une la base de datos con los cálculos y entrega a la interfaz datos listos para mostrar:
// notas ya redondeadas y escritas con coma, colores y textos del estado.
const calculos = require("../logica/calculos");
const { clave } = require("./basedatos");

const TIPO_TEXTO = { practica: "Práctica", lectiva: "Lectiva" };

const MENSAJE_BLOQUEADA =
  "Esta nota se completó con la nota del examen. Para modificarla, borra primero la nota del examen.";
const MENSAJE_NO_EDITABLE = "Activa la ponderación libre para cambiar las evaluaciones.";
const MENSAJE_NOMBRE_REPETIDO = "Ya existe una evaluación con ese nombre.";
const MENSAJE_SIN_EXAMEN = "Esta asignatura no tiene examen final.";

function crearServicio(bd) {
  function calcular(asignatura) {
    return calculos.calcularAsignatura({
      tipo: asignatura.tipo,
      evaluaciones: asignatura.evaluaciones.map((evaluacion) => ({
        ...evaluacion,
        justificada: evaluacion.inasistencia_justificada === 1,
      })),
      notaExamen: asignatura.notaExamen,
    });
  }

  /**
   * Los porcentajes suman 100 y no queda porcentaje pendiente. Es la misma regla de calcularAsignatura:
   * una evaluación de 0 % sin nota no deja la asignatura incompleta.
   */
  function completa(asignatura) {
    const { evaluaciones } = asignatura;
    return calculos.sumaPorcentajes(evaluaciones) === 100 && calculos.porcentajeEvaluado(evaluaciones) === 100;
  }

  /**
   * La prueba justificada queda bloqueada mientras haya nota de examen (su casilla muestra esa nota).
   * Si a la asignatura le falta alguna nota, el examen no se usa: la casilla vuelve al 1,0 y se puede editar.
   */
  function bloqueadaPorExamen(asignatura, evaluacion) {
    return evaluacion.inasistencia_justificada === 1 && asignatura.notaExamen !== null && completa(asignatura);
  }

  /** Si la acumulada (con el 1,0) llega a la eximición, ya no va a examen: se quita la falta justificada. */
  function revisarJustificacion(asignaturaId) {
    const asignatura = bd.asignatura(asignaturaId);
    if (!asignatura) return;
    const { evaluaciones } = asignatura;
    if (calculos.sumaPorcentajes(evaluaciones) !== 100 || calculos.notaAcumulada(evaluaciones) < calculos.EXIMIRSE) return;
    for (const evaluacion of evaluaciones) {
      if (evaluacion.inasistencia_justificada === 1) bd.guardarInasistenciaJustificada(evaluacion.id, false);
    }
  }

  function ponderacionModificada(asignatura) {
    const original = bd.ponderacionOriginal(asignatura.id) ?? [];
    const actual = asignatura.evaluaciones;
    return (
      original.length !== actual.length ||
      original.some((evaluacion, i) => clave(evaluacion.nombre) !== clave(actual[i].nombre) || evaluacion.porcentaje !== actual[i].porcentaje)
    );
  }

  /** Mensaje corto con la nota que falta: "Para eximirte necesitas un 6,1 en EV4." */
  function mensajeNotaNecesaria(asignatura, notaNecesaria) {
    const meta = asignatura.tipo === "lectiva" ? "eximirte" : "aprobar";
    // Una evaluación de 0 % sin nota no cambia el promedio, así que no se nombra
    const pendientes = asignatura.evaluaciones
      .filter((evaluacion) => evaluacion.nota === null && evaluacion.porcentaje > 0)
      .map((evaluacion) => evaluacion.nombre);
    const donde =
      pendientes.length > 3
        ? "cada evaluación que falta"
        : pendientes.join(", ").replace(/, ([^,]*)$/, " y $1");
    return `Para ${meta} necesitas un ${calculos.formatearNota(notaNecesaria)} en ${donde}.`;
  }

  function resultadoParaMostrar(resultado, asignatura) {
    const nota = calculos.formatearNota;
    let mensaje = resultado.mensaje;
    if (resultado.estado === "en-curso" && resultado.notaNecesaria !== null) {
      mensaje = mensajeNotaNecesaria(asignatura, resultado.notaNecesaria);
    }
    return {
      estado: resultado.estado,
      color: resultado.color,
      titulo: resultado.titulo,
      mensaje,
      completo: resultado.completo,
      promedio: nota(resultado.promedio),
      notaNecesaria: nota(resultado.notaNecesaria),
      examen: resultado.examen && {
        necesaria: nota(resultado.examen.necesaria),
        final: nota(resultado.examen.final),
      },
    };
  }

  /** Todo lo que necesita el panel de una asignatura. */
  function vista(asignaturaId) {
    const asignatura = bd.asignatura(asignaturaId);
    if (!asignatura) return null;
    const calculo = calcular(asignatura);
    const promedioBajoEximicion =
      calculo.completo && calculos.notaAcumulada(asignatura.evaluaciones) < calculos.EXIMIRSE;
    // Solo se puede justificar una prueba por asignatura
    const hayJustificada = asignatura.evaluaciones.some((evaluacion) => evaluacion.inasistencia_justificada === 1);
    return {
      asignatura: {
        id: asignatura.id,
        nombre: asignatura.nombre,
        tipo: asignatura.tipo,
        tipoTexto: TIPO_TEXTO[asignatura.tipo],
        semestreId: asignatura.semestreId,
        ponderacionLibre: asignatura.ponderacionLibre,
        siempreLibre: asignatura.siempreLibre,
        ponderacionModificada: ponderacionModificada(asignatura),
      },
      evaluaciones: asignatura.evaluaciones.map((evaluacion) => {
        const inasistenciaJustificada = evaluacion.inasistencia_justificada === 1;
        const puedeJustificarInasistencia =
          asignatura.tipo === "lectiva" &&
          promedioBajoEximicion &&
          evaluacion.nota === calculos.NOTA_MINIMA &&
          !hayJustificada;
        const bloqueada = bloqueadaPorExamen(asignatura, evaluacion);
        return {
          id: evaluacion.id,
          nombre: evaluacion.nombre,
          porcentaje: evaluacion.porcentaje,
          nota: calculos.formatearNota(bloqueada ? asignatura.notaExamen : evaluacion.nota),
          inasistenciaJustificada,
          puedeJustificarInasistencia,
          bloqueadaPorExamen: bloqueada,
        };
      }),
      porcentajeTotal: calculos.sumaPorcentajes(asignatura.evaluaciones),
      examen: {
        nota: calculos.formatearNota(asignatura.notaExamen),
      },
      resultado: resultadoParaMostrar(calculo, asignatura),
    };
  }

  /** Resumen corto de una asignatura para la barra lateral y la portada del semestre. */
  function resumen(asignaturaId) {
    const asignatura = bd.asignatura(asignaturaId);
    if (!asignatura) return null;
    const resultado = resultadoParaMostrar(calcular(asignatura), asignatura);
    return {
      id: asignatura.id,
      nombre: asignatura.nombre,
      tipoTexto: TIPO_TEXTO[asignatura.tipo],
      color: resultado.color,
      titulo: resultado.titulo,
      promedio: resultado.examen?.final || resultado.promedio,
    };
  }

  function editable(asignaturaId) {
    const asignatura = bd.asignatura(asignaturaId);
    return Boolean(asignatura && asignatura.ponderacionLibre);
  }

  /** Respuesta común de las acciones que validan un texto: { valida, mensaje, incompleta, vista } */
  function respuesta(validacion, asignaturaId) {
    return {
      valida: validacion.valida,
      mensaje: validacion.mensaje,
      incompleta: Boolean(validacion.incompleta),
      vista: vista(asignaturaId),
    };
  }

  return {
    semestres: () => bd.semestres(),
    asignaturas: (semestreId) => bd.idsAsignaturas(semestreId).map(resumen),
    vista,
    resumen,

    guardarNota(evaluacionId, texto) {
      const asignaturaId = bd.asignaturaDeEvaluacion(evaluacionId);
      const asignatura = asignaturaId === null ? null : bd.asignatura(asignaturaId);
      const evaluacion = asignatura?.evaluaciones.find((item) => item.id === evaluacionId);
      if (evaluacion && bloqueadaPorExamen(asignatura, evaluacion)) {
        return respuesta({ valida: false, mensaje: MENSAJE_BLOQUEADA }, asignaturaId);
      }
      const validacion = calculos.validarNota(texto);
      if (validacion.valida) {
        bd.guardarNota(evaluacionId, validacion.valor);
        if (validacion.valor !== calculos.NOTA_MINIMA) {
          bd.guardarInasistenciaJustificada(evaluacionId, false);
        }
        revisarJustificacion(asignaturaId);
      }
      return respuesta(validacion, asignaturaId);
    },

    guardarNotaExamen(asignaturaId, texto) {
      if (bd.asignatura(asignaturaId)?.tipo !== "lectiva") {
        return respuesta({ valida: false, mensaje: MENSAJE_SIN_EXAMEN }, asignaturaId);
      }
      const validacion = calculos.validarNota(texto);
      if (validacion.valida) bd.guardarNotaExamen(asignaturaId, validacion.valor);
      return respuesta(validacion, asignaturaId);
    },

    justificarInasistencia(evaluacionId, justificada) {
      const asignaturaId = bd.asignaturaDeEvaluacion(evaluacionId);
      const asignatura = asignaturaId === null ? null : bd.asignatura(asignaturaId);
      if (!asignatura) return { valida: false, mensaje: "No se encontró la evaluación.", vista: null };
      const actual = vista(asignaturaId);
      const evaluacion = asignatura.evaluaciones.find((item) => item.id === evaluacionId);
      if (!justificada && evaluacion && bloqueadaPorExamen(asignatura, evaluacion)) {
        return { valida: false, mensaje: MENSAJE_BLOQUEADA, vista: actual };
      }
      if (
        justificada &&
        !actual.evaluaciones.find(
          (evaluacion) => evaluacion.id === evaluacionId && evaluacion.puedeJustificarInasistencia,
        )
      ) {
        return {
          valida: false,
          mensaje: "Solo puedes justificar una prueba por asignatura, con nota 1,0, en una lectiva completa que vaya a examen.",
          vista: actual,
        };
      }
      bd.guardarInasistenciaJustificada(evaluacionId, justificada);
      return { valida: true, mensaje: "", vista: vista(asignaturaId) };
    },

    /** Al desactivar la ponderación libre se vuelve a la original (los electivos siempre son libres). */
    cambiarPonderacionLibre(asignaturaId, libre) {
      const asignatura = bd.asignatura(asignaturaId);
      if (!asignatura || asignatura.siempreLibre) return vista(asignaturaId);
      if (!libre) bd.restaurarPonderacion(asignaturaId);
      bd.guardarPonderacionLibre(asignaturaId, libre);
      revisarJustificacion(asignaturaId);
      return vista(asignaturaId);
    },

    restaurarPonderacion(asignaturaId) {
      bd.restaurarPonderacion(asignaturaId);
      revisarJustificacion(asignaturaId);
      return vista(asignaturaId);
    },

    agregarEvaluacion(asignaturaId) {
      if (editable(asignaturaId)) {
        const { evaluaciones } = bd.asignatura(asignaturaId);
        const disponible = Math.max(0, 100 - calculos.sumaPorcentajes(evaluaciones));
        // Primer "EVn" que no esté usado (al eliminar EV2 de cuatro, la nueva no puede llamarse EV4 otra vez)
        const usados = new Set(evaluaciones.map((evaluacion) => clave(evaluacion.nombre)));
        let numero = evaluaciones.length + 1;
        while (usados.has(clave(`EV${numero}`))) numero += 1;
        bd.agregarEvaluacion(asignaturaId, `EV${numero}`, disponible);
      }
      return vista(asignaturaId);
    },

    eliminarEvaluacion(evaluacionId) {
      const asignaturaId = bd.asignaturaDeEvaluacion(evaluacionId);
      if (editable(asignaturaId)) {
        bd.eliminarEvaluacion(evaluacionId);
        revisarJustificacion(asignaturaId);
      }
      return vista(asignaturaId);
    },

    renombrarEvaluacion(evaluacionId, texto) {
      const asignaturaId = bd.asignaturaDeEvaluacion(evaluacionId);
      if (!editable(asignaturaId)) return respuesta({ valida: false, mensaje: MENSAJE_NO_EDITABLE }, asignaturaId);
      const nombre = String(texto ?? "").trim().slice(0, 60);
      // Sin nombres repetidos: al restaurar la ponderación las notas se conservan por nombre
      const repetido = bd
        .asignatura(asignaturaId)
        .evaluaciones.some((evaluacion) => evaluacion.id !== evaluacionId && clave(evaluacion.nombre) === clave(nombre));
      let validacion = { valida: true, mensaje: "" };
      if (!nombre) validacion = { valida: false, mensaje: "El nombre de la evaluación no puede quedar vacío." };
      else if (repetido) validacion = { valida: false, mensaje: MENSAJE_NOMBRE_REPETIDO };
      if (validacion.valida) bd.guardarNombre(evaluacionId, nombre);
      return respuesta(validacion, asignaturaId);
    },

    cambiarPorcentaje(evaluacionId, texto) {
      const asignaturaId = bd.asignaturaDeEvaluacion(evaluacionId);
      if (!editable(asignaturaId)) return respuesta({ valida: false, mensaje: MENSAJE_NO_EDITABLE }, asignaturaId);
      const validacion = calculos.validarPorcentaje(texto);
      if (validacion.valido) {
        bd.guardarPorcentaje(evaluacionId, validacion.valor);
        revisarJustificacion(asignaturaId);
      }
      return respuesta({ ...validacion, valida: validacion.valido }, asignaturaId);
    },
  };
}

module.exports = { crearServicio };
