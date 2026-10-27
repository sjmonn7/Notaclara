// Puente entre la interfaz y el proceso principal. La interfaz solo puede usar estas funciones.
const { contextBridge, ipcRenderer } = require("electron");

const llamar = (canal) => (...argumentos) => ipcRenderer.invoke(canal, ...argumentos);

contextBridge.exposeInMainWorld("notaclara", {
  semestres: llamar("semestres:listar"),
  asignaturas: llamar("semestre:asignaturas"),
  vista: llamar("asignatura:vista"),
  resumen: llamar("asignatura:resumen"),
  guardarNota: llamar("evaluacion:nota"),
  renombrarEvaluacion: llamar("evaluacion:nombre"),
  cambiarPorcentaje: llamar("evaluacion:porcentaje"),
  agregarEvaluacion: llamar("evaluacion:agregar"),
  eliminarEvaluacion: llamar("evaluacion:eliminar"),
  guardarNotaExamen: llamar("examen:nota"),
  justificarFalta: llamar("examen:justificar"),
  cambiarPonderacionLibre: llamar("ponderacion:libre"),
  restaurarPonderacion: llamar("ponderacion:restaurar"),
});
