// Pruebas del guardado y de la ponderación libre, con un archivo de notas en memoria.
const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { abrirBaseDatos } = require("../src/main/basedatos");
const { crearServicio } = require("../src/main/servicio");
const { MALLA } = require("../src/datos/malla");

function nuevo() {
  const bd = abrirBaseDatos(":memory:");
  return { bd, servicio: crearServicio(bd) };
}

function buscar(servicio, nombre) {
  for (const semestre of servicio.semestres()) {
    const encontrada = servicio.asignaturas(semestre.id).find((a) => a.nombre === nombre);
    if (encontrada) return servicio.vista(encontrada.id);
  }
  throw new Error(`No existe ${nombre}`);
}

test("precarga los 4 semestres con todas sus asignaturas y ponderaciones que suman 100", () => {
  const { servicio } = nuevo();
  const semestres = servicio.semestres();
  assert.deepEqual(semestres.map((s) => s.nombre), ["1° Semestre", "2° Semestre", "3° Semestre", "4° Semestre"]);
  semestres.forEach((semestre, i) => {
    const asignaturas = servicio.asignaturas(semestre.id);
    assert.deepEqual(asignaturas.map((a) => a.nombre), MALLA[i].asignaturas.map((a) => a.nombre));
    for (const { id } of asignaturas) assert.equal(servicio.vista(id).porcentajeTotal, 100);
  });
});

test("una asignatura que no existe no rompe la vista ni el resumen", () => {
  const { servicio } = nuevo();
  assert.equal(servicio.vista(999999), null);
  assert.equal(servicio.resumen(999999), null);
});

test("abrir el archivo de nuevo conserva las notas y no duplica asignaturas", (t) => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "notaclara-"));
  t.after(() => fs.rmSync(carpeta, { recursive: true, force: true }));
  const ruta = path.join(carpeta, "notaclara.sqlite");

  let bd = abrirBaseDatos(ruta);
  let servicio = crearServicio(bd);
  const vista = buscar(servicio, "Formación Ciudadana");
  servicio.guardarNota(vista.evaluaciones[0].id, "6,5");
  bd.cerrar();

  bd = abrirBaseDatos(ruta);
  servicio = crearServicio(bd);
  assert.equal(servicio.asignaturas(servicio.semestres()[0].id).length, 5);
  assert.equal(buscar(servicio, "Formación Ciudadana").evaluaciones[0].nota, "6,5");
  bd.cerrar();
});

test("migra una base anterior sin perder notas ni la columna antigua del examen", (t) => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "notaclara-migracion-"));
  let bd = null;
  // Windows no deja borrar el archivo mientras esté abierto: primero se cierra
  t.after(() => {
    bd?.cerrar();
    fs.rmSync(carpeta, { recursive: true, force: true });
  });
  const ruta = path.join(carpeta, "notaclara.sqlite");
  const anterior = new Database(ruta);
  anterior.exec(`
    CREATE TABLE semestre (
      id INTEGER PRIMARY KEY, numero INTEGER NOT NULL UNIQUE, nombre TEXT NOT NULL
    );
    CREATE TABLE asignatura (
      id INTEGER PRIMARY KEY, semestre_id INTEGER NOT NULL REFERENCES semestre(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL, tipo TEXT NOT NULL CHECK (tipo IN ('practica', 'lectiva')),
      ponderacion_libre INTEGER NOT NULL DEFAULT 0, siempre_libre INTEGER NOT NULL DEFAULT 0,
      orden INTEGER NOT NULL, UNIQUE (semestre_id, nombre)
    );
    CREATE TABLE evaluacion (
      id INTEGER PRIMARY KEY, asignatura_id INTEGER NOT NULL REFERENCES asignatura(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL, porcentaje INTEGER NOT NULL CHECK (porcentaje BETWEEN 0 AND 100),
      nota INTEGER CHECK (nota IS NULL OR nota BETWEEN 10 AND 70), orden INTEGER NOT NULL
    );
    CREATE TABLE estado_examen (
      asignatura_id INTEGER PRIMARY KEY REFERENCES asignatura(id) ON DELETE CASCADE,
      nota_examen INTEGER CHECK (nota_examen IS NULL OR nota_examen BETWEEN 10 AND 70),
      falta_justificada INTEGER NOT NULL DEFAULT 0 CHECK (falta_justificada IN (0, 1))
    );
    INSERT INTO semestre VALUES (1, 2, '2° Semestre');
    INSERT INTO asignatura VALUES (1, 1, 'Administración', 'lectiva', 0, 0, 1);
    INSERT INTO evaluacion VALUES (1, 1, 'EV1', 20, 10, 1);
    INSERT INTO estado_examen VALUES (1, 25, 1);
  `);
  anterior.close();

  bd = abrirBaseDatos(ruta);
  const servicio = crearServicio(bd);
  const vista = servicio.vista(1);
  assert.equal(vista.evaluaciones[0].nota, "1,0");
  assert.equal(vista.evaluaciones[0].inasistenciaJustificada, false);
  assert.equal(vista.examen.nota, "2,5");
  assert.equal(
    bd.asignatura(1).evaluaciones[0].inasistencia_justificada,
    0,
  );
});

