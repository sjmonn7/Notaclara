# Cálculos de notas. Funciones puras: no usan la base de datos.
# "evaluaciones" es una lista de tuplas (nota, porcentaje), con el porcentaje de 0 a 100.
# Una nota None significa que la evaluación está pendiente.

NOTA_MINIMA = 1.0
NOTA_MAXIMA = 7.0


def aporte(nota, porcentaje):
    """Cuánto suma una evaluación a la nota final. Ej: 7,0 al 50 % aporta 3,5."""
    return nota * porcentaje / 100


def porcentaje_evaluado(evaluaciones):
    """Suma de los porcentajes de las evaluaciones que ya tienen nota."""
    return round(sum(porcentaje for nota, porcentaje in evaluaciones if nota is not None), 2)


def nota_acumulada(evaluaciones):
    """Suma de los aportes de las evaluaciones que ya tienen nota."""
    return round(sum(aporte(nota, porcentaje) for nota, porcentaje in evaluaciones if nota is not None), 6)


def nota_minima(acumulada, porcentaje_pendiente, nota_aprobacion=4.0):
    """Nota que se necesita en lo que falta para aprobar. None si no queda nada pendiente."""
    if porcentaje_pendiente <= 0:
        return None
    return (nota_aprobacion - acumulada) / (porcentaje_pendiente / 100)


def estado_nota_minima(minima):
    """Interpreta la nota mínima: 'asegurada', 'imposible' o 'posible'."""
    if minima <= NOTA_MINIMA:
        return "asegurada"
    if minima > NOTA_MAXIMA:
        return "imposible"
    return "posible"
