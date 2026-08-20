# Métricas de los reportes

Qué mide cada número, con qué datos se calcula y qué decisión habilita.
Todo sale de lo ya cargado: no hay campos extra que alguien deba completar.
El código vive en `src/lib/analytics.ts`, con tests en `analytics.test.ts`.

## De dónde salen los datos

| Fuente | Qué aporta |
| --- | --- |
| `tasks.created_at` | cuándo entró el trabajo al sistema |
| `tasks.completed_at` | cuándo se cerró (lo sella el cambio a un estado terminal) |
| `tasks.due_date` | la fecha comprometida |
| `activity_log` (campo `etapa`) | el recorrido por el tablero, con hora |

El historial es lo que permite medir **dónde se traba el trabajo**. Se escribe
solo, en cada cambio de etapa, desde `src/actions/log.ts`.

## Las métricas

**Lead time** — días entre que la tarea se crea y se cierra. Es el tiempo que
percibe quien pidió el trabajo, incluida la espera antes de empezar.

**Cycle time** — días entre el primer movimiento real de la tarea y su cierre.
Es el tiempo de ejecución. Si el lead time es muy superior al cycle time, el
problema no es la velocidad del equipo: es la cola.

**Atraso al cerrar** — días entre la fecha comprometida y la de cierre.
Positivo = cerró tarde. El promedio del reporte considera **solo las que
cerraron tarde**: mezclar los adelantos diluiría el atraso y lo haría parecer
menor de lo que fue.

**Puntualidad** — porcentaje de tareas cerradas dentro de la fecha, sobre las
que tenían fecha. Las que no tenían quedan aparte, contadas como "no se pueden
juzgar" en lugar de sumarse como si hubieran cumplido.

**Tiempo por etapa** — se reconstruye del historial: cada cambio de etapa
cierra el tramo anterior. El tramo abierto de una tarea viva se cierra en el
momento actual, a propósito: una tarea trabada hace dos semanas *es* el
problema que el reporte tiene que mostrar, y descartarla lo escondería.

**Aging del WIP** — hace cuánto espera cada tarea abierta, en bandas. Las
bandas altas son deuda: trabajo que nadie cerró y que probablemente ya no
refleja la realidad.

**Throughput semanal** — cuánto entra contra cuánto sale por semana. Si lo
creado supera a lo cerrado de forma sostenida, la cola crece y ninguna
promesa de fecha se sostiene.

## Decisiones de cálculo

**Las canceladas quedan afuera de todo.** No se hicieron ni se van a hacer;
contarlas hundiría los porcentajes de equipos que simplemente descartaron
trabajo.

**El estado terminal es un flag, no un nombre.** Renombrar "Completado" no
rompe ninguna métrica; lo que define el cierre es `statuses.is_done`.

**Los promedios devuelven `null`, no cero, cuando no hay datos.** Un cero se
lee como "rindió pésimo"; un guion se lee como "todavía no hay con qué
juzgar", que es la verdad.

**Las fechas se comparan en días de calendario y en UTC.** El planificador
razona en días, no en instantes, y el cálculo en UTC evita el corrimiento de
un día por horario de verano.

## Sobre los gráficos

Están construidos a mano en `src/components/charts/`, sin librería externa.
Las reglas que siguen:

- **La forma la elige el trabajo del dato.** Magnitud con nombres largos →
  barras horizontales. Parte-de-un-todo de un vistazo → dona, con pocos
  gajos. Una razón contra un límite → medidor. Un número suelto → una ficha,
  no un gráfico de una sola barra.
- **Un solo eje.** Dos medidas de escalas distintas van en dos gráficos: un
  segundo eje inventa correlaciones que los datos no tienen.
- **Una serie, un color.** No se pinta cada barra de un tono distinto según su
  tamaño: duplicaría en color lo que el largo ya dice.
- **Énfasis en gris.** Cuando importa una sola barra, el resto va en gris, no
  en el mismo color diluido.
- **La rampa ordinal solo donde hay orden real** (bandas de antigüedad).
- **Ningún valor depende del color ni del hover.** Cada tarjeta tiene su vista
  de tabla, y las etiquetas van fuera de la barra para que nunca se recorten.
- **La paleta está validada**, no elegida a ojo: separación para daltonismo y
  contraste contra las superficies reales de la app, en claro y en oscuro.
