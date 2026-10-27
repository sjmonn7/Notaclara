// Pruebas de src/logica/calculos.js. Ejecutar con: npm test
const test = require("node:test");
const assert = require("node:assert/strict");

const c = require("../src/logica/calculos");

/** Arma evaluaciones a partir de pares [nota, porcentaje]. La nota va como texto ("4,5") o null. */
function evaluaciones(...pares) {
  return pares.map(([nota, porcentaje]) => ({ nota: nota === null ? null : c.validarNota(nota).valor, porcentaje }));
}

function calcular(tipo, pares, extra = {}) {
  return c.calcularAsignatura({ tipo, evaluaciones: evaluaciones(...pares), notaExamen: null, ...extra });
}

const nota = c.formatearNota;

// ---------- Migradas de test_calculos.py ----------

test.describe("cálculos básicos (migrados de la versión en Python)", () => {
  // Ejemplo: 7,0 al 50 %, 3,0 al 25 % y un examen del 25 % pendiente
  const EJEMPLO = evaluaciones(["7,0", 50], ["3,0", 25], [null, 25]);

  test("aporte", () => {
    assert.equal(c.aporte(70, 50), 3500); // 3,5
    assert.equal(c.aporte(30, 25), 750); // 0,75
  });

  test("nota acumulada", () => {
    assert.equal(c.notaAcumulada(EJEMPLO), 4250); // 4,25
  });

  test("porcentaje evaluado", () => {
    assert.equal(c.porcentajeEvaluado(EJEMPLO), 75);
  });

  test("nota necesaria asegurada", () => {
    const necesaria = c.notaNecesaria(4250, 25, c.APROBAR);
    assert.ok(necesaria <= c.NOTA_MINIMA);
    assert.equal(c.estadoNotaNecesaria(necesaria), "asegurada");
  });

  test("nota necesaria posible", () => {
    // 3,0 al 50 % -> acumulada 1,5; necesita 4,9 en el 50 % restante (3,0 y 4,9 dan 3,95)
    const necesaria = c.notaNecesaria(1500, 50, c.APROBAR);
    assert.equal(necesaria, 49);
    assert.equal(c.estadoNotaNecesaria(necesaria), "posible");
  });

  test("nota necesaria imposible", () => {
    // 1,0 al 80 % -> acumulada 0,8; necesitaría 15,8 en el 20 % restante
    const necesaria = c.notaNecesaria(800, 20, c.APROBAR);
    assert.equal(c.estadoNotaNecesaria(necesaria), "imposible");
  });

  test("sin porcentaje pendiente", () => {
    assert.equal(c.notaNecesaria(4500, 0, c.APROBAR), null);
  });
});

// ---------- Redondeo chileno ----------

test.describe("redondeo chileno", () => {
  test("4,945 -> 5,0", () => assert.equal(nota(c.redondear(4945)), "5,0"));
  test("3,945 -> 4,0", () => assert.equal(nota(c.redondear(3945)), "4,0"));
  test("4,944 -> 4,9", () => assert.equal(nota(c.redondear(4944)), "4,9"));
  test("3,944 -> 3,9", () => assert.equal(nota(c.redondear(3944)), "3,9"));
  test("6,95 -> 7,0", () => assert.equal(nota(c.redondear(6950)), "7,0"));
  test("promedio de lo ingresado con fracción: 4,9466... -> 4,95 -> 5,0", () => {
    // (4,9 × 2 + 5,04) / 3 no es exacto: 14840 / 3 milésimas
    assert.equal(nota(c.redondearFraccion(14840, 3)), "5,0");
  });
});

// ---------- Validación de notas ----------

test.describe("validación de notas", () => {
  test("6,34 se rechaza con el mensaje de un solo decimal", () => {
    const r = c.validarNota("6,34");
    assert.equal(r.valida, false);
    assert.equal(r.mensaje, "Nota inválida. Ingrese un número con UN solo decimal.");
  });

  test("6,3 y 6.3 se aceptan", () => {
    assert.deepEqual([c.validarNota("6,3").valida, c.validarNota("6,3").valor], [true, 63]);
    assert.deepEqual([c.validarNota("6.3").valida, c.validarNota("6.3").valor], [true, 63]);
  });

  test("7,1 y 0,9 se rechazan con el mensaje de rango", () => {
    for (const texto of ["7,1", "0,9"]) {
      const r = c.validarNota(texto);
      assert.equal(r.valida, false, texto);
      assert.equal(r.mensaje, "Nota inválida. Ingrese una nota entre 1,0 y 7,0.");
    }
  });

  test("bordes 1,0 y 7,0 se aceptan; enteros también", () => {
    assert.equal(c.validarNota("1,0").valor, 10);
    assert.equal(c.validarNota("7,0").valor, 70);
    assert.equal(c.validarNota("7").valor, 70);
    assert.equal(c.validarNota(" 5 ").valor, 50);
  });

  test("7,77 se rechaza y no se redondea a 7,0", () => {
    const r = c.validarNota("7,77");
    assert.equal(r.valida, false);
    assert.equal(r.mensaje, c.MENSAJE_DECIMALES);
  });

  test("vacío deja la evaluación pendiente", () => {
    assert.deepEqual([c.validarNota("").valida, c.validarNota("").valor], [true, null]);
  });

  test("texto que no es número se rechaza", () => {
    assert.equal(c.validarNota("abc").valida, false);
    assert.equal(c.validarNota("4,5,1").valida, false);
    assert.equal(c.validarNota("-4").valida, false);
  });

  test("'4,' está incompleta (todavía escribiendo)", () => {
    const r = c.validarNota("4,");
    assert.equal(r.valida, false);
    assert.equal(r.incompleta, true);
  });

  test("las notas se muestran con coma y un decimal", () => {
    assert.equal(nota(45), "4,5");
    assert.equal(nota(70), "7,0");
    assert.equal(nota(null), "");
  });
});

