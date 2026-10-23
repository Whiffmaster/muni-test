import { useState } from "react";
import type { DashboardResponse } from "@app/shared";

import { api } from "../../api";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Modal } from "../../components/Modal";
import { Panel } from "../../components/Panel";
import { EmptyRow, Table } from "../../components/Table";
import { ErrorNote } from "./ErrorNote";
import { useAction } from "./helpers";

interface CoursesTabProps {
  data: DashboardResponse;
  onChanged: () => Promise<void>;
}

const EMPTY_FORM = {
  code: "",
  name: "",
  validityMonths: "",
  scope: "everyone" as "everyone" | "nobody" | "departments" | "positions",
  values: "",
};

/** Who has to do the course - the same wording as in the catalogue. */
function scopeText(scope: string, values: string[]): string {
  if (scope === "everyone") return "Všichni";
  if (scope === "nobody") return "Nepovinné";
  if (scope === "departments") return `Útvar: ${values.join(", ")}`;
  return `Pozice: ${values.join(", ")}`;
}

export function CoursesTab({ data, onChanged }: CoursesTabProps) {
  const courses = data.courses ?? [];
  const { error, busy, run } = useAction();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function update(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const values = form.values
      .split(/[;,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    const ok = await run(() =>
      api.admin.createCourse({
        code: form.code.trim(),
        name: form.name.trim(),
        validityMonths: form.validityMonths ? Number(form.validityMonths) : null,
        requiredFor:
          form.scope === "everyone"
            ? { everyone: true }
            : form.scope === "nobody"
              ? { nobody: true }
              : form.scope === "departments"
                ? { departments: values }
                : { positions: values },
      }),
    );
    if (!ok) return;
    setForm(EMPTY_FORM);
    setAdding(false);
    await onChanged();
  }

  async function remove(code: string, name: string) {
    if (!window.confirm(`Opravdu smazat školení ${name}?`)) return;
    const ok = await run(() => api.admin.deleteCourse(code));
    if (ok) await onChanged();
  }

  return (
    <>
      {!adding && <ErrorNote message={error} />}

      <Panel
        title="Katalog školení"
        subtitle={`${courses.length} kurzů`}
        actions={<Button onClick={() => setAdding(true)}>+ Přidat školení</Button>}
        flush
      >
        <Table head={["Kód", "Název", "Platnost", "Povinné pro", ""]}>
          {courses.length === 0 && <EmptyRow columns={5} text="Katalog je prázdný" />}
          {courses.map((course) => (
            <tr key={course.code} className="hover:bg-zinc-50">
              <td className="px-4 py-3 text-xs text-zinc-500">{course.code}</td>
              <td className="px-4 py-3 font-medium text-zinc-900">{course.name}</td>
              <td className="px-4 py-3 text-zinc-600">
                {course.validityMonths ? `${course.validityMonths} měs.` : "—"}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {course.requiredFor.everyone
                  ? "Všichni"
                  : course.requiredFor.nobody
                    ? "Nepovinné"
                    : scopeText(
                        course.requiredFor.departments.length > 0 ? "departments" : "positions",
                        course.requiredFor.departments.length > 0
                          ? course.requiredFor.departments
                          : course.requiredFor.positions,
                      )}
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" onClick={() => remove(course.code, course.name)}>
                  Smazat
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      {adding && (
        <Modal
          title="Nové školení"
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
              label="Kód"
              value={form.code}
              onChange={(event) => update("code", event.target.value)}
              placeholder="BOZP-Z"
            />
            <Field
              label="Název"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
            />
            <Field
              label="Platnost (měsíce)"
              type="number"
              value={form.validityMonths}
              onChange={(event) => update("validityMonths", event.target.value)}
              hint="0 nebo prázdné = bez omezení"
            />
            <label className="block">
              <span className="mb-1 block text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Povinné pro
              </span>
              <select
                value={form.scope}
                onChange={(event) => update("scope", event.target.value)}
                className="w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="everyone">Všichni</option>
                <option value="nobody">Nepovinné</option>
                <option value="departments">Útvar</option>
                <option value="positions">Pozice</option>
              </select>
            </label>
            {(form.scope === "departments" || form.scope === "positions") && (
              <div className="sm:col-span-2">
                <Field
                  label={form.scope === "departments" ? "Útvary" : "Pozice"}
                  value={form.values}
                  onChange={(event) => update("values", event.target.value)}
                  hint="odděleno středníkem"
                />
              </div>
            )}
          </div>
          <ErrorNote message={error} />
        </Modal>
      )}
    </>
  );
}
