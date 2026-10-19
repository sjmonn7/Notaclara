# NotaClara (Versión Portable 🚀)

Calculadora de notas y promedios para estudiantes de INACAP. Esta rama (`sqlite-version`) contiene una adaptación **100% autónoma y portable**, diseñada para ejecutarse con un solo clic sin necesidad de configuraciones técnicas complicadas.

Proyecto universitario de Simon Masías y Fabián Rojas.

## 🌟 Qué hace el programa
- **Tus propias asignaturas:** la app parte vacía. Agrega tus ramos con el botón **+**, anota cada evaluación con su porcentaje y su nota, y todo queda guardado para la próxima vez.
- **Archivar y renombrar:** corrige nombres o archiva ramos de semestres anteriores sin perder sus notas; los restauras desde "Ver archivadas".
- **Gestión de evaluaciones:** registra tus notas (de 1,0 a 7,0) junto con su porcentaje de ponderación.
- **Cálculos automáticos:** calcula tu nota acumulada actual y te dice exactamente **cuánto necesitas obtener en las evaluaciones restantes** para aprobar con nota 4,0.

## 📦 Cómo usar (sin instalar nada)
El ejecutable disponible hoy es para **Linux**.

1. Entra a la sección **[Releases](../../releases)** de este repositorio.
2. Descarga el archivo `NotaClara`.
3. Dale permisos de ejecución:
   - *De forma visual:* clic derecho sobre el archivo → **Propiedades** → pestaña **Permisos** → marca **"Permitir ejecutar el archivo como un programa"**.
   - *O por terminal:* `chmod +x NotaClara`.
4. Haz **doble clic** sobre el archivo y la aplicación se abrirá.

*Tus datos se guardan automáticamente en `~/.notaclara/notaclara.db` (en tu carpeta personal). Si quieres empezar de cero, borra esa carpeta.*

---

## 🛠️ Desarrollo e instalación (opcional)
Si quieres ejecutar el código fuente en Python (por ejemplo, en Windows o macOS), clona esta rama y activa un entorno virtual:

```bash
git clone -b sqlite-version https://github.com/sjmonn7/Notaclara.git
cd Notaclara
python3 -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate

pip install -r requirements.txt
python interfaz.py
```

*Si usas Linux Mint / Ubuntu y la interfaz no abre por falta de componentes gráficos, instala: `sudo apt install python3-tk -y`.*