// Interfaz de NotaClara. No calcula nada: todo llega ya calculado, redondeado y con coma.
"use strict";

const api = window.notaclara;

const estado = {
  semestres: [],
  semestreId: null,
  asignaturaId: null,
  resumenes: [], // asignaturas del semestre elegido
  vista: null, // asignatura abierta
};

// Referencias a partes del panel que se actualizan sin volver a dibujarlo (para no perder el foco)
let panel = null;

const $ = (selector, raiz = document) => raiz.querySelector(selector);

/** Crea un elemento. atributos: class, texto, on<evento>, y cualquier atributo HTML. */
function crear(etiqueta, atributos = {}, ...hijos) {
  const elemento = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (nombre === "class") elemento.className = valor;
    else if (nombre === "texto") elemento.textContent = valor;
    else if (nombre.startsWith("on")) elemento.addEventListener(nombre.slice(2), valor);
    else if (valor === true) elemento.setAttribute(nombre, "");
    else elemento.setAttribute(nombre, valor);
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo !== null && hijo !== undefined && hijo !== false) elemento.append(hijo);
  }
  return elemento;
}

function recordar(clave, valor) {
  try {
    localStorage.setItem(`notaclara.${clave}`, String(valor ?? ""));
  } catch {
    // Si no se puede recordar, la app funciona igual
  }
}

function recuerdo(clave) {
  try {
    return Number(localStorage.getItem(`notaclara.${clave}`)) || null;
  } catch {
    return null;
  }
}

// ---------- Avisos y confirmaciones ----------

let temporizadorAviso = null;

function aviso(texto) {
  let caja = $("#aviso");
  if (!caja) {
    caja = crear("div", { id: "aviso", class: "aviso", role: "status" });
    document.body.append(caja);
  }
  caja.textContent = texto;
  caja.classList.add("aviso--visible");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => caja.classList.remove("aviso--visible"), 4000);
}

let temporizadorGuardado = null;

function marcarGuardado() {
  const marca = $("#guardado");
  if (!marca) return;
  marca.classList.add("guardado--visible");
  clearTimeout(temporizadorGuardado);
  temporizadorGuardado = setTimeout(() => marca.classList.remove("guardado--visible"), 1800);
}

/** Pregunta Sí / Cancelar. Devuelve una promesa con true si la persona confirma. */
function confirmar(texto, textoAceptar = "Sí") {
  return new Promise((resolver) => {
    const fondo = $("#modal");
    const aceptar = $("#modal-aceptar");
    const cancelar = $("#modal-cancelar");
    const anterior = document.activeElement;
    $("#modal-texto").textContent = texto;
    aceptar.textContent = textoAceptar;
    fondo.hidden = false;
    cancelar.focus();

    function cerrar(respuesta) {
      fondo.hidden = true;
      aceptar.removeEventListener("click", alAceptar);
      cancelar.removeEventListener("click", alCancelar);
      document.removeEventListener("keydown", alTeclear, true);
      if (anterior && document.contains(anterior)) anterior.focus();
      resolver(respuesta);
    }
    const alAceptar = () => cerrar(true);
    const alCancelar = () => cerrar(false);
    function alTeclear(evento) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        cerrar(false);
      } else if (evento.key === "Tab") {
        evento.preventDefault();
        (document.activeElement === aceptar ? cancelar : aceptar).focus();
      }
    }
    aceptar.addEventListener("click", alAceptar);
    cancelar.addEventListener("click", alCancelar);
    document.addEventListener("keydown", alTeclear, true);
  });
}

/** Llama a una acción y avisa si algo sale mal, sin mostrar detalles técnicos. */
async function intentar(accion) {
  try {
    return await accion();
  } catch (error) {
    console.error(error);
    aviso("No se pudo guardar el cambio. Inténtalo de nuevo.");
    return null;
  }
}

// ---------- Barra lateral ----------

function nombreSemestre(id) {
  return estado.semestres.find((semestre) => semestre.id === id)?.nombre ?? "";
}

function renderLateral() {
  const nav = $("#semestres");
  nav.replaceChildren(
    ...estado.semestres.map((semestre) => {
      const activo = semestre.id === estado.semestreId;
      return crear(
        "div",
        { class: `semestre${activo ? " semestre--activo" : ""}` },
        crear(
          "button",
          {
            type: "button",
            class: "semestre-boton",
            "aria-expanded": String(activo),
            "aria-current": activo && !estado.asignaturaId ? "page" : null,
            onclick: () => elegirSemestre(semestre.id),
          },
          crear("span", { texto: semestre.nombre }),
          crear("span", { class: "flecha", "aria-hidden": "true" }),
        ),
        activo && crear("ul", { class: "asignaturas" }, estado.resumenes.map(itemAsignatura)),
      );
    }),
  );
}

