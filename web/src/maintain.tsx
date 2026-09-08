import { useEffect, useEffectEvent, useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL ?? "https://api.noai.eslee.io";

interface Designation {
  id: string;
  rationale: string;
  representativeVideoUrl: string;
  status: "active" | "removed";
  updatedAt: string;
  youtubeChannelId: string;
}

interface EvidenceSubmission {
  createdAt: string;
  id: string;
  rationale: string;
  representativeVideoUrl: string;
  reviewedAt: string | null;
  status: "pending" | "reviewed" | "dismissed";
  youtubeChannelId: string;
}

interface Maintainer {
  active: boolean;
  githubLogin: string;
  githubUserId: string;
  id: string;
}

interface Dashboard {
  designations: Designation[];
  maintainer: Pick<Maintainer, "githubLogin" | "githubUserId">;
  members: Maintainer[];
  submissions: EvidenceSubmission[];
}

type ScreenState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "ready"; dashboard: Dashboard }
  | { kind: "error"; message: string };

interface DesignationDraft {
  channelId: string;
  rationale: string;
  videoUrl: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isDesignation(value: unknown): value is Designation {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.rationale) &&
    isString(value.representativeVideoUrl) &&
    (value.status === "active" || value.status === "removed") &&
    isString(value.updatedAt) &&
    isString(value.youtubeChannelId)
  );
}

function isEvidenceSubmission(value: unknown): value is EvidenceSubmission {
  return (
    isRecord(value) &&
    isString(value.createdAt) &&
    isString(value.id) &&
    isString(value.rationale) &&
    isString(value.representativeVideoUrl) &&
    (value.reviewedAt === null || isString(value.reviewedAt)) &&
    (value.status === "pending" ||
      value.status === "reviewed" ||
      value.status === "dismissed") &&
    isString(value.youtubeChannelId)
  );
}

function isMaintainer(value: unknown): value is Maintainer {
  return (
    isRecord(value) &&
    typeof value.active === "boolean" &&
    isString(value.githubLogin) &&
    isString(value.githubUserId) &&
    isString(value.id)
  );
}

function isDashboard(value: unknown): value is Dashboard {
  return (
    isRecord(value) &&
    Array.isArray(value.designations) &&
    value.designations.every(isDesignation) &&
    isRecord(value.maintainer) &&
    isString(value.maintainer.githubLogin) &&
    isString(value.maintainer.githubUserId) &&
    Array.isArray(value.members) &&
    value.members.every(isMaintainer) &&
    Array.isArray(value.submissions) &&
    value.submissions.every(isEvidenceSubmission)
  );
}

async function request(path: string, options?: RequestInit): Promise<Response> {
  return fetch(new URL(path, apiUrl), {
    credentials: "include",
    ...options,
  });
}

async function getError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) && isString(body.error)
      ? body.error
      : "The request could not be completed";
  } catch {
    return "The request could not be completed";
  }
}

function formatDate(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf())
    ? "Unknown date"
    : timestamp.toLocaleDateString();
}

function SignIn({ reason }: { reason: string | null }) {
  const message =
    reason === "denied"
      ? "Your GitHub account is not an active NoAI Maintainer."
      : reason === "unavailable"
        ? "Maintainer sign-in is not configured yet."
        : reason === "failed"
          ? "GitHub sign-in did not complete. Try again."
          : null;

  return (
    <main className="maintain-shell sign-in-shell">
      <a className="maintain-mark" href="/">
        NOAI
      </a>
      <div className="sign-in-panel">
        <p className="eyebrow">MAINTAINER ACCESS</p>
        <h1>Keep the catalogue accountable.</h1>
        <p>
          Sign in with the GitHub account approved for NoAI maintenance. Every
          published change is recorded.
        </p>
        {message ? <p className="form-message is-error">{message}</p> : null}
        <a className="button button-primary" href={`${apiUrl}/auth/github`}>
          Sign in with GitHub
        </a>
        <a className="back-link" href="/">
          Return to NoAI
        </a>
      </div>
    </main>
  );
}

