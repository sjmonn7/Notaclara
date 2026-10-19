# NotaClara con interfaz gráfica (customtkinter).
# Usa los mismos modelos y cálculos que la versión de terminal (main.py).
import tkinter as tk
from tkinter import messagebox, ttk

import customtkinter as ctk
from peewee import OperationalError

import calculos
import vistas
from db import db
from main import leer_numero, porcentaje_disponible
from models import Asignatura, Evaluacion, crear_tablas

COLORES = {"verde": "#2fa572", "amarillo": "#e0a526", "rojo": "#e05252"}
COLOR_TARJETA = "#2b2b2b"
COLOR_SELECCION = "#1f538d"


# ---------- Validación de datos ----------


def convertir_nota(texto):
    """'5,5' -> 5.5. Vacío -> None (pendiente). Lanza ValueError si no es válida."""
    texto = texto.strip()
    if texto == "":
        return None
    try:
        nota = leer_numero(texto)
    except ValueError:
        raise ValueError("La nota debe ser un número, por ejemplo 5,5.") from None
    if not 1.0 <= nota <= 7.0:
        raise ValueError("La nota debe estar entre 1,0 y 7,0.")
    return nota


def convertir_porcentaje(texto, disponible):
    """'30' -> 30.0. Lanza ValueError si no es válido o pasa del disponible."""
    try:
        porcentaje = leer_numero(texto)
    except ValueError:
        raise ValueError("El porcentaje debe ser un número, por ejemplo 30.") from None
    if not 0 < porcentaje <= disponible:
        raise ValueError(f"El porcentaje debe ser mayor que 0 y como máximo {vistas.formato_porcentaje(disponible)}.")
    return porcentaje


# ---------- Cálculo del estado de una asignatura ----------


def estado_minima(asignatura, acumulada, evaluado):
    """Devuelve (valor, descripción, color) para mostrar la nota mínima."""
    aprobacion = float(asignatura.nota_aprobacion)
    minima = calculos.nota_minima(acumulada, 100 - evaluado, aprobacion)

    if minima is None:
        if acumulada >= aprobacion:
            return vistas.con_coma(acumulada), "Nota final · Aprobado", "verde"
        return vistas.con_coma(acumulada), "Nota final · Reprobado", "rojo"

    estado = calculos.estado_nota_minima(minima)
    if estado == "asegurada":
        return vistas.con_coma(minima), "Aprobación asegurada", "verde"
    if estado == "imposible":
        return vistas.con_coma(minima), "Ya no es posible aprobar", "rojo"
    pendiente = vistas.formato_porcentaje(100 - evaluado)
    return vistas.con_coma(vistas.redondear_hacia_arriba(minima)), f"en el {pendiente} restante", "amarillo"


