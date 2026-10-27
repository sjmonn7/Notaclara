// Malla de Analista Programador (INACAP): semestres, asignaturas y ponderaciones originales.
// Se usa para precargar los datos la primera vez y para "Restaurar ponderación original".

// Evaluaciones de partida de los electivos (siempre con ponderación libre)
const PONDERACION_ELECTIVO = [25, 25, 25, 25];

function asignatura(nombre, tipo, porcentajes, siempreLibre = false) {
  return {
    nombre,
    tipo,
    siempreLibre,
    evaluaciones: porcentajes.map((porcentaje, indice) => ({ nombre: `EV${indice + 1}`, porcentaje })),
  };
}

const MALLA = [
  {
    numero: 1,
    asignaturas: [
      asignatura("Formación Ciudadana", "practica", [10, 20, 35, 35]),
      asignatura("Resolución de Problemas en Álgebra", "lectiva", [5, 10, 5, 20, 5, 25, 5, 25]),
      asignatura("Introducción a la Programación Segura", "practica", [15, 25, 30, 30]),
      asignatura("Fundamentos de Base de Datos", "practica", [15, 30, 30, 25]),
      asignatura("Fundamentos de Hardware y Software", "practica", [15, 35, 30, 20]),
    ],
  },
  {
    numero: 2,
    asignaturas: [
      asignatura("Administración", "lectiva", [20, 25, 25, 30]),
      asignatura("Funciones y Matrices", "lectiva", [20, 15, 25, 40]),
      asignatura("Programación Orientada a Objeto Seguro", "practica", [15, 30, 25, 30]),
      asignatura("Bases de Datos Estructuradas", "practica", [15, 25, 30, 30]),
      asignatura("Metodología de Desarrollo Ágil", "lectiva", [20, 30, 25, 25]),
      asignatura("Modelamiento de Soluciones Informáticas", "practica", [15, 25, 30, 30]),
    ],
  },
  {
    numero: 3,
    asignaturas: [
      asignatura("Innovación y Emprendimiento I", "lectiva", [20, 25, 30, 25]),
      asignatura("Programación Front End", "practica", [15, 25, 35, 25]),
      asignatura("Bases de Datos No Estructuradas", "practica", [15, 25, 30, 30]),
      asignatura("Fundamentos de Seguridad de la Información", "lectiva", [15, 25, 30, 30]),
      asignatura("Sistemas Operativos", "practica", [15, 30, 30, 25]),
      asignatura("Electivo de Tendencias del Sector Productivo y de Servicios I", "lectiva", PONDERACION_ELECTIVO, true),
    ],
  },
  {
    numero: 4,
    asignaturas: [
      asignatura("Inglés Inicial", "lectiva", [15, 25, 30, 30]),
      asignatura("Programación Back End", "practica", [15, 25, 30, 30]),
      asignatura("Aplicaciones Móviles para IoT", "practica", [15, 25, 35, 25]),
      asignatura("Ingeniería de Software", "lectiva", [15, 25, 35, 25]),
      asignatura("Proyecto Integrado", "practica", [15, 20, 30, 35]),
      asignatura("Electivo de Tendencias del Sector Productivo y de Servicios II", "lectiva", PONDERACION_ELECTIVO, true),
    ],
  },
];

/** Ponderación original de una asignatura, o null si no está en la malla. */
function ponderacionOriginal(numeroSemestre, nombre) {
  const semestre = MALLA.find((s) => s.numero === numeroSemestre);
  const encontrada = semestre?.asignaturas.find((a) => a.nombre === nombre);
  return encontrada ? encontrada.evaluaciones : null;
}

module.exports = { MALLA, ponderacionOriginal };