test("una base con varias pruebas justificadas en la misma asignatura conserva solo la primera", (t) => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "notaclara-varias-"));
  let bd = null;
  t.after(() => {
    bd?.cerrar();
    fs.rmSync(carpeta, { recursive: true, force: true });
  });
  const ruta = path.join(carpeta, "notaclara.sqlite");

  bd = abrirBaseDatos(ruta);
  const { id } = buscar(crearServicio(bd), "Administración").asignatura;
  const { evaluaciones } = bd.asignatura(id);
  bd.guardarInasistenciaJustificada(evaluaciones[1].id, true);
  bd.guardarInasistenciaJustificada(evaluaciones[2].id, true);
  bd.cerrar();

  bd = abrirBaseDatos(ruta);
  const marcas = bd.asignatura(id).evaluaciones.map((evaluacion) => evaluacion.inasistencia_justificada);
  assert.deepEqual(marcas, [0, 1, 0, 0]);
});

test("guarda notas válidas y rechaza notas de dos decimales sin guardarlas", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Formación Ciudadana");
  const ev1 = vista.evaluaciones[0].id;

  let r = servicio.guardarNota(ev1, "5.5");
  assert.equal(r.valida, true);
  assert.equal(r.vista.evaluaciones[0].nota, "5,5");

  r = servicio.guardarNota(ev1, "6,34");
  assert.equal(r.valida, false);
  assert.equal(r.mensaje, "Nota inválida. Ingrese un número con UN solo decimal.");
  assert.equal(r.vista.evaluaciones[0].nota, "5,5");

  r = servicio.guardarNota(ev1, "7,77");
  assert.equal(r.valida, false);
  assert.equal(r.vista.evaluaciones[0].nota, "5,5");

  r = servicio.guardarNota(ev1, "7,0");
  assert.equal(r.valida, true);
  assert.equal(r.vista.evaluaciones[0].nota, "7,0");

  r = servicio.guardarNota(ev1, "");
  assert.equal(r.vista.evaluaciones[0].nota, "");
});

test("el mensaje dice en una frase la nota que falta y en qué evaluaciones", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Formación Ciudadana");
  servicio.guardarNota(vista.evaluaciones[0].id, "3,0");

  const resultado = servicio.vista(vista.asignatura.id).resultado;
  assert.equal(resultado.mensaje, `Para aprobar necesitas un ${resultado.notaNecesaria} en EV2, EV3 y EV4.`);
});

test("el mensaje nombra la única evaluación pendiente", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Formación Ciudadana");
  for (const evaluacion of vista.evaluaciones.slice(0, 3)) {
    servicio.guardarNota(evaluacion.id, "3,0");
  }

  const resultado = servicio.vista(vista.asignatura.id).resultado;
  assert.equal(resultado.mensaje, `Para aprobar necesitas un ${resultado.notaNecesaria} en EV4.`);
});

