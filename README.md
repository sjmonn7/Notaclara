# NotaClara

Calculadora de notas para estudiantes de **Analista Programador de INACAP** (4 semestres).
Es una aplicación de escritorio para Windows hecha con Electron (HTML + CSS + JavaScript) que guarda las notas en un archivo SQLite local. Funciona 100 % sin internet.

**Autores:** Simon Macías, Fabián Rojas, Natalia Sandoval y Berhane Castro.

## Qué hace

- Trae precargados los 4 semestres de la carrera con sus asignaturas, su tipo (Práctica o Lectiva) y las ponderaciones oficiales de cada evaluación.
- Se elige un semestre en la barra lateral, luego una asignatura, y se escriben las notas. Cada nota se **guarda automáticamente** al escribirla (no hay botón "Guardar").
- Muestra el promedio y el estado de la asignatura con colores:
  - **Verde**: aprobado o eximido.
  - **Amarillo**: va a examen (solo lectivas).
  - **Rojo**: reprobado.
  - **Gris**: todavía no hay notas (o faltan notas y aún no hay un resultado definido).
- Calcula la nota mínima que se necesita en lo que falta para aprobar (prácticas) o para eximirse (lectivas). En las últimas dos evaluaciones pendientes muestra la nota de referencia, suponiendo que se obtiene la misma nota en todas las pendientes.
- En una asignatura lectiva completa cuyo promedio de presentación queda bajo 4,945, permite justificar cada prueba inasistida que tenga un 1,0. La nota 1,0 se conserva dentro del 75 % de presentación; el examen final representa el 25 % restante. Cada prueba se puede desjustificar por separado.
- **Ponderación libre**: si las ponderaciones cambiaron durante el año, se pueden editar nombres y porcentajes, agregar y eliminar evaluaciones (como en la primera versión del proyecto) y volver a la ponderación original. Los electivos vienen siempre con ponderación libre (parten con 4 evaluaciones de 25 %).

La interfaz está pensada para personas que no saben de informática: no muestra términos técnicos, fórmulas ni umbrales internos. Esos detalles están solo en este README.

## Ejecutarla desde VS Code