function DesignationForm({
  draft,
  onPublish,
  publishing,
}: {
  draft: DesignationDraft;
  onPublish: (draft: DesignationDraft) => Promise<void>;
  publishing: boolean;
}) {
  const [value, setValue] = useState(draft);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setValue(draft);
  }, [draft]);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setMessage(null);
    try {
      await onPublish(value);
      setValue({ channelId: "", rationale: "", videoUrl: "" });
      setMessage("Designation published.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish");
    }
  }

  return (
    <form className="maintain-form" onSubmit={submit}>
      <label>
        <span>YouTube Channel ID</span>
        <input
          value={value.channelId}
          onChange={(event) =>
            setValue({ ...value, channelId: event.target.value })
          }
          placeholder="UC..."
          required
        />
      </label>
      <label>
        <span>Representative video URL</span>
        <input
          value={value.videoUrl}
          onChange={(event) =>
            setValue({ ...value, videoUrl: event.target.value })
          }
          placeholder="https://www.youtube.com/watch?v=..."
          required
          type="url"
        />
      </label>
      <label>
        <span>Maintainer rationale</span>
        <textarea
          value={value.rationale}
          onChange={(event) =>
            setValue({ ...value, rationale: event.target.value })
          }
          required
          rows={5}
        />
      </label>
      <button disabled={publishing} type="submit">
        {publishing ? "Publishing..." : "Publish designation"}
      </button>
      {message ? <p className="form-message">{message}</p> : null}
    </form>
  );
}

