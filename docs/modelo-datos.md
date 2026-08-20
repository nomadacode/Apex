# Modelo de datos

SQLite local (`data/apex.db`), esquema en `src/db/schema.ts`, migraciones en
`drizzle/`. Todo lo que en la planilla original era una lista suelta en la hoja
*Configuración* es acá una tabla editable desde la UI.

## Catálogos

| Tabla | Para qué |
| --- | --- |
| `people` | Responsables, con rol/área, color y flag `active` |
| `statuses` | Estados de tarea. `is_done` marca los terminales; `is_cancelled`, los descartados |
| `kanban_stages` | Columnas del tablero, con `wip_limit` opcional |
| `priorities` | Prioridades con `weight` 1–5 (5 = más alta) |
| `holidays` | Festivos y días libres, en ISO `YYYY-MM-DD` |
| `settings` | Días laborables (bitmask L–D), inicio de semana, nombre del espacio |

## Núcleo

| Tabla | Notas |
| --- | --- |
| `projects` | `code` autoincremental (P1, P2, …) sin tope. `archived` saca el proyecto de las vistas sin borrarlo |
| `phases` | Pertenecen a un proyecto y tienen orden propio. En la planilla la fase era texto repetido fila por fila |
| `tasks` | La entidad central. `parent_task_id` habilita subtareas de N niveles, con borrado en cascada |
| `task_dependencies` | FS/SS/FF/SF. Se valida contra ciclos al crear |
| `comments`, `attachments` | Adjuntos en `data/uploads/`, servidos por `/api/archivos/[id]` |
| `activity_log` | Historial de cambios. Único punto de escritura: `actions/log.ts` |
| `tags`, `task_tags` | Etiquetas libres, transversales a proyectos |

## Decisiones

**Fechas como texto ISO, no timestamps.** El planificador razona en días
("faltan 3 días", "vence hoy"), no en instantes. Guardar `YYYY-MM-DD` y hacer
las cuentas en UTC evita el corrimiento de un día por horario de verano — el
mismo problema que la planilla advertía con su nota sobre la zona horaria.

**`is_done` en lugar del literal "Completado".** La planilla comparaba contra
el texto exacto de una celda, así que renombrar el estado rompía todos los
porcentajes. Acá el estado terminal es un flag, y siempre tiene que existir al
menos uno.

**Las canceladas salen del denominador.** La planilla las contaba, y eso hundía
el porcentaje de proyectos que simplemente habían descartado trabajo.

**Nada de derivados persistidos.** Días restantes, atrasos, cuadrante de
Eisenhower, días laborables y rollup de subtareas se calculan al vuelo en
`src/lib/derive.ts`, el único lugar donde vive esa lógica. Las seis vistas la
consumen; ninguna la reimplementa. Cambiar los días laborables recalcula todo
sin migraciones.

## Escala

Sin topes heredados de la planilla. Para que eso sea real y no declarativo:

- Índices en `tasks` por proyecto, fase, padre, responsable, estado, etapa,
  fecha de inicio y fecha límite.
- Los KPIs del Dashboard se calculan con agregados SQL (`src/lib/dashboard-queries.ts`),
  no trayendo todas las filas a memoria.
- La tabla de Tareas virtualiza las filas (`@tanstack/react-virtual`).
- Calendarios y Gantt consultan por ventana de fechas, no la tabla entera.
