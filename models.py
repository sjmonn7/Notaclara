# Modelos de la base de datos adaptados para SQLite
from decimal import Decimal
from peewee import CharField, DecimalField, ForeignKeyField, Model
from db import db

# Asignaturas que se cargan automáticamente en la base de datos
ASIGNATURAS = [
    "Funciones y Matrices",
    "Programación Orientada a Objetos",
    "Bases de Datos Estructuradas",
    "Administración",
    "Modelamiento de Soluciones Informáticas",
    "Metodología de Desarrollo Ágil",
]


class ModeloBase(Model):
    class Meta:
        database = db
        # Se removió ENGINE=InnoDB ya que SQLite maneja claves foráneas automáticamente


class Asignatura(ModeloBase):
    nombre = CharField(max_length=100, unique=True)
    nota_aprobacion = DecimalField(max_digits=2, decimal_places=1, default=Decimal("4.0"))

    def notas(self):
        """Devuelve una lista de (nota, porcentaje) como float. La nota es None si está pendiente."""
        lista = []
        for evaluacion in self.evaluaciones:
            nota = float(evaluacion.nota) if evaluacion.nota is not None else None
            lista.append((nota, float(evaluacion.porcentaje)))
        return lista


class Evaluacion(ModeloBase):
    asignatura = ForeignKeyField(Asignatura, backref="evaluaciones", on_delete="CASCADE")
    nombre = CharField(max_length=100)
    porcentaje = DecimalField(max_digits=5, decimal_places=2)  # de 0 a 100
    nota = DecimalField(max_digits=2, decimal_places=1, null=True)  # vacía si está pendiente


def crear_tablas():
    """Crea las tablas (si no existen) y carga las asignaturas."""
    db.create_tables([Asignatura, Evaluacion])
    for nombre in ASIGNATURAS:
        Asignatura.get_or_create(nombre=nombre)
