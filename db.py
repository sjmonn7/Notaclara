# Conexión a la base de datos MySQL usando peewee
from peewee import MySQLDatabase

import config

db = MySQLDatabase(
    config.DB_NAME,
    host=config.DB_HOST,
    port=config.DB_PORT,
    user=config.DB_USER,
    password=config.DB_PASSWORD,
    charset="utf8mb4",
)
