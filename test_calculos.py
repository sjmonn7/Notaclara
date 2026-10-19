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


if __name__ == "__main__":
    unittest.main()