test("el mensaje no nombra evaluaciones de 0 % sin nota", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Formación Ciudadana");
  servicio.cambiarPonderacionLibre(vista.asignatura.id, true);
  servicio.agregarEvaluacion(vista.asignatura.id);
  for (const evaluacion of vista.evaluaciones.slice(0, 3)) {
    servicio.guardarNota(evaluacion.id, "3,0");
  }

  const resultado = servicio.vista(vista.asignatura.id).resultado;
  assert.equal(resultado.mensaje, `Para aprobar necesitas un ${resultado.notaNecesaria} en EV4.`);
});

test("en una lectiva el mensaje habla de eximirse", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Administración");
  for (const evaluacion of vista.evaluaciones.slice(0, 3)) {
    servicio.guardarNota(evaluacion.id, "4,5");
  }

  const resultado = servicio.vista(vista.asignatura.id).resultado;
  assert.equal(resultado.mensaje, `Para eximirte necesitas un ${resultado.notaNecesaria} en EV4.`);
});

test("con más de tres evaluaciones pendientes no las nombra una por una", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Resolución de Problemas en Álgebra");
  servicio.guardarNota(vista.evaluaciones[0].id, "4,0");

  const resultado = servicio.vista(vista.asignatura.id).resultado;
  assert.equal(resultado.mensaje, `Para eximirte necesitas un ${resultado.notaNecesaria} en cada evaluación que falta.`);
});

/** Administración (lectiva, 20/25/25/30) con 1,0 en EV1 y 5,5 en el resto: acumulada 4,6, va a examen. */
function administracionConFalta(servicio) {
  const vista = buscar(servicio, "Administración");
  servicio.guardarNota(vista.evaluaciones[0].id, "1,0");
  for (const evaluacion of vista.evaluaciones.slice(1)) servicio.guardarNota(evaluacion.id, "5,5");
  return servicio.vista(vista.asignatura.id);
}

const MENSAJE_BLOQUEADA =
  "Esta nota se completó con la nota del examen. Para modificarla, borra primero la nota del examen.";

test("lectiva: justificar la falta deja el estado en morado esperando el examen", () => {
  const { servicio } = nuevo();
  const vista = administracionConFalta(servicio);
  assert.equal(vista.resultado.promedio, "4,6");
  assert.equal(vista.evaluaciones[0].puedeJustificarInasistencia, true);
  assert.equal(vista.evaluaciones[1].puedeJustificarInasistencia, false);

  const respuesta = servicio.justificarInasistencia(vista.evaluaciones[0].id, true);
  assert.equal(respuesta.valida, true);
  const { resultado, evaluaciones } = respuesta.vista;
  assert.equal(resultado.estado, "justificada");
  assert.equal(resultado.color, "morado");
  assert.equal(resultado.titulo, "Falta justificada");
  assert.equal(
    resultado.mensaje,
    "Ya justificaste la falta a la prueba. Coloca la nota del examen final para calcular el promedio final.",
  );
  assert.equal(resultado.examen.necesaria, "1,7");
  assert.equal(evaluaciones[0].nota, "1,0");
  assert.equal(evaluaciones[0].inasistenciaJustificada, true);
  assert.equal(evaluaciones[0].bloqueadaPorExamen, false);
  assert.equal(servicio.resumen(vista.asignatura.id).color, "morado");
});

