import { GraduationCap, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useProjects } from "../lib/hooks";
import { sortProjects } from "../lib/projects";
import { ProjectRow } from "../components/ProjectParts";
import { useProjectForm } from "../components/ProjectForm";
import { Empty, Loading, PageTitle, SectionHead, Segmented } from "../components/ui";

export default function ProjectsPage() {
  const { data, isLoading } = useProjects();
  const showForm = useProjectForm((s) => s.show);
  const [show, setShow] = useState<"active" | "done">("active");

  const { active, done, soon } = useMemo(() => {
    const list = sortProjects(data ?? []);
    const active = list.filter((p) => !p.completedAt);
    const week = Date.now() + 7 * 86_400_000;
    return {
      active,
      done: list.filter((p) => p.completedAt),
      soon: active.filter((p) => p.deadline && new Date(p.deadline).getTime() < week).length,
    };
  }, [data]);

  const courses = active.filter((p) => p.kind === "COURSE");
  const projects = active.filter((p) => p.kind === "PROJECT");

  return (
    <div className="max-w-[860px]">
      <PageTitle
        sub="Things with a finish line: work you've been given and courses you're taking. Each gets a checklist, a deadline countdown and reminders."
        aside={
          <div className="flex gap-2">
            <button className="btn-line" onClick={() => showForm(null, "COURSE")}>
              <GraduationCap size={17} /> New course
            </button>
            <button className="btn-pen" onClick={() => showForm(null, "PROJECT")}>
              <Plus size={18} strokeWidth={2.5} /> New project
            </button>
          </div>
        }
      >
        Projects
      </PageTitle>

      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty
          title="Nothing on the go"
          body="Add the project you've been handed, or the course you keep meaning to finish. Break it into steps, set a deadline, and HabitFlow will count down with you."
          action={
            <div className="flex flex-wrap gap-2">
              <button className="btn-pen" onClick={() => showForm(null, "PROJECT")}>
                <Plus size={18} /> Add a project
              </button>
              <button className="btn-line" onClick={() => showForm(null, "COURSE")}>
                <GraduationCap size={17} /> Add a course
              </button>
            </div>
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] text-ink-2">
              <span className="numeral text-[26px] font-extrabold text-ink">{active.length}</span> on the go
              {soon > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-red">{soon} due this week</span>
                </>
              )}
            </p>
            <div className="w-[220px]">
              <Segmented
                id="pshow"
                size="sm"
                value={show}
                onChange={setShow}
                options={[
                  { value: "active", label: "Active" },
                  { value: "done", label: `Done · ${done.length}` },
                ]}
              />
            </div>
          </div>

          {show === "active" ? (
            <>
              {!active.length && <p className="sheet px-5 py-4 text-[15px] text-ink-2">Everything's finished. Add the next one when it lands.</p>}
              {projects.length > 0 && (
                <section>
                  <SectionHead aside={String(projects.length)}>Projects</SectionHead>
                  <ul className="sheet overflow-hidden">
                    {projects.map((p, i) => (
                      <ProjectRow key={p.id} project={p} index={i} />
                    ))}
                  </ul>
                </section>
              )}
              {courses.length > 0 && (
                <section>
                  <SectionHead aside={String(courses.length)}>Courses</SectionHead>
                  <ul className="sheet overflow-hidden">
                    {courses.map((p, i) => (
                      <ProjectRow key={p.id} project={p} index={i} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : done.length ? (
            <ul className="sheet overflow-hidden">
              {done.map((p, i) => (
                <ProjectRow key={p.id} project={p} index={i} />
              ))}
            </ul>
          ) : (
            <p className="sheet px-5 py-4 text-[15px] text-ink-2">Nothing finished yet. The first one is the hardest.</p>
          )}
        </div>
      )}
    </div>
  );
}
