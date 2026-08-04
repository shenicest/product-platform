import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject } from "@/server/projects";
import { ProjectDetail } from "@/components/project-detail";

export const dynamic = "force-dynamic";

const METADATA_DESCRIPTION_MAX_LENGTH = 150;

function parseProjectId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength
    ? text
    : `${text.slice(0, maxLength - 1)}…`;
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
  if (!project) return { title: "项目不可用" };

  const description = project.tagline
    ? truncate(project.tagline, METADATA_DESCRIPTION_MAX_LENGTH)
    : project.description
      ? truncate(project.description, METADATA_DESCRIPTION_MAX_LENGTH)
      : undefined;

  return {
    title: project.name,
    description,
    openGraph: {
      title: project.name,
      description,
      type: "article",
      ...(project.coverUrl ? { images: [{ url: project.coverUrl }] } : {}),
    },
  };
}

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const project = await loadProject(id);
  if (!project) notFound();

  return <ProjectDetail project={project} />;
}