test("lectiva: con examen la prueba justificada toma esa nota y queda bloqueada", () => {
  const { servicio } = nuevo();
  const vista = administracionConFalta(servicio);
  const id = vista.asignatura.id;
  const prueba = vista.evaluaciones[0].id;
  servicio.justificarInasistencia(prueba, true);

  // presentación = 4,6 + (2,0 − 1,0) × 0,2 = 4,8 ; final = 4,8 × 0,75 + 2,0 × 0,25 = 4,1
  let respuesta = servicio.guardarNotaExamen(id, "2,0");
  assert.equal(respuesta.vista.resultado.titulo, "Aprobado");
  assert.equal(respuesta.vista.resultado.promedio, "4,8");
  assert.equal(respuesta.vista.resultado.examen.final, "4,1");
  assert.equal(respuesta.vista.evaluaciones[0].nota, "2,0");
  assert.equal(respuesta.vista.evaluaciones[0].bloqueadaPorExamen, true);

  // La casilla bloqueada no acepta cambios y la nota guardada sigue siendo 1,0
  respuesta = servicio.guardarNota(prueba, "6,0");
  assert.equal(respuesta.valida, false);
  assert.equal(respuesta.mensaje, MENSAJE_BLOQUEADA);
  assert.equal(servicio.vista(id).evaluaciones[0].inasistenciaJustificada, true);

  // Quitar la justificación se rechaza mientras haya nota de examen
  respuesta = servicio.justificarInasistencia(prueba, false);
  assert.equal(respuesta.valida, false);
  assert.equal(respuesta.mensaje, MENSAJE_BLOQUEADA);
  assert.equal(respuesta.vista.evaluaciones[0].inasistenciaJustificada, true);
});

test("lectiva: al borrar el examen vuelve el 1,0 y el estado morado", () => {
  const { servicio } = nuevo();
  const vista = administracionConFalta(servicio);
  const id = vista.asignatura.id;
  const prueba = vista.evaluaciones[0].id;
  servicio.justificarInasistencia(prueba, true);
  servicio.guardarNotaExamen(id, "6,0");

  const actual = servicio.guardarNotaExamen(id, "").vista;
  assert.equal(actual.resultado.estado, "justificada");
  assert.equal(actual.resultado.color, "morado");
  assert.equal(actual.evaluaciones[0].nota, "1,0");
  assert.equal(actual.evaluaciones[0].bloqueadaPorExamen, false);

  // Sin examen sí se puede quitar la justificación, y todo vuelve a como estaba
  const respuesta = servicio.justificarInasistencia(prueba, false);
  assert.equal(respuesta.valida, true);
  assert.equal(respuesta.vista.evaluaciones[0].inasistenciaJustificada, false);
  assert.equal(respuesta.vista.resultado.estado, "examen");
  assert.equal(respuesta.vista.resultado.promedio, "4,6");
});

test("lectiva: si se borra otra nota con examen puesto, la prueba justificada vuelve al 1,0 y se desbloquea", () => {
  const { servicio } = nuevo();
  const vista = administracionConFalta(servicio);
  const id = vista.asignatura.id;
  const prueba = vista.evaluaciones[0].id;
  servicio.justificarInasistencia(prueba, true);
  servicio.guardarNotaExamen(id, "6,0");

  // Sin EV4 el examen no se usa: la casilla muestra el 1,0 con que se calcula el promedio
  let actual = servicio.guardarNota(vista.evaluaciones[3].id, "").vista;
  assert.equal(actual.resultado.completo, false);
  assert.equal(actual.evaluaciones[0].nota, "1,0");
  assert.equal(actual.evaluaciones[0].bloqueadaPorExamen, false);
  assert.equal(actual.evaluaciones[0].inasistenciaJustificada, true);

  // Al completar de nuevo, vuelve a usarse el examen y la casilla se bloquea otra vez
  // presentación = 4,6 + (6,0 − 1,0) × 0,2 = 5,6 ; final = 5,6 × 0,75 + 6,0 × 0,25 = 5,7
  actual = servicio.guardarNota(vista.evaluaciones[3].id, "5,5").vista;
  assert.equal(actual.evaluaciones[0].nota, "6,0");
  assert.equal(actual.evaluaciones[0].bloqueadaPorExamen, true);
  assert.equal(actual.resultado.examen.final, "5,7");
});

