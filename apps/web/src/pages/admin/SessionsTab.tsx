import { useState } from "react";
import type { DashboardResponse } from "@app/shared";

import { api } from "../../api";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Modal } from "../../components/Modal";
import { Panel } from "../../components/Panel";
import { EmptyRow, Table } from "../../components/Table";
import { formatDate } from "../../lib/format";
import { ErrorNote } from "./ErrorNote";
import { useAction } from "./helpers";

interface SessionsTabProps {
  data: DashboardResponse;
  onChanged: () => Promise<void>;
}

const EMPTY_FORM = {
  courseCode: "",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
  capacity: "",
  booked: "",
  pricePerPerson: "",
};

export function SessionsTab({ data, onChanged }: SessionsTabProps) {
  const sessions = data.sessions ?? [];
  const courses = data.courses ?? [];
  const { error, busy, run } = useAction();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function update(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const ok = await run(() =>
      api.admin.createSession({
        courseCode: form.courseCode,
        date: form.date || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        location: form.location || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        booked: form.booked ? Number(form.booked) : 0,
        pricePerPerson: form.pricePerPerson ? Number(form.pricePerPerson) : null,
      }),
    );
    if (!ok) return;
    setForm(EMPTY_FORM);
    setAdding(false);
    await onChanged();
  }

  async function remove(id: string, courseCode: string) {
    if (!window.confirm(`Opravdu smazat termín ${id} (${courseCode})?`)) return;
    const ok = await run(() => api.admin.deleteSession(id));
    if (ok) await onChanged();
  }

  return (
    <>
      {!adding && <ErrorNote message={error} />}

      <Panel
        title="Termíny školení"
        subtitle={`${sessions.length} termínů`}
        actions={<Button onClick={() => setAdding(true)}>+ Přidat termín</Button>}
        flush
      >
        <Table head={["ID", "Školení", "Datum", "Čas", "Místo", "Kapacita", "Obsazeno", "Volno", ""]}>
          {sessions.length === 0 && <EmptyRow columns={9} text="Zatím žádné termíny" />}
          {sessions.map((session) => (
            <tr key={session.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 text-xs text-zinc-400">{session.id}</td>
              <td className="px-4 py-3 font-medium text-zinc-900">{session.courseCode}</td>
              <td className="px-4 py-3 text-zinc-600">{formatDate(session.date)}</td>
              <td className="px-4 py-3 text-zinc-600">{session.timeRange ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-600">{session.location ?? "—"}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{session.capacity ?? "—"}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{session.booked ?? "—"}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">
                {session.freeSpots ?? "—"}
                {session.overbooked && (
                  <span className="ml-1 text-xs text-zinc-900">překročeno</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" onClick={() => remove(session.id, session.courseCode)}>
                  Smazat
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      {adding && (
        <Modal
          title="Nový termín"
          onClose={() => setAdding(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAdding(false)}>
                Zrušit
              </Button>
              <Button disabled={busy} onClick={save}>
                Uložit
              </Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Školení
              </span>
              <select
                value={form.courseCode}
                onChange={(event) => update("courseCode", event.target.value)}
                className="w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">— vyberte kurz —</option>
                {courses.map((course) => (
                  <option key={course.code} value={course.code}>
                    {course.code} · {course.name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Datum"
              type="date"
              value={form.date}
              onChange={(event) => update("date", event.target.value)}
            />
            <Field
              label="Místo"
              value={form.location}
              onChange={(event) => update("location", event.target.value)}
            />
            <Field
              label="Od"
              type="time"
              value={form.startTime}
              onChange={(event) => update("startTime", event.target.value)}
            />
            <Field
              label="Do"
              type="time"
              value={form.endTime}
              onChange={(event) => update("endTime", event.target.value)}
            />
            <Field
              label="Kapacita"
              type="number"
              value={form.capacity}
              onChange={(event) => update("capacity", event.target.value)}
            />
            <Field
              label="Obsazeno"
              type="number"
              value={form.booked}
              onChange={(event) => update("booked", event.target.value)}
            />
            <Field
              label="Cena za osobu"
              type="number"
              value={form.pricePerPerson}
              onChange={(event) => update("pricePerPerson", event.target.value)}
            />
          </div>
          <ErrorNote message={error} />
        </Modal>
      )}
    </>
  );
}
