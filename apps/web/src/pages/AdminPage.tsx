import { useState } from "react";
import type { DashboardResponse } from "@app/shared";

import { StatTile } from "../components/StatTile";
import { TrainingPlanSection, TrainingWarnings } from "../components/TrainingPlan";
import { CoursesTab } from "./admin/CoursesTab";
import { PeopleTab } from "./admin/PeopleTab";
import { SessionsTab } from "./admin/SessionsTab";
import { TrainingsTab } from "./admin/TrainingsTab";

interface AdminPageProps {
  data: DashboardResponse;
  onChanged: () => Promise<void>;
}

type Tab = "people" | "courses" | "sessions" | "trainings" | "plan";

const TABS: { id: Tab; label: string }[] = [
  { id: "people", label: "Lidé" },
  { id: "courses", label: "Katalog školení" },
  { id: "sessions", label: "Termíny" },
  { id: "trainings", label: "Absolvovaná" },
  { id: "plan", label: "Plán školení" },
];

export function AdminPage({ data, onChanged }: AdminPageProps) {
  const [tab, setTab] = useState<Tab>("people");
  const stats = data.stats;
  const warnings = data.trainingWarnings ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Lidé" value={stats.employees} hint={`${stats.activeEmployees} aktivních`} />
        <StatTile label="Absolvovaná školení" value={stats.trainings} />
        <StatTile label="Chybí" value={stats.missing} emphasis={stats.missing > 0} />
        <StatTile label="Vypršelá" value={stats.expired} emphasis={stats.expired > 0} />
      </div>

      <TrainingWarnings warnings={warnings} showManager />

      <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-zinc-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === item.id
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "people" && <PeopleTab data={data} onChanged={onChanged} />}
      {tab === "courses" && <CoursesTab data={data} onChanged={onChanged} />}
      {tab === "sessions" && <SessionsTab data={data} onChanged={onChanged} />}
      {tab === "trainings" && <TrainingsTab data={data} onChanged={onChanged} />}
      {tab === "plan" && (
        <TrainingPlanSection
          items={data.trainingPlan ?? []}
          summary={data.trainingPlanSummary ?? []}
          subtitle="Návrh, kdo má jít na který nejbližší termín - pro všechny lidi"
        />
      )}
    </div>
  );
}
