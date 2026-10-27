// Acceso al archivo SQLite donde se guardan las notas.
// Las notas se guardan en décimas (4,5 -> 45) y los porcentajes como enteros, igual que en src/logica/calculos.js.
const Database = require("better-sqlite3");

const { MALLA, ponderacionOriginal } = require("../datos/malla");

const ESQUEMA = `
  CREATE TABLE IF NOT EXISTS semestre (
    id     INTEGER PRIMARY KEY,
    numero INTEGER NOT NULL UNIQUE,
    nombre TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS asignatura (
    id                INTEGER PRIMARY KEY,
    semestre_id       INTEGER NOT NULL REFERENCES semestre(id) ON DELETE CASCADE,
    nombre            TEXT    NOT NULL,
    tipo              TEXT    NOT NULL CHECK (tipo IN ('practica', 'lectiva')),
    ponderacion_libre INTEGER NOT NULL DEFAULT 0,
    siempre_libre     INTEGER NOT NULL DEFAULT 0,
    orden             INTEGER NOT NULL,
    UNIQUE (semestre_id, nombre)
  );

  CREATE TABLE IF NOT EXISTS evaluacion (
    id                       INTEGER PRIMARY KEY,
    asignatura_id            INTEGER NOT NULL REFERENCES asignatura(id) ON DELETE CASCADE,
    nombre                   TEXT    NOT NULL,
    porcentaje               INTEGER NOT NULL CHECK (porcentaje BETWEEN 0 AND 100),
    nota                     INTEGER CHECK (nota IS NULL OR nota BETWEEN 10 AND 70),
    orden                    INTEGER NOT NULL,
    inasistencia_justificada INTEGER NOT NULL DEFAULT 0 CHECK (inasistencia_justificada IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS estado_examen (
    asignatura_id INTEGER PRIMARY KEY REFERENCES asignatura(id) ON DELETE CASCADE,
    nota_examen   INTEGER CHECK (nota_examen IS NULL OR nota_examen BETWEEN 10 AND 70)
  );
`;

/** Normaliza un nombre de evaluación para comparar ("  ev1 " == "EV1"). */
function clave(nombre) {
  return nombre.trim().toLocaleLowerCase("es");
}

/**
 * Abre (o crea) el archivo de notas en la ruta indicada. Usa ":memory:" para pruebas.
 * Crea las tablas y precarga la malla si faltan asignaturas.
 */