function MaintainerDashboard({
  dashboard,
  refresh,
}: { dashboard: Dashboard; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState<DesignationDraft>({
    channelId: "",
    rationale: "",
    videoUrl: "",
  });
  const [publishing, setPublishing] = useState(false);
  const [memberLogin, setMemberLogin] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function publishDesignation(value: DesignationDraft): Promise<void> {
    setPublishing(true);
    try {
      const response = await request("/v1/maintainer/designations", {
        body: JSON.stringify(value),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await getError(response));
      }
      await refresh();
    } finally {
      setPublishing(false);
    }
  }

  async function reviewSubmission(
    id: string,
    status: "reviewed" | "dismissed",
  ): Promise<void> {
    const response = await request(
      `/v1/maintainer/evidence-submissions/${id}/review`,
      {
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    if (!response.ok) {
      setMessage(await getError(response));
      return;
    }
    await refresh();
  }

  async function removeDesignation(channelId: string): Promise<void> {
    const reason = window.prompt("Why should this designation be removed?");
    if (!reason) {
      return;
    }

    const response = await request(
      `/v1/maintainer/designations/${channelId}/remove`,
      {
        body: JSON.stringify({ reason }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    if (!response.ok) {
      setMessage(await getError(response));
      return;
    }
    await refresh();
  }

  async function addMember(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const response = await request("/v1/maintainer/members", {
      body: JSON.stringify({ githubLogin: memberLogin }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      setMessage(await getError(response));
      return;
    }
    setMemberLogin("");
    await refresh();
  }

  async function deactivateMember(githubUserId: string): Promise<void> {
    const response = await request(
      `/v1/maintainer/members/${githubUserId}/deactivate`,
      {
        method: "POST",
      },
    );
    if (!response.ok) {
      setMessage(await getError(response));
      return;
    }
    await refresh();
  }

  async function signOut(): Promise<void> {
    await request("/auth/logout", { method: "POST" });
    window.location.assign("/maintain");
  }

  const pendingSubmissions = dashboard.submissions.filter(
    (submission) => submission.status === "pending",
  );

  return (
    <main className="maintain-shell">
      <header className="maintain-header">
        <a className="maintain-mark" href="/">
          NOAI
        </a>
        <p>MAINTAINER CONSOLE</p>
        <div>
          <span>@{dashboard.maintainer.githubLogin}</span>
          <button
            className="text-button"
            onClick={() => void signOut()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="maintain-hero">
        <p className="eyebrow">CATALOGUE OPERATIONS</p>
        <h1>Make the list worth trusting.</h1>
        <p>
          Every publication updates the public snapshot. Every removal leaves an
          auditable event behind.
        </p>
      </section>

      {message ? <p className="maintain-alert">{message}</p> : null}

      <div className="maintain-grid">
        <section className="maintain-section publish-section">
          <div className="section-title">
            <p className="eyebrow">PUBLISH</p>
            <h2>Channel designation</h2>
          </div>
          <DesignationForm
            draft={draft}
            onPublish={publishDesignation}
            publishing={publishing}
          />
        </section>

        <section className="maintain-section queue-section">
          <div className="section-title">
            <p className="eyebrow">REVIEW QUEUE</p>
            <h2>{pendingSubmissions.length} pending submissions</h2>
          </div>
          <div className="review-list">
            {pendingSubmissions.length === 0 ? (
              <p className="empty-copy">Nothing is waiting for review.</p>
            ) : null}
            {pendingSubmissions.map((submission) => (
              <article className="review-item" key={submission.id}>
                <a
                  href={`https://www.youtube.com/channel/${submission.youtubeChannelId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {submission.youtubeChannelId}
                </a>
                <p>{submission.rationale}</p>
                <a
                  className="video-link"
                  href={submission.representativeVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Representative video
                </a>
                <div className="review-actions">
                  <button
                    onClick={() =>
                      setDraft({
                        channelId: submission.youtubeChannelId,
                        rationale: submission.rationale,
                        videoUrl: submission.representativeVideoUrl,
                      })
                    }
                    type="button"
                  >
                    Use in designation
                  </button>
                  <button
                    onClick={() =>
                      void reviewSubmission(submission.id, "dismissed")
                    }
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="maintain-section designation-section">
          <div className="section-title">
            <p className="eyebrow">PUBLISHED</p>
            <h2>
              {
                dashboard.designations.filter(
                  (designation) => designation.status === "active",
                ).length
              }{" "}
              active designations
            </h2>
          </div>
          <div className="designation-list">
            {dashboard.designations.map((designation) => (
              <article key={designation.id}>
                <div>
                  <a
                    href={`https://www.youtube.com/channel/${designation.youtubeChannelId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {designation.youtubeChannelId}
                  </a>
                  <span>
                    {designation.status} / updated{" "}
                    {formatDate(designation.updatedAt)}
                  </span>
                </div>
                <p>{designation.rationale}</p>
                {designation.status === "active" ? (
                  <button
                    onClick={() =>
                      void removeDesignation(designation.youtubeChannelId)
                    }
                    type="button"
                  >
                    Remove designation
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="maintain-section members-section">
          <div className="section-title">
            <p className="eyebrow">MAINTAINERS</p>
            <h2>People trusted to publish</h2>
          </div>
          <form className="member-form" onSubmit={addMember}>
            <label>
              <span>GitHub login</span>
              <input
                value={memberLogin}
                onChange={(event) => setMemberLogin(event.target.value)}
                required
              />
            </label>
            <button type="submit">Add maintainer</button>
          </form>
          <div className="member-list">
            {dashboard.members.map((member) => (
              <div key={member.id}>
                <span>@{member.githubLogin}</span>
                {member.active ? (
                  <button
                    disabled={
                      member.githubUserId === dashboard.maintainer.githubUserId
                    }
                    onClick={() => void deactivateMember(member.githubUserId)}
                    type="button"
                  >
                    Remove
                  </button>
                ) : (
                  <span>Inactive</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export function MaintainApp() {
  const [state, setState] = useState<ScreenState>({ kind: "loading" });
  const reason = new URLSearchParams(window.location.search).get("auth");

  const loadDashboard = useEffectEvent(async () => {
    const sessionResponse = await request("/v1/maintainer/session");
    const session: unknown = await sessionResponse.json();
    if (!isRecord(session) || session.authenticated !== true) {
      setState({ kind: "signed-out" });
      return;
    }

    const dashboardResponse = await request("/v1/maintainer/dashboard");
    if (!dashboardResponse.ok) {
      setState({ kind: "error", message: await getError(dashboardResponse) });
      return;
    }

    const dashboard: unknown = await dashboardResponse.json();
    if (!isDashboard(dashboard)) {
      setState({ kind: "error", message: "Maintainer data was invalid" });
      return;
    }
    setState({ kind: "ready", dashboard });
  });

  useEffect(() => {
    void loadDashboard().catch(() => {
      setState({
        kind: "error",
        message: "Unable to reach the maintainer API",
      });
    });
  }, [loadDashboard]);

  if (state.kind === "loading") {
    return (
      <main className="maintain-shell loading-shell">
        Loading maintainer console...
      </main>
    );
  }

  if (state.kind === "signed-out") {
    return <SignIn reason={reason} />;
  }

  if (state.kind === "error") {
    return (
      <main className="maintain-shell loading-shell">{state.message}</main>
    );
  }

  return (
    <MaintainerDashboard
      dashboard={state.dashboard}
      refresh={() => loadDashboard()}
    />
  );
}
