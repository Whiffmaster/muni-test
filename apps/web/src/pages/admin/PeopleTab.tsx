import { useMemo, useState } from "react";
import type { DashboardResponse, Employee } from "@app/shared";

import { api } from "../../api";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Modal } from "../../components/Modal";
import { Panel } from "../../components/Panel";
import { EmptyRow, Table } from "../../components/Table";
import { formatDate } from "../../lib/format";
import { ErrorNote } from "./ErrorNote";
import { useAction } from "./helpers";

interface PeopleTabProps {
  data: DashboardResponse;
  onChanged: () => Promise<void>;
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  department: "",
  position: "",
  managerEmail: "",
  hiredAt: "",
};

/** A stable empty list - so the memoized lists do not change every render. */
const NO_EMPLOYEES: Employee[] = [];

export function PeopleTab({ data, onChanged }: PeopleTabProps) {
  const employees = data.employees ?? NO_EMPLOYEES;
  const { error, busy, run } = useAction();

  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const managers = useMemo(
    () =>
      employees
        .filter((employee) => employee.email)
        .map((employee) => ({ value: employee.email as string, label: employee.fullName })),
    [employees],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((employee) =>
      [employee.fullName, employee.email, employee.department, employee.position]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(needle)),
    );
  }, [employees, search]);

  function update(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const ok = await run(() =>
      api.admin.createEmployee({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        department: form.department.trim() || null,
        position: form.position.trim() || null,
        managerEmail: form.managerEmail || null,
        hiredAt: form.hiredAt || null,
      }),
    );
    if (!ok) return;
    setForm(EMPTY_FORM);
    setAdding(false);
    await onChanged();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Opravdu smazat ${name}? Smazou se i jeho absolvovaná školení.`)) return;
    const ok = await run(() => api.admin.deleteEmployee(id));
    if (ok) await onChanged();
  }

  return (
    <>
      {!adding && <ErrorNote message={error} />}

      <Panel
        title="Lidé"
        subtitle={`${employees.length} záznamů`}
        actions={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Hledat…"
              className="w-48 rounded-md bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-300 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900"
            />
            <Button onClick={() => setAdding(true)}>+ Přidat člověka</Button>
          </>
        }
        flush
      >
        <Table head={["ID", "Jméno", "E-mail", "Útvar", "Pozice", "Nadřízený", "Nástup", ""]}>
          {filtered.length === 0 && <EmptyRow columns={8} text="Nikoho jsme nenašli" />}
          {filtered.map((employee) => (
            <tr key={employee.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 text-xs text-zinc-400">{employee.id}</td>
              <td className="px-4 py-3 font-medium text-zinc-900">{employee.fullName}</td>
              <td className="px-4 py-3 text-zinc-600">{employee.email ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-600">{employee.department ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-600">{employee.position ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-600">{employee.managerEmail ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-600">{formatDate(employee.hiredAt)}</td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" onClick={() => remove(employee.id, employee.fullName)}>
                  Smazat
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      {adding && (
        <Modal
          title="Nový člověk"
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
            <Field
              label="Jméno"
              value={form.firstName}
              onChange={(event) => update("firstName", event.target.value)}
            />
            <Field
              label="Příjmení"
              value={form.lastName}
              onChange={(event) => update("lastName", event.target.value)}
            />
            <Field
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
            />
            <Field
              label="Útvar"
              value={form.department}
              onChange={(event) => update("department", event.target.value)}
            />
            <Field
              label="Pozice"
              value={form.position}
              onChange={(event) => update("position", event.target.value)}
            />
            <Field
              label="Nástup"
              type="date"
              value={form.hiredAt}
              onChange={(event) => update("hiredAt", event.target.value)}
            />
            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Nadřízený
                </span>
                <select
                  value={form.managerEmail}
                  onChange={(event) => update("managerEmail", event.target.value)}
                  className="w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">— bez nadřízeného —</option>
                  {managers.map((manager) => (
                    <option key={manager.value} value={manager.value}>
                      {manager.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <ErrorNote message={error} />
        </Modal>
      )}
    </>
  );
}
