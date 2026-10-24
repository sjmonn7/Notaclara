# Funciones auxiliares compartidas por la interfaz.


def leer_numero(texto):
    """Convierte '5,5' o '5.5' en 5.5. Lanza ValueError si no es un número."""
    return float(texto.strip().replace(",", "."))


def porcentaje_disponible(asignatura):
    """Cuánto porcentaje queda por asignar para no pasar del 100 %."""
    usado = sum(float(evaluacion.porcentaje) for evaluacion in asignatura.evaluaciones)
    return round(100 - usado, 2)
