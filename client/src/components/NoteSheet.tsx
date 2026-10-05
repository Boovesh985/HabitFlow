import { useEffect, useState } from "react";
import { useCheckIn } from "../lib/hooks";
import type { Habit } from "../lib/types";
import { Sheet } from "./ui";

export function NoteSheet({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const checkIn = useCheckIn();
  useEffect(() => setNote(habit?.todayNote ?? ""), [habit]);
  return (
    <Sheet open={!!habit} onClose={onClose} title={habit ? `Note · ${habit.name}` : ""}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!habit) return;
          const s = habit.stats;
          checkIn.mutate({
            habitId: habit.id,
            // A note on an unchecked day is stored as a zero-count entry, so it doesn't complete the habit.
            status: s.todayStatus ?? "DONE",
            count: s.todayStatus ? s.todayCount : 0,
            note: note || null,
          });
          onClose();
        }}
      >
        <textarea
          autoFocus
          rows={5}
          className="field resize-none leading-relaxed"
          placeholder="How did it go? What made it easier or harder?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          aria-label="Note"
        />
        <button className="btn-ink w-full">Save note</button>
      </form>
    </Sheet>
  );
}
