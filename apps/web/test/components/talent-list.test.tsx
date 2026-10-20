import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TalentList } from "@/components/talent/talent-ui";
import type { TalentProfile } from "@/lib/talent";

vi.mock("@/lib/client-api", () => ({
  acceptTalentConnection: vi.fn(),
  getConnections: vi.fn(),
  ignoreTalentConnection: vi.fn(),
  pauseTalent: vi.fn(),
  saveTalent: vi.fn(),
  sendTalentConnection: vi.fn(),
  suspendTalent: vi.fn(),
}));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const base: TalentProfile = {
  id: 2,
  userId: "2",
  status: 0,
  headline: "寻找开发搭档",
  bio: "这是一段足够长的人才简介，用来描述我的经验、工作方式以及正在寻找的合作方向。",
  city: "上海",
  links: [],
  availability: 0,
  skills: ["productStrategy", "needsAnalysis"],
  seekingSkills: ["frontend"],
  domains: ["效率工具"],
  durations: ["短期项目"],
  publishedAt: "",
  createdAt: "",
  updatedAt: "",
  founder: { nickname: "候选人" },
  projects: [],
};

const params = { sort: "new" as const, page: 1 };

describe("TalentList (plaza surfaces)", () => {
  it("shows the availability badge and both skill states on the card, with no role filter", () => {
    render(<TalentList profiles={[base]} total={1} params={{ ...params }} />);

    expect(screen.getByText("积极寻找合作")).toBeInTheDocument();
    const provided = screen.getByText("产品策略").closest("[data-skill-state]");
    const seeking = screen.getByText("前端").closest("[data-skill-state]");
    expect(provided).toHaveAttribute("data-skill-state", "provide");
    expect(seeking).toHaveAttribute("data-skill-state", "seeking");

    expect(screen.getByLabelText("合作方式")).toBeInTheDocument();
    expect(screen.queryByLabelText("方向")).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("搜索姓名、技能或项目"),
    ).toBeInTheDocument();
  });

  it("keeps page navigation free of the removed role param", () => {
    // parseTalentParams never emits a role key, so pageHref drops stray params.
    render(
      <TalentList profiles={[base]} total={21} params={{ ...params }} />,
    );
    const links = screen.getAllByRole("link", { name: "下一页 →" });
    expect(links[0]).toHaveAttribute("href", "/talents?sort=new&page=2");
  });
});
