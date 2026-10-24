# NotaClara (Versión Portable 🚀)

Calculadora de notas y promedios para estudiantes de INACAP. Esta rama (`sqlite-version`) contiene una adaptación **100% autónoma y portable**, diseñada para ejecutarse con un solo clic sin necesidad de configuraciones técnicas complicadas.

Proyecto universitario de Simon Masías y Fabián Rojas.

## 🌟 Qué hace el programa
- **Tus propias asignaturas:** la app parte vacía. Agrega tus ramos con el botón **+**, anota cada evaluación con su porcentaje y su nota, y todo queda guardado para la próxima vez.
- **Archivar y renombrar:** corrige nombres o archiva ramos de semestres anteriores sin perder sus notas; los restauras desde "Ver archivadas".
- **Gestión de evaluaciones:** registra tus notas (de 1,0 a 7,0) junto con su porcentaje de ponderación.
- **Cálculos automáticos:** calcula tu nota acumulada actual y te dice exactamente **cuánto necesitas obtener en las evaluaciones restantes** para aprobar con nota 4,0.

## 📦 Cómo usar (sin instalar nada)
Descarga el archivo para tu sistema desde la sección **[Releases](../../releases)** de este repositorio.

### Windows
1. Descarga `NotaClara.exe`.
2. Haz doble clic y la aplicación se abrirá.

### Linux
1. Descarga `NotaClara-Linux`.
2. Dale permisos de ejecución:
   - *De forma visual:* clic derecho sobre el archivo → **Propiedades** → pestaña **Permisos** → marca **"Permitir ejecutar el archivo como un programa"**.
   - *O por terminal:* `chmod +x NotaClara-Linux`.
3. Haz doble clic sobre el archivo (o ejecútalo con `./NotaClara-Linux`).

### Dónde se guardan tus datos
La base de datos se crea sola la primera vez y queda en tu carpeta personal:
- **Windows:** `C:\Users\<tu usuario>\.notaclara\notaclara.db`
- **Linux:** `~/.notaclara/notaclara.db`

Si quieres empezar de cero, borra esa carpeta. Para hacer un respaldo, copia el archivo `notaclara.db`.

---

## 🛠️ Desarrollo e instalación (opcional)
Si quieres ejecutar el código fuente en Python, clona esta rama y activa un entorno virtual:

```bash
git clone -b sqlite-version https://github.com/sjmonn7/Notaclara.git
cd Notaclara
python3 -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate

pip install -r requirements.txt
python interfaz.py
```

Para correr las pruebas del cálculo de notas:

```bash
pip install pytest
python -m pytest test_calculos.py
```

*Si usas Linux Mint / Ubuntu y la interfaz no abre por falta de componentes gráficos, instala: `sudo apt install python3-tk -y`.*
