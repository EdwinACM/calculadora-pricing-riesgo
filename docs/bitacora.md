# Bitácora de decisiones

Corrida del 12 de noviembre de 2026.

1. La calculadora trabaja en tasas anuales. riesgo-credito-politicas usó tasas mensuales y su README advierte que las cifras salían exageradas, porque la base tiene 22% de incumplimiento mensual.
2. El plazo entra a la fórmula por la PD acumulada: con una tasa de incumplimiento constante, la PD a T años es 1 menos (1 menos PD) elevado a T. La pérdida esperada se anualiza dividiéndola entre T. A 12 meses da PD por LGD.
3. Se supone un crédito de pago único al vencimiento con exposición constante. Un crédito que amortiza tendría una exposición promedio menor y una pérdida esperada distinta. Es una simplificación y está declarada en los límites del README.
4. El fondeo se aplica solo a la parte no financiada con capital, y el capital cuesta el rendimiento exigido. Si el capital asignado es cero, el rendimiento exigido no afecta la tasa.
5. Las bandas de PD salen de `resultados/precio_riesgo.csv` de riesgo-credito-politicas: 306, 5,961, 1,541 y 1,192 clientes con PD media de 7.4%, 13.1%, 28.7% y 61.3%. Una prueba compara el código con ese archivo.
6. Esas PD son del mes siguiente, así que no se usan como PD anual. Se usa su forma: cada banda se reescala por su cociente contra el promedio ponderado (21.9%) para que el promedio de las bandas sea la PD que escribe la persona. Cada PD reescalada tiene tope de 100%.
7. La tasa plana es el promedio ponderado por clientes de las tasas mínimas de las bandas, de modo que el subsidio cruzado ponderado suma cero. Ponderé por clientes y no por exposición porque el archivo de resultados no trae la exposición por banda.
8. Los escenarios mueven PD, LGD y fondeo con factores fijos (optimista: 0.7, menos 5 puntos, menos 1 punto; estrés: 1.5, más 10 puntos, más 2 puntos). Son ilustrativos.
9. Límites de entrada: PD y LGD de 0 a 100%, fondeo, gastos y capital de 0 a 50%, rendimiento de 0 a 100%, plazo de 1 a 360 meses enteros. Fuera de rango o vacío, no se calcula y se marca el campo.
10. Las pruebas existen en JavaScript (node --test) y en Python, que reescribe la fórmula y además llama a Node con 200 casos al azar para comparar ambos resultados.