function itemAsignatura(resumen) {
  const abierta = resumen.id === estado.asignaturaId;
  return crear(
    "li",
    {},
    crear(
      "button",
      {
        type: "button",
        class: "asignatura-boton",
        "data-id": resumen.id,
        "aria-current": abierta ? "page" : null,
        title: `${resumen.nombre} · ${resumen.titulo}`,
        onclick: () => abrirAsignatura(resumen.id),
      },
      crear("span", { class: `punto punto--${resumen.color}`, "aria-hidden": "true" }),
      crear("span", { class: "asignatura-nombre", texto: resumen.nombre }),
      crear("span", { class: `asignatura-promedio texto--${resumen.color}`, texto: resumen.promedio }),
    ),
  );
}

/** Refleja en la barra lateral el estado nuevo de la asignatura abierta. */
function actualizarLateral(vista) {
  const resumen = estado.resumenes.find((item) => item.id === vista.asignatura.id);
  if (!resumen) return;
  resumen.color = vista.resultado.color;
  resumen.titulo = vista.resultado.titulo;
  resumen.promedio = vista.resultado.examen?.final || vista.resultado.promedio;
  resumen.nombre = vista.asignatura.nombre;
  const boton = $(`.asignatura-boton[data-id="${resumen.id}"]`);
  if (boton) boton.parentElement.replaceWith(itemAsignatura(resumen));
}

// ---------- Navegación ----------

async function elegirSemestre(semestreId) {
  const resumenes = await intentar(() => api.asignaturas(semestreId));
  if (!resumenes) return;
  estado.semestreId = semestreId;
  estado.asignaturaId = null;
  estado.vista = null;
  estado.resumenes = resumenes;
  recordar("semestre", semestreId);
  recordar("asignatura", "");
  renderLateral();
  renderSemestre();
}

async function abrirAsignatura(asignaturaId) {
  const vista = await intentar(() => api.vista(asignaturaId));
  if (!vista) return;
  estado.asignaturaId = asignaturaId;
  recordar("asignatura", asignaturaId);
  renderLateral();
  renderAsignatura(vista);
  $("#contenido").scrollTop = 0;
}

// ---------- Portada de un semestre ----------

function renderSemestre() {
  panel = null;
  const contenido = $("#contenido");
  contenido.replaceChildren(
    crear(
      "header",
      { class: "cabecera" },
      crear("h2", { texto: nombreSemestre(estado.semestreId) }),
      crear("p", { class: "subtitulo", texto: "Elige una asignatura para ingresar tus notas. Todo se guarda automáticamente." }),
    ),
    crear(
      "div",
      { class: "grilla-asignaturas" },
      estado.resumenes.map((resumen) =>
        crear(
          "button",
          { type: "button", class: `tarjeta tarjeta-asignatura borde--${resumen.color}`, onclick: () => abrirAsignatura(resumen.id) },
          crear("span", { class: "chip chip--tipo", texto: resumen.tipoTexto }),
          crear("span", { class: "tarjeta-asignatura-nombre", texto: resumen.nombre }),
          crear(
            "span",
            { class: "tarjeta-asignatura-pie" },
            crear("span", { class: `tarjeta-asignatura-promedio texto--${resumen.color}`, texto: resumen.promedio || "–" }),
            crear("span", { class: `chip chip--${resumen.color}`, texto: resumen.titulo }),
          ),
        ),
      ),
    ),
  );
  contenido.focus({ preventScroll: true });
}

// ---------- Panel de una asignatura ----------

function renderAsignatura(vista) {
  estado.vista = vista;
  const { asignatura } = vista;
  panel = {};

  const contenido = $("#contenido");
  contenido.replaceChildren(
    crear(
      "header",
      { class: "cabecera" },
      crear("button", { type: "button", class: "volver", onclick: () => elegirSemestre(estado.semestreId) }, `← ${nombreSemestre(asignatura.semestreId)}`),
      crear("div", { class: "cabecera-fila" }, crear("h2", { texto: asignatura.nombre }), crear("span", { class: "chip chip--tipo", texto: asignatura.tipoTexto })),
    ),
    crear(
      "div",
      { class: "panel" },
      seccionEvaluaciones(vista),
      crear("div", { class: "panel-lado" }, seccionEstado(), asignatura.tipo === "lectiva" && seccionExamen(vista)),
    ),
  );
  aplicarVista(vista);
}

