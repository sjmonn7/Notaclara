# Revisión de errores de NotaClara (14-11-2026)

Se revisó el cálculo de promedios, el guardado de notas y lo que podría fallar al empaquetar. Cada error se demostró **antes** de corregirlo: con una prueba automática que fallaba, o reproduciéndolo en la ventana real de la app.

Resumen: **3 errores corregidos** y **6 sospechas descartadas o que no son errores**. El cálculo de promedios coincide con un verificador independiente en 40 679 casos.

## Errores corregidos

### E1. Una evaluación de 0 % desbloqueaba la prueba justificada

**Dónde:** `src/main/servicio.js`, función `completa()`.

**Qué pasaba:** en una asignatura lectiva con una falta justificada y la nota del examen ya puesta, si se activaba la ponderación libre y se agregaba una evaluación, esta se creaba con **0 %**, porque los porcentajes ya sumaban 100. Entonces:

- el cálculo seguía usando la nota del examen en vez del 1,0 (correcto),
- pero la casilla volvía a mostrar **1,0**, quedaba **desbloqueada** y se podía **quitar la justificación**, aunque el promedio en pantalla seguía usando el examen.

**Causa:** había dos definiciones distintas de "asignatura completa":

| Archivo | Regla |
|---|---|
| `calculos.js` (calcula el promedio) | No queda **porcentaje** pendiente |
| `servicio.js` (decide qué se muestra y qué se bloquea) | **Todas** las evaluaciones tienen nota |

Una evaluación de 0 % sin nota cumple la primera regla pero no la segunda.

**Cómo comprobarlo:** prueba `lectiva: una evaluación nueva de 0 % no desbloquea la prueba justificada mientras el examen se usa` en `test/servicio.test.js`. Sin la corrección falla con `actual: '1,0', expected: '6,0'`.

**Corrección:** `completa()` usa ahora la misma regla que el cálculo: los porcentajes suman 100 y el porcentaje evaluado es 100.

### E2. El mensaje pedía nota en una evaluación de 0 %

**Dónde:** `src/main/servicio.js`, función `mensajeNotaNecesaria()`.

**Qué pasaba:** con una evaluación de 0 % sin nota, el mensaje decía, por ejemplo, *"Para aprobar necesitas un 5,7 en EV4 y EV5"*, aunque EV5 no influye en el promedio.

**Causa:** la misma de E1. La lista de evaluaciones pendientes no consideraba el porcentaje.

**Cómo comprobarlo:** prueba `el mensaje no nombra evaluaciones de 0 % sin nota`. Sin la corrección falla con `'Para aprobar necesitas un 5,7 en EV4 y EV5.'`.

**Corrección:** solo se nombran las evaluaciones pendientes con porcentaje mayor que 0.

### E3. Con una nota a medio escribir ("4,") el promedio seguía visible

**Dónde:** `src/renderer/app.js`, función `conectarCampo()` (evento `blur`, es decir, al salir de la casilla).

**Qué pasaba:** si escribías `4,` y salías de la casilla con Tab o con un clic, la casilla se ponía roja con "Nota inválida", pero el promedio y el estado seguían mostrando el cálculo anterior. El README dice que, con una nota inválida, el promedio se oculta hasta corregirla.

**Causa:** mientras escribes `4,`, la app espera porque puede que todavía falte el decimal, y no marca error. Al salir de la casilla sí marca el error, pero no volvía a dibujar la tarjeta del promedio. Esa tarjeta solo revisa si hay notas inválidas cuando se dibuja.

**Cómo comprobarlo:** abrir Formación Ciudadana, escribir `5,0` en EV1, escribir `4,` en EV2 y presionar Tab. Antes de la corrección el promedio mostraba `5,0`. Ahora muestra `–` y "Corrige la nota". Al cambiar a `4,5` vuelve a mostrar `4,7`. Se comprobó en la ventana real de la app, controlada automáticamente por Chrome DevTools Protocol y con una carpeta de datos temporal.

**Corrección:** al salir de una casilla con una nota inválida, se vuelve a aplicar la vista actual. Así la tarjeta ve el error y oculta el promedio. Al volver a dibujar, la casilla del **examen** conserva lo que escribiste si está marcada como inválida. Antes la reemplazaba por la nota guardada (por ejemplo, `4,` volvía a `4,0`), y quedaba una nota válida en rojo con el promedio oculto. Esto lo detectó la inspección de Codex y se comprobó igual: examen `4,0` → `4,` + Tab → la casilla conserva `4,` y el promedio se oculta → al corregir a `4,5` todo vuelve a la normalidad.

Una segunda inspección encontró el mismo problema cuando la persona sale de la casilla **antes** de que la app termine de responder: la respuesta "incompleta" borraba el error y la casilla volvía a `4,0`. Ahora una nota a medio escribir solo se perdona mientras la persona sigue en la casilla. Se comprobó haciendo que la app respondiera 400 ms más lento a propósito: la casilla conserva `4,`, el promedio se oculta y al corregir a `4,5` todo vuelve a la normalidad. (Corregido en la versión 2.0.1.)

Una tercera inspección encontró un caso que ya existía antes de esta revisión. Si el examen quedaba a medio escribir (`4,`) y después la asignatura dejaba de usar el examen (porque te eximías o borrabas una nota), la casilla del examen se ocultaba pero su error seguía bloqueando el promedio con "Corrige la nota". Ahora, cuando el examen deja de aplicarse, se descarta lo que quedó a medio escribir. Se comprobó en la ventana real: examen `4,` → todas las notas en 6,0 → **Eximido 6,0**; al bajar una nota vuelve "Vas a examen" con la casilla limpia; al borrar una nota no queda bloqueado. (Corregido en la versión 2.0.1.)

