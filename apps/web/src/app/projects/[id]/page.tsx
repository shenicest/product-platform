import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject } from "@/server/projects";
import { ProjectDetail } from "@/components/project-detail";
import { PublicInteractionBoundary } from '@/components/public-interaction-boundary'
import { getMyProjectConnectionStatus } from '@/server/project-connections'
import { NO_INDEX_ROBOTS, pageMetadata } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

function parseProjectId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function loadProject(rawId: string) {
  const id = parseProjectId(rawId);
  if (id === null) return null;
  return getProject(id);
}

export async function generateMetadata(
  props: PageProps<"/projects/[id]">
): Promise<Metadata> {
  const { id } = await props.params;
  const project = await loadProject(id);
  if (!project) return { title: "项目不可用", robots: NO_INDEX_ROBOTS };

  return pageMetadata({
    title: project.name,
    description: project.tagline || project.problemStatement,
    path: `/projects/${project.id}`,
    type: "article",
    images: project.coverUrl
      ? [{ url: project.coverUrl, alt: project.name }]
      : undefined,
  });
}

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const project = await loadProject(id);
  if (!project) notFound();
  const connectGate = await getMyProjectConnectionStatus(project.id);

  return (
    <PublicInteractionBoundary>
      <ProjectDetail project={project} connectGate={connectGate} />
    </PublicInteractionBoundary>
  );
}