function seccionEstado() {
  const etiqueta = crear("span", { class: "estado-etiqueta" });
  const valor = crear("span", { class: "estado-valor" });
  const etiquetaFinal = crear("span", { class: "estado-etiqueta", texto: "Nota final" });
  const valorFinal = crear("span", { class: "estado-valor" });
  const bloqueFinal = crear("div", { class: "estado-nota" }, etiquetaFinal, valorFinal);
  const titulo = crear("span", { class: "chip" });
  const mensaje = crear("p", { class: "estado-mensaje" });
  const tarjeta = crear(
    "section",
    { class: "tarjeta estado", "aria-live": "polite" },
    crear("div", { class: "estado-notas" }, crear("div", { class: "estado-nota" }, etiqueta, valor), bloqueFinal),
    titulo,
    mensaje,
  );
  panel.estado = { tarjeta, etiqueta, valor, bloqueFinal, valorFinal, titulo, mensaje };
  return tarjeta;
}

function seccionEvaluaciones(vista) {
  const { asignatura } = vista;
  const libre = asignatura.ponderacionLibre;

  const interruptor = crear("input", {
    type: "checkbox",
    role: "switch",
    checked: libre,
    disabled: asignatura.siempreLibre,
    onchange: (evento) => cambiarPonderacionLibre(evento.target),
  });

  const permiteJustificarInasistencia = asignatura.tipo === "lectiva";
  const muestraAcciones = libre || permiteJustificarInasistencia;
  const cuerpo = crear(
    "tbody",
    {},
    vista.evaluaciones.map((evaluacion) =>
      filaEvaluacion(evaluacion, libre, muestraAcciones, permiteJustificarInasistencia),
    ),
  );
  const tabla = crear(
    "table",
    { class: `tabla${libre ? " tabla--libre" : ""}` },
    crear(
      "thead",
      {},
      crear(
        "tr",
        {},
        crear("th", { texto: "Evaluación" }),
        crear("th", { class: "col-porcentaje", texto: "Porcentaje" }),
        crear("th", { class: "col-nota", texto: "Nota" }),
        muestraAcciones && crear("th", { class: "col-accion" }, crear("span", { class: "oculto", texto: "Acciones" })),
      ),
    ),
    cuerpo,
  );

  let pie = null;
  if (libre) {
    panel.total = crear("span", { class: "total" });
    panel.restaurar = crear("button", { type: "button", class: "boton", onclick: restaurarPonderacion }, "Restaurar ponderación original");
    pie = crear(
      "div",
      { class: "tabla-pie" },
      crear("button", { type: "button", class: "boton", onclick: agregarEvaluacion }, "+ Agregar evaluación"),
      panel.restaurar,
      panel.total,
    );
  }

  return crear(
    "section",
    { class: "tarjeta evaluaciones" },
    crear(
      "div",
      { class: "tarjeta-cabecera" },
      crear("h3", { texto: "Evaluaciones" }),
      crear("span", { id: "guardado", class: "guardado", texto: "✓ Guardado" }),
      crear("label", { class: "interruptor" }, interruptor, crear("span", { class: "interruptor-pista", "aria-hidden": "true" }), "Ponderación libre"),
    ),
    asignatura.siempreLibre && crear("p", { class: "nota-al-pie", texto: "Esta asignatura siempre usa ponderación libre: ingresa los nombres y porcentajes de tus evaluaciones." }),
    libre && !asignatura.siempreLibre && crear("p", { class: "nota-al-pie", texto: "Puedes cambiar nombres y porcentajes, agregar o eliminar evaluaciones." }),
    crear("div", { class: "tabla-contenedor" }, tabla),
    pie,
  );
}

