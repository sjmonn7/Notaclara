# NotaClara: calculadora de notas para estudiantes de INACAP
from peewee import OperationalError

import vistas
from db import db
from models import Asignatura, Evaluacion, crear_tablas

# ---------- Funciones para pedir datos (nunca hacen caer el programa) ----------


def leer_numero(texto):
    """Convierte '5,5' o '5.5' en 5.5. Lanza ValueError si no es un número."""
    return float(texto.strip().replace(",", "."))


def pedir_texto(mensaje):
    while True:
        texto = input(mensaje).strip()
        if texto:
            return texto
        print("No puede quedar vacío.")


def pedir_opcion(mensaje, maximo):
    """Pide un número entero entre 0 y maximo."""
    while True:
        texto = input(mensaje).strip()
        if texto.isdigit() and 0 <= int(texto) <= maximo:
            return int(texto)
        print(f"Opción inválida. Ingresa un número entre 0 y {maximo}.")


def pedir_nota(mensaje):
    """Pide una nota entre 1,0 y 7,0. Si se deja vacío devuelve None (pendiente)."""
    while True:
        texto = input(mensaje).strip()
        if texto == "":
            return None
        try:
            nota = leer_numero(texto)
        except ValueError:
            print("Ingresa un número, por ejemplo 5,5.")
            continue
        if 1.0 <= nota <= 7.0:
            return nota
        print("La nota debe estar entre 1,0 y 7,0.")


def pedir_porcentaje(mensaje, maximo):
    """Pide un porcentaje mayor que 0 y que no pase del máximo disponible."""
    while True:
        try:
            porcentaje = leer_numero(input(mensaje))
        except ValueError:
            print("Ingresa un número, por ejemplo 30.")
            continue
        if 0 < porcentaje <= maximo:
            return porcentaje
        print(f"El porcentaje debe ser mayor que 0 y como máximo {vistas.formato_porcentaje(maximo)}.")


def confirmar(mensaje):
    return input(f"{mensaje} (s/n): ").strip().lower() == "s"


# ---------- Elegir asignatura y evaluación ----------


def elegir_asignatura():
    asignaturas = list(Asignatura.select().order_by(Asignatura.id))
    vistas.mostrar_asignaturas(asignaturas)
    opcion = pedir_opcion("Elige una asignatura (0 para volver): ", len(asignaturas))
    if opcion == 0:
        return None
    return asignaturas[opcion - 1]


def elegir_evaluacion(asignatura):
    evaluaciones = list(asignatura.evaluaciones)
    if not evaluaciones:
        print("Esta asignatura no tiene evaluaciones.")
        return None
    vistas.mostrar_lista_evaluaciones(evaluaciones)
    opcion = pedir_opcion("Elige una evaluación (0 para volver): ", len(evaluaciones))
    if opcion == 0:
        return None
    return evaluaciones[opcion - 1]


# ---------- Evaluaciones ----------


def porcentaje_disponible(asignatura):
    """Cuánto porcentaje queda por asignar para no pasar del 100 %."""
    usado = sum(float(evaluacion.porcentaje) for evaluacion in asignatura.evaluaciones)
    return 100 - usado


def agregar_evaluacion(asignatura):
    disponible = porcentaje_disponible(asignatura)
    if disponible <= 0:
        print("Esta asignatura ya tiene el 100 % asignado.")
        return
    nombre = pedir_texto("Nombre de la evaluación: ")
    porcentaje = pedir_porcentaje(f"Porcentaje (disponible {vistas.formato_porcentaje(disponible)}): ", disponible)
    nota = pedir_nota("Nota (Enter si está pendiente): ")
    Evaluacion.create(asignatura=asignatura, nombre=nombre, porcentaje=porcentaje, nota=nota)
    print("Evaluación agregada.")


def editar_nota(asignatura):
    evaluacion = elegir_evaluacion(asignatura)
    if evaluacion is None:
        return
    evaluacion.nota = pedir_nota("Nueva nota (Enter para dejarla pendiente): ")
    evaluacion.save()
    print("Nota actualizada.")


def eliminar_evaluacion(asignatura):
    evaluacion = elegir_evaluacion(asignatura)
    if evaluacion is None:
        return
    if confirmar(f"¿Eliminar '{evaluacion.nombre}'?"):
        evaluacion.delete_instance()
        print("Evaluación eliminada.")


def menu_evaluaciones():
    asignatura = elegir_asignatura()
    if asignatura is None:
        return
    while True:
        print(f"\n--- Evaluaciones de {asignatura.nombre} ---")
        print("1. Agregar evaluación")
        print("2. Editar nota")
        print("3. Eliminar evaluación")
        print("0. Volver")
        opcion = pedir_opcion("Opción: ", 3)
        if opcion == 1:
            agregar_evaluacion(asignatura)
        elif opcion == 2:
            editar_nota(asignatura)
        elif opcion == 3:
            eliminar_evaluacion(asignatura)
        else:
            return


# ---------- Menú principal ----------


def ver_promedio():
    asignatura = elegir_asignatura()
    if asignatura is not None:
        vistas.mostrar_promedio(asignatura)


def menu_principal():
    while True:
        print("\n=== NotaClara ===")
        print("1. Ver asignaturas")
        print("2. Evaluaciones (agregar / editar nota / eliminar)")
        print("3. Ver promedio de una asignatura")
        print("4. ¿Cuánto necesito?")
        print("0. Salir")
        opcion = pedir_opcion("Opción: ", 4)
        if opcion == 1:
            vistas.mostrar_asignaturas(Asignatura.select().order_by(Asignatura.id))
        elif opcion == 2:
            menu_evaluaciones()
        elif opcion == 3:
            ver_promedio()
        elif opcion == 4:
            vistas.mostrar_resumen(Asignatura.select().order_by(Asignatura.id))
        else:
            print("¡Hasta luego!")
            return


def main():
    try:
        db.connect()
        crear_tablas()
        menu_principal()
    except OperationalError:
        print("\nNo se pudo conectar a MySQL.")
        print("Revisa que MySQL (WAMP) esté encendido, que exista la base de datos")
        print("(python crear_bd.py) y que los datos del archivo .env sean correctos.")
    except (KeyboardInterrupt, EOFError):
        print("\n¡Hasta luego!")
    finally:
        if not db.is_closed():
            db.close()


if __name__ == "__main__":
    main()
