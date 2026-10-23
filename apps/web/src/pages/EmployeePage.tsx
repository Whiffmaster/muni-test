import type { DashboardResponse, SessionInfo, TrainingRequirement } from "@app/shared";

import { Badge } from "../components/Badge";
import { Panel } from "../components/Panel";
import { StatTile } from "../components/StatTile";
import { EmptyRow, Table } from "../components/Table";
import { formatDate, formatDays, stateLabel, stateTone } from "../lib/format";

interface EmployeePageProps {
  data: DashboardResponse;
}

/** The session that is soonest - the one the person should book. */
function soonestSession(
  trainings: TrainingRequirement[],
): { session: SessionInfo; training: TrainingRequirement } | null {
  const candidates = trainings
    .filter((training) => training.nextSession !== null)
    .sort((a, b) =>
      (a.nextSession?.date ?? "9999").localeCompare(b.nextSession?.date ?? "9999"),
    );

  const training = candidates[0];
  if (!training?.nextSession) return null;
  return { session: training.nextSession, training };
}

export function EmployeePage({ data }: EmployeePageProps) {
  const trainings = data.myTrainings ?? [];
  const required = trainings.filter((training) => training.required);
  const next = soonestSession(required);

  const valid = required.filter((training) => training.state === "valid").length;
  const expiring = required.filter((training) => training.state === "expiring").length;
  const expired = required.filter((training) => training.state === "expired").length;
  const missing = required.filter((training) => training.state === "missing").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Povinná školení" value={required.length} />
        <StatTile label="Platná" value={valid} />
        <StatTile label="Expirují" value={expiring} emphasis={expiring > 0} />
        <StatTile label="Vypršelá / chybí" value={expired + missing} emphasis={expired + missing > 0} />
      </div>

      <Panel
        title="Další školení"
        subtitle="Termín, na který se můžete přihlásit"
      >
        {next ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-zinc-900">
                {next.training.courseName}
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                {formatDate(next.session.date)}
                {next.session.startTime ? ` · ${next.session.startTime}` : ""}
                {next.session.location ? ` · ${next.session.location}` : ""}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={stateTone(next.training.state)}>{stateLabel(next.training.state)}</Badge>
                <span className="text-xs text-zinc-400">
                  {next.training.courseCode}
                  {next.session.freeSpots !== null
                    ? ` · volných míst: ${next.session.freeSpots}`
                    : ""}
                </span>
              </div>
            </div>
            {next.training.state !== "valid" && (
              <div className="rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200">
                <div className="font-medium text-zinc-900">
                  {next.training.state === "missing"
                    ? "Toto školení ještě nemáte"
                    : next.training.state === "expired"
                      ? "Platnost vypršela"
                      : "Platnost brzy vyprší"}
                </div>
                {next.training.validUntil && (
                  <div className="mt-1 text-xs">
                    Do {formatDate(next.training.validUntil)} · {formatDays(next.training.daysLeft)}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">
            Momentálně není žádný plánovaný termín.
          </p>
        )}
      </Panel>

      <Panel title="Moje školení" flush>
        <Table head={["Školení", "Stav", "Absolvováno", "Platné do", "Další termín"]}>
          {required.length === 0 && <EmptyRow columns={5} text="Žádná povinná školení" />}
          {required.map((training) => (
            <tr key={training.courseCode} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-900">{training.courseName}</div>
                <div className="text-xs text-zinc-400">{training.courseCode}</div>
              </td>
              <td className="px-4 py-3">
                <Badge tone={stateTone(training.state)}>{stateLabel(training.state)}</Badge>
              </td>
              <td className="px-4 py-3 text-zinc-600">{formatDate(training.completedAt)}</td>
              <td className="px-4 py-3 text-zinc-600">
                {formatDate(training.validUntil)}
                {training.daysLeft !== null && (
                  <div className="text-xs text-zinc-400">{formatDays(training.daysLeft)}</div>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {training.nextSession ? (
                  <>
                    {formatDate(training.nextSession.date)}
                    {training.nextSession.startTime && (
                      <div className="text-xs text-zinc-400">
                        {training.nextSession.startTime}
                      </div>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      {trainings.some((training) => !training.required) && (
        <Panel title="Nepovinná školení" subtitle="Kurzy, které nemusíte absolvovat" flush>
          <Table head={["Školení", "Kód", "Absolvováno", "Platné do"]}>
            {trainings
              .filter((training) => !training.required)
              .map((training) => (
                <tr key={training.courseCode} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-700">{training.courseName}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{training.courseCode}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(training.completedAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(training.validUntil)}
                  </td>
                </tr>
              ))}
          </Table>
        </Panel>
      )}
    </div>
  );
}