function filaEvaluacion(evaluacion, libre, muestraAcciones, permiteJustificarInasistencia) {
  const errores = { nombre: "", porcentaje: "", nota: "" };
  const textoError = crear("td", { colspan: muestraAcciones ? 4 : 3 });
  const filaError = crear("tr", { class: "fila-error", hidden: true }, textoError);

  function mostrarError(campo, input, mensaje) {
    errores[campo] = mensaje;
    input.classList.toggle("campo--error", Boolean(mensaje));
    input.setAttribute("aria-invalid", String(Boolean(mensaje)));
    const primero = errores.nombre || errores.porcentaje || errores.nota;
    textoError.textContent = primero;
    filaError.hidden = !primero;
  }

  const nota = crear("input", {
    class: "campo campo--nota",
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    maxlength: "5",
    placeholder: "–",
    "aria-label": `Nota de ${evaluacion.nombre}`,
    value: evaluacion.nota,
  });
  conectarCampo(nota, (texto) => api.guardarNota(evaluacion.id, texto), (mensaje) => mostrarError("nota", nota, mensaje), (vista) => {
    return vista.evaluaciones.find((item) => item.id === evaluacion.id)?.nota;
  });
  const marcaJustificada = crear("span", {
    class: "marca-justificada",
    texto: "Inasistencia justificada",
    hidden: !evaluacion.inasistenciaJustificada,
  });

  let celdaNombre;
  let celdaPorcentaje;
  let botonEliminar = null;
  if (libre) {
    const nombre = crear("input", { class: "campo campo--nombre", type: "text", maxlength: "60", "aria-label": "Nombre de la evaluación", value: evaluacion.nombre });
    conectarCampo(nombre, (texto) => api.renombrarEvaluacion(evaluacion.id, texto), (mensaje) => mostrarError("nombre", nombre, mensaje));
    nombre.addEventListener("input", () => nota.setAttribute("aria-label", `Nota de ${nombre.value}`));

    const porcentaje = crear("input", {
      class: "campo campo--porcentaje",
      type: "text",
      inputmode: "numeric",
      maxlength: "3",
      "aria-label": `Porcentaje de ${evaluacion.nombre}`,
      value: String(evaluacion.porcentaje),
    });
    conectarCampo(porcentaje, (texto) => api.cambiarPorcentaje(evaluacion.id, texto), (mensaje) => mostrarError("porcentaje", porcentaje, mensaje));

    celdaNombre = crear(
      "td",
      {},
      nombre,
      marcaJustificada,
    );
    celdaPorcentaje = crear("td", { class: "col-porcentaje" }, crear("span", { class: "con-sufijo" }, porcentaje, crear("span", { texto: "%" })));
    botonEliminar = crear(
      "button",
      {
        type: "button",
        class: "boton-icono",
        title: "Eliminar evaluación",
        "aria-label": `Eliminar ${evaluacion.nombre}`,
        onclick: () => eliminarEvaluacion(evaluacion.id, nombre.value),
      },
      "✕",
    );
  } else {
    celdaNombre = crear(
      "td",
      { class: "nombre-evaluacion" },
      evaluacion.nombre,
      marcaJustificada,
    );
    celdaPorcentaje = crear("td", { class: "col-porcentaje", texto: `${evaluacion.porcentaje}%` });
  }

  const acciones = [];
  if (permiteJustificarInasistencia) {
    acciones.push(
      crear(
        "button",
        {
          type: "button",
          class: "boton boton--pequeno",
          "data-inasistencia-action": evaluacion.id,
          "data-justificada": String(evaluacion.inasistenciaJustificada),
          hidden: !evaluacion.puedeJustificarInasistencia && !evaluacion.inasistenciaJustificada,
          onclick: (evento) =>
            cambiarJustificacionInasistencia(
              evaluacion.id,
              evento.currentTarget.dataset.justificada !== "true",
            ),
        },
        evaluacion.inasistenciaJustificada ? "Deshacer" : "Justificar inasistencia",
      ),
    );
  }
  if (botonEliminar) acciones.push(botonEliminar);

  const celdaAccion = muestraAcciones
    ? crear("td", { class: "col-accion" }, crear("div", { class: "acciones-evaluacion" }, acciones))
    : null;
  const fila = crear(
    "tr",
    { "data-evaluacion-id": evaluacion.id },
    celdaNombre,
    celdaPorcentaje,
    crear("td", { class: "col-nota" }, nota),
    celdaAccion,
  );
  return [fila, filaError];
}

/**
 * Guarda automáticamente mientras se escribe. Los errores se muestran al tiro, salvo que la persona
 * todavía esté escribiendo (ej: "4,"); en ese caso se muestran al salir de la casilla.
 * formatear(vista) devuelve el texto bonito para dejar en la casilla al salir (ej: "4.5" -> "4,5").
 */
