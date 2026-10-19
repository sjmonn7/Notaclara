# Crea la base de datos (si no existe), las tablas y carga las asignaturas.
# Se ejecuta una sola vez: python crear_bd.py
import pymysql

import config


def crear_base_de_datos():
    conexion = pymysql.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
    )
    with conexion.cursor() as cursor:
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{config.DB_NAME}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
    conexion.close()


if __name__ == "__main__":
    try:
        crear_base_de_datos()
    except pymysql.err.OperationalError:
        print("No se pudo conectar a MySQL. Revisa que esté encendido y los datos del archivo .env.")
        raise SystemExit(1)

    # Se importa aquí porque la base de datos ya debe existir
    from models import crear_tablas

    crear_tablas()
    print(f"Base de datos '{config.DB_NAME}' lista, con sus tablas y asignaturas.")