Requisito para desarrollar: [Node.js](https://nodejs.org/) 22.12 o superior (se probó con Node 24).

1. Abrir la carpeta del proyecto en VS Code.
2. Abrir una terminal (`Terminal → New Terminal`) y ejecutar:

```bash
npm install
npm start
```

`npm install` descarga Electron, electron-builder y better-sqlite3. La primera vez que se ejecuta `npm start`, Electron descarga su programa (una sola vez).

También se puede usar `Run and Debug → Abrir NotaClara` (configurado en [.vscode/launch.json](.vscode/launch.json)).

> `npm start` usa [scripts/iniciar.js](scripts/iniciar.js), que quita la variable `ELECTRON_RUN_AS_NODE` antes de abrir Electron. VS Code a veces la hereda a sus terminales y tareas, y con ella la ventana no se abre.

### Pruebas

```bash
npm test
```

Usa el ejecutor de pruebas que trae Node (`node:test`). Las pruebas están en [test/](test/): cálculos, redondeo, validación de notas y guardado en un archivo SQLite temporal.

## Generar el instalador (.exe)

```bash
npm run build
```

Crea `dist/NotaClara-Instalador-<versión>.exe` con electron-builder (instalador NSIS para Windows x64). El instalador incluye todo lo necesario (Electron y SQLite), así que **quien instala la app no necesita instalar nada más** ni tener internet. Permite elegir la carpeta de instalación y crea accesos directos en el escritorio y en el menú Inicio.

Para generar el instalador sí se necesita internet la primera vez, porque electron-builder descarga sus herramientas. La carpeta `dist/` no se sube al repositorio.

El instalador no está firmado digitalmente, así que Windows SmartScreen puede mostrar un aviso la primera vez ("Más información → Ejecutar de todas formas").

## Dónde se guardan las notas

En un archivo SQLite llamado `notaclara.sqlite`, dentro de la carpeta de datos del usuario de Windows (`app.getPath('userData')`):

```
%APPDATA%\NotaClara\notaclara.sqlite
```

(por ejemplo `C:\Users\<usuario>\AppData\Roaming\NotaClara\notaclara.sqlite`). Nunca se guarda junto al `.exe`, así que desinstalar o actualizar la app no borra las notas. El archivo se crea solo la primera vez que se abre la app, con todas las asignaturas precargadas. Para empezar de cero basta con cerrar la app y borrar ese archivo.

### Tablas

| Tabla | Contenido |
|---|---|
| `semestre` | Los 4 semestres (`numero`, `nombre`) |
| `asignatura` | `nombre`, `semestre_id`, `tipo` (`practica` / `lectiva`), `ponderacion_libre`, `siempre_libre` (electivos), `orden` |
| `evaluacion` | `asignatura_id`, `nombre`, `porcentaje` (entero), `nota` (en décimas: 4,5 se guarda como 45; vacía si está pendiente), `inasistencia_justificada` (0 / 1), `orden` |
| `estado_examen` | `asignatura_id`, `nota_examen` (en décimas) |

Las ponderaciones originales están en [src/datos/malla.js](src/datos/malla.js); se usan para precargar y para "Restaurar ponderación original".

Al abrir una base anterior, la aplicación agrega la nueva marca por evaluación sin borrar las notas guardadas. La antigua marca de falta al examen queda sin uso y no afecta los cálculos.

## Reglas de cálculo

Toda la lógica está en [src/logica/calculos.js](src/logica/calculos.js), un módulo sin dependencias de la interfaz ni de la base de datos. La interfaz solo recibe resultados ya redondeados.

### Precisión: solo enteros

No se usan decimales flotantes para comparar. Una nota se maneja en décimas (4,5 → 45) y un porcentaje como entero (30 % → 30). Su producto queda en milésimas: 45 × 30 = 1350 = 1,350. Si los porcentajes suman 100, la suma de los aportes es el promedio ponderado **exacto** en milésimas.

### Redondeo chileno

Primero a 2 decimales (mitad hacia arriba) y luego a 1 decimal (mitad hacia arriba):

| Promedio real | A 2 decimales | Se muestra |
|---|---|---|
| 4,945 | 4,95 | 5,0 |
| 3,945 | 3,95 | 4,0 |
| 4,944 | 4,94 | 4,9 |

La app muestra siempre el valor redondeado, sin avisar nada (si el promedio real es 4,945, se ve 5,0 en verde).

### Umbrales internos (nunca se muestran en la app)

| Umbral | Valor | Equivale a |
|---|---|---|
| Aprobar | **3,945** | 4,0 final |
| Eximirse (solo lectivas) | **4,945** | 5,0 final |

### Asignatura práctica

- Promedio ≥ 3,945 → verde "Aprobado". Si no → rojo "Reprobado". No hay examen.
- Con evaluaciones pendientes se calcula la nota mínima en lo pendiente para llegar a 3,945: `(3,945 − acumulado) ÷ porcentaje pendiente`, redondeada hacia arriba a 1 decimal y como mínimo 1,0.
  - Si es mayor que 7,0 → rojo "Reprobado" aunque falten notas.
  - Si basta con 1,0 → verde "Aprobado" (ya está asegurado).

### Asignatura lectiva

- Promedio de presentación ≥ 4,945 → verde "Eximido".
- Si no → amarillo "Vas a examen" (siempre puede ir a examen, aunque tenga 1,0).
- Nota final con examen = presentación (redondeada) × 0,75 + examen × 0,25. Aprueba si la nota final ≥ 3,945.
- Nota mínima de examen = `(3,945 − presentación × 0,75) ÷ 0,25`, redondeada hacia arriba a 1 decimal, mínimo 1,0. Si es mayor que 7,0 → rojo "Reprobado".
  - Ejemplo: presentación 4,5 → (3,945 − 3,375) ÷ 0,25 = 2,28 → **2,3**. Con 2,3 la final es 3,95 (se ve 4,0, aprueba); con 2,2 es 3,925 (se ve 3,9, reprueba).
- Con evaluaciones pendientes se muestra la nota mínima en lo pendiente para eximirse. Si eximirse ya es imposible → amarillo "Vas a examen". Si ni con 7,0 en todo lo pendiente y 7,0 en el examen alcanza → rojo "Reprobado".

### Prueba inasistida

- La opción aparece solo en asignaturas lectivas, cuando todas las evaluaciones tienen nota y el promedio de presentación sin redondear es menor que 4,945.
- Solo se puede justificar una evaluación cuya nota sea 1,0. Si hay varias, cada una se marca o desmarca por separado.
- La justificación no borra ni reemplaza el 1,0: la presentación completa (incluido ese 1,0) conserva su ponderación del 75 % y una sola nota de examen final del ramo aporta el 25 % restante.
- Si el promedio llega a 4,945 o más, no se ofrece esta acción. En ramos prácticos no hay examen final.
- Al ingresar una nota inválida, el promedio y la nota final se ocultan hasta corregirla. La nota inválida no se guarda ni se usa en los cálculos.

### Validación de notas

- Los campos de nota y examen solo permiten números entre 1,0 y 7,0, con hasta un decimal; se acepta coma o punto (`6,3` y `6.3`) y se muestran siempre con coma y un decimal.
- Fuera de 1,0 a 7,0 → "Nota inválida. Ingrese una nota entre 1,0 y 7,0."
- Más de un decimal (`6,34`) → "Nota inválida. Ingrese un número con UN solo decimal."
- En ponderación libre, los campos de porcentaje solo permiten números enteros de 0 a 100. Si no suman 100 % no se calcula el estado y se muestra "Los porcentajes deben sumar 100%."

## Estructura de carpetas

```
NotaClara/
├── package.json             Dependencias, scripts (start, test, build) y configuración del instalador
├── recursos/
│   └── icono.png            Ícono de la app y del instalador
├── scripts/
│   └── iniciar.js           Abre Electron para `npm start`
├── src/
│   ├── datos/
│   │   └── malla.js         Semestres, asignaturas y ponderaciones originales
│   ├── logica/
│   │   └── calculos.js      Cálculos puros: redondeo, umbrales, estados, validación
│   ├── main/
│   │   ├── main.js          Proceso principal de Electron (ventana y comunicación con la interfaz)
│   │   ├── preload.js       Puente seguro entre la interfaz y el proceso principal
│   │   ├── basedatos.js     Archivo SQLite: tablas, precarga y consultas
│   │   └── servicio.js      Une datos y cálculos; entrega todo listo para mostrar
│   └── renderer/
│       ├── index.html       Interfaz
│       ├── estilos.css
│       └── app.js           Comportamiento de la interfaz (no calcula nada)
└── test/
    ├── calculos.test.js     Pruebas de la lógica (incluye las migradas de test_calculos.py)
    └── servicio.test.js     Pruebas de guardado y ponderación libre
```

## Historia

La primera versión era una aplicación de terminal en Python con MySQL (peewee + pymysql) y luego tuvo una interfaz con customtkinter. Esta versión la reemplaza por completo: ya no se necesita Python, MySQL, WAMP/XAMPP ni el archivo `.env`.
