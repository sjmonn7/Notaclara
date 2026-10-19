# Funciones que muestran la información en tablas con prettytable
import math

from prettytable import PrettyTable

import calculos


def con_coma(numero, decimales=1):
    """Ej: 4.25 -> '4,25'"""
    return f"{numero:.{decimales}f}".replace(".", ",")


def formato_porcentaje(porcentaje):
    """Ej: 50.0 -> '50 %', 12.5 -> '12,5 %'"""
    return f"{float(porcentaje):g} %".replace(".", ",")


def redondear_hacia_arriba(nota):
    """Redondea a 1 decimal hacia arriba, para no quedar corto (4,21 -> 4,3)."""
    return math.ceil(round(nota * 10, 6)) / 10


def mostrar_asignaturas(asignaturas):
    tabla = PrettyTable(["N°", "Asignatura"])
    tabla.align["Asignatura"] = "l"
    for numero, asignatura in enumerate(asignaturas, start=1):
        tabla.add_row([numero, asignatura.nombre])
    print(tabla)


def mostrar_lista_evaluaciones(evaluaciones):
    """Tabla numerada para elegir una evaluación."""
    tabla = PrettyTable(["N°", "Evaluación", "Porcentaje", "Nota"])
    tabla.align["Evaluación"] = "l"
    for numero, evaluacion in enumerate(evaluaciones, start=1):
        nota = con_coma(evaluacion.nota) if evaluacion.nota is not None else "—"
        tabla.add_row([numero, evaluacion.nombre, formato_porcentaje(evaluacion.porcentaje), nota])
    print(tabla)


def mostrar_promedio(asignatura):
    """Opción 3: detalle de una asignatura con su nota acumulada y la nota mínima."""
    tabla = PrettyTable(["Evaluación", "Porcentaje", "Nota", "Aporte"])
    tabla.align["Evaluación"] = "l"
    for evaluacion in asignatura.evaluaciones:
        if evaluacion.nota is None:
            nota, aporte = "—", "—"
        else:
            nota = con_coma(evaluacion.nota)
            aporte = con_coma(calculos.aporte(float(evaluacion.nota), float(evaluacion.porcentaje)), 2)
        tabla.add_row([evaluacion.nombre, formato_porcentaje(evaluacion.porcentaje), nota, aporte])

    print(f"\n{asignatura.nombre}")
    print(tabla)

    notas = asignatura.notas()
    acumulada = calculos.nota_acumulada(notas)
    evaluado = calculos.porcentaje_evaluado(notas)
    print(f"Nota acumulada: {con_coma(acumulada, 2)} ({formato_porcentaje(evaluado)} evaluado)")
    print(texto_nota_minima(asignatura, acumulada, evaluado))


def texto_nota_minima(asignatura, acumulada, evaluado):
    aprobacion = float(asignatura.nota_aprobacion)
    minima = calculos.nota_minima(acumulada, 100 - evaluado, aprobacion)

    if minima is None:
        resultado = "Aprobado" if acumulada >= aprobacion else "Reprobado"
        return f"Nota final: {con_coma(acumulada)} → {resultado}"

    estado = calculos.estado_nota_minima(minima)
    if estado == "asegurada":
        return f"Nota mínima necesaria: {con_coma(minima)} → aprobación asegurada"
    if estado == "imposible":
        return f"Nota mínima necesaria: {con_coma(minima)} → ya no es posible aprobar"
    pendiente = formato_porcentaje(100 - evaluado)
    return f"Nota mínima necesaria: {con_coma(redondear_hacia_arriba(minima))} en el {pendiente} restante"


def mostrar_resumen(asignaturas):
    """Opción 4: cuánto necesita el estudiante en cada asignatura."""
    tabla = PrettyTable(["Asignatura", "Acumulada", "Evaluado", "¿Cuánto necesito?"])
    tabla.align["Asignatura"] = "l"
    tabla.align["¿Cuánto necesito?"] = "l"
    for asignatura in asignaturas:
        notas = asignatura.notas()
        acumulada = calculos.nota_acumulada(notas)
        evaluado = calculos.porcentaje_evaluado(notas)
        tabla.add_row([
            asignatura.nombre,
            con_coma(acumulada, 2),
            formato_porcentaje(evaluado),
            texto_necesito(asignatura, acumulada, evaluado),
        ])
    print(tabla)


def texto_necesito(asignatura, acumulada, evaluado):
    aprobacion = float(asignatura.nota_aprobacion)
    minima = calculos.nota_minima(acumulada, 100 - evaluado, aprobacion)

    if minima is None:
        return "Aprobado" if acumulada >= aprobacion else "Reprobado"
    estado = calculos.estado_nota_minima(minima)
    if estado == "asegurada":
        return "Aprobación asegurada"
    if estado == "imposible":
        return "Ya no es posible aprobar"
    return f"{con_coma(redondear_hacia_arriba(minima))} en el {formato_porcentaje(100 - evaluado)} restante"
