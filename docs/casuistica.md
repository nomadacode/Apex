# Casuística

Los casos que definen comportamiento no obvio, resueltos antes de programar.
Cada uno indica dónde vive la decisión en el código.

## Fechas y vencimientos

| Caso | Comportamiento | Dónde |
| --- | --- | --- |
| Tarea sin fecha límite | Días restantes vacío. No cuenta como atrasada. No aparece en el calendario mensual. | `derive.ts → daysRemaining` |
| Tarea sin ninguna fecha | Tampoco se dibuja en el Gantt; se avisa cuántas quedaron afuera. | `gantt-chart.tsx` |
| Fecha de inicio posterior a la fecha límite | Se rechaza al guardar con mensaje explícito. Nunca se persiste el estado inconsistente. | `actions/tasks.ts → validateDates` |
| Arrastrar el extremo de una barra más allá del otro | Se rechaza con aviso; la barra vuelve a su lugar. | `gantt-chart.tsx → handlePointerUp` |
| Fecha límite en festivo o día no laborable | Se permite, pero el día se marca visualmente en calendarios y Gantt. | `derive.ts → isWorkday` |
| Cambio de horario de verano | Todas las cuentas de días se hacen en UTC: nunca se corre un día. | `dates.ts` |

## Estados y progreso

| Caso | Comportamiento | Dónde |
| --- | --- | --- |
| Completar una tarea | Sella `completedAt`, pone el progreso en 100, los días restantes pasan a `-` y sale de "atrasadas". | `actions/tasks.ts → updateTask` |
| Descompletar una tarea | Limpia `completedAt`; vuelve a contar como pendiente. | ídem |
| Tarea cancelada | Queda fuera del numerador **y** del denominador del % completado. No figura como atrasada. | `derive.ts → summarize` |
| Completar un padre con subtareas pendientes | Se pregunta antes: completar todo en cascada, completar solo el padre, o cancelar. | `tasks-screen.tsx` |
| Progreso de una tarea con subtareas | Solo lectura: es el promedio de las hijas no canceladas. | `derive.ts → rollupProgress` |
| Progreso de una tarea sin subtareas | Editable a mano, con slider en la tabla. | `cells.tsx → ProgressCell` |

## Catálogos en uso

| Caso | Comportamiento | Dónde |
| --- | --- | --- |
| Borrar un estado usado por tareas | Se bloquea con el conteo exacto y se ofrece migrar esas tareas a otro estado en el mismo paso. | `actions/config.ts → deleteStatus`, `migrateStatus` |
| Borrar el último estado terminal | Se bloquea siempre: sin un estado que marque "completado", todos los KPIs mienten. | `deleteStatus` |
| Quitar la marca de terminal al único estado terminal | Se bloquea por la misma razón. | `saveStatus` |
| Estado terminal y cancelado a la vez | Se rechaza: son categorías incompatibles. | `saveStatus` |
| Borrar una etapa Kanban en uso | Se bloquea y se ofrece mover las tarjetas a otra columna. | `deleteStage`, `migrateStage` |
| Borrar la última etapa Kanban | Se bloquea: el tablero necesita al menos una columna. | `deleteStage` |
| Borrar una prioridad en uso | Se bloquea con el conteo. | `deletePriority` |
| Borrar una persona con tareas asignadas | Se bloquea; se ofrece reasignar en masa **o** desactivarla (conserva el historial). | `deletePerson`, `reassignTasks` |
| Borrar una persona que lidera proyectos | Se bloquea hasta cambiar el líder. | `deletePerson` |
| Persona inactiva | No aparece para asignar tareas nuevas, pero sigue visible en las que ya tenía. | `task-detail-panel.tsx`, `task-table.tsx` |

## Proyectos y fases

| Caso | Comportamiento | Dónde |
| --- | --- | --- |
| Borrar un proyecto con tareas | Confirmación con el número exacto de tareas y fases que se pierden, y se ofrece archivar como alternativa. | `projects-section.tsx`, `getProjectDeletionImpact` |
| Archivar un proyecto | Desaparece de todas las vistas de trabajo sin perder un dato. Reversible. | `setProjectArchived`, `task-queries.ts → buildWhere` |
| Borrar una fase con tareas | Las tareas **no** se borran: quedan sin fase y se avisa cuántas. | `deletePhase` |
| Mover una tarea a otro proyecto | Si la fase no pertenece al proyecto nuevo, se limpia sola en vez de quedar colgada. | `updateTask` |
| Código de proyecto | Autoincremental sin tope (P1, P2, … P1000, …). El límite de 30 de la planilla era una limitación de rango de fórmula. | `nextProjectCode` |

