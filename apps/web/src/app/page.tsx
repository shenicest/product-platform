import { getLiveProjects } from "@/server/projects";
import { ProjectCard } from "@/components/project-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data: projects, total } = await getLiveProjects();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">发现早期产品</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {total} 个正在展示的项目
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-24 text-center text-muted-foreground">
          暂无正在展示的项目
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
