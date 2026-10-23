import type { TrainingPlanItem, TrainingPlanSummary, TrainingWarning } from "@app/shared";

import { formatDate, formatDays, stateLabel, stateTone } from "../lib/format";
import { Badge } from "./Badge";
import { Panel } from "./Panel";
import { EmptyRow, Table } from "./Table";

/** How much attention one warning deserves, in the gray scale of the panel. */
const SEVERITY: Record<TrainingWarning["severity"], { label: string; tone: string }> = {
  critical: { label: "kritické", tone: "bg-zinc-900 text-zinc-50 ring-zinc-900" },
  warning: { label: "varování", tone: "bg-zinc-300 text-zinc-900 ring-zinc-300" },
};

interface TrainingWarningsProps {
  warnings: TrainingWarning[];
  /** Whether the name of the manager is worth showing (it is for the admin). */
  showManager?: boolean;
}

/**
 * The warnings about a qualification that runs out and has no seat left.
 *
 * The manager gets the warnings of their team, the admin gets all of them.
 */
export function TrainingWarnings({ warnings, showManager = false }: TrainingWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <Panel
      title="Chybějící místa"
      subtitle={`${warnings.length} lidí s končící kvalifikací nemá volné místo v naplánovaných termínech`}
    >
      <ul className="space-y-2">
        {warnings.map((warning) => {
          const severity = SEVERITY[warning.severity];
          return (
            <li
              key={`${warning.employeeId}:${warning.courseCode}`}
              className="rounded-lg px-3 py-2 ring-1 ring-zinc-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-zinc-900">{warning.employeeName}</div>
                  <div className="text-xs text-zinc-500">
                    {warning.courseName} · {warning.courseCode}
                    {showManager && warning.managerName ? ` · vedoucí ${warning.managerName}` : ""}
                  </div>
                </div>
                <Badge tone={severity.tone}>{severity.label}</Badge>
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Platnost končí {formatDate(warning.validUntil)} ({formatDays(warning.daysLeft)}).
                Školení potřebuje {warning.peopleNeeding} lidí, volných míst je{" "}
                {warning.peopleCanTake} - chybí {warning.shortfall}.
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

interface TrainingPlanSectionProps {
  items: TrainingPlanItem[];
  summary: TrainingPlanSummary[];
  title?: string;
  subtitle?: string;
}

/** The plan of the queue - a summary per course and the concrete assignments. */
export function TrainingPlanSection({
  items,
  summary,
  title = "Plán školení",
  subtitle = "Nejnaléhavější lidé dostanou nejbližší volný termín",
}: TrainingPlanSectionProps) {
  const rows = [...items].sort((a, b) => {
    if (a.courseCode !== b.courseCode) return a.courseCode.localeCompare(b.courseCode);
    if (a.assigned !== b.assigned) return a.assigned ? 1 : -1;
    return (a.daysLeft ?? Number.MAX_SAFE_INTEGER) - (b.daysLeft ?? Number.MAX_SAFE_INTEGER);
  });

  return (
    <div className="space-y-5">
      <Panel title={title} subtitle={subtitle} flush>
        <Table
          head={[
            "Školení",
            "Potřebuje",
            "Přiřazeno",
            "Bez místa",
            "Volná místa",
            "Další termín",
            "Kapacita",
          ]}
        >
          {summary.length === 0 && <EmptyRow columns={7} text="Nikdo nic doplňovat nemusí" />}
          {summary.map((course) => (
            <tr key={course.courseCode} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-900">{course.courseName}</div>
                <div className="text-xs text-zinc-400">{course.courseCode}</div>
              </td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{course.peopleNeeding}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{course.peopleAssigned}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{course.peopleUnassigned}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{course.freeSpots ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-600">
                {course.nextSession ? (
                  <>
                    {formatDate(course.nextSession.date)}
                    {course.nextSession.startTime && (
                      <div className="text-xs text-zinc-400">{course.nextSession.startTime}</div>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                <Badge
                  tone={
                    course.capacityOk
                      ? "bg-zinc-100 text-zinc-700 ring-zinc-200"
                      : "bg-zinc-900 text-zinc-50 ring-zinc-900"
                  }
                >
                  {course.capacityOk ? "dostatek míst" : "chybí místa"}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="Navržené zařazení" subtitle={`${rows.length} lidí k doplnění`} flush>
        <Table head={["Zaměstnanec", "Školení", "Stav", "Platnost do", "Navržený termín"]}>
          {rows.length === 0 && <EmptyRow columns={5} text="Nikdo nic doplňovat nemusí" />}
          {rows.map((item) => (
            <tr key={`${item.employeeId}:${item.courseCode}`} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-900">{item.employeeName}</div>
                <div className="text-xs text-zinc-400">{item.employeeEmail ?? "—"}</div>
              </td>
              <td className="px-4 py-3">
                <div className="text-zinc-700">{item.courseName}</div>
                <div className="text-xs text-zinc-400">{item.courseCode}</div>
              </td>
              <td className="px-4 py-3">
                <Badge tone={stateTone(item.state)}>{stateLabel(item.state)}</Badge>
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {formatDate(item.validUntil)}
                {item.daysLeft !== null && (
                  <div className="text-xs text-zinc-400">{formatDays(item.daysLeft)}</div>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {item.session ? (
                  <>
                    {formatDate(item.session.date)}
                    {item.session.startTime && (
                      <div className="text-xs text-zinc-400">
                        {item.session.startTime}
                        {item.session.location ? ` · ${item.session.location}` : ""}
                      </div>
                    )}
                  </>
                ) : (
                  <Badge tone="bg-white text-zinc-500 ring-zinc-300">bez místa</Badge>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