test("lectiva: con una nota borrada se puede quitar la justificación aunque haya examen", () => {
  const { servicio } = nuevo();
  const vista = administracionConFalta(servicio);
  const prueba = vista.evaluaciones[0].id;
  servicio.justificarInasistencia(prueba, true);
  servicio.guardarNotaExamen(vista.asignatura.id, "6,0");
  servicio.guardarNota(vista.evaluaciones[3].id, "");

  const respuesta = servicio.justificarInasistencia(prueba, false);
  assert.equal(respuesta.valida, true);
  assert.equal(respuesta.vista.evaluaciones[0].inasistenciaJustificada, false);
});

test("lectiva: una evaluación nueva de 0 % no desbloquea la prueba justificada mientras el examen se usa", () => {
  const { servicio } = nuevo();
  const vista = administracionConFalta(servicio);
  const id = vista.asignatura.id;
  const prueba = vista.evaluaciones[0].id;
  servicio.justificarInasistencia(prueba, true);
  servicio.guardarNotaExamen(id, "6,0");
  servicio.cambiarPonderacionLibre(id, true);

  // Los porcentajes ya suman 100, así que la evaluación nueva vale 0 % y el cálculo sigue completo
  const actual = servicio.agregarEvaluacion(id);
  assert.equal(actual.evaluaciones.at(-1).porcentaje, 0);
  assert.equal(actual.resultado.completo, true);
  assert.equal(actual.resultado.examen.final, "5,7");
  // La casilla muestra la nota con que se calcula (el examen) y sigue bloqueada
  assert.equal(actual.evaluaciones[0].nota, "6,0");
  assert.equal(actual.evaluaciones[0].bloqueadaPorExamen, true);
  assert.equal(servicio.guardarNota(prueba, "6,0").valida, false);
  assert.equal(servicio.justificarInasistencia(prueba, false).valida, false);
});

test("solo se puede justificar una prueba por asignatura", () => {
  const { servicio } = nuevo();
  let vista = buscar(servicio, "Administración");
  const id = vista.asignatura.id;
  const [primera, segunda, ...restantes] = vista.evaluaciones;

  servicio.guardarNota(primera.id, "1,0");
  // Con evaluaciones pendientes todavía no se puede justificar
  assert.equal(servicio.justificarInasistencia(primera.id, true).valida, false);

  servicio.guardarNota(segunda.id, "1,0");
  for (const evaluacion of restantes) servicio.guardarNota(evaluacion.id, "5,5");
  vista = servicio.vista(id);
  assert.equal(vista.evaluaciones[0].puedeJustificarInasistencia, true);
  assert.equal(vista.evaluaciones[1].puedeJustificarInasistencia, true);

  const respuesta = servicio.justificarInasistencia(primera.id, true);
  assert.equal(respuesta.valida, true);
  assert.equal(respuesta.vista.evaluaciones[1].puedeJustificarInasistencia, false);

  const otra = servicio.justificarInasistencia(segunda.id, true);
  assert.equal(otra.valida, false);
  assert.equal(otra.vista.evaluaciones[1].inasistenciaJustificada, false);
});

test("prácticas: no se ofrece justificar y el 1,0 queda tal cual", () => {
  const { servicio } = nuevo();
  let vista = buscar(servicio, "Formación Ciudadana");
  servicio.guardarNota(vista.evaluaciones[0].id, "1,0");
  for (const evaluacion of vista.evaluaciones.slice(1)) servicio.guardarNota(evaluacion.id, "3,0");

  vista = servicio.vista(vista.asignatura.id);
  assert.equal(vista.asignatura.tipo, "practica");
  assert.ok(vista.evaluaciones.every((evaluacion) => !evaluacion.puedeJustificarInasistencia));
  const respuesta = servicio.justificarInasistencia(vista.evaluaciones[0].id, true);
  assert.equal(respuesta.valida, false);
  assert.equal(respuesta.vista.evaluaciones[0].inasistenciaJustificada, false);
  assert.equal(respuesta.vista.resultado.estado, "reprobado");
});

