// Proceso principal de Electron: abre la ventana, el archivo de notas y atiende a la interfaz.
const path = require("node:path");
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, shell } = require("electron");

const { abrirBaseDatos } = require("./basedatos");
const { crearServicio } = require("./servicio");

// El archivo de notas vive en la carpeta de datos del usuario (ej: %APPDATA%\NotaClara), nunca junto al .exe
const ARCHIVO_NOTAS = "notaclara.sqlite";

let ventana = null;
let bd = null;

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1200,
    height: 740,
    minWidth: 900,
    minHeight: 600,
    title: "NotaClara",
    icon: path.join(__dirname, "..", "..", "recursos", "icono.png"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#13171f" : "#f4f6fa",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  ventana.once("ready-to-show", () => ventana.show());
  ventana.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  // La app no navega a ningún sitio: cualquier enlace se abre fuera
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  ventana.webContents.on("will-navigate", (evento) => evento.preventDefault());
}

function registrarAcciones(servicio) {
  const acciones = {
    "semestres:listar": () => servicio.semestres(),
    "semestre:asignaturas": (semestreId) => servicio.asignaturas(semestreId),
    "asignatura:vista": (asignaturaId) => servicio.vista(asignaturaId),
    "asignatura:resumen": (asignaturaId) => servicio.resumen(asignaturaId),
    "evaluacion:nota": (evaluacionId, texto) => servicio.guardarNota(evaluacionId, texto),
    "evaluacion:nombre": (evaluacionId, texto) => servicio.renombrarEvaluacion(evaluacionId, texto),
    "evaluacion:porcentaje": (evaluacionId, texto) => servicio.cambiarPorcentaje(evaluacionId, texto),
    "evaluacion:agregar": (asignaturaId) => servicio.agregarEvaluacion(asignaturaId),
    "evaluacion:eliminar": (evaluacionId) => servicio.eliminarEvaluacion(evaluacionId),
    "examen:nota": (asignaturaId, texto) => servicio.guardarNotaExamen(asignaturaId, texto),
    "inasistencia:justificar": (evaluacionId, justificada) =>
      servicio.justificarInasistencia(evaluacionId, justificada),
    "ponderacion:libre": (asignaturaId, libre) => servicio.cambiarPonderacionLibre(asignaturaId, libre),
    "ponderacion:restaurar": (asignaturaId) => servicio.restaurarPonderacion(asignaturaId),
  };
  for (const [canal, accion] of Object.entries(acciones)) {
    ipcMain.handle(canal, (_evento, ...argumentos) => accion(...argumentos));
  }
}

function iniciar() {
  try {
    bd = abrirBaseDatos(path.join(app.getPath("userData"), ARCHIVO_NOTAS));
  } catch (error) {
    console.error(error);
    dialog.showErrorBox(
      "NotaClara",
      "No se pudieron abrir tus notas guardadas. Cierra otras ventanas de NotaClara y vuelve a intentarlo.",
    );
    app.quit();
    return;
  }
  registrarAcciones(crearServicio(bd));
  Menu.setApplicationMenu(null);
  crearVentana();
}

// Una sola ventana de NotaClara a la vez, para que no se pisen las notas
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.focus();
  });
  app.whenReady().then(iniciar);
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => bd?.cerrar());
}
