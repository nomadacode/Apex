"use client";

import { useId, type HTMLAttributes, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type HandleProps = HTMLAttributes<HTMLElement>;

/** Lista vertical reordenable por arrastre, con soporte de teclado
 *  (Tab al asa + flechas). El orden nuevo se persiste vía `onReorder`. */
export function SortableList({
  items,
  onReorder,
  renderItem,
}: {
  items: number[];
  onReorder: (orderedIds: number[]) => void;
  renderItem: (id: number, handleProps: HandleProps) => ReactNode;
}) {
  // dnd-kit deriva sus ids de accesibilidad de un contador interno; sin un
  // id estable, el servidor y el cliente numeran distinto y React reporta
  // un error de hidratación.
  const id = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.indexOf(Number(active.id));
    const to = items.indexOf(Number(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-border">
          {items.map((id) => (
            <SortableRow key={id} id={id} renderItem={renderItem} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  renderItem,
}: {
  id: number;
  renderItem: (id: number, handleProps: HandleProps) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="bg-surface"
    >
      {renderItem(id, { ...attributes, ...listeners })}
    </li>
  );
}