function conectarCampo(input, guardar, mostrarError, formatear) {
  let pedido = 0;
  let ultima = Promise.resolve(null);

  input.addEventListener("input", () => {
    const numero = ++pedido;
    ultima = intentar(() => guardar(input.value)).then((respuesta) => {
      if (!respuesta || numero !== pedido) return null;
      mostrarError(respuesta.valida || respuesta.incompleta ? "" : respuesta.mensaje);
      if (respuesta.vista) aplicarVista(respuesta.vista);
      if (respuesta.valida) marcarGuardado();
      return respuesta;
    });
  });

  input.addEventListener("blur", async () => {
    const respuesta = await ultima;
    if (!respuesta) return;
    if (!respuesta.valida) mostrarError(respuesta.mensaje);
    else if (formatear && document.activeElement !== input) input.value = formatear(respuesta.vista) ?? input.value;
  });

  // Enter pasa a la siguiente casilla
  input.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    const casillas = [...document.querySelectorAll("#contenido input.campo:not([disabled])")].filter((c) => c.offsetParent);
    const siguiente = casillas[casillas.indexOf(input) + 1];
    if (siguiente) siguiente.focus();
    else input.blur();
  });
}

function seccionExamen(vista) {
  const nota = crear("input", {
    class: "campo campo--nota",
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    maxlength: "5",
    placeholder: "–",
    id: "nota-examen",
    value: vista.examen.nota,
  });
  const error = crear("p", { class: "error", hidden: true });
  conectarCampo(
    nota,
    (texto) => api.guardarNotaExamen(estado.asignaturaId, texto),
    (mensaje) => {
      error.textContent = mensaje;
      error.hidden = !mensaje;
      nota.classList.toggle("campo--error", Boolean(mensaje));
      nota.setAttribute("aria-invalid", String(Boolean(mensaje)));
    },
    (vistaNueva) => vistaNueva.examen.nota,
  );

  const necesaria = crear("p", { class: "examen-necesaria" });
  const campo = crear(
    "div",
    { class: "examen-campo" },
    necesaria,
    crear("div", { class: "examen-entrada" }, crear("label", { for: "nota-examen", texto: "Nota del examen" }), nota),
    error,
  );
  const espera = crear(
    "p",
    { class: "nota-al-pie", texto: "Cuando tengas todas tus notas podrás ingresar aquí la nota del examen final." },
  );
  const normal = crear("div", { class: "examen-normal" }, espera, campo);

  const tarjeta = crear("section", { class: "tarjeta examen" }, crear("h3", { texto: "Examen final" }), normal);
  panel.examen = { tarjeta, nota, necesaria, campo, espera };
  return tarjeta;
}

/** Actualiza el estado, el examen y la barra lateral sin volver a dibujar las casillas. */
function aplicarVista(vista) {
  if (!panel || vista.asignatura.id !== estado.asignaturaId) return;
  estado.vista = vista;
  const { resultado } = vista;

  const e = panel.estado;
  e.tarjeta.className = `tarjeta estado estado--${resultado.color}`;
  e.etiqueta.textContent = resultado.completo ? "Promedio" : "Promedio actual";
  e.valor.textContent = resultado.promedio || "–";
  e.bloqueFinal.hidden = !resultado.examen?.final;
  e.valorFinal.textContent = resultado.examen?.final ?? "";
  e.titulo.className = `chip chip--${resultado.color}`;
  e.titulo.textContent = resultado.titulo;
  e.mensaje.textContent = resultado.mensaje;

  if (panel.examen) {
    const x = panel.examen;
    x.tarjeta.hidden = !(resultado.examen || resultado.estado === "examen");
    x.espera.hidden = Boolean(resultado.examen);
    x.campo.hidden = !resultado.examen;
    x.necesaria.textContent = resultado.examen ? `Nota mínima para aprobar: ${resultado.examen.necesaria}` : "";
    if (document.activeElement !== x.nota) x.nota.value = vista.examen.nota;
  }

  for (const evaluacion of vista.evaluaciones) {
    const fila = $(`#contenido [data-evaluacion-id="${evaluacion.id}"]`);
    const marca = fila?.querySelector(".marca-justificada");
    const accion = fila?.querySelector("[data-inasistencia-action]");
    if (marca) marca.hidden = !evaluacion.inasistenciaJustificada;
    if (accion) {
      accion.hidden = !evaluacion.puedeJustificarInasistencia && !evaluacion.inasistenciaJustificada;
      accion.dataset.justificada = String(evaluacion.inasistenciaJustificada);
      accion.textContent = evaluacion.inasistenciaJustificada ? "Deshacer" : "Justificar inasistencia";
    }
  }

  if (panel.total) {
    const suma = vista.porcentajeTotal;
    panel.total.textContent = `Total: ${suma}%`;
    panel.total.classList.toggle("total--error", suma !== 100);
  }
  if (panel.restaurar) panel.restaurar.disabled = !vista.asignatura.ponderacionModificada;

  const notaInvalida = $("#contenido .campo--nota[aria-invalid='true']");
  if (notaInvalida) {
    e.tarjeta.className = "tarjeta estado estado--gris";
    e.valor.textContent = "–";
    e.bloqueFinal.hidden = true;
    e.valorFinal.textContent = "";
    e.titulo.className = "chip";
    e.titulo.textContent = "Corrige la nota";
    e.mensaje.textContent = "No se puede calcular el promedio mientras haya una nota inválida.";
    const resumen = estado.resumenes.find((item) => item.id === vista.asignatura.id);
    if (resumen) {
      resumen.color = "gris";
      resumen.titulo = "Corrige la nota";
      resumen.promedio = "";
      const boton = $(`.asignatura-boton[data-id="${resumen.id}"]`);
      if (boton) boton.parentElement.replaceWith(itemAsignatura(resumen));
    }
  } else {
    actualizarLateral(vista);
  }
}