## Subtareas y dependencias

| Caso | Comportamiento | Dónde |
| --- | --- | --- |
| Borrar una tarea con subtareas | Cae el subárbol entero; la confirmación dice cuántas subtareas se llevan puestas. | `getDeletionImpact`, FK `on delete cascade` |
| Dependencia que cierra un ciclo | Se rechaza y el mensaje muestra el camino concreto del ciclo. | `derive.ts → findCycle`, `addDependency` |
| Dependencia de una tarea consigo misma | Se rechaza. | `addDependency` |
| Dependencia duplicada | Se rechaza con aviso. | `addDependency` |
| Mover una barra dejando a las sucesoras empezando antes | Se avisa cuáles quedaron mal, sin bloquear: la decisión es del usuario. | `gantt-chart.tsx → warnAboutSuccessors` |
| Datos con ciclo en la jerarquía padre-hijo | El recorrido no se cuelga: hay control de visitados. | `derive.ts → descendantIds` |
| Subtarea cuyo padre no pasa el filtro activo | Se muestra igual, en el primer nivel. | `task-table.tsx → buildRows` |

## Abrir una tarea

Sigue el patrón de Asana y Jira: la tarea se abre con un clic, y los campos
de la fila se editan sin salir de la tabla.

| Caso | Comportamiento | Dónde |
| --- | --- | --- |
| Clic en el nombre de la tarea | Abre el panel de detalle. | `task-table.tsx → TaskRow` |
| Clic en cualquier zona libre de la fila | También abre el detalle. | `handleRowClick` |
| Clic en un desplegable, fecha, casilla o progreso | **No** abre nada: edita ese campo en línea. La fila ignora los clics que caen sobre un control. | `handleRowClick` |
| Nombre de la tarea ya abierta | Pasa a ser editable en línea: es el gesto de "clic para abrir, clic de nuevo para renombrar". Así un mismo clic nunca significa dos cosas. | `TaskRow` |
| Fila de la tarea abierta | Queda marcada con fondo y una barra de acento, para no perder de vista cuál se está mirando. | `TaskRow` |
| Tarjeta en Kanban o en la matriz | Toda la tarjeta abre la tarea: ahí no hay campos que editar en línea que puedan quedarse con el clic. | `task-card.tsx` |
| Tarjeta en celular | Igual que arriba: se toca en cualquier parte. | `task-list-mobile.tsx` |

## Filtros, vistas y errores

| Caso | Comportamiento | Dónde |
| --- | --- | --- |
| Filtro sin resultados | Estado vacío que dice que la causa son los filtros, con botón para limpiarlos. | `EmptyState` en cada vista |
| Filtro de proyecto que se cambia | Se limpia la fase elegida: las fases pertenecen al proyecto. | `filters-bar.tsx` |
| Búsqueda con acentos | "diseno" encuentra "diseño": la comparación normaliza acentos y mayúsculas. | `task-queries.ts → normalize` |
| Recarga de página | Los filtros viven en la URL, así que sobreviven a la recarga y se pueden compartir. | `use-filters.ts` |
| Arrastre en Kanban que falla al guardar | La tarjeta vuelve a su columna y aparece un aviso con el motivo. | `kanban-board.tsx` |
| Reordenar tarjetas con un orden automático activo | Se avisa que hay que pasar a "orden manual" en vez de perder el arrastre en silencio. | `kanban-board.tsx` |
| Columna Kanban por encima de su límite | Se marca en ámbar con ícono de alerta, sin bloquear. | `kanban-board.tsx → Column` |
| Sin proyectos cargados | Cada vista explica que falta crear un proyecto y linkea a Configuración. | `EmptyState` en cada vista |
| Cambiar los días laborables | Todas las duraciones en días laborables se recalculan al vuelo: no hay nada persistido que quede viejo. | `derive.ts → workdaysBetween` |
| Error inesperado en una pantalla | Página de error con "reintentar" y "volver al Dashboard", aclarando que los datos están intactos. | `app/error.tsx` |
| Abrir la app desde el celular por IP | El servidor de desarrollo devolvería 403 a sus propios chunks y la página quedaría sin hidratar (se ve, no responde). Se habilitan los rangos de red privada en `allowedDevOrigins`. | `next.config.ts` |
| Service worker por IP sin HTTPS | El navegador no lo permite fuera de un contexto seguro: se sale en silencio y la app funciona sin caché. | `pwa/service-worker.tsx` |
| Adjunto que ya no está en disco | El registro se borra igual; descargarlo devuelve 410 con explicación. | `actions/attachments.ts`, `api/archivos/[id]` |
