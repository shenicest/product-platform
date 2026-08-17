import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TalentDetail } from "@/components/talent/talent-ui";
import { sendTalentConnection } from "@/lib/client-api";
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
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { user_id: 1 } }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const profile: TalentProfile = {
  id: 2,
  userId: "2",
  status: 0,
  headline: "寻找开发搭档",
  bio: "这是一段足够长的人才简介，用来描述我的经验、工作方式以及正在寻找的合作方向。",
  city: "上海",
  roles: ["产品"],
  skills: ["产品策略", "需求分析", "用户研究"],
  seekingSkills: ["前端开发"],
  domains: ["效率工具"],
  durations: ["短期项目"],
  publishedAt: "",
  createdAt: "",
  updatedAt: "",
  founder: { nickname: "候选人" },
  projects: [],
};

describe("TalentDetail connection dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendTalentConnection).mockResolvedValue({
      data: {} as never,
      error: null,
    });
  });

  it("submits the selected sender-owned Live project ID", async () => {
    const user = userEvent.setup();
    render(
      <TalentDetail
        profile={profile}
        projectOptions={[{ id: 17, name: "我的 Live 项目", tagline: null }]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "发起一次连接" }));
    await user.selectOptions(
      screen.getByLabelText("关联我的已上线项目（可选）"),
      "17",
    );
    await user.selectOptions(screen.getByLabelText("想一起做什么"), "短期协作");
    await user.type(
      screen.getByLabelText("留言（30-500 字）"),
      "希望进一步交流合作方式，这是一段满足最小长度要求的连接说明。",
    );
    await user.type(screen.getByLabelText("邮箱"), "sender@example.com");
    await user.click(screen.getByRole("button", { name: "发送连接" }));

    expect(sendTalentConnection).toHaveBeenCalledWith({
      receiverUserId: "2",
      projectId: 17,
      purpose: "短期协作",
      message: "希望进一步交流合作方式，这是一段满足最小长度要求的连接说明。",
      wechat: undefined,
      email: "sender@example.com",
    });
  });

  it("omits the selector when the sender has no Live projects", async () => {
    const user = userEvent.setup();
    render(<TalentDetail profile={profile} projectOptions={[]} />);
    await user.click(screen.getByRole("button", { name: "发起一次连接" }));
    expect(
      screen.queryByLabelText("关联我的已上线项目（可选）"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
