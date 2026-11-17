# Cómo generar y publicar una versión nueva de NotaClara

Guía para quien mantiene el proyecto. Los comandos se escriben en la terminal de VS Code (**Terminal → New Terminal**, que en Windows abre PowerShell), dentro de la carpeta del proyecto.

## Idea general

```
 código  ──npm test──►  pruebas OK  ──npm run build──►  dist\NotaClara-Instalador.exe  ──GitHub Release──►  enlace de descarga
```

- **electron-builder** toma el código de `src/`, le agrega Electron (el "navegador" que dibuja la ventana) y SQLite, y lo empaqueta todo en un instalador **NSIS** (el formato de instalador clásico de Windows, con su desinstalador).
- El instalador se sube a **GitHub Releases**. Un *release* es una página del repositorio con un número de versión (una *etiqueta* o *tag* de git, por ejemplo `v2.0.1`) y archivos adjuntos para descargar.
- El instalador se llama **siempre** `NotaClara-Instalador.exe`, así este enlace descarga siempre la última versión y nunca hay que cambiarlo:

  https://github.com/sjmonn7/Notaclara/releases/latest/download/NotaClara-Instalador.exe

## Requisitos (solo la primera vez)

- [Node.js](https://nodejs.org/) 22.12 o superior (probado con Node 24) y [Git](https://git-scm.com/).
- Internet la primera vez que se ejecuta `npm run build`, porque electron-builder descarga sus herramientas.
- Opcional, para publicar desde la terminal: **GitHub CLI** (`gh`).

  ```powershell
  winget install --id GitHub.cli -e
  ```

  Cierra y vuelve a abrir la terminal, y luego inicia sesión (elige *GitHub.com* → *HTTPS* → *Login with a web browser*):

  ```powershell
  gh auth login
  ```

> **Cuidado con tus propias notas:** `npm start` y la app instalada usan **el mismo archivo** de notas (`%APPDATA%\NotaClara\notaclara.sqlite`). Si vas a probar cosas raras, primero haz una copia de ese archivo.

## Pasos para publicar una versión nueva

Ejemplo: pasar de la versión `2.0.0` a la `2.0.1`. Cambia los números según corresponda.

### 1. Partir de `main` actualizado

```powershell
git switch main
git pull
npm ci
```

`npm ci` instala exactamente las versiones de `package-lock.json`.

### 2. Hacer los cambios y probar

```powershell
npm test
```

Tienen que pasar todas las pruebas (`fail 0`).

### 3. Subir el número de versión

Usa [versionado semántico](https://semver.org/lang/es/): `2.0.1` para corregir errores, `2.1.0` para agregar algo nuevo y `3.0.0` para cambios grandes.

```powershell
npm version 2.0.1 --no-git-tag-version
```

Cambia la versión en `package.json` y `package-lock.json`. Con `--no-git-tag-version` no hace commit ni crea la etiqueta todavía.

### 4. Generar el instalador

```powershell
npm run build
```

Resultado: `dist\NotaClara-Instalador.exe` (unos 120 MB). La carpeta `dist\` no se sube al repositorio: está en `.gitignore`.

Calcula su huella SHA-256 para publicarla en el release. Así los usuarios pueden comprobar que el archivo es el original:

```powershell
(Get-FileHash dist\NotaClara-Instalador.exe).Hash
```

### 5. Probar el programa empaquetado sin tocar tus notas

Abre la versión empaquetada con una carpeta de datos de prueba:

```powershell
.\dist\win-unpacked\NotaClara.exe --user-data-dir="$env:TEMP\notaclara-prueba"
```

Revisa que abra, que calcule y que, al cerrarla y abrirla otra vez con el mismo comando, conserve las notas. Para borrar la prueba:

```powershell
Remove-Item -Recurse -Force "$env:TEMP\notaclara-prueba"
```

### 6. Guardar los cambios en GitHub

Revisa qué cambió y agrega solo lo que corresponde:

```powershell
git status
git add package.json package-lock.json src test recursos README.md DESCARGA.md PUBLICAR.md REVISION-ERRORES.md
git status
git commit -m "Versión 2.0.1"
git push
```

### 7. Crear el release

**Opción A: desde la página web (sin instalar nada)**

1. Entra a https://github.com/sjmonn7/Notaclara/releases y haz clic en **Draft a new release**.
2. En **Choose a tag**, escribe `v2.0.1` y elige **Create new tag: v2.0.1 on publish**. En **Target**, deja `main`.
3. Título: `NotaClara 2.0.1`. En la descripción, cuenta en pocas palabras qué cambió, pega la línea `SHA-256: <huella del paso 4>` y el enlace a la guía de instalación: `https://github.com/sjmonn7/Notaclara/blob/main/DESCARGA.md`.
4. Arrastra el archivo `dist\NotaClara-Instalador.exe` a la zona **Attach binaries**. No subas los demás archivos de `dist\`.
5. Deja marcada **Set as the latest release** y haz clic en **Publish release**.

**Opción B: desde la terminal con `gh`**

```powershell
gh release create v2.0.1 "dist\NotaClara-Instalador.exe" --repo sjmonn7/Notaclara --target main --title "NotaClara 2.0.1" --notes "Corrige ... SHA-256: <huella del paso 4>. Guía de instalación: https://github.com/sjmonn7/Notaclara/blob/main/DESCARGA.md" --latest
```

### 8. Comprobar el enlace

Abre en el navegador (mejor en una ventana privada):

https://github.com/sjmonn7/Notaclara/releases/latest/download/NotaClara-Instalador.exe

Tiene que descargar el instalador nuevo.

## Versiones publicadas

| Versión | Qué tiene |
|---|---|
| `v1.0` | Versión antigua en Python (portable). Obsoleta. |
| `v2.0.0` | Primera versión con instalador para Windows (Electron + SQLite). Su etiqueta apunta a un commit anterior a las correcciones: el código fuente del release no coincide exactamente con su instalador. |
| `v2.0.1` | Igual que 2.0.0, más las correcciones de [REVISION-ERRORES.md](REVISION-ERRORES.md), el README nuevo y las guías. El código del release y el instalador coinciden. |
| `v2.1.0` | Las notas y el examen aceptan dos dígitos sin separador: `55` se lee como 5,5 (`71` o `80` son inválidos). |

Para las próximas versiones, sigue los pasos de arriba: primero commit y push a `main`, y después el release. Así la etiqueta apunta siempre al mismo código del instalador.

## Prueba en un Windows limpio (recomendada antes de anunciar)

En otro computador o en una máquina virtual (por ejemplo, VirtualBox con Windows 11) que **nunca** haya tenido NotaClara, Node ni Python:

1. Descarga el instalador con el enlace del paso 8.
2. Si aparece "Windows protegió su PC": **Más información → Ejecutar de todas formas**.
3. Instala con las opciones propuestas y abre NotaClara desde el acceso directo del Escritorio.
4. En **1° Semestre → Formación Ciudadana**, escribe 4,0 / 5,0 / 3,0 / 6,0. Debe mostrar **4,6** y **Aprobado** en verde.
5. Cierra NotaClara, vuelve a abrirla y comprueba que las cuatro notas siguen ahí.
6. Desconecta internet y repite el paso 5: debe funcionar igual.

## Si algo falla

| Problema | Solución |
|---|---|
| `npm run build` falla descargando algo | Revisa tu conexión a internet y vuelve a ejecutarlo. |
| La ventana no abre con `npm start` desde VS Code | Usa `npm start` (no `electron .`): el script quita la variable `ELECTRON_RUN_AS_NODE` que VS Code a veces hereda. |
| `gh: command not found` / `gh no se reconoce` | Cierra y vuelve a abrir la terminal después de instalarlo con winget. |
| `gh release create` dice que la etiqueta ya existe | Ese número de versión ya se publicó: sube el número (paso 3). |
| Windows SmartScreen avisa al instalar | Es normal mientras el instalador no tenga firma digital (un certificado de firma de código cuesta dinero). |
| "Una directiva de Control de aplicaciones bloqueó este archivo" al abrir `dist\win-unpacked\NotaClara.exe` | Es **Control inteligente de aplicaciones** de Windows 11: bloquea programas nuevos sin firma según su reputación, y cada build nueva es un archivo nuevo. Prueba el código con `npm start` (ojo con tus notas) o en otro PC. A los usuarios con esta función activada también puede bloquearles NotaClara; [DESCARGA.md](DESCARGA.md) explica qué hacer. La solución definitiva es firmar el instalador (por ejemplo, SignPath ofrece firma gratuita a proyectos de código abierto, o un certificado de firma de código pagado). |
