// Pruebas del guardado y de la ponderación libre, con un archivo de notas en memoria.
const test = require("node:test");
const assert = require("node:assert/strict");
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

test("guarda una nota al escribirla y rechaza una inválida sin guardarla", () => {
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

  r = servicio.guardarNota(ev1, "");
  assert.equal(r.vista.evaluaciones[0].nota, "");
});

test("lectiva: examen y falta justificada se guardan y se pueden deshacer", () => {
  const { servicio } = nuevo();
  let vista = buscar(servicio, "Administración");
  const id = vista.asignatura.id;
  for (const evaluacion of vista.evaluaciones) servicio.guardarNota(evaluacion.id, "4,5");

  vista = servicio.vista(id);
  assert.equal(vista.resultado.color, "amarillo");
  assert.equal(vista.resultado.examen.necesaria, "2,3");

  vista = servicio.guardarNotaExamen(id, "2,3").vista;
  assert.equal(vista.resultado.titulo, "Aprobado");
  assert.equal(vista.resultado.examen.final, "4,0");

  vista = servicio.guardarNotaExamen(id, "").vista;
  vista = servicio.justificarFalta(id, true);
  assert.equal(vista.resultado.titulo, "Aprobado");
  assert.equal(vista.resultado.faltaJustificada, true);

  vista = servicio.justificarFalta(id, false);
  assert.equal(vista.resultado.titulo, "Vas a examen");
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