// ---------- Acciones ----------

async function cambiarPonderacionLibre(interruptor) {
  const activar = interruptor.checked;
  if (!activar && estado.vista.asignatura.ponderacionModificada) {
    const seguro = await confirmar(
      "Al desactivar la ponderación libre se volverá a la ponderación original. Se mantendrán las notas de las evaluaciones que conserven su nombre. ¿Continuar?",
    );
    if (!seguro) {
      interruptor.checked = true;
      return;
    }
  }
  const vista = await intentar(() => api.cambiarPonderacionLibre(estado.asignaturaId, activar));
  if (vista) renderAsignatura(vista);
}

async function restaurarPonderacion() {
  const seguro = await confirmar("¿Restaurar la ponderación original? Se mantendrán las notas de las evaluaciones que conserven su nombre.");
  if (!seguro) return;
  const vista = await intentar(() => api.restaurarPonderacion(estado.asignaturaId));
  if (vista) renderAsignatura(vista);
}

async function agregarEvaluacion() {
  const vista = await intentar(() => api.agregarEvaluacion(estado.asignaturaId));
  if (!vista) return;
  renderAsignatura(vista);
  const nombres = document.querySelectorAll("#contenido .campo--nombre");
  const nuevo = nombres[nombres.length - 1];
  if (nuevo) {
    nuevo.focus();
    nuevo.select();
  }
}

async function eliminarEvaluacion(evaluacionId, nombre) {
  const seguro = await confirmar(`¿Eliminar la evaluación «${nombre}»? También se borrará su nota.`);
  if (!seguro) return;
  const vista = await intentar(() => api.eliminarEvaluacion(evaluacionId));
  if (vista) renderAsignatura(vista);
}

async function cambiarJustificacionInasistencia(evaluacionId, justificada) {
  const mensaje = justificada
    ? "¿Confirmas que esta nota 1,0 corresponde a una prueba inasistida? La nota 1,0 se conservará en la presentación (75 %) y el examen final valdrá el 25 % restante."
    : "¿Quieres quitar la justificación de inasistencia de esta prueba?";
  if (!(await confirmar(mensaje, justificada ? "Justificar inasistencia" : "Quitar justificación"))) return;
  const respuesta = await intentar(() => api.justificarInasistencia(evaluacionId, justificada));
  if (!respuesta) return;
  if (!respuesta.valida) {
    aviso(respuesta.mensaje);
    if (respuesta.vista) renderAsignatura(respuesta.vista);
    return;
  }
  renderAsignatura(respuesta.vista);
}

// ---------- Inicio ----------

async function iniciar() {
  estado.semestres = (await intentar(() => api.semestres())) ?? [];
  if (estado.semestres.length === 0) return;
  const semestreGuardado = recuerdo("semestre");
  const asignaturaGuardada = recuerdo("asignatura");
  const semestreId = estado.semestres.some((s) => s.id === semestreGuardado) ? semestreGuardado : estado.semestres[0].id;
  await elegirSemestre(semestreId);
  if (estado.resumenes.some((a) => a.id === asignaturaGuardada)) await abrirAsignatura(asignaturaGuardada);
}

void iniciar();