// ---------- Asignatura práctica ----------

test.describe("práctica", () => {
  test("promedio 3,945 se muestra 4,0 en verde (aprobado)", () => {
    // 3,8 × 15 + 3,9 × 25 + 4,0 × 30 + 4,0 × 30 = 3,945
    const r = calcular("practica", [["3,8", 15], ["3,9", 25], ["4,0", 30], ["4,0", 30]]);
    assert.equal(nota(r.promedio), "4,0");
    assert.equal(r.color, "verde");
    assert.equal(r.titulo, "Aprobado");
  });

  test("promedio 3,944 se muestra 3,9 en rojo (reprobado)", () => {
    // 6,1 × 2 + 3,9 × 98 = 3,944
    const r = calcular("practica", [["6,1", 2], ["3,9", 98]]);
    assert.equal(nota(r.promedio), "3,9");
    assert.equal(r.color, "rojo");
    assert.equal(r.titulo, "Reprobado");
  });

  test("con notas pendientes donde ni con 7,0 alcanza -> reprobado", () => {
    // 1,0 en el 70 % evaluado: aunque saque 7,0 en el 30 % llega a 2,8
    const r = calcular("practica", [["1,0", 15], ["1,0", 25], ["1,0", 30], [null, 30]]);
    assert.equal(r.completo, false);
    assert.equal(r.color, "rojo");
    assert.equal(r.titulo, "Reprobado");
  });

  test("con notas pendientes muestra la nota necesaria (hacia arriba)", () => {
    // 3,0 × 50 = 1,5 -> necesita 4,9 en el 50 % restante
    const r = calcular("practica", [["3,0", 50], [null, 50]]);
    assert.equal(r.estado, "en-curso");
    assert.equal(r.color, "gris");
    assert.equal(nota(r.notaNecesaria), "4,9");
  });

  test("nota necesaria mínima es 1,0 y la aprobación queda asegurada", () => {
    const r = calcular("practica", [["7,0", 70], [null, 30]]);
    assert.equal(nota(r.notaNecesaria), "1,0");
    assert.equal(r.color, "verde");
  });

  test("sin notas queda en gris", () => {
    const r = calcular("practica", [[null, 50], [null, 50]]);
    assert.equal(r.color, "gris");
    assert.equal(r.promedio, null);
  });

  test("una práctica nunca va a examen", () => {
    const r = calcular("practica", [["3,0", 100]]);
    assert.equal(r.examen, null);
  });
});

// ---------- Asignatura lectiva ----------