test("si la acumulada sube a 4,945 o más se quita la justificación", () => {
  const { servicio } = nuevo();
  const vista = administracionConFalta(servicio);
  servicio.justificarInasistencia(vista.evaluaciones[0].id, true);

  // 1,0×0,20 + 7,0×0,25 + 5,5×0,25 + 5,5×0,30 = 4,975
  const actual = servicio.guardarNota(vista.evaluaciones[1].id, "7,0").vista;
  assert.equal(actual.evaluaciones[0].inasistenciaJustificada, false);
  assert.equal(actual.resultado.estado, "eximido");
});

test("no ofrece justificar el 1,0 si el promedio completo llega a 4,945", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Funciones y Matrices");
  servicio.guardarNota(vista.evaluaciones[0].id, "1,0");
  for (const evaluacion of vista.evaluaciones.slice(1)) servicio.guardarNota(evaluacion.id, "6,0");

  const actual = servicio.vista(vista.asignatura.id);
  assert.equal(actual.resultado.promedio, "5,0");
  assert.equal(actual.evaluaciones[0].puedeJustificarInasistencia, false);
  const respuesta = servicio.justificarInasistencia(actual.evaluaciones[0].id, true);
  assert.equal(respuesta.valida, false);
  assert.equal(respuesta.vista.evaluaciones[0].inasistenciaJustificada, false);
});

test("cambiar la nota de la prueba justificada quita la justificación", () => {
  const { servicio } = nuevo();
  let vista = buscar(servicio, "Administración");
  servicio.guardarNota(vista.evaluaciones[0].id, "1,0");
  for (const evaluacion of vista.evaluaciones.slice(1)) servicio.guardarNota(evaluacion.id, "5,5");
  vista = servicio.vista(vista.asignatura.id);
  servicio.justificarInasistencia(vista.evaluaciones[0].id, true);

  const actualizada = servicio.guardarNota(vista.evaluaciones[0].id, "5,0").vista;
  assert.equal(actualizada.evaluaciones[0].inasistenciaJustificada, false);
  assert.equal(actualizada.evaluaciones[0].nota, "5,0");
});

test("ponderación libre: editar, agregar, eliminar y restaurar conservando notas", () => {
  const { servicio } = nuevo();
  let vista = buscar(servicio, "Programación Front End");
  const id = vista.asignatura.id;

  // Sin ponderación libre no se puede editar
  servicio.cambiarPorcentaje(vista.evaluaciones[0].id, "50");
  assert.equal(servicio.vista(id).evaluaciones[0].porcentaje, 15);

  servicio.guardarNota(vista.evaluaciones[0].id, "6,0");
  vista = servicio.cambiarPonderacionLibre(id, true);
  assert.equal(vista.asignatura.ponderacionLibre, true);
  assert.equal(vista.asignatura.ponderacionModificada, false);

  vista = servicio.cambiarPorcentaje(vista.evaluaciones[3].id, "15").vista;
  assert.equal(vista.porcentajeTotal, 90);
  assert.equal(vista.resultado.mensaje, "Los porcentajes deben sumar 100%.");
  assert.equal(vista.asignatura.ponderacionModificada, true);

  vista = servicio.agregarEvaluacion(id);
  assert.equal(vista.evaluaciones.length, 5);
  assert.equal(vista.evaluaciones[4].nombre, "EV5");
  assert.equal(vista.evaluaciones[4].porcentaje, 10);
  assert.equal(vista.porcentajeTotal, 100);

  assert.equal(servicio.renombrarEvaluacion(vista.evaluaciones[4].id, "  ").valida, false);
  vista = servicio.renombrarEvaluacion(vista.evaluaciones[4].id, "Disertación").vista;
  assert.equal(vista.evaluaciones[4].nombre, "Disertación");

  vista = servicio.eliminarEvaluacion(vista.evaluaciones[4].id);
  assert.equal(vista.evaluaciones.length, 4);

  vista = servicio.restaurarPonderacion(id);
  assert.deepEqual(vista.evaluaciones.map((e) => e.porcentaje), [15, 25, 35, 25]);
  assert.equal(vista.evaluaciones[0].nota, "6,0");
  assert.equal(vista.asignatura.ponderacionModificada, false);
});

