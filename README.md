# NotaClara (Versión Portable 🚀)

Calculadora de notas y promedios para estudiantes de INACAP. Esta rama (`sqlite-version`) contiene una adaptación **100% autónoma y portable**, diseñada para ejecutarse con un solo clic sin necesidad de configuraciones técnicas complicadas.

Proyecto universitario de Simon Masías y Fabián Rojas.

## 🌟 Qué hace el programa
- **Carga automática:** Las asignaturas de INACAP ya vienen listas (`Programación Orientada a Objetos`, `Bases de Datos Estructuradas`, etc.).
- **Gestión de evaluaciones:** Registra tus notas (de 1,0 a 7,0) junto con su respectivo porcentaje de ponderación.
- **Cálculos automáticos:** Calcula tu nota acumulada actual y te dice exactamente **cuánto necesitas obtener en las evaluaciones restantes** para aprobar con nota 4,0.

## 📦 Cómo usar (Sin instalar nada - Un solo clic)
Para usar la aplicación de forma inmediata en Linux:
1. Entra a la carpeta `dist/` de este repositorio.
2. Descarga el archivo ejecutable llamado `interfaz`.
3. Dale permisos de ejecución al archivo descargado:
   - *De forma visual:* Clic derecho sobre el archivo -> **Propiedades** -> pestaña **Permisos** -> Marca la casilla **"Permitir ejecutar el archivo como un programa"**.
   - *O por terminal:* Ejecuta `chmod +x interfaz`.
4. ¡Haz **doble clic** sobre el archivo y la aplicación se abrirá! 

*Nota: La base de datos (`notaclara.db`) se creará sola en la misma carpeta al abrir el programa por primera vez.*

---

## 🛠️ Desarrollo e Instalación (Opcional)
Si eres desarrollador y deseas ejecutar el código fuente en Python, solo necesitas clonar esta rama y activar tu entorno virtual:

```bash
# Instalar librerías del proyecto
pip install -r requirements.txt

# Ejecutar la versión gráfica
python interfaz.py

# Ejecutar la versión de terminal
python main.py
```

*Si usas Linux Mint / Ubuntu y la interfaz no despliega las ventanas por falta de componentes gráficos de tu sistema, soluciónalo con: `sudo apt install python3-tk -y`.*
