from pathlib import Path
from peewee import SqliteDatabase

# La base de datos queda en la carpeta personal del usuario, siempre en el mismo lugar
_carpeta = Path.home() / ".notaclara"
_carpeta.mkdir(exist_ok=True)

db = SqliteDatabase(str(_carpeta / "notaclara.db"), pragmas={"foreign_keys": 1})