function abrirBaseDatos(ruta) {
  const db = new Database(ruta);
  db.pragma("foreign_keys = ON");
  db.exec(ESQUEMA);
  const columnasEvaluacion = db.pragma("table_info(evaluacion)");
  if (!columnasEvaluacion.some((columna) => columna.name === "inasistencia_justificada")) {
    db.exec(
      "ALTER TABLE evaluacion ADD COLUMN inasistencia_justificada INTEGER NOT NULL DEFAULT 0 CHECK (inasistencia_justificada IN (0, 1))",
    );
  }

  const sql = {
    semestrePorNumero: db.prepare("SELECT id FROM semestre WHERE numero = ?"),
    insertarSemestre: db.prepare("INSERT INTO semestre (numero, nombre) VALUES (?, ?)"),
    asignaturaPorNombre: db.prepare("SELECT id FROM asignatura WHERE semestre_id = ? AND nombre = ?"),
    insertarAsignatura: db.prepare(
      `INSERT INTO asignatura (semestre_id, nombre, tipo, ponderacion_libre, siempre_libre, orden)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ),
    insertarEstadoExamen: db.prepare("INSERT OR IGNORE INTO estado_examen (asignatura_id) VALUES (?)"),
    insertarEvaluacion: db.prepare(
      "INSERT INTO evaluacion (asignatura_id, nombre, porcentaje, nota, orden) VALUES (?, ?, ?, ?, ?)",
    ),

    semestres: db.prepare("SELECT id, numero, nombre FROM semestre ORDER BY numero"),
    asignaturasDeSemestre: db.prepare("SELECT id FROM asignatura WHERE semestre_id = ? ORDER BY orden"),
    asignatura: db.prepare(
      `SELECT a.id, a.nombre, a.tipo, a.ponderacion_libre, a.siempre_libre, a.semestre_id, s.numero AS semestre_numero
       FROM asignatura a JOIN semestre s ON s.id = a.semestre_id
       WHERE a.id = ?`,
    ),
    evaluaciones: db.prepare(
      `SELECT id, nombre, porcentaje, nota, inasistencia_justificada
       FROM evaluacion WHERE asignatura_id = ? ORDER BY orden, id`,
    ),
    estadoExamen: db.prepare("SELECT nota_examen FROM estado_examen WHERE asignatura_id = ?"),
    asignaturaDeEvaluacion: db.prepare("SELECT asignatura_id FROM evaluacion WHERE id = ?"),
    siguienteOrden: db.prepare("SELECT COALESCE(MAX(orden), 0) + 1 AS orden FROM evaluacion WHERE asignatura_id = ?"),

    guardarNota: db.prepare("UPDATE evaluacion SET nota = ? WHERE id = ?"),
    guardarInasistenciaJustificada: db.prepare(
      "UPDATE evaluacion SET inasistencia_justificada = ? WHERE id = ?",
    ),
    guardarNombre: db.prepare("UPDATE evaluacion SET nombre = ? WHERE id = ?"),
    guardarPorcentaje: db.prepare("UPDATE evaluacion SET porcentaje = ? WHERE id = ?"),
    eliminarEvaluacion: db.prepare("DELETE FROM evaluacion WHERE id = ?"),
    eliminarEvaluaciones: db.prepare("DELETE FROM evaluacion WHERE asignatura_id = ?"),
    guardarNotaExamen: db.prepare("UPDATE estado_examen SET nota_examen = ? WHERE asignatura_id = ?"),
    guardarPonderacionLibre: db.prepare("UPDATE asignatura SET ponderacion_libre = ? WHERE id = ?"),
  };

  const precargar = db.transaction(() => {
    for (const semestre of MALLA) {
      let fila = sql.semestrePorNumero.get(semestre.numero);
      if (!fila) {
        const { lastInsertRowid } = sql.insertarSemestre.run(semestre.numero, `${semestre.numero}° Semestre`);
        fila = { id: lastInsertRowid };
      }
      semestre.asignaturas.forEach((datos, indice) => {
        if (sql.asignaturaPorNombre.get(fila.id, datos.nombre)) return;
        const libre = datos.siempreLibre ? 1 : 0;
        const { lastInsertRowid } = sql.insertarAsignatura.run(fila.id, datos.nombre, datos.tipo, libre, libre, indice + 1);
        sql.insertarEstadoExamen.run(lastInsertRowid);
        datos.evaluaciones.forEach((evaluacion, orden) => {
          sql.insertarEvaluacion.run(lastInsertRowid, evaluacion.nombre, evaluacion.porcentaje, null, orden + 1);
        });
      });
    }
  });
  precargar();

  function asignatura(id) {
    const fila = sql.asignatura.get(id);
    if (!fila) return null;
    const examen = sql.estadoExamen.get(id) ?? { nota_examen: null };
    return {
      id: fila.id,
      nombre: fila.nombre,
      tipo: fila.tipo,
      semestreId: fila.semestre_id,
      semestreNumero: fila.semestre_numero,
      ponderacionLibre: fila.ponderacion_libre === 1,
      siempreLibre: fila.siempre_libre === 1,
      evaluaciones: sql.evaluaciones.all(id),
      notaExamen: examen.nota_examen,
    };
  }

  function ponderacionDe(asignaturaId) {
    const fila = sql.asignatura.get(asignaturaId);
    return fila ? ponderacionOriginal(fila.semestre_numero, fila.nombre) : null;
  }

  /** Vuelve a la ponderación original. Conserva las notas de las evaluaciones con el mismo nombre. */
  const restaurarPonderacion = db.transaction((asignaturaId) => {
    const original = ponderacionDe(asignaturaId);
    if (!original) return;
    const notas = new Map();
    for (const evaluacion of sql.evaluaciones.all(asignaturaId)) {
      if (!notas.has(clave(evaluacion.nombre))) {
        notas.set(clave(evaluacion.nombre), {
          nota: evaluacion.nota,
          inasistenciaJustificada: evaluacion.inasistencia_justificada,
        });
      }
    }
    sql.eliminarEvaluaciones.run(asignaturaId);
    original.forEach((evaluacion, indice) => {
      const datos = notas.get(clave(evaluacion.nombre));
      const { lastInsertRowid } = sql.insertarEvaluacion.run(
        asignaturaId,
        evaluacion.nombre,
        evaluacion.porcentaje,
        datos?.nota ?? null,
        indice + 1,
      );
      if (datos?.inasistenciaJustificada) {
        sql.guardarInasistenciaJustificada.run(datos.inasistenciaJustificada, lastInsertRowid);
      }
    });
  });

  return {
    semestres: () => sql.semestres.all(),
    idsAsignaturas: (semestreId) => sql.asignaturasDeSemestre.all(semestreId).map((fila) => fila.id),
    asignatura,
    ponderacionOriginal: ponderacionDe,
    asignaturaDeEvaluacion: (evaluacionId) => sql.asignaturaDeEvaluacion.get(evaluacionId)?.asignatura_id ?? null,

    guardarNota: (evaluacionId, nota) => sql.guardarNota.run(nota, evaluacionId),
    guardarInasistenciaJustificada: (evaluacionId, justificada) =>
      sql.guardarInasistenciaJustificada.run(justificada ? 1 : 0, evaluacionId),
    guardarNombre: (evaluacionId, nombre) => sql.guardarNombre.run(nombre, evaluacionId),
    guardarPorcentaje: (evaluacionId, porcentaje) => sql.guardarPorcentaje.run(porcentaje, evaluacionId),
    eliminarEvaluacion: (evaluacionId) => sql.eliminarEvaluacion.run(evaluacionId),
    agregarEvaluacion(asignaturaId, nombre, porcentaje) {
      const { orden } = sql.siguienteOrden.get(asignaturaId);
      return sql.insertarEvaluacion.run(asignaturaId, nombre, porcentaje, null, orden).lastInsertRowid;
    },
    guardarNotaExamen: (asignaturaId, nota) => sql.guardarNotaExamen.run(nota, asignaturaId),
    guardarPonderacionLibre: (asignaturaId, libre) => sql.guardarPonderacionLibre.run(libre ? 1 : 0, asignaturaId),
    restaurarPonderacion,
    cerrar: () => db.close(),
  };
}

module.exports = { abrirBaseDatos, clave };
