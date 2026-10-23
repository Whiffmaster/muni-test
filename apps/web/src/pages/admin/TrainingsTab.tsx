import { useMemo, useState } from "react";
import type { CompletedTraining, DashboardResponse, Employee } from "@app/shared";

import { api } from "../../api";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Modal } from "../../components/Modal";
import { Panel } from "../../components/Panel";
import { EmptyRow, Table } from "../../components/Table";
import { formatDate } from "../../lib/format";
import { ErrorNote } from "./ErrorNote";
import { useAction } from "./helpers";

interface TrainingsTabProps {
  data: DashboardResponse;
  onChanged: () => Promise<void>;
}

const EMPTY_FORM = {
  employeeId: "",
  courseCode: "",
  completedAt: "",
  validUntil: "",
  provider: "",
  price: "",
};

/** A stable empty list - so the memoized lists do not change every render. */
const NO_TRAININGS: CompletedTraining[] = [];
const NO_EMPLOYEES: Employee[] = [];

export function TrainingsTab({ data, onChanged }: TrainingsTabProps) {
  const trainings = data.trainings ?? NO_TRAININGS;
  const employees = data.employees ?? NO_EMPLOYEES;
  const courses = data.courses ?? [];
  const { error, busy, run } = useAction();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: `${employee.fullName} (${employee.id})`,
      })),
    [employees],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return trainings;
    return trainings.filter((training) =>
      [training.employeeName, training.employeeId, training.courseCode]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(needle)),
    );
  }, [trainings, search]);

  function update(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const ok = await run(() =>
      api.admin.createTraining({
        employeeId: form.employeeId || null,
        courseCode: form.courseCode,
        completedAt: form.completedAt || null,
        validUntil: form.validUntil || null,
        provider: form.provider || null,
        price: form.price ? Number(form.price) : null,
      }),
    );
    if (!ok) return;
    setForm(EMPTY_FORM);
    setAdding(false);
    await onChanged();
  }

  async function remove(id: string) {
    if (!window.confirm(`Opravdu smazat záznam ${id}?`)) return;
    const ok = await run(() => api.admin.deleteTraining(id));
    if (ok) await onChanged();
  }

  return (
    <>
      {!adding && <ErrorNote message={error} />}

      <Panel
        title="Absolvovaná školení"
        subtitle={`${trainings.length} záznamů`}
        actions={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Hledat…"
              className="w-48 rounded-md bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-300 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900"
            />
            <Button onClick={() => setAdding(true)}>+ Přidat záznam</Button>
          </>
        }
        flush
      >
        <Table head={["ID", "Zaměstnanec", "Školení", "Absolvováno", "Platné do", "Poskytovatel", ""]}>
          {filtered.length === 0 && <EmptyRow columns={7} text="Žádné záznamy" />}
          {filtered.slice(0, 300).map((training) => (
            <tr key={training.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 text-xs text-zinc-400">{training.id}</td>
              <td className="px-4 py-3 text-zinc-900">
                {training.employeeName ?? training.employeeId ?? "—"}
              </td>
              <td className="px-4 py-3 text-zinc-600">{training.courseCode ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-600">{formatDate(training.completedAt)}</td>
              <td className="px-4 py-3 text-zinc-600">{formatDate(training.validUntil)}</td>
              <td className="px-4 py-3 text-zinc-500">{training.provider ?? "—"}</td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" onClick={() => remove(training.id)}>
                  Smazat
                </Button>
              </td>
            </tr>
          ))}
        </Table>
        {filtered.length > 300 && (
          <p className="px-4 py-3 text-xs text-zinc-400">
            Zobrazeno prvních 300 z {filtered.length} záznamů - zúžte hledání.
          </p>
        )}
      </Panel>

      {adding && (
        <Modal
          title="Nový záznam"
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
                Zaměstnanec
              </span>
              <select
                value={form.employeeId}
                onChange={(event) => update("employeeId", event.target.value)}
                className="w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">— vyberte člověka —</option>
                {employeeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
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
              label="Absolvováno"
              type="date"
              value={form.completedAt}
              onChange={(event) => update("completedAt", event.target.value)}
            />
            <Field
              label="Platné do"
              type="date"
              value={form.validUntil}
              onChange={(event) => update("validUntil", event.target.value)}
              hint="prázdné = podle katalogu"
            />
            <Field
              label="Poskytovatel"
              value={form.provider}
              onChange={(event) => update("provider", event.target.value)}
            />
            <Field
              label="Cena"
              type="number"
              value={form.price}
              onChange={(event) => update("price", event.target.value)}
            />
          </div>
          <ErrorNote message={error} />
        </Modal>
      )}
    </>
  );
}