test.describe("lectiva", () => {
  test("promedio 4,945 se muestra 5,0 (eximido)", () => {
    // 5,8 × 5 + 4,9 × 95 = 4,945
    const r = calcular("lectiva", [["5,8", 5], ["4,9", 95]]);
    assert.equal(nota(r.promedio), "5,0");
    assert.equal(r.color, "verde");
    assert.equal(r.titulo, "Eximido");
  });

  test("promedio 4,944 se muestra 4,9 y va a examen", () => {
    // 2,2 × 2 + 5,0 × 98 = 4,944
    const r = calcular("lectiva", [["2,2", 2], ["5,0", 98]]);
    assert.equal(nota(r.promedio), "4,9");
    assert.equal(r.color, "amarillo");
    assert.equal(r.titulo, "Vas a examen");
  });

  const PRESENTACION_45 = [["4,5", 20], ["4,5", 25], ["4,5", 25], ["4,5", 30]];

  test("presentación 4,5 -> examen mínimo 2,3", () => {
    const r = calcular("lectiva", PRESENTACION_45);
    assert.equal(r.color, "amarillo");
    assert.equal(nota(r.promedio), "4,5");
    assert.equal(nota(r.examen.necesaria), "2,3");
  });

  test("presentación 4,5 con examen 2,3 aprueba", () => {
    const r = calcular("lectiva", PRESENTACION_45, { notaExamen: 23 });
    assert.equal(r.color, "verde");
    assert.equal(r.titulo, "Aprobado");
    assert.equal(nota(r.examen.final), "4,0"); // 3,375 + 0,575 = 3,95
  });

  test("presentación 4,5 con examen 2,2 reprueba", () => {
    const r = calcular("lectiva", PRESENTACION_45, { notaExamen: 22 });
    assert.equal(r.color, "rojo");
    assert.equal(r.titulo, "Reprobado");
    assert.equal(nota(r.examen.final), "3,9"); // 3,375 + 0,55 = 3,925
  });

  test("el examen usa la presentación redondeada", () => {
    // 4,47 -> 4,5: con examen 2,3 aprueba igual que con 4,5 exacto
    const r = calcular("lectiva", [["4,4", 30], ["4,5", 70]], { notaExamen: 23 }); // 1,32 + 3,15 = 4,47
    assert.equal(nota(r.promedio), "4,5");
    assert.equal(r.titulo, "Aprobado");
  });

  test("presentación 1,0 -> examen necesario mayor a 7,0 -> reprobado", () => {
    const r = calcular("lectiva", [["1,0", 50], ["1,0", 50]]);
    assert.ok(c.examenNecesario(10) > c.NOTA_MAXIMA);
    assert.equal(r.color, "rojo");
    assert.equal(r.titulo, "Reprobado");
  });

  test("presentación 3,0 todavía puede aprobar con 6,8 en el examen", () => {
    const r = calcular("lectiva", [["3,0", 100]]);
    assert.equal(r.color, "amarillo");
    assert.equal(nota(r.examen.necesaria), "6,8");
  });

  test("con notas pendientes muestra la nota necesaria para eximirse", () => {
    // 5,0 × 50 = 2,5 -> necesita 4,9 en el 50 % restante para llegar a 4,945
    const r = calcular("lectiva", [["5,0", 50], [null, 50]]);
    assert.equal(r.estado, "en-curso");
    assert.equal(nota(r.notaNecesaria), "4,9");
  });

  test("con notas pendientes y eximición imposible -> vas a examen", () => {
    // 2,0 × 70 = 1,4; con 7,0 en el 30 % llega a 3,5 (no se exime, pero puede aprobar con examen)
    const r = calcular("lectiva", [["2,0", 70], [null, 30]]);
    assert.equal(r.color, "amarillo");
    assert.equal(r.titulo, "Vas a examen");
  });

  test("con notas pendientes donde ni con 7,0 en todo y en el examen alcanza -> reprobado", () => {
    // 1,0 × 90 = 0,9; con 7,0 en el 10 % llega a 1,6 -> 1,2 + 1,75 = 2,95 < 3,945
    const r = calcular("lectiva", [["1,0", 90], [null, 10]]);
    assert.equal(r.color, "rojo");
    assert.equal(r.titulo, "Reprobado");
  });
});

// ---------- Prueba inasistida ----------

test.describe("prueba inasistida", () => {
  test("mantiene el 1,0 en la presentación y agrega el examen como 25 %", () => {
    const r = calcular("lectiva", [
      ["1,0", 20],
      ["5,5", 25],
      ["5,5", 25],
      ["5,5", 30],
    ]);
    assert.equal(nota(r.promedio), "4,6");
    assert.equal(nota(r.examen.necesaria), "2,0");
    assert.equal(r.estado, "examen");

    const conExamen = calcular(
      "lectiva",
      [
        ["1,0", 20],
        ["5,5", 25],
        ["5,5", 25],
        ["5,5", 30],
      ],
      { notaExamen: 23 },
    );
    assert.equal(nota(conExamen.promedio), "4,6");
    assert.equal(nota(conExamen.examen.final), "4,0");
    assert.equal(conExamen.titulo, "Aprobado");
  });
});

// ---------- Ponderación ----------

test.describe("ponderación", () => {
  test("si los porcentajes no suman 100 no se calcula el estado", () => {
    const r = calcular("practica", [["7,0", 50], ["7,0", 40]]);
    assert.equal(r.estado, "porcentajes");
    assert.equal(r.mensaje, "Los porcentajes deben sumar 100%.");
    assert.equal(r.porcentajeTotal, 90);
  });

  test("sin evaluaciones tampoco se calcula", () => {
    assert.equal(calcular("lectiva", []).estado, "porcentajes");
  });

  test("porcentajes: enteros de 0 a 100", () => {
    assert.equal(c.validarPorcentaje("30").valor, 30);
    assert.equal(c.validarPorcentaje("30%").valor, 30);
    assert.equal(c.validarPorcentaje("101").valido, false);
    assert.equal(c.validarPorcentaje("12,5").valido, false);
    assert.equal(c.validarPorcentaje("").valido, false);
  });
});
