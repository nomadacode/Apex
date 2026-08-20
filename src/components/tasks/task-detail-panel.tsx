"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CornerDownRight,
  Link2Off,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { deleteAttachment, uploadAttachment } from "@/actions/attachments";

import {
  addComment,
  addDependency,
  deleteComment,
  removeDependency,
  updateTask,
  type TaskPatch,
} from "@/actions/tasks";
import {
  DaysRemainingBadge,
  PersonAvatar,
} from "@/components/tasks/task-badges";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/field";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import {
  daysRemaining,
  quadrantOf,
  QUADRANTS,
  workdaysBetween,
} from "@/lib/derive";
import type { TaskDetail, Workspace } from "@/lib/task-queries";
import { useAction } from "@/lib/use-action";

type Tab =
  | "detalle"
  | "subtareas"
  | "dependencias"
  | "comentarios"
  | "archivos"
  | "historial";

export function TaskDetailPanel({
  detail,
  workspace,
  today,
  allTasks,
  onClose,
  onOpen,
  onCreateSubtask,
}: {
  detail: TaskDetail | null;
  workspace: Workspace;
  today: string;
  allTasks: Task[];
  onClose: () => void;
  onOpen: (id: number) => void;
  onCreateSubtask: (parent: Task) => void;
}) {
  const { run, pending } = useAction();
  const [tab, setTab] = useState<Tab>("detalle");

  if (!detail) return null;

  const { task } = detail;
  const statusById = new Map(workspace.statuses.map((s) => [s.id, s]));
  const project = workspace.projects.find((p) => p.id === task.projectId);
  const remaining = daysRemaining(task, statusById, today);
  const quadrant = QUADRANTS[quadrantOf(task)];
  const workdays = workdaysBetween(
    task.startDate,
    task.dueDate,
    workspace.calendar,
  );

  function patch(next: TaskPatch) {
    run(() => updateTask(task.id, next));
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "detalle", label: "Detalle" },
    { id: "subtareas", label: "Subtareas", count: detail.children.length },
    {
      id: "dependencias",
      label: "Dependencias",
      count: detail.predecessors.length + detail.successors.length,
    },
    { id: "comentarios", label: "Comentarios", count: detail.comments.length },
    { id: "archivos", label: "Archivos", count: detail.attachments.length },
    { id: "historial", label: "Historial" },
  ];

  return (
    // En celular ocupa toda la pantalla: un panel de 26 rem al costado no
    // entra, y partirlo en dos columnas dejaría ambas inservibles.
    //
    // Al ser `fixed` se posiciona contra la ventana y se saltea el
    // resguardo del contenedor, así que se lo repone acá: el fondo sigue
    // llegando hasta el borde del vidrio, pero la cabecera —y con ella la
    // X— arranca abajo del reloj y la batería. Solo hasta `md`, porque de
    // ahí para arriba vuelve a ser un hijo normal del contenedor ya
    // resguardado y el relleno se contaría dos veces.
    <aside className="fixed inset-0 z-50 flex flex-col bg-surface max-md:pt-[var(--safe-top)] max-md:pr-[var(--safe-right)] max-md:pb-[var(--safe-bottom)] max-md:pl-[var(--safe-left)] md:static md:z-auto md:w-[26rem] md:shrink-0 md:border-l md:border-border">
      <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {project ? `${project.code} · ${project.name}` : "Sin proyecto"}
          </p>
          <h2 className="truncate font-medium">{task.title}</h2>
          {detail.parent ? (
            <button
              onClick={() => onOpen(detail.parent!.id)}
              className="mt-0.5 flex items-center gap-1 text-xs text-muted hover:text-foreground"
            >
              <CornerDownRight className="size-3" />
              subtarea de {detail.parent.title}
            </button>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Cerrar panel"
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="shrink-0 border-b border-border">
        <div className="tab-strip -mb-px flex gap-1 px-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "shrink-0 cursor-pointer border-b-2 px-2 py-2 text-xs transition-colors",
                tab === item.id
                  ? "border-accent font-medium"
                  : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {item.label}
              {item.count ? (
                <span className="ml-1 text-[10px] text-muted">
                  {item.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === "detalle" ? (
          <div className="flex flex-col gap-4">
            <Field label="Nombre">
              <Input
                defaultValue={task.title}
                key={`title-${task.id}`}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== task.title) {
                    patch({ title: e.target.value.trim() });
                  }
                }}
              />
            </Field>

            <Field label="Descripción">
              <Textarea
                defaultValue={task.description}
                key={`desc-${task.id}`}
                rows={3}
                onBlur={(e) => {
                  if (e.target.value !== task.description) {
                    patch({ description: e.target.value });
                  }
                }}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Proyecto">
                <Select
                  value={task.projectId}
                  onChange={(e) =>
                    patch({ projectId: Number(e.target.value), phaseId: null })
                  }
                >
                  {workspace.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fase">
                <Select
                  value={task.phaseId ?? ""}
                  onChange={(e) =>
                    patch({
                      phaseId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">Sin fase</option>
                  {workspace.phases
                    .filter((p) => p.projectId === task.projectId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Estado">
                <Select
                  value={task.statusId ?? ""}
                  onChange={(e) =>
                    patch({
                      statusId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">Sin estado</option>
                  {workspace.statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Etapa Kanban">
                <Select
                  value={task.kanbanStageId ?? ""}
                  onChange={(e) =>
                    patch({
                      kanbanStageId: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">Sin etapa</option>
                  {workspace.stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Prioridad">
                <Select
                  value={task.priorityId ?? ""}
                  onChange={(e) =>
                    patch({
                      priorityId: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">Sin prioridad</option>
                  {workspace.priorities.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Responsable">
                <Select
                  value={task.assigneeId ?? ""}
                  onChange={(e) =>
                    patch({
                      assigneeId: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">Sin asignar</option>
                  {workspace.people
                    .filter((p) => p.active || p.id === task.assigneeId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.role ? ` · ${p.role}` : ""}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>

            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={task.important}
                  onChange={(e) => patch({ important: e.target.checked })}
                />
                Importante
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={task.urgent}
                  onChange={(e) => patch({ urgent: e.target.checked })}
                />
                Urgente
              </label>
            </div>
            <p className="-mt-2 text-xs text-muted">
              Matriz de Eisenhower: <strong>{quadrant.label}</strong>.{" "}
              {quadrant.hint}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha de inicio">
                <Input
                  type="date"
                  value={task.startDate ?? ""}
                  onChange={(e) => patch({ startDate: e.target.value || null })}
                />
              </Field>
              <Field label="Fecha límite">
                <Input
                  type="date"
                  value={task.dueDate ?? ""}
                  onChange={(e) => patch({ dueDate: e.target.value || null })}
                />
              </Field>
            </div>

            <div className="flex items-center gap-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
              <span>
                Faltan: <DaysRemainingBadge value={remaining} />
              </span>
              {workdays != null ? (
                <span>{workdays} días laborables</span>
              ) : null}
              {task.completedAt ? (
                <span>
                  Completada {formatDate(task.completedAt.slice(0, 10))}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Progreso"
                hint={
                  detail.children.length > 0
                    ? "Calculado a partir de las subtareas."
                    : undefined
                }
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={task.progress}
                  disabled={detail.children.length > 0}
                  onChange={(e) => patch({ progress: Number(e.target.value) })}
                />
              </Field>
              <Field label="Estimación (horas)">
                <Input
                  type="number"
                  min={0}
                  defaultValue={task.estimateHours ?? ""}
                  key={`est-${task.id}`}
                  onBlur={(e) =>
                    patch({
                      estimateHours: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </Field>
            </div>

            <Field label="Notas">
              <Textarea
                defaultValue={task.notes}
                key={`notes-${task.id}`}
                rows={3}
                onBlur={(e) => {
                  if (e.target.value !== task.notes)
                    patch({ notes: e.target.value });
                }}
              />
            </Field>
          </div>
        ) : null}

        {tab === "subtareas" ? (
          <div className="flex flex-col gap-2">
            {detail.children.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Sin subtareas. Al agregar la primera, el progreso de esta tarea
                pasa a calcularse como el promedio de sus hijas.
              </p>
            ) : (
              detail.children.map((child) => {
                const status = workspace.statuses.find(
                  (s) => s.id === child.statusId,
                );
                return (
                  <button
                    key={child.id}
                    onClick={() => onOpen(child.id)}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {child.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {status?.emoji} {child.progress}%
                    </span>
                  </button>
                );
              })
            )}
            <Button size="sm" onClick={() => onCreateSubtask(task)}>
              <Plus className="size-3.5" /> Agregar subtarea
            </Button>
          </div>
        ) : null}

        {tab === "dependencias" ? (
          <DependenciesTab
            detail={detail}
            allTasks={allTasks}
            pending={pending}
            onOpen={onOpen}
            onAdd={(predecessorId, successorId) =>
              run(() => addDependency(predecessorId, successorId), {
                success: "Dependencia agregada.",
              })
            }
            onRemove={(id) =>
              run(() => removeDependency(id), {
                success: "Dependencia quitada.",
              })
            }
          />
        ) : null}

        {tab === "comentarios" ? (
          <div className="flex flex-col gap-3">
            {detail.comments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">
                Sin comentarios todavía.
              </p>
            ) : (
              detail.comments.map((comment) => {
                const author = workspace.people.find(
                  (p) => p.id === comment.authorId,
                );
                return (
                  <div
                    key={comment.id}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <PersonAvatar person={author} />
                      <span className="text-xs font-medium">
                        {author?.name ?? "Anónimo"}
                      </span>
                      <span className="text-xs text-muted">
                        {comment.createdAt.slice(0, 16).replace("T", " ")}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto"
                        aria-label="Borrar comentario"
                        onClick={() =>
                          run(() => deleteComment(comment.id), {
                            success: "Comentario borrado.",
                          })
                        }
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {comment.body}
                    </p>
                  </div>
                );
              })
            )}

            <form
              action={(formData) =>
                run(() => addComment(formData), {
                  onSuccess: () => {
                    const form = document.getElementById(
                      "comment-form",
                    ) as HTMLFormElement | null;
                    form?.reset();
                  },
                })
              }
              id="comment-form"
              className="flex flex-col gap-2 border-t border-border pt-3"
            >
              <input type="hidden" name="taskId" value={task.id} />
              <Select name="authorId" defaultValue="">
                <option value="">Sin autor</option>
                {workspace.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Textarea
                name="body"
                rows={2}
                placeholder="Escribí un comentario…"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={pending}
                >
                  Comentar
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {tab === "archivos" ? (
          <div className="flex flex-col gap-2">
            {detail.attachments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">
                Sin archivos adjuntos.
              </p>
            ) : (
              detail.attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                >
                  <Paperclip className="size-3.5 shrink-0 text-muted" />
                  <a
                    href={`/api/archivos/${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm hover:underline"
                  >
                    {file.name}
                  </a>
                  <span className="shrink-0 text-xs text-muted">
                    {formatBytes(file.size)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Borrar archivo"
                    onClick={() =>
                      run(() => deleteAttachment(file.id), {
                        success: "Archivo borrado.",
                      })
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))
            )}

            <form
              action={(formData) =>
                run(() => uploadAttachment(formData), {
                  success: "Archivo subido.",
                })
              }
              className="flex flex-col gap-2 border-t border-border pt-3"
            >
              <input type="hidden" name="taskId" value={task.id} />
              <input
                type="file"
                name="file"
                required
                className="text-sm file:mr-2 file:cursor-pointer file:rounded file:border file:border-border file:bg-surface-2 file:px-2 file:py-1 file:text-sm"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Hasta 25 MB.</span>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={pending}
                >
                  Subir
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {tab === "historial" ? (
          <div className="flex flex-col gap-1">
            {detail.activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Todavía no hay cambios registrados.
              </p>
            ) : (
              detail.activity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-2 border-b border-border py-1.5 text-xs last:border-0"
                >
                  <span className="text-muted">
                    {entry.at.slice(0, 16).replace("T", " ")}
                  </span>
                  <span className="font-medium">{entry.field}</span>
                  {entry.oldValue ? (
                    <span className="text-muted line-through">
                      {entry.oldValue}
                    </span>
                  ) : null}
                  {entry.newValue ? <span>{entry.newValue}</span> : null}
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DependenciesTab({
  detail,
  allTasks,
  pending,
  onOpen,
  onAdd,
  onRemove,
}: {
  detail: TaskDetail;
  allTasks: Task[];
  pending: boolean;
  onOpen: (id: number) => void;
  onAdd: (predecessorId: number, successorId: number) => void;
  onRemove: (id: number) => void;
}) {
  const [mode, setMode] = useState<"pred" | "succ">("pred");
  const [pick, setPick] = useState("");

  const linkedIds = new Set([
    detail.task.id,
    ...detail.predecessors.map((d) => d.taskId),
    ...detail.successors.map((d) => d.taskId),
  ]);
  const candidates = allTasks.filter((t) => !linkedIds.has(t.id));

  function titleOf(id: number) {
    return (
      detail.related.find((t) => t.id === id)?.title ??
      allTasks.find((t) => t.id === id)?.title ??
      `#${id}`
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section>
        <Label>Tiene que terminar antes ({detail.predecessors.length})</Label>
        <div className="mt-1 flex flex-col gap-1">
          {detail.predecessors.length === 0 ? (
            <p className="text-xs text-muted">Nada la bloquea.</p>
          ) : (
            detail.predecessors.map((dep) => (
              <DependencyRow
                key={dep.id}
                icon={<ArrowLeft className="size-3 text-muted" />}
                label={titleOf(dep.taskId)}
                onOpen={() => onOpen(dep.taskId)}
                onRemove={() => onRemove(dep.id)}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <Label>Depende de esta ({detail.successors.length})</Label>
        <div className="mt-1 flex flex-col gap-1">
          {detail.successors.length === 0 ? (
            <p className="text-xs text-muted">No bloquea a nadie.</p>
          ) : (
            detail.successors.map((dep) => (
              <DependencyRow
                key={dep.id}
                icon={<ArrowRight className="size-3 text-muted" />}
                label={titleOf(dep.taskId)}
                onOpen={() => onOpen(dep.taskId)}
                onRemove={() => onRemove(dep.id)}
              />
            ))
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2 border-t border-border pt-3">
        <Label>Agregar dependencia</Label>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mode === "pred" ? "primary" : "secondary"}
            onClick={() => setMode("pred")}
          >
            Va antes
          </Button>
          <Button
            size="sm"
            variant={mode === "succ" ? "primary" : "secondary"}
            onClick={() => setMode("succ")}
          >
            Va después
          </Button>
        </div>
        <Select value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Elegí una tarea…</option>
          {candidates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          variant="primary"
          disabled={!pick || pending}
          onClick={() => {
            const other = Number(pick);
            if (mode === "pred") onAdd(other, detail.task.id);
            else onAdd(detail.task.id, other);
            setPick("");
          }}
        >
          <Plus className="size-3.5" /> Agregar
        </Button>
        <p className="text-xs text-muted">
          Si la dependencia formara un círculo, se rechaza y se muestra el
          camino que lo cierra.
        </p>
      </section>
    </div>
  );
}

function DependencyRow({
  icon,
  label,
  onOpen,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-border px-2 py-1">
      {icon}
      <button
        onClick={onOpen}
        className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
      >
        {label}
      </button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Quitar dependencia"
        onClick={onRemove}
      >
        <Link2Off className="size-3" />
      </Button>
    </div>
  );
}
