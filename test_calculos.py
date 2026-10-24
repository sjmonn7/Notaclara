# Pruebas de calculos.py. Ejecutar con: python -m unittest test_calculos
import unittest

import calculos

# Ejemplo: 7,0 al 50 %, 3,0 al 25 % y un examen del 25 % pendiente
EJEMPLO = [(7.0, 50), (3.0, 25), (None, 25)]


class PruebasCalculos(unittest.TestCase):
    def test_aporte(self):
        self.assertAlmostEqual(calculos.aporte(7.0, 50), 3.5)
        self.assertAlmostEqual(calculos.aporte(3.0, 25), 0.75)

    def test_nota_acumulada(self):
        self.assertAlmostEqual(calculos.nota_acumulada(EJEMPLO), 4.25)

    def test_porcentaje_evaluado(self):
        self.assertAlmostEqual(calculos.porcentaje_evaluado(EJEMPLO), 75)

    def test_nota_minima_asegurada(self):
        minima = calculos.nota_minima(4.25, 25)
        self.assertAlmostEqual(minima, -1.0)
        self.assertEqual(calculos.estado_nota_minima(minima), "asegurada")

    def test_nota_minima_posible(self):
        # 3,0 al 50 % -> acumulada 1,5; necesita 5,0 en el 50 % restante
        minima = calculos.nota_minima(1.5, 50)
        self.assertAlmostEqual(minima, 5.0)
        self.assertEqual(calculos.estado_nota_minima(minima), "posible")

    def test_nota_minima_imposible(self):
        # 1,0 al 80 % -> acumulada 0,8; necesitaría 16,0 en el 20 % restante
        minima = calculos.nota_minima(0.8, 20)
        self.assertEqual(calculos.estado_nota_minima(minima), "imposible")

    def test_sin_porcentaje_pendiente(self):
        self.assertIsNone(calculos.nota_minima(4.5, 0))

    def test_residuo_decimal_no_deja_pendiente(self):
        evaluaciones = [(5.0, 33.3), (5.0, 33.3), (5.0, 33.3), (5.0, 0.1)]
        evaluado = calculos.porcentaje_evaluado(evaluaciones)
        self.assertEqual(100 - evaluado, 0)
        self.assertIsNone(calculos.nota_minima(calculos.nota_acumulada(evaluaciones), 100 - evaluado))

    def test_sin_evaluaciones(self):
        self.assertEqual(calculos.porcentaje_evaluado([]), 0)
        self.assertEqual(calculos.nota_acumulada([]), 0)
        self.assertEqual(calculos.nota_minima(0, 100), 4.0)

    def test_todas_pendientes(self):
        evaluaciones = [(None, 30), (None, 70)]
        self.assertEqual(calculos.porcentaje_evaluado(evaluaciones), 0)
        self.assertEqual(calculos.nota_acumulada(evaluaciones), 0)

    def test_aprobacion_justa_en_100_por_ciento(self):
        evaluaciones = [(4.8, 50), (3.2, 50)]
        self.assertEqual(calculos.nota_acumulada(evaluaciones), 4.0)

    def test_nota_minima_exacta_uno_es_asegurada(self):
        self.assertEqual(calculos.estado_nota_minima(1.0), "asegurada")