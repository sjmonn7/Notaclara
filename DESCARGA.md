# Cómo descargar e instalar NotaClara

NotaClara es una calculadora de notas para estudiantes de **Analista Programador de INACAP**. Esta guía explica, paso a paso, cómo tenerla en tu computador. No necesitas saber de informática.

## Antes de empezar

- Necesitas un computador con **Windows 10 o Windows 11** (de 64 bits, que es lo normal hoy).
- Solo necesitas internet para **descargar** el programa. Después NotaClara funciona **sin internet**.
- No tienes que instalar nada más: todo lo que NotaClara necesita viene incluido.
- No necesitas ser administrador del computador.

## 1. Descargar

1. Abre este enlace en tu navegador (Chrome, Edge, Firefox…):

   **https://github.com/sjmonn7/Notaclara/releases/latest/download/NotaClara-Instalador.exe**

2. La descarga empieza sola. El archivo se llama `NotaClara-Instalador.exe` y queda en tu carpeta **Descargas**.

> Si prefieres ver la página de descargas, entra a https://github.com/sjmonn7/Notaclara/releases/latest y, en la sección **Assets**, haz clic en `NotaClara-Instalador.exe`.

### Comprobar que el archivo es el original (opcional, recomendado)

Como el instalador no tiene firma digital, puedes comprobar que nadie lo cambió. Cada archivo tiene una "huella" única llamada **SHA-256**:

1. Abre el menú **Inicio**, escribe `PowerShell` y ábrelo.
2. Copia este comando, pégalo con clic derecho y presiona **Enter**:

   ```powershell
   Get-FileHash "$env:USERPROFILE\Downloads\NotaClara-Instalador.exe"
   ```

3. Compara el texto largo que aparece en **Hash** con el **SHA-256** publicado en la descripción del release, en https://github.com/sjmonn7/Notaclara/releases/latest. Si son iguales, el archivo es el original. **Si no coinciden, no lo abras** y descárgalo de nuevo desde el enlace oficial.

### Si el navegador dice que el archivo "no se descarga con frecuencia"

Algunos navegadores avisan con los programas nuevos que todavía poca gente ha descargado. Es normal con NotaClara.

- **Microsoft Edge:** pasa el mouse sobre la descarga, haz clic en los **tres puntos (…)** → **Conservar** → **Mostrar más** → **Conservar de todas formas**.
- **Google Chrome:** en la lista de descargas, haz clic en **Conservar** (o en la flecha junto a la descarga → **Descargar archivo sospechoso**).

## 2. Instalar

1. Abre la carpeta **Descargas** y haz **doble clic** en `NotaClara-Instalador.exe`.
2. Es probable que aparezca una ventana azul que dice **"Windows protegió su PC"**. Mira la sección siguiente para saber qué hacer.
3. Se abre el instalador de NotaClara, en español:
   - Te muestra la carpeta donde se instalará. La que viene propuesta está bien: haz clic en **Instalar**.
   - Espera unos segundos mientras se copian los archivos.
   - Al final, deja marcada la casilla **Ejecutar NotaClara** y haz clic en **Terminar**.
4. El instalador crea un acceso directo **NotaClara** en el **Escritorio** y en el **menú Inicio**.

### "Windows protegió su PC" (aviso de SmartScreen)

Windows muestra este aviso con los programas que **no tienen una firma digital pagada**. NotaClara es un proyecto de estudiantes y no la tiene, pero eso no significa que tenga virus. Para continuar:

1. En la ventana azul, haz clic en el texto **Más información**.
2. Aparece el nombre del archivo (`NotaClara-Instalador.exe`) y un botón nuevo: haz clic en **Ejecutar de todas formas**.

Solo tienes que hacerlo una vez.

> **Consejo de seguridad:** haz esto solo con archivos descargados desde el enlace oficial de arriba (`github.com/sjmonn7/Notaclara`) y, si puedes, después de comprobar su huella SHA-256 (ver el paso 1). Si alguien te envía un "NotaClara" por otro medio, no lo abras.

