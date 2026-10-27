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
  t.after(() => fs.rmSync(carpeta, { recursive: true, force: true }));
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

  const bd = abrirBaseDatos(ruta);
  t.after(() => bd.cerrar());
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

test("el mensaje destaca las dos últimas evaluaciones pendientes y la nota requerida", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Formación Ciudadana");
  servicio.guardarNota(vista.evaluaciones[0].id, "3,0");

  const resultado = servicio.vista(vista.asignatura.id).resultado;
  assert.match(resultado.mensaje, new RegExp(`EV3: ${resultado.notaNecesaria} y EV4: ${resultado.notaNecesaria}`));
  assert.doesNotMatch(resultado.mensaje, /EV2:/);
  assert.match(resultado.mensaje, /misma nota en todas las pendientes/);
});

test("el mensaje nombra la única evaluación pendiente", () => {
  const { servicio } = nuevo();
  const vista = buscar(servicio, "Formación Ciudadana");
  for (const evaluacion of vista.evaluaciones.slice(0, 3)) {
    servicio.guardarNota(evaluacion.id, "3,0");
  }

  const resultado = servicio.vista(vista.asignatura.id).resultado;
  assert.match(
    resultado.mensaje,
    new RegExp(`la última pendiente es: EV4: ${resultado.notaNecesaria}`),
  );
});

test("lectiva: conserva el 1,0 justificado y agrega una sola nota de examen final", () => {
  const { servicio } = nuevo();
  let vista = buscar(servicio, "Administración");
  const id = vista.asignatura.id;
  servicio.guardarNota(vista.evaluaciones[0].id, "1,0");
  for (const evaluacion of vista.evaluaciones.slice(1)) servicio.guardarNota(evaluacion.id, "5,5");

  vista = servicio.vista(id);
  assert.equal(vista.resultado.promedio, "4,6");
  assert.equal(vista.evaluaciones[0].puedeJustificarInasistencia, true);
  assert.equal(vista.evaluaciones[1].puedeJustificarInasistencia, false);

  let respuesta = servicio.justificarInasistencia(vista.evaluaciones[0].id, true);
  assert.equal(respuesta.valida, true);
  assert.equal(respuesta.vista.evaluaciones[0].nota, "1,0");
  assert.equal(respuesta.vista.evaluaciones[0].inasistenciaJustificada, true);
  assert.equal(respuesta.vista.resultado.promedio, "4,6");
  assert.equal(respuesta.vista.resultado.examen.necesaria, "2,0");

  respuesta = servicio.guardarNotaExamen(id, "2,0");
  assert.equal(respuesta.vista.resultado.titulo, "Aprobado");
  assert.equal(respuesta.vista.resultado.examen.final, "4,0");
  assert.equal(respuesta.vista.evaluaciones[0].nota, "1,0");
  assert.equal(respuesta.vista.evaluaciones[0].inasistenciaJustificada, true);

  respuesta = servicio.justificarInasistencia(vista.evaluaciones[0].id, false);
  assert.equal(respuesta.valida, true);
  assert.equal(respuesta.vista.evaluaciones[0].inasistenciaJustificada, false);
});

test("permite justificar varias notas 1,0 por separado y no adelanta el examen", () => {
  const { servicio } = nuevo();
  let vista = buscar(servicio, "Administración");
  const id = vista.asignatura.id;
  const [primera, segunda, ...restantes] = vista.evaluaciones;

  servicio.guardarNota(primera.id, "1,0");
  let respuesta = servicio.justificarInasistencia(primera.id, true);
  assert.equal(respuesta.valida, false);
  assert.equal(respuesta.vista.evaluaciones[0].puedeJustificarInasistencia, false);

  servicio.guardarNota(segunda.id, "1,0");
  for (const evaluacion of restantes) servicio.guardarNota(evaluacion.id, "5,5");

  vista = servicio.vista(id);
  assert.equal(vista.evaluaciones[0].puedeJustificarInasistencia, true);
  assert.equal(vista.evaluaciones[1].puedeJustificarInasistencia, true);
  assert.equal(servicio.justificarInasistencia(primera.id, true).valida, true);
  respuesta = servicio.justificarInasistencia(segunda.id, true);
  assert.equal(respuesta.valida, true);
  assert.equal(respuesta.vista.evaluaciones[0].inasistenciaJustificada, true);
  assert.equal(respuesta.vista.evaluaciones[1].inasistenciaJustificada, true);
  assert.equal(respuesta.vista.examen.nota, "");
  assert.equal(respuesta.vista.resultado.examen.necesaria, "5,3");
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

test("editar una evaluación ya no mantiene una justificación de inasistencia obsoleta", () => {
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