Una cuarta inspección encontró otro caso que ya existía: con la prueba EV1 justificada, si su `1,0` quedaba a medio editar (`1,`) y después se ingresaba el examen, la casilla pasaba a mostrar la nota del examen bloqueada, pero seguía marcada con error y el promedio seguía oculto. Ahora, cuando la app reemplaza lo escrito por la nota con que se calcula, también borra el error de esa casilla. Se comprobó: EV1 justificada → `1,` → examen `6,0` → EV1 muestra `6,0` bloqueada y sin error, con **5,6 Aprobado**. (Corregido en la versión 2.0.1.)

Una quinta inspección encontró que, al salir de una casilla, la app usaba la última respuesta guardada de esa casilla aunque ya estuviera obsoleta. Ejemplo: con EV1 justificada y el examen en 6,0, la casilla de EV1 muestra 6,0 bloqueada; al hacer clic en ella y salir, volvía a mostrar el 1,0 antiguo, aunque el cálculo usaba 6,0. Ahora, al salir, la respuesta solo se usa si la casilla todavía tiene el mismo texto que la generó. Se comprobó en la ventana real, junto con que `5.5` se sigue convirtiendo a `5,5` al salir. (Corregido en la versión 2.0.1.)

## Sospechas descartadas o que no son errores

| # | Sospecha | Resultado |
|---|---|---|
| S1 | **Cálculo de promedios** (redondeo chileno, umbrales 3,945 y 4,945, nota necesaria, examen, falta justificada) | **Correcto.** Un verificador independiente escrito en Python con fracciones exactas, a partir de las reglas del README, se comparó con `calculos.js` en 40 679 casos (20 000 aleatorios y todos los bordes): **0 diferencias**, antes y después de los cambios. |
| S2 | ¿Se pierde una nota escrita justo antes de cerrar la ventana? | **No.** Se escribió `6,3` y se cerró la ventana 50 ms después. Al volver a abrir, la nota estaba guardada. better-sqlite3 escribe en el disco en el momento. |
| S3 | Borrar la nota de una prueba justificada quita la justificación | **Comportamiento esperado.** Ya existe la prueba "cambiar la nota de la prueba justificada quita la justificación". Si se vuelve a escribir 1,0, hay que justificar de nuevo. |
| S4 | Se puede guardar nota de examen en una lectiva incompleta | **No afecta.** La casilla del examen solo aparece cuando la asignatura está completa, y el cálculo ignora el examen hasta entonces. |
| S5 | `servicio.resumen(id)` falla si el id no existe | La interfaz nunca lo pide así, pero el canal está expuesto al renderer (lo señaló la inspección de Codex). **Corregido en 2.0.1:** devuelve `null`. Lo comprueba la prueba `una asignatura que no existe no rompe la vista ni el resumen`. |
| S6 | `npm start` usa las mismas notas que la app instalada | **No es un error**, pero puede sorprender al probar. Se documentó en el README y en PUBLICAR.md, con el comando para probar con datos aparte. |

## Revisión del empaquetado

| Tema | Resultado |
|---|---|
| **Herramienta** | Se mantiene **electron-builder** con instalador **NSIS**. Es el estándar para apps Electron, ya estaba configurado, desempaqueta solo los módulos nativos (SQLite) y crea un instalador clásico con desinstalador. |
| **Rutas de archivos** | `main.js` usa `path.join(__dirname, …)` para `index.html`, `preload.js` y el ícono. Funciona dentro de `app.asar` (comprobado abriendo el `.exe` empaquetado). |
| **Ubicación de la base de datos** | `app.getPath("userData")` → `%APPDATA%\NotaClara\notaclara.sqlite`. Nunca junto al `.exe`, así que no hay problemas de permisos y las notas sobreviven a actualizaciones y desinstalaciones. Comprobado: el `.exe` empaquetado creó la base, con los 4 semestres y las notas escritas, en la carpeta de datos indicada. |
| **Permisos de Windows** | Instalación por usuario (`perMachine: false`). No pide administrador. |
| **SQLite incluido** | `better-sqlite3/prebuilds/win32-x64.node` va en `app.asar.unpacked`. Comprobado: el Electron empaquetado carga SQLite 3.53.4. |
| **Restos de compilación** | Se excluyó `better-sqlite3/build/**` (archivos `.vcxproj` y `obj` que no se usan). |
| **Publicación accidental** | `npm run build` usa ahora `--publish never`. |
| **Build reproducible** | Clon limpio → `npm ci` → `npm run build` → `dist/NotaClara-Instalador.exe` (≈ 121 MB) en unos 32 segundos (con la caché de Electron ya descargada). |

## Pendiente: solo se puede verificar a mano

- Instalar en un **Windows limpio**, en otro PC o en una máquina virtual. La lista de pasos está en [PUBLICAR.md](PUBLICAR.md#prueba-en-un-windows-limpio-recomendada-antes-de-anunciar).
- El aviso de **SmartScreen** seguirá apareciendo mientras el instalador no tenga firma digital.
- **Control inteligente de aplicaciones** (Windows 11): en el PC del autor bloqueó un `NotaClara.exe` recién generado ("Una directiva de Control de aplicaciones bloqueó este archivo"), aunque builds anteriores sí se abrieron. En computadores con esta función activada, NotaClara puede no abrirse y no hay botón para continuar. Está documentado en DESCARGA.md; la solución definitiva es firmar el instalador.
- Las carpetas `build/` y `dist/` del repositorio local tienen restos de la versión en Python (`dist/NotaClara`, `dist/interfaz`, `dist/notaclara.db`). Git las ignora, pero conviene borrarlas para no subir por error un archivo antiguo al release.
