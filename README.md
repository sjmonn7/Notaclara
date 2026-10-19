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

```bash
python main.py
```

## Pruebas

```bash
python -m unittest test_calculos
```

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `main.py` | Menú principal y lectura de datos |
| `config.py` | Lee las credenciales desde `.env` |
| `db.py` | Conexión a MySQL |
| `models.py` | Tablas `Asignatura` y `Evaluacion` |
| `calculos.py` | Fórmulas de notas (no usa la base de datos) |
| `vistas.py` | Tablas que se muestran en pantalla |
| `crear_bd.sql` | Script SQL que crea la base de datos |
| `crear_bd.py` | Crea la base de datos desde Python |
| `test_calculos.py` | Pruebas de los cálculos |
