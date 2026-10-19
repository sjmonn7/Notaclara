# NotaClara

Calculadora de notas para estudiantes de INACAP. Funciona en la terminal y guarda los datos en MySQL.

Proyecto universitario de Simon Masías y Fabián Rojas.

## Qué hace

- Registra las evaluaciones de cada asignatura con su porcentaje y nota (de 1,0 a 7,0).
- Calcula el aporte de cada evaluación: `nota × porcentaje`.
- Calcula la nota acumulada: `Σ (nota × porcentaje)`.
- Calcula la nota mínima necesaria para aprobar con 4,0: `(4,0 − acumulada) ÷ porcentaje pendiente`.

Las asignaturas vienen cargadas:

- Funciones y Matrices
- Programación Orientada a Objetos
- Bases de Datos Estructuradas
- Administración
- Modelamiento de Soluciones Informáticas
- Metodología de Desarrollo Ágil

## Instalación

Requisitos: Python 3 y MySQL encendido (por ejemplo con WAMP o XAMPP).

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Configurar el archivo .env

Copia `.env.example` a `.env` y completa los datos de tu MySQL:

```bash
copy .env.example .env
```

Con WAMP o XAMPP normalmente el usuario es `root` y la contraseña va vacía.

## Crear la base de datos

El script [crear_bd.sql](crear_bd.sql) crea la base de datos `notaclara`, las tablas y las asignaturas. Se puede ejecutar de cualquiera de estas formas:

**Con phpMyAdmin** (http://localhost/phpmyadmin): pestaña **Importar** → elegir `crear_bd.sql` → **Importar**.

**Con la consola de MySQL:**

```bash
mysql -u root -p --default-character-set=utf8mb4 < crear_bd.sql
```

**Con Python** (hace lo mismo que el script SQL):

```bash
python crear_bd.py
```

## Ejecutar

Versión gráfica (customtkinter):

```bash
python interfaz.py
```

Versión de terminal:

```bash
python main.py
```

Las dos versiones usan la misma base de datos, así que lo que se guarda en una aparece en la otra.

## Pruebas

```bash
python -m unittest test_calculos
```

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `interfaz.py` | Versión gráfica con customtkinter |
| `main.py` | Versión de terminal: menú principal y lectura de datos |
| `config.py` | Lee las credenciales desde `.env` |
| `db.py` | Conexión a MySQL |
| `models.py` | Tablas `Asignatura` y `Evaluacion` |
| `calculos.py` | Fórmulas de notas (no usa la base de datos) |
| `vistas.py` | Tablas que se muestran en pantalla |
| `crear_bd.sql` | Script SQL que crea la base de datos |
| `crear_bd.py` | Crea la base de datos desde Python |
| `test_calculos.py` | Pruebas de los cálculos |




## 🚀 Versión Portable (Rama SQLite)

Esta rama (`sqlite-version`) contiene una adaptación **100% portable y autónoma** del proyecto, ideal para demostraciones rápidas o para compartir con compañeros y profesores sin complicaciones técnicas.

### Ventajas de esta versión:
- **Sin Servidores Externos:** No requiere tener encendido MySQL, XAMPP, WAMP ni herramientas similares.
- **Sin Configuraciones Manuales:** No necesitas clonar ni rellenar archivos `.env` con credenciales locales.
- **Base de Datos Autogestionada:** Utiliza **SQLite** (integrado nativamente en Python). La base de datos (`notaclara.db`) se crea y carga de forma completamente automática con las asignaturas de INACAP en el primer segundo en que abres la aplicación.

### Cómo ejecutar en esta rama:
Asegúrate de tener tu entorno virtual activo e instala la librería visual necesaria para Linux/Windows:

```bash
pip install -r requirements.txt
python interfaz.py
```

*Nota: En distribuciones basadas en Ubuntu/Linux Mint, si la interfaz gráfica no abre por falta de componentes del sistema, puedes solucionar la dependencia ejecutando `sudo apt install python3-tk -y` en tu terminal.*

### 📦 Descargar Versión Ejecutable (Doble Clic)
Si no deseas usar la terminal ni instalar Python, puedes descargar el archivo ejecutable listo para usar:
1. Entra a la carpeta `dist/` en esta rama.
2. Descarga el archivo ejecutable llamado `interfaz`.
3. Dale permisos de ejecución en tu Linux (Clic derecho -> Propiedades -> Permisos -> Permitir ejecutar como un programa, o mediante terminal con `chmod +x interfaz`).
4. ¡Haz **doble clic** y listo! El programa creará su propia base de datos local automáticamente.