# ---------- Ventana principal ----------


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("NotaClara")
        self.geometry("1050x650")
        self.minsize(950, 600)
        self.report_callback_exception = self.mostrar_error_inesperado

        self.asignatura = None
        self.botones_asignaturas = {}

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        self.configurar_estilo_tablas()
        self.crear_barra_lateral()
        self.crear_panel_asignatura()
        self.crear_panel_resumen()
        self.mostrar_resumen()

    # ----- Estilo de las tablas (ttk.Treeview no viene en customtkinter) -----

    def configurar_estilo_tablas(self):
        escala = ctk.ScalingTracker.get_window_scaling(self)
        estilo = ttk.Style()
        estilo.theme_use("clam")
        estilo.layout("Treeview", [("Treeview.treearea", {"sticky": "nswe"})])  # quita el borde blanco
        estilo.configure(
            "Treeview",
            background=COLOR_TARJETA,
            fieldbackground=COLOR_TARJETA,
            foreground="#dce4ee",
            rowheight=int(32 * escala),
            borderwidth=0,
            font=("Segoe UI", 11),
        )
        estilo.configure(
            "Treeview.Heading",
            background="#333333",
            foreground="#dce4ee",
            relief="flat",
            font=("Segoe UI", 11, "bold"),
        )
        estilo.map("Treeview", background=[("selected", COLOR_SELECCION)])
        estilo.map("Treeview.Heading", background=[("active", "#3d3d3d")])

    def crear_tabla(self, padre, columnas, anchos):
        """Crea una tabla con las columnas dadas: {clave: título}."""
        tabla = ttk.Treeview(padre, columns=list(columnas), show="headings", selectmode="browse")
        for clave, titulo in columnas.items():
            alineacion = "w" if clave == "nombre" else "center"
            tabla.heading(clave, text=titulo, anchor=alineacion)
            tabla.column(clave, width=anchos[clave], anchor=alineacion)
        for nombre, color in COLORES.items():
            tabla.tag_configure(nombre, foreground=color)
        return tabla

    # ----- Barra lateral -----

    def crear_barra_lateral(self):
        barra = ctk.CTkFrame(self, width=260, corner_radius=0)
        barra.grid(row=0, column=0, sticky="nsew")
        barra.grid_propagate(False)

        ctk.CTkLabel(barra, text="NotaClara", font=ctk.CTkFont(size=26, weight="bold")).pack(pady=(28, 0))
        ctk.CTkLabel(barra, text="Calculadora de notas INACAP", text_color="gray").pack(pady=(0, 24))

        self.boton_resumen = ctk.CTkButton(barra, text="¿Cuánto necesito?", height=38, command=self.mostrar_resumen)
        self.boton_resumen.pack(fill="x", padx=16, pady=(0, 20))

        ctk.CTkLabel(barra, text="ASIGNATURAS", text_color="gray", font=ctk.CTkFont(size=12, weight="bold")).pack(
            anchor="w", padx=20
        )
        for asignatura in Asignatura.select().order_by(Asignatura.id):
            boton = ctk.CTkButton(
                barra,
                text=asignatura.nombre,
                anchor="w",
                height=36,
                fg_color="transparent",
                text_color=("gray10", "gray90"),
                hover_color=("gray75", "gray25"),
                command=lambda a=asignatura: self.abrir_asignatura(a),
            )
            boton.pack(fill="x", padx=10, pady=2)
            self.botones_asignaturas[asignatura.id] = boton

    def marcar_boton(self, asignatura_id):
        """Resalta en la barra lateral la asignatura abierta."""
        for id_boton, boton in self.botones_asignaturas.items():
            boton.configure(fg_color=COLOR_SELECCION if id_boton == asignatura_id else "transparent")

    # ----- Panel de una asignatura (opción 3 y evaluaciones) -----

    def crear_panel_asignatura(self):
        panel = ctk.CTkFrame(self, fg_color="transparent")
        panel.grid_columnconfigure(0, weight=1)
        panel.grid_rowconfigure(2, weight=1)
        self.panel_asignatura = panel

        self.titulo = ctk.CTkLabel(panel, text="", font=ctk.CTkFont(size=24, weight="bold"))
        self.titulo.grid(row=0, column=0, sticky="w", pady=(0, 16))

        self.crear_tarjetas(panel)
        self.crear_tabla_evaluaciones(panel)
        self.crear_formulario(panel)

    def crear_tarjetas(self, panel):
        tarjetas = ctk.CTkFrame(panel, fg_color="transparent")
        tarjetas.grid(row=1, column=0, sticky="ew", pady=(0, 16))
        tarjetas.grid_columnconfigure((0, 1, 2), weight=1, uniform="tarjeta")

        self.valor_acumulada, _ = self.crear_tarjeta(tarjetas, 0, "Nota acumulada")
        self.valor_evaluado, _ = self.crear_tarjeta(tarjetas, 1, "Evaluado")
        self.valor_minima, self.detalle_minima = self.crear_tarjeta(tarjetas, 2, "Nota mínima necesaria")

    def crear_tarjeta(self, padre, columna, titulo):
        tarjeta = ctk.CTkFrame(padre, fg_color=COLOR_TARJETA, corner_radius=12)
        tarjeta.grid(row=0, column=columna, sticky="nsew", padx=(0 if columna == 0 else 8, 0))
        ctk.CTkLabel(tarjeta, text=titulo, text_color="gray").pack(anchor="w", padx=16, pady=(12, 0))
        valor = ctk.CTkLabel(tarjeta, text="", font=ctk.CTkFont(size=30, weight="bold"))
        valor.pack(anchor="w", padx=16)
        detalle = ctk.CTkLabel(tarjeta, text="", text_color="gray")
        detalle.pack(anchor="w", padx=16, pady=(0, 12))
        return valor, detalle

    def crear_tabla_evaluaciones(self, panel):
        marco = ctk.CTkFrame(panel, fg_color=COLOR_TARJETA, corner_radius=12)
        marco.grid(row=2, column=0, sticky="nsew")
        marco.grid_columnconfigure(0, weight=1)
        marco.grid_rowconfigure(0, weight=1)

        columnas = {"nombre": "Evaluación", "porcentaje": "Porcentaje", "nota": "Nota", "aporte": "Aporte"}
        anchos = {"nombre": 300, "porcentaje": 120, "nota": 100, "aporte": 100}
        self.tabla_evaluaciones = self.crear_tabla(marco, columnas, anchos)
        self.tabla_evaluaciones.grid(row=0, column=0, columnspan=3, sticky="nsew", padx=12, pady=(12, 8))
        self.tabla_evaluaciones.bind("<Double-1>", lambda evento: self.editar_nota())

        ctk.CTkLabel(marco, text="Doble clic en una evaluación para editar su nota", text_color="gray").grid(
            row=1, column=0, sticky="w", padx=16, pady=(0, 12)
        )
        ctk.CTkButton(marco, text="Editar nota", width=120, command=self.editar_nota).grid(
            row=1, column=1, padx=(0, 8), pady=(0, 12)
        )
        ctk.CTkButton(
            marco, text="Eliminar", width=120, fg_color="#a83232", hover_color="#7d2424",
            command=self.eliminar_evaluacion,
        ).grid(row=1, column=2, padx=(0, 12), pady=(0, 12))

    def crear_formulario(self, panel):
        formulario = ctk.CTkFrame(panel, fg_color=COLOR_TARJETA, corner_radius=12)
        formulario.grid(row=3, column=0, sticky="ew", pady=(16, 0))
        formulario.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(formulario, text="Nueva evaluación", font=ctk.CTkFont(size=15, weight="bold")).grid(
            row=0, column=0, sticky="w", padx=16, pady=(12, 4)
        )
        self.texto_disponible = ctk.CTkLabel(formulario, text="", text_color="gray")
        self.texto_disponible.grid(row=0, column=1, columnspan=3, sticky="e", padx=16, pady=(12, 4))

        self.entrada_nombre = ctk.CTkEntry(formulario, placeholder_text="Nombre (ej: Prueba 1)")
        self.entrada_porcentaje = ctk.CTkEntry(formulario, placeholder_text="Porcentaje", width=120)
        self.entrada_nota = ctk.CTkEntry(formulario, placeholder_text="Nota (vacío = pendiente)", width=180)
        self.entrada_nombre.grid(row=1, column=0, sticky="ew", padx=(16, 8), pady=(0, 14))
        self.entrada_porcentaje.grid(row=1, column=1, padx=(0, 8), pady=(0, 14))
        self.entrada_nota.grid(row=1, column=2, padx=(0, 8), pady=(0, 14))
        ctk.CTkButton(formulario, text="Agregar", width=120, command=self.agregar_evaluacion).grid(
            row=1, column=3, padx=(0, 16), pady=(0, 14)
        )
        for entrada in (self.entrada_nombre, self.entrada_porcentaje, self.entrada_nota):
            entrada.bind("<Return>", lambda evento: self.agregar_evaluacion())

    # ----- Panel resumen (opción 4) -----

    def crear_panel_resumen(self):
        panel = ctk.CTkFrame(self, fg_color="transparent")
        panel.grid_columnconfigure(0, weight=1)
        panel.grid_rowconfigure(1, weight=1)
        self.panel_resumen = panel

        ctk.CTkLabel(panel, text="¿Cuánto necesito?", font=ctk.CTkFont(size=24, weight="bold")).grid(
            row=0, column=0, sticky="w", pady=(0, 16)
        )
        marco = ctk.CTkFrame(panel, fg_color=COLOR_TARJETA, corner_radius=12)
        marco.grid(row=1, column=0, sticky="nsew")
        marco.grid_columnconfigure(0, weight=1)
        marco.grid_rowconfigure(0, weight=1)

        columnas = {"nombre": "Asignatura", "acumulada": "Acumulada", "evaluado": "Evaluado", "necesito": "¿Cuánto necesito?"}
        anchos = {"nombre": 310, "acumulada": 95, "evaluado": 85, "necesito": 200}
        self.tabla_resumen = self.crear_tabla(marco, columnas, anchos)
        self.tabla_resumen.grid(row=0, column=0, sticky="nsew", padx=12, pady=(12, 8))
        self.tabla_resumen.bind("<Double-1>", lambda evento: self.abrir_desde_resumen())

        ctk.CTkLabel(marco, text="Doble clic en una asignatura para ver sus evaluaciones", text_color="gray").grid(
            row=1, column=0, sticky="w", padx=16, pady=(0, 12)
        )

    # ----- Cambiar de vista -----

    def mostrar_panel(self, panel):
        self.panel_asignatura.grid_forget()
        self.panel_resumen.grid_forget()
        panel.grid(row=0, column=1, sticky="nsew", padx=24, pady=24)

    def mostrar_resumen(self):
        self.asignatura = None
        self.marcar_boton(None)
        self.mostrar_panel(self.panel_resumen)
        self.tabla_resumen.delete(*self.tabla_resumen.get_children())

        for asignatura in Asignatura.select().order_by(Asignatura.id):
            notas = asignatura.notas()
            acumulada = calculos.nota_acumulada(notas)
            evaluado = calculos.porcentaje_evaluado(notas)
            _, _, color = estado_minima(asignatura, acumulada, evaluado)
            fila = (
                asignatura.nombre,
                vistas.con_coma(acumulada, 2),
                vistas.formato_porcentaje(evaluado),
                vistas.texto_necesito(asignatura, acumulada, evaluado),
            )
            self.tabla_resumen.insert("", "end", iid=str(asignatura.id), values=fila, tags=(color,))

    def abrir_desde_resumen(self):
        seleccion = self.tabla_resumen.selection()
        if seleccion:
            self.abrir_asignatura(Asignatura.get_by_id(int(seleccion[0])))

    def abrir_asignatura(self, asignatura):
        self.asignatura = asignatura
        self.marcar_boton(asignatura.id)
        self.mostrar_panel(self.panel_asignatura)
        self.actualizar_asignatura()

    def actualizar_asignatura(self):
        """Vuelve a leer la asignatura desde la base de datos y actualiza la pantalla."""
        asignatura = Asignatura.get_by_id(self.asignatura.id)
        self.asignatura = asignatura
        self.titulo.configure(text=asignatura.nombre)

        tabla = self.tabla_evaluaciones
        tabla.delete(*tabla.get_children())
        for evaluacion in asignatura.evaluaciones.order_by(Evaluacion.id):
            if evaluacion.nota is None:
                nota, aporte = "—", "—"
            else:
                nota = vistas.con_coma(evaluacion.nota)
                aporte = vistas.con_coma(calculos.aporte(float(evaluacion.nota), float(evaluacion.porcentaje)), 2)
            fila = (evaluacion.nombre, vistas.formato_porcentaje(evaluacion.porcentaje), nota, aporte)
            tabla.insert("", "end", iid=str(evaluacion.id), values=fila)

        notas = asignatura.notas()
        acumulada = calculos.nota_acumulada(notas)
        evaluado = calculos.porcentaje_evaluado(notas)
        valor, detalle, color = estado_minima(asignatura, acumulada, evaluado)

        self.valor_acumulada.configure(text=vistas.con_coma(acumulada, 2))
        self.valor_evaluado.configure(text=vistas.formato_porcentaje(evaluado))
        self.valor_minima.configure(text=valor, text_color=COLORES[color])
        self.detalle_minima.configure(text=detalle, text_color=COLORES[color])
        disponible = porcentaje_disponible(asignatura)
        self.texto_disponible.configure(text=f"Porcentaje disponible: {vistas.formato_porcentaje(disponible)}")

    # ----- Acciones sobre evaluaciones -----

    def evaluacion_seleccionada(self):
        seleccion = self.tabla_evaluaciones.selection()
        if not seleccion:
            messagebox.showinfo("NotaClara", "Primero selecciona una evaluación de la tabla.")
            return None
        return Evaluacion.get_by_id(int(seleccion[0]))

    def agregar_evaluacion(self):
        disponible = porcentaje_disponible(self.asignatura)
        if disponible <= 0:
            messagebox.showwarning("NotaClara", "Esta asignatura ya tiene el 100 % asignado.")
            return
        nombre = self.entrada_nombre.get().strip()
        if not nombre:
            messagebox.showwarning("NotaClara", "Escribe el nombre de la evaluación.")
            return
        try:
            porcentaje = convertir_porcentaje(self.entrada_porcentaje.get(), disponible)
            nota = convertir_nota(self.entrada_nota.get())
        except ValueError as error:
            messagebox.showwarning("NotaClara", str(error))
            return

        Evaluacion.create(asignatura=self.asignatura, nombre=nombre, porcentaje=porcentaje, nota=nota)
        for entrada in (self.entrada_nombre, self.entrada_porcentaje, self.entrada_nota):
            entrada.delete(0, "end")
        self.entrada_nombre.focus()
        self.actualizar_asignatura()

    def editar_nota(self):
        evaluacion = self.evaluacion_seleccionada()
        if evaluacion is None:
            return
        dialogo = ctk.CTkInputDialog(
            title="Editar nota", text=f"Nueva nota para '{evaluacion.nombre}'\n(deja vacío si está pendiente):"
        )
        texto = dialogo.get_input()
        if texto is None:  # se canceló
            return
        try:
            evaluacion.nota = convertir_nota(texto)
        except ValueError as error:
            messagebox.showwarning("NotaClara", str(error))
            return
        evaluacion.save()
        self.actualizar_asignatura()

    def eliminar_evaluacion(self):
        evaluacion = self.evaluacion_seleccionada()
        if evaluacion is None:
            return
        if messagebox.askyesno("NotaClara", f"¿Eliminar '{evaluacion.nombre}'?"):
            evaluacion.delete_instance()
            self.actualizar_asignatura()

    # ----- Errores -----

    def mostrar_error_inesperado(self, tipo, error, traza):
        """Muestra los errores en una ventana en vez de una traza en la consola."""
        if isinstance(error, OperationalError):
            messagebox.showerror("NotaClara", "Se perdió la conexión con MySQL. Revisa que WAMP esté encendido.")
        else:
            messagebox.showerror("NotaClara", f"Ocurrió un error inesperado:\n{error}")


def main():
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")
    try:
        db.connect()
        crear_tablas()
    except OperationalError:
        ventana = tk.Tk()
        ventana.withdraw()
        messagebox.showerror(
            "NotaClara",
            "No se pudo conectar a MySQL.\n\nRevisa que WAMP esté encendido, que exista la base de datos "
            "(crear_bd.sql) y que los datos del archivo .env sean correctos.",
        )
        ventana.destroy()
        return

    app = App()
    app.mainloop()
    db.close()


if __name__ == "__main__":
    main()
