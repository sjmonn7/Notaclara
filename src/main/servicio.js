// Une la base de datos con los cálculos y entrega a la interfaz datos listos para mostrar:
// notas ya redondeadas y escritas con coma, colores y textos del estado.
const calculos = require("../logica/calculos");
const { clave } = require("./basedatos");

const TIPO_TEXTO = { practica: "Práctica", lectiva: "Lectiva" };

function crearServicio(bd) {
  function calcular(asignatura) {
    return calculos.calcularAsignatura({
      tipo: asignatura.tipo,
      evaluaciones: asignatura.evaluaciones,
      notaExamen: asignatura.notaExamen,
    });
  }

  function ponderacionModificada(asignatura) {
    const original = bd.ponderacionOriginal(asignatura.id) ?? [];
    const actual = asignatura.evaluaciones;
    return (
      original.length !== actual.length ||
      original.some((evaluacion, i) => clave(evaluacion.nombre) !== clave(actual[i].nombre) || evaluacion.porcentaje !== actual[i].porcentaje)
    );
  }

  function resultadoParaMostrar(resultado, evaluaciones) {
    const nota = calculos.formatearNota;
    let mensaje = resultado.mensaje;
    if (resultado.estado === "en-curso" && resultado.notaNecesaria !== null) {
      const pendientes = evaluaciones.filter((evaluacion) => evaluacion.nota === null);
      const ultimas = pendientes.slice(-2);
      const detalle = ultimas
        .map((evaluacion) => `${evaluacion.nombre}: ${nota(resultado.notaNecesaria)}`)
        .join(" y ");
      if (detalle) {
        const cantidad = ultimas.length === 1 ? "la última pendiente es" : "las últimas dos pendientes son";
        mensaje += ` Si obtienes la misma nota en todas las pendientes, ${cantidad}: ${detalle}.`;
      }
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
          !inasistenciaJustificada;
        return {
          id: evaluacion.id,
          nombre: evaluacion.nombre,
          porcentaje: evaluacion.porcentaje,
          nota: calculos.formatearNota(evaluacion.nota),
          inasistenciaJustificada,
          puedeJustificarInasistencia,
        };
      }),
      porcentajeTotal: calculos.sumaPorcentajes(asignatura.evaluaciones),
      examen: {
        nota: calculos.formatearNota(asignatura.notaExamen),
      },
      resultado: resultadoParaMostrar(calculo, asignatura.evaluaciones),
    };
  }

  /** Resumen corto de una asignatura para la barra lateral y la portada del semestre. */
  function resumen(asignaturaId) {
    const asignatura = bd.asignatura(asignaturaId);
    const resultado = resultadoParaMostrar(calcular(asignatura), asignatura.evaluaciones);
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
      const validacion = calculos.validarNota(texto);
      if (validacion.valida) {
        bd.guardarNota(evaluacionId, validacion.valor);
        if (validacion.valor !== calculos.NOTA_MINIMA) {
          bd.guardarInasistenciaJustificada(evaluacionId, false);
        }
      }
      return respuesta(validacion, asignaturaId);
    },

    guardarNotaExamen(asignaturaId, texto) {
      const validacion = calculos.validarNota(texto);
      if (validacion.valida) bd.guardarNotaExamen(asignaturaId, validacion.valor);
      return respuesta(validacion, asignaturaId);
    },

    justificarInasistencia(evaluacionId, justificada) {
      const asignaturaId = bd.asignaturaDeEvaluacion(evaluacionId);
      const asignatura = asignaturaId === null ? null : bd.asignatura(asignaturaId);
      if (!asignatura) return { valida: false, mensaje: "No se encontró la evaluación.", vista: null };
      const actual = vista(asignaturaId);
      if (
        justificada &&
        !actual.evaluaciones.find(
          (evaluacion) => evaluacion.id === evaluacionId && evaluacion.puedeJustificarInasistencia,
        )
      ) {
        return {
          valida: false,
          mensaje: "Solo puedes justificar una prueba con nota 1,0 en una lectiva completa cuyo promedio quede bajo el umbral de eximición.",
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
      return vista(asignaturaId);
    },

    restaurarPonderacion(asignaturaId) {
      bd.restaurarPonderacion(asignaturaId);
      return vista(asignaturaId);
    },

    agregarEvaluacion(asignaturaId) {
      if (editable(asignaturaId)) {
        const { evaluaciones } = bd.asignatura(asignaturaId);
        const disponible = Math.max(0, 100 - calculos.sumaPorcentajes(evaluaciones));
        bd.agregarEvaluacion(asignaturaId, `EV${evaluaciones.length + 1}`, disponible);
      }
      return vista(asignaturaId);
    },

    eliminarEvaluacion(evaluacionId) {
      const asignaturaId = bd.asignaturaDeEvaluacion(evaluacionId);
      if (editable(asignaturaId)) bd.eliminarEvaluacion(evaluacionId);
      return vista(asignaturaId);
    },

    renombrarEvaluacion(evaluacionId, texto) {
      const asignaturaId = bd.asignaturaDeEvaluacion(evaluacionId);
      const nombre = String(texto ?? "").trim();
      const validacion = nombre
        ? { valida: true, mensaje: "" }
        : { valida: false, mensaje: "El nombre de la evaluación no puede quedar vacío." };
      if (validacion.valida && editable(asignaturaId)) bd.guardarNombre(evaluacionId, nombre.slice(0, 60));
      return respuesta(validacion, asignaturaId);
    },

    cambiarPorcentaje(evaluacionId, texto) {
      const asignaturaId = bd.asignaturaDeEvaluacion(evaluacionId);
      const validacion = calculos.validarPorcentaje(texto);
      if (validacion.valido && editable(asignaturaId)) bd.guardarPorcentaje(evaluacionId, validacion.valor);
      return respuesta({ ...validacion, valida: validacion.valido }, asignaturaId);
    },
  };
}

module.exports = { crearServicio };