test("agregar una evaluación no repite el nombre de otra", () => {
  const { servicio } = nuevo();
  let vista = buscar(servicio, "Electivo de Tendencias del Sector Productivo y de Servicios I");
  const id = vista.asignatura.id;

  vista = servicio.eliminarEvaluacion(vista.evaluaciones[1].id);
  vista = servicio.agregarEvaluacion(id);
  assert.deepEqual(vista.evaluaciones.map((e) => e.nombre), ["EV1", "EV3", "EV4", "EV5"]);

  vista = servicio.renombrarEvaluacion(vista.evaluaciones[0].id, "ev6").vista;
  vista = servicio.agregarEvaluacion(id);
  assert.equal(vista.evaluaciones[4].nombre, "EV7");
});

test("renombrar no permite repetir el nombre de otra evaluación", () => {
  const { servicio } = nuevo();
  let vista = buscar(servicio, "Electivo de Tendencias del Sector Productivo y de Servicios I");
  const segunda = vista.evaluaciones[1].id;

  let respuesta = servicio.renombrarEvaluacion(segunda, " ev1 ");
  assert.equal(respuesta.valida, false);
  assert.equal(respuesta.mensaje, "Ya existe una evaluación con ese nombre.");
  assert.equal(respuesta.vista.evaluaciones[1].nombre, "EV2");

  // Mantener su propio nombre (aunque cambien mayúsculas) sí se puede
  respuesta = servicio.renombrarEvaluacion(segunda, "ev2");
  assert.equal(respuesta.valida, true);
  assert.equal(respuesta.vista.evaluaciones[1].nombre, "ev2");
});

test("sin ponderación libre no se cambian nombres ni porcentajes", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Sistemas Operativos");
  const evaluacion = vista.evaluaciones[0];

  let respuesta = servicio.renombrarEvaluacion(evaluacion.id, "Prueba");
  assert.equal(respuesta.valida, false);
  assert.equal(respuesta.vista.evaluaciones[0].nombre, evaluacion.nombre);

  respuesta = servicio.cambiarPorcentaje(evaluacion.id, "50");
  assert.equal(respuesta.valida, false);
  assert.equal(respuesta.vista.evaluaciones[0].porcentaje, evaluacion.porcentaje);
});

test("las prácticas no aceptan nota de examen", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Sistemas Operativos");
  const respuesta = servicio.guardarNotaExamen(vista.asignatura.id, "7,0");
  assert.equal(respuesta.valida, false);
  assert.equal(respuesta.vista.examen.nota, "");
});

test("desactivar la ponderación libre vuelve a la original", () => {
  const { servicio } = nuevo();
  let vista = buscar(servicio, "Sistemas Operativos");
  const id = vista.asignatura.id;
  vista = servicio.cambiarPonderacionLibre(id, true);
  servicio.cambiarPorcentaje(vista.evaluaciones[0].id, "40");
  vista = servicio.cambiarPonderacionLibre(id, false);
  assert.equal(vista.asignatura.ponderacionLibre, false);
  assert.deepEqual(vista.evaluaciones.map((e) => e.porcentaje), [15, 30, 30, 25]);
});

test("los electivos vienen siempre con ponderación libre", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Electivo de Tendencias del Sector Productivo y de Servicios I");
  assert.equal(vista.asignatura.ponderacionLibre, true);
  assert.equal(vista.asignatura.siempreLibre, true);
  assert.equal(vista.asignatura.tipo, "lectiva");
  const despues = servicio.cambiarPonderacionLibre(vista.asignatura.id, false);
  assert.equal(despues.asignatura.ponderacionLibre, true);
});