### "Control inteligente de aplicaciones bloqueó…" (solo algunos Windows 11)

Algunos computadores con Windows 11 tienen activado **Control inteligente de aplicaciones** (*Smart App Control*). Es más estricto que el aviso azul: bloquea los programas sin firma digital y **no muestra** el botón "Ejecutar de todas formas".

Por ahora, **NotaClara no funciona en esos computadores**: es una limitación conocida, porque el instalador no tiene firma digital. Usa NotaClara en otro computador. **No te recomendamos desactivar esa protección** solo para instalar NotaClara: protege tu computador de programas peligrosos y, en algunas versiones de Windows, no se puede volver a activar sin reinstalar Windows.

Para saber si lo tienes activado: **Inicio → Seguridad de Windows → Control de aplicaciones y exploradores → Configuración de Control inteligente de aplicaciones**.

## 3. Abrir NotaClara

- Haz doble clic en el ícono **NotaClara** del Escritorio, **o**
- Abre el menú **Inicio**, escribe `NotaClara` y presiona **Enter**.

Para usarla:

1. Elige tu **semestre** en la barra de la izquierda.
2. Elige una **asignatura**.
3. Escribe tus notas (por ejemplo `5,5` o `5.5`). Se **guardan solas** mientras escribes: no hay botón "Guardar".

Puedes cerrar NotaClara cuando quieras. Al volver a abrirla, tus notas siguen ahí.

## Dónde quedan guardadas tus notas

Tus notas se guardan en tu computador, en este archivo:

```
C:\Users\<tu usuario>\AppData\Roaming\NotaClara\notaclara.sqlite
```

Para llegar rápido: presiona las teclas **Windows + R**, escribe `%APPDATA%\NotaClara` y presiona **Enter**.

- **Para hacer una copia de seguridad**, cierra NotaClara y copia el archivo `notaclara.sqlite` a un pendrive o a tu nube.
- **Para pasar tus notas a otro computador**, instala NotaClara en el otro computador, ábrela y ciérrala una vez, y reemplaza su `notaclara.sqlite` por tu copia.

## Actualizar a una versión nueva

Descarga el instalador nuevo con el mismo enlace del paso 1 e instálalo encima. **Tus notas se conservan.**

## Desinstalar

1. Abre **Inicio → Configuración → Aplicaciones → Aplicaciones instaladas**.
2. Busca **NotaClara**, haz clic en los **tres puntos (…)** → **Desinstalar**.

Al desinstalar **no se borran tus notas**, por si vuelves a instalarla. Si quieres borrarlas también, borra la carpeta `%APPDATA%\NotaClara`.

## Problemas frecuentes

| Problema | Qué hacer |
|---|---|
| No encuentro el archivo descargado | Abre la carpeta **Descargas**, o presiona **Ctrl + J** en el navegador para ver tus descargas. |
| El navegador bloqueó la descarga | Revisa la sección "Si el navegador dice que el archivo no se descarga con frecuencia". |
| Apareció "Windows protegió su PC" y no veo el botón "Ejecutar de todas formas" | Primero haz clic en **Más información**; el botón aparece después. |
| Mi antivirus bloqueó el instalador | Algunos antivirus desconfían de los programas sin firma. Si descargaste desde el enlace oficial, puedes permitirlo en tu antivirus. Si no estás seguro, pide ayuda. |
| Dice "Control inteligente de aplicaciones bloqueó…" | Es una limitación conocida en esos computadores: revisa la sección "Control inteligente de aplicaciones" más arriba. |
| Hice doble clic en NotaClara y no pasa nada | Puede que ya esté abierta (NotaClara se abre una sola vez): revisa la barra de tareas. |
| Aparece "No se pudieron abrir tus notas guardadas" | Cierra todas las ventanas de NotaClara y vuelve a abrirla. Si sigue pasando, reinicia el computador. |
| Dice "Nota inválida" | Las notas van de **1,0 a 7,0** y con **un solo decimal** (por ejemplo `4,5`, no `4,55`). |
