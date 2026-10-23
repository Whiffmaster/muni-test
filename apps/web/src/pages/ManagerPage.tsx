import type { DashboardResponse } from "@app/shared";

import { Badge } from "../components/Badge";
import { Panel } from "../components/Panel";
import { StatTile } from "../components/StatTile";
import { EmptyRow, Table } from "../components/Table";
import { TrainingPlanSection, TrainingWarnings } from "../components/TrainingPlan";
import { formatDate, stateLabel, stateTone } from "../lib/format";

interface ManagerPageProps {
  data: DashboardResponse;
}

export function ManagerPage({ data }: ManagerPageProps) {
  const team = data.team ?? [];
  const summaries = data.teamTrainings ?? [];
  const plan = data.trainingPlan ?? [];
  const planSummary = data.trainingPlanSummary ?? [];
  const warnings = data.trainingWarnings ?? [];

  const expired = team.reduce((sum, member) => sum + member.expiredCount, 0);
  const missing = team.reduce((sum, member) => sum + member.missingCount, 0);
  const expiring = team.reduce((sum, member) => sum + member.expiringCount, 0);

  const withOutstanding = team.filter((member) => member.outstanding.length > 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="V týmu" value={team.length} />
        <StatTile label="Chybí" value={missing} emphasis={missing > 0} />
        <StatTile label="Vypršelá" value={expired} emphasis={expired > 0} />
        <StatTile label="Expirují" value={expiring} emphasis={expiring > 0} />
      </div>

      <TrainingWarnings warnings={warnings} />

      <TrainingPlanSection
        items={plan}
        summary={planSummary}
        subtitle="Návrh, kdo z týmu má jít na který nejbližší termín"
      />

      <Panel
        title="Tým"
        subtitle={`${withOutstanding.length} z ${team.length} lidí má něco k doplnit`}
        flush
      >
        <Table head={["Jméno", "Útvar", "Pozice", "Platná", "Expiruje", "Vypršelá", "Chybí", "Další konec platnosti"]}>
          {team.length === 0 && <EmptyRow columns={8} text="V týmu nikdo není" />}
          {team.map((member) => (
            <tr key={member.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-900">{member.fullName}</div>
                <div className="text-xs text-zinc-400">{member.email}</div>
              </td>
              <td className="px-4 py-3 text-zinc-600">{member.department ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-600">{member.position ?? "—"}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{member.validCount}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{member.expiringCount}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{member.expiredCount}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{member.missingCount}</td>
              <td className="px-4 py-3 text-zinc-600">{formatDate(member.nextExpiry)}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel
        title="Školení týmu"
        subtitle="Kolik lidí má které školení v pořádku"
        flush
      >
        <Table head={["Školení", "Platná", "Expiruje", "Vypršelá", "Chybí", "Další termín"]}>
          {summaries.length === 0 && <EmptyRow columns={6} text="Pro tým nejsou žádná školení" />}
          {summaries.map((summary) => (
            <tr key={summary.courseCode} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-900">{summary.courseName}</div>
                <div className="text-xs text-zinc-400">{summary.courseCode}</div>
              </td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{summary.peopleValid}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{summary.peopleExpiring}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{summary.peopleExpired}</td>
              <td className="px-4 py-3 tabular-nums text-zinc-600">{summary.peopleMissing}</td>
              <td className="px-4 py-3 text-zinc-600">
                {summary.nextSession ? (
                  <>
                    {formatDate(summary.nextSession.date)}
                    {summary.nextSession.startTime && (
                      <div className="text-xs text-zinc-400">{summary.nextSession.startTime}</div>
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

      <Panel title="Kdo má co doplnit" subtitle="Přehled chybějících a vypršelých školení">
        {withOutstanding.length === 0 ? (
          <p className="text-sm text-zinc-400">Všichni mají všechna školení v pořádku.</p>
        ) : (
          <ul className="space-y-2">
            {withOutstanding.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ring-1 ring-zinc-200"
              >
                <div className="text-sm font-medium text-zinc-900">{member.fullName}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {member.outstanding.map((item) => (
                    <Badge key={item.courseCode} tone={stateTone(item.state)}>
                      {item.courseCode} · {stateLabel(item.state)}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
