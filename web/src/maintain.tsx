import { useEffect, useRef, useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL ?? "https://api.noai.eslee.io";
const channelIdPattern = /^UC[\w-]{22}$/;
const videoIdPattern = /^[\w-]{11}$/;

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
  trustSubmissions: EvidenceSubmission[];
  trustedDesignations: Designation[];
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

type Notice = { kind: "success" | "error"; message: string } | null;

const emptyDraft: DesignationDraft = {
  channelId: "",
  rationale: "",
  videoUrl: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isYouTubeVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be") {
      return videoIdPattern.test(url.pathname.slice(1));
    }

    if (
      host !== "youtube.com" &&
      host !== "www.youtube.com" &&
      host !== "m.youtube.com"
    ) {
      return false;
    }

    if (url.pathname === "/watch") {
      return videoIdPattern.test(url.searchParams.get("v") ?? "");
    }

    const shortMatch = url.pathname.match(/^\/shorts\/([\w-]{11})$/);
    return shortMatch?.[1] ? videoIdPattern.test(shortMatch[1]) : false;
  } catch {
    return false;
  }
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
    value.submissions.every(isEvidenceSubmission) &&
    (value.trustSubmissions === undefined ||
      (Array.isArray(value.trustSubmissions) &&
        value.trustSubmissions.every(isEvidenceSubmission))) &&
    (value.trustedDesignations === undefined ||
      (Array.isArray(value.trustedDesignations) &&
        value.trustedDesignations.every(isDesignation)))
  );
}

async function request(path: string, options?: RequestInit): Promise<Response> {
  return fetch(new URL(path, apiUrl), {
    credentials: "include",
    ...options,
  }).catch(() => {
    throw new Error(
      "We couldn't reach NoAI. Check your connection and try again.",
    );
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

async function post(path: string, body?: object): Promise<void> {
  const response = await request(path, {
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await getError(response));
  }
}

async function loadDashboard(signal?: AbortSignal): Promise<Dashboard | null> {
  const sessionResponse = await request("/v1/maintainer/session", { signal });
  if (!sessionResponse.ok) {
    throw new Error(await getError(sessionResponse));
  }
  const session: unknown = await sessionResponse.json();
  if (!isRecord(session) || typeof session.authenticated !== "boolean") {
    throw new Error("We couldn't read your session. Please try again.");
  }
  if (!session.authenticated) {
    return null;
  }

  const response = await request("/v1/maintainer/dashboard", { signal });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await getError(response));
  }
  const dashboard: unknown = await response.json();
  if (!isDashboard(dashboard)) {
    throw new Error("We couldn't read the maintainer data. Please try again.");
  }
  return {
    ...dashboard,
    trustSubmissions: dashboard.trustSubmissions ?? [],
    trustedDesignations: dashboard.trustedDesignations ?? [],
  };
}

function Feedback({ notice }: { notice: Notice }) {
  return notice ? (
    <p
      className={`workflow-notice is-${notice.kind}`}
      role={notice.kind === "error" ? "alert" : "status"}
    >
      {notice.message}
    </p>
  ) : null;
}

function SignIn({ reason }: { reason: string | null }) {
  const message =
    reason === "denied"
      ? "This GitHub account doesn't have maintainer access. Try an approved account, or ask a current maintainer to add you."
      : reason === "unavailable"
        ? "GitHub sign-in is temporarily unavailable. Please try again later."
        : reason === "failed"
          ? "GitHub sign-in did not complete. Try again."
          : null;

  return (
    <div className="workflow-intro-grid workflow-sign-in">
      <div className="workflow-intro">
        <p className="workflow-kicker">For maintainers</p>
        <h1>A little care for a better feed.</h1>
        <p className="workflow-lede">
          Welcome back. Help keep the NoAI catalogue thoughtful, accurate, and
          open to correction.
        </p>
      </div>
      <section className="workflow-panel" aria-labelledby="sign-in-title">
        <h2 id="sign-in-title">Sign in to NoAI</h2>
        <p className="workflow-muted">
          Use the GitHub account a maintainer has approved. You can review
          evidence and publish, revise, or remove channel designations.
        </p>
        <Feedback notice={message ? { kind: "error", message } : null} />
        <a className="workflow-button" href={`${apiUrl}/auth/github`}>
          {reason === "failed"
            ? "Try GitHub sign-in again"
            : "Sign in with GitHub"}
        </a>
        <p className="workflow-small workflow-sign-in-note">
          Every published change has a recorded history.
        </p>
        <div className="workflow-divider-note">
          <h3>Just want to share a channel?</h3>
          <p>You don't need an account to send evidence.</p>
          <a href="/submit">Submit a channel</a>
        </div>
      </section>
    </div>
  );
}

function DesignationForm({
  draft,
  existing,
  onChange,
  onPublish,
  publishing,
}: {
  draft: DesignationDraft;
  existing: Designation | undefined;
  onChange: (draft: DesignationDraft) => void;
  onPublish: (draft: DesignationDraft) => Promise<void>;
  publishing: boolean;
}) {
  const [notice, setNotice] = useState<Notice>(null);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setNotice(null);
    const value = {
      channelId: draft.channelId.trim(),
      rationale: draft.rationale.trim(),
      videoUrl: draft.videoUrl.trim(),
    };
    if (!channelIdPattern.test(value.channelId)) {
      setNotice({
        kind: "error",
        message:
          "Enter the full YouTube Channel ID: UC followed by 22 characters.",
      });
      return;
    }

    if (!isYouTubeVideoUrl(value.videoUrl)) {
      setNotice({
        kind: "error",
        message: "Paste a YouTube video link, not a channel profile URL.",
      });
      return;
    }
    if (!value.rationale) {
      setNotice({
        kind: "error",
        message: "Add a rationale before publishing.",
      });
      return;
    }

    try {
      await onPublish(value);
      onChange(emptyDraft);
      setNotice({
        kind: "success",
        message: `Designation ${existing?.status === "active" ? "revised" : "published"} for ${value.channelId}. Evidence submissions have not changed.`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't publish. Your draft is still here. Try again.",
      });
    }
  }

  return (
    <form className="workflow-form" onSubmit={submit} aria-busy={publishing}>
      <fieldset disabled={publishing}>
        <legend className="visually-hidden">Channel designation details</legend>
        <label>
          <span>YouTube Channel ID</span>
          <input
            id="designation-channel"
            name="channelId"
            value={draft.channelId}
            onChange={(event) =>
              onChange({ ...draft, channelId: event.target.value })
            }
            placeholder="UC..."
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="designation-channel-hint"
            required
          />
          <small id="designation-channel-hint">
            The full ID beginning with UC, not an @handle or channel name.
          </small>
        </label>
        <label>
          <span>Representative video URL</span>
          <input
            name="videoUrl"
            value={draft.videoUrl}
            onChange={(event) =>
              onChange({ ...draft, videoUrl: event.target.value })
            }
            placeholder="https://www.youtube.com/watch?v=..."
            required
            type="url"
            aria-describedby="designation-video-hint"
          />
          <small id="designation-video-hint">
            A watch, Shorts, or youtu.be link that supports your rationale.
          </small>
        </label>
        <label>
          <span>Maintainer rationale</span>
          <textarea
            id="designation-rationale"
            name="rationale"
            value={draft.rationale}
            onChange={(event) =>
              onChange({ ...draft, rationale: event.target.value })
            }
            required
            maxLength={2000}
            rows={5}
            aria-describedby="designation-rationale-hint"
          />
          <small id="designation-rationale-hint">
            Explain why this channel primarily distributes AI slop. Up to 2,000
            characters.
          </small>
        </label>
        {existing ? (
          <p className="workflow-note">
            {existing.status === "active"
              ? "This channel already has an active designation. Publishing will record a revision."
              : "This designation was removed. Publishing will add the channel to the catalogue again."}
          </p>
        ) : null}
        <div className="workflow-actions">
          <button className="workflow-button" type="submit">
            {publishing
              ? "Publishing..."
              : existing?.status === "active"
                ? "Publish revision"
                : "Publish designation"}
          </button>
          <button
            className="workflow-button is-quiet"
            type="button"
            onClick={() => {
              onChange(emptyDraft);
              setNotice(null);
            }}
          >
            Clear draft
          </button>
        </div>
      </fieldset>
      <Feedback notice={notice} />
    </form>
  );
}

function EvidenceSubmissions({
  submissions,
  onDraft,
  publishing,
  refresh,
}: {
  submissions: EvidenceSubmission[];
  onDraft: (draft: DesignationDraft) => void;
  publishing: boolean;
  refresh: () => Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const pending = submissions.filter(
    (submission) => submission.status === "pending",
  );

  async function reviewSubmission(
    id: string,
    status: "reviewed" | "dismissed",
  ): Promise<void> {
    setPendingId(id);
    setNotice(null);
    try {
      await post(`/v1/maintainer/evidence-submissions/${id}/review`, {
        status,
      });
      setNotice({
        kind: "success",
        message:
          status === "reviewed"
            ? "Submission marked as reviewed. The catalogue hasn't changed."
            : "Submission dismissed. The catalogue hasn't changed.",
      });
      await refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't update this submission. Try again.",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section
      className="workflow-panel workflow-evidence"
      id="evidence"
      aria-labelledby="evidence-title"
    >
      <div className="workflow-section-heading">
        <h2 id="evidence-title">Evidence to review</h2>
        <span className="workflow-badge">{pending.length} pending</span>
      </div>
      <p className="workflow-muted">
        Read the evidence, watch the video, and decide what belongs in the
        catalogue. Publishing a designation doesn't mark a submission as
        reviewed.
      </p>
      <Feedback notice={notice} />
      <div className="workflow-record-list" aria-busy={pendingId !== null}>
        {pending.length === 0 ? (
          <div className="workflow-empty">
            <h3>You're all caught up.</h3>
            <p>
              New evidence submissions will appear here. You can also start a
              designation from your own research.
            </p>
          </div>
        ) : null}
        {pending.map((submission) => (
          <article className="workflow-record" key={submission.id}>
            <p className="workflow-small">
              Submitted {formatDate(submission.createdAt)}
            </p>
            <h3>
              <a
                className="workflow-channel"
                href={`https://www.youtube.com/channel/${submission.youtubeChannelId}`}
                target="_blank"
                rel="noreferrer"
              >
                {submission.youtubeChannelId}
              </a>
            </h3>
            <p className="workflow-rationale">{submission.rationale}</p>
            <a
              className="workflow-video-link"
              href={submission.representativeVideoUrl}
              target="_blank"
              rel="noreferrer"
            >
              Watch the representative video
            </a>
            <div className="workflow-actions">
              <button
                className="workflow-button is-secondary"
                disabled={publishing || pendingId !== null}
                onClick={() => {
                  onDraft({
                    channelId: submission.youtubeChannelId,
                    rationale: submission.rationale,
                    videoUrl: submission.representativeVideoUrl,
                  });
                  setNotice({
                    kind: "success",
                    message:
                      "Evidence copied into the draft. Nothing has been published.",
                  });
                }}
                type="button"
              >
                Copy into draft
              </button>
              <button
                className="workflow-button is-quiet"
                disabled={pendingId !== null}
                onClick={() => void reviewSubmission(submission.id, "reviewed")}
                type="button"
              >
                Mark reviewed
              </button>
              <button
                className="workflow-button is-quiet"
                disabled={pendingId !== null}
                onClick={() =>
                  void reviewSubmission(submission.id, "dismissed")
                }
                type="button"
              >
                Dismiss
              </button>
            </div>
            {pendingId === submission.id ? (
              <p className="workflow-small" aria-live="polite">
                Updating submission...
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Designations({
  designations,
  onDraft,
  publishing,
  refresh,
}: {
  designations: Designation[];
  onDraft: (draft: DesignationDraft) => void;
  publishing: boolean;
  refresh: () => Promise<void>;
}) {
  const [removal, setRemoval] = useState<{
    channelId: string;
    reason: string;
  } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const removingChannelId = removal?.channelId;

  useEffect(() => {
    if (removingChannelId) reasonInput.current?.focus();
  }, [removingChannelId]);

  async function removeDesignation(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!removal) return;
    if (!removal.reason.trim()) {
      setNotice({
        kind: "error",
        message:
          "Add a reason so other maintainers can understand this removal.",
      });
      return;
    }
    setRemoving(true);
    setNotice(null);
    try {
      await post(`/v1/maintainer/designations/${removal.channelId}/remove`, {
        reason: removal.reason.trim(),
      });
      setNotice({
        kind: "success",
        message: `Designation removed for ${removal.channelId}. Its history is preserved.`,
      });
      setRemoval(null);
      await refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't remove this designation. Your reason is still here. Try again.",
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section
      className="workflow-panel workflow-designations"
      id="designations"
      aria-labelledby="designations-title"
    >
      <div className="workflow-section-heading">
        <h2 id="designations-title">Channel designations</h2>
        <span className="workflow-badge">
          {
            designations.filter(
              (designation) => designation.status === "active",
            ).length
          }{" "}
          active
        </span>
      </div>
      <p className="workflow-muted">
        Active designations are included in the public catalogue. Revisions and
        removals keep their history.
      </p>
      <Feedback notice={notice} />
      <div className="workflow-record-list" aria-busy={removing}>
        {designations.length === 0 ? (
          <div className="workflow-empty">
            <h3>No designations yet.</h3>
            <p>
              Publish a designation with a rationale and a representative video
              to add the first channel.
            </p>
          </div>
        ) : null}
        {designations.map((designation) => {
          const active = designation.status === "active";
          const currentRemoval =
            removal?.channelId === designation.youtubeChannelId
              ? removal
              : null;
          return (
            <article className="workflow-record" key={designation.id}>
              <div className="workflow-record-heading">
                <h3>
                  <a
                    className="workflow-channel"
                    href={`https://www.youtube.com/channel/${designation.youtubeChannelId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {designation.youtubeChannelId}
                  </a>
                </h3>
                <span
                  className="workflow-badge"
                  data-status={designation.status}
                >
                  {designation.status}
                </span>
              </div>
              <p className="workflow-small">
                Updated {formatDate(designation.updatedAt)}
              </p>
              <p className="workflow-rationale">{designation.rationale}</p>
              <a
                className="workflow-video-link"
                href={designation.representativeVideoUrl}
                target="_blank"
                rel="noreferrer"
              >
                Watch the representative video
              </a>
              <div className="workflow-actions">
                <button
                  className="workflow-button is-secondary"
                  disabled={publishing || removing}
                  onClick={() =>
                    onDraft({
                      channelId: designation.youtubeChannelId,
                      rationale: designation.rationale,
                      videoUrl: designation.representativeVideoUrl,
                    })
                  }
                  type="button"
                >
                  {active ? "Edit designation" : "Use in draft"}
                </button>
                {active ? (
                  <button
                    className="workflow-button is-quiet is-danger"
                    id={`remove-${designation.id}`}
                    disabled={removing || publishing}
                    aria-expanded={currentRemoval !== null}
                    onClick={() => {
                      setRemoval(
                        currentRemoval ?? {
                          channelId: designation.youtubeChannelId,
                          reason: "",
                        },
                      );
                      setNotice(null);
                    }}
                    type="button"
                  >
                    Remove designation
                  </button>
                ) : null}
              </div>
              {currentRemoval ? (
                <form
                  className="workflow-form workflow-removal"
                  id="designation-removal"
                  onSubmit={removeDesignation}
                >
                  <h3>Remove this designation?</h3>
                  <p>
                    NoAI will stop filtering this channel through the public
                    catalogue. Your reason will be recorded.
                  </p>
                  <fieldset disabled={removing}>
                    <legend className="visually-hidden">Removal reason</legend>
                    <label>
                      <span>Why should it be removed?</span>
                      <textarea
                        ref={reasonInput}
                        value={currentRemoval.reason}
                        onChange={(event) =>
                          setRemoval({
                            ...currentRemoval,
                            reason: event.target.value,
                          })
                        }
                        required
                        maxLength={2000}
                        rows={3}
                      />
                    </label>
                    <div className="workflow-actions">
                      <button
                        className="workflow-button is-danger"
                        type="submit"
                      >
                        {removing ? "Removing..." : "Confirm removal"}
                      </button>
                      <button
                        className="workflow-button is-quiet"
                        type="button"
                        onClick={() => {
                          setRemoval(null);
                          setNotice(null);
                          document
                            .getElementById(`remove-${designation.id}`)
                            ?.focus();
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </fieldset>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TrustSubmissions({
  submissions,
  onDraft,
  publishing,
  refresh,
}: {
  submissions: EvidenceSubmission[];
  onDraft: (draft: DesignationDraft) => void;
  publishing: boolean;
  refresh: () => Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const pending = submissions.filter(
    (submission) => submission.status === "pending",
  );

  async function reviewSubmission(
    id: string,
    status: "reviewed" | "dismissed",
  ): Promise<void> {
    setPendingId(id);
    setNotice(null);
    try {
      await post(`/v1/maintainer/trust-submissions/${id}/review`, {
        status,
      });
      setNotice({
        kind: "success",
        message:
          status === "reviewed"
            ? "Whitelist request marked as reviewed. The whitelist hasn't changed."
            : "Whitelist request dismissed. The whitelist hasn't changed.",
      });
      await refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't update this request. Try again.",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section
      className="workflow-panel workflow-evidence"
      id="whitelist-requests"
      aria-labelledby="whitelist-requests-title"
    >
      <div className="workflow-section-heading">
        <h2 id="whitelist-requests-title">Whitelist requests to review</h2>
        <span className="workflow-badge">{pending.length} pending</span>
      </div>
      <p className="workflow-muted">
        Read the request, watch the video, and decide what belongs on the
        whitelist. Publishing a trusted designation doesn't mark a request as
        reviewed. Whitelisted channels never show Hide as AI slop.
      </p>
      <Feedback notice={notice} />
      <div className="workflow-record-list" aria-busy={pendingId !== null}>
        {pending.length === 0 ? (
          <div className="workflow-empty">
            <h3>No whitelist requests.</h3>
            <p>
              New whitelist requests will appear here. You can also start a
              trusted designation from your own research.
            </p>
          </div>
        ) : null}
        {pending.map((submission) => (
          <article className="workflow-record" key={submission.id}>
            <p className="workflow-small">
              Submitted {formatDate(submission.createdAt)}
            </p>
            <h3>
              <a
                className="workflow-channel"
                href={`https://www.youtube.com/channel/${submission.youtubeChannelId}`}
                target="_blank"
                rel="noreferrer"
              >
                {submission.youtubeChannelId}
              </a>
            </h3>
            <p className="workflow-rationale">{submission.rationale}</p>
            <a
              className="workflow-video-link"
              href={submission.representativeVideoUrl}
              target="_blank"
              rel="noreferrer"
            >
              Watch the representative video
            </a>
            <div className="workflow-actions">
              <button
                className="workflow-button is-secondary"
                disabled={publishing || pendingId !== null}
                onClick={() => {
                  onDraft({
                    channelId: submission.youtubeChannelId,
                    rationale: submission.rationale,
                    videoUrl: submission.representativeVideoUrl,
                  });
                  setNotice({
                    kind: "success",
                    message:
                      "Request copied into the trusted draft. Nothing has been published.",
                  });
                }}
                type="button"
              >
                Copy into trusted draft
              </button>
              <button
                className="workflow-button is-quiet"
                disabled={pendingId !== null}
                onClick={() => void reviewSubmission(submission.id, "reviewed")}
                type="button"
              >
                Mark reviewed
              </button>
              <button
                className="workflow-button is-quiet"
                disabled={pendingId !== null}
                onClick={() =>
                  void reviewSubmission(submission.id, "dismissed")
                }
                type="button"
              >
                Dismiss
              </button>
            </div>
            {pendingId === submission.id ? (
              <p className="workflow-small" aria-live="polite">
                Updating request...
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function TrustedDesignations({
  designations,
  onDraft,
  publishing,
  refresh,
}: {
  designations: Designation[];
  onDraft: (draft: DesignationDraft) => void;
  publishing: boolean;
  refresh: () => Promise<void>;
}) {
  const [removal, setRemoval] = useState<{
    channelId: string;
    reason: string;
  } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const removingChannelId = removal?.channelId;

  useEffect(() => {
    if (removingChannelId) reasonInput.current?.focus();
  }, [removingChannelId]);

  async function removeDesignation(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!removal) return;
    if (!removal.reason.trim()) {
      setNotice({
        kind: "error",
        message:
          "Add a reason so other maintainers can understand this removal.",
      });
      return;
    }
    setRemoving(true);
    setNotice(null);
    try {
      await post(
        `/v1/maintainer/trusted-designations/${removal.channelId}/remove`,
        {
          reason: removal.reason.trim(),
        },
      );
      setNotice({
        kind: "success",
        message: `Trusted designation removed for ${removal.channelId}. Its history is preserved.`,
      });
      setRemoval(null);
      await refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't remove this trusted designation. Your reason is still here. Try again.",
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section
      className="workflow-panel workflow-designations"
      id="trusted-designations"
      aria-labelledby="trusted-designations-title"
    >
      <div className="workflow-section-heading">
        <h2 id="trusted-designations-title">Trusted whitelist</h2>
        <span className="workflow-badge">
          {
            designations.filter(
              (designation) => designation.status === "active",
            ).length
          }{" "}
          active
        </span>
      </div>
      <p className="workflow-muted">
        Active trusted designations are included in the public catalogue. NoAI
        never filters them and never shows Hide as AI slop for them. Revisions
        and removals keep their history.
      </p>
      <Feedback notice={notice} />
      <div className="workflow-record-list" aria-busy={removing}>
        {designations.length === 0 ? (
          <div className="workflow-empty">
            <h3>No trusted channels yet.</h3>
            <p>
              Publish a trusted designation with a rationale and a
              representative video to whitelist the first channel.
            </p>
          </div>
        ) : null}
        {designations.map((designation) => {
          const active = designation.status === "active";
          const currentRemoval =
            removal?.channelId === designation.youtubeChannelId
              ? removal
              : null;
          return (
            <article className="workflow-record" key={designation.id}>
              <div className="workflow-record-heading">
                <h3>
                  <a
                    className="workflow-channel"
                    href={`https://www.youtube.com/channel/${designation.youtubeChannelId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {designation.youtubeChannelId}
                  </a>
                </h3>
                <span
                  className="workflow-badge"
                  data-status={designation.status}
                >
                  {designation.status}
                </span>
              </div>
              <p className="workflow-small">
                Updated {formatDate(designation.updatedAt)}
              </p>
              <p className="workflow-rationale">{designation.rationale}</p>
              <a
                className="workflow-video-link"
                href={designation.representativeVideoUrl}
                target="_blank"
                rel="noreferrer"
              >
                Watch the representative video
              </a>
              <div className="workflow-actions">
                <button
                  className="workflow-button is-secondary"
                  disabled={publishing || removing}
                  onClick={() =>
                    onDraft({
                      channelId: designation.youtubeChannelId,
                      rationale: designation.rationale,
                      videoUrl: designation.representativeVideoUrl,
                    })
                  }
                  type="button"
                >
                  {active ? "Edit trusted designation" : "Use in trusted draft"}
                </button>
                {active ? (
                  <button
                    className="workflow-button is-quiet is-danger"
                    id={`remove-trusted-${designation.id}`}
                    disabled={removing || publishing}
                    aria-expanded={currentRemoval !== null}
                    onClick={() => {
                      setRemoval(
                        currentRemoval ?? {
                          channelId: designation.youtubeChannelId,
                          reason: "",
                        },
                      );
                      setNotice(null);
                    }}
                    type="button"
                  >
                    Remove trusted designation
                  </button>
                ) : null}
              </div>
              {currentRemoval ? (
                <form
                  className="workflow-form workflow-removal"
                  id="trusted-designation-removal"
                  onSubmit={removeDesignation}
                >
                  <h3>Remove this trusted designation?</h3>
                  <p>
                    NoAI may filter this channel again through the public
                    catalogue or personal rules. Your reason will be recorded.
                  </p>
                  <fieldset disabled={removing}>
                    <legend className="visually-hidden">Removal reason</legend>
                    <label>
                      <span>Why should it be removed?</span>
                      <textarea
                        ref={reasonInput}
                        value={currentRemoval.reason}
                        onChange={(event) =>
                          setRemoval({
                            ...currentRemoval,
                            reason: event.target.value,
                          })
                        }
                        required
                        maxLength={2000}
                        rows={3}
                      />
                    </label>
                    <div className="workflow-actions">
                      <button
                        className="workflow-button is-danger"
                        type="submit"
                      >
                        {removing ? "Removing..." : "Confirm removal"}
                      </button>
                      <button
                        className="workflow-button is-quiet"
                        type="button"
                        onClick={() => {
                          setRemoval(null);
                          setNotice(null);
                          document
                            .getElementById(`remove-trusted-${designation.id}`)
                            ?.focus();
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </fieldset>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TrustedDesignationForm({
  draft,
  existing,
  onChange,
  onPublish,
  publishing,
}: {
  draft: DesignationDraft;
  existing: Designation | undefined;
  onChange: (draft: DesignationDraft) => void;
  onPublish: (draft: DesignationDraft) => Promise<void>;
  publishing: boolean;
}) {
  const [notice, setNotice] = useState<Notice>(null);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setNotice(null);
    const value = {
      channelId: draft.channelId.trim(),
      rationale: draft.rationale.trim(),
      videoUrl: draft.videoUrl.trim(),
    };
    if (!channelIdPattern.test(value.channelId)) {
      setNotice({
        kind: "error",
        message:
          "Enter the full YouTube Channel ID: UC followed by 22 characters.",
      });
      return;
    }

    if (!isYouTubeVideoUrl(value.videoUrl)) {
      setNotice({
        kind: "error",
        message: "Paste a YouTube video link, not a channel profile URL.",
      });
      return;
    }
    if (!value.rationale) {
      setNotice({
        kind: "error",
        message: "Add a rationale before publishing.",
      });
      return;
    }

    try {
      await onPublish(value);
      onChange(emptyDraft);
      setNotice({
        kind: "success",
        message: `Trusted designation ${existing?.status === "active" ? "revised" : "published"} for ${value.channelId}. Whitelist requests have not changed.`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't publish. Your draft is still here. Try again.",
      });
    }
  }

  return (
    <form className="workflow-form" onSubmit={submit} aria-busy={publishing}>
      <fieldset disabled={publishing}>
        <legend className="visually-hidden">
          Trusted channel designation details
        </legend>
        <label>
          <span>YouTube Channel ID</span>
          <input
            id="trusted-designation-channel"
            name="trustedChannelId"
            value={draft.channelId}
            onChange={(event) =>
              onChange({ ...draft, channelId: event.target.value })
            }
            placeholder="UC..."
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="trusted-designation-channel-hint"
            required
          />
          <small id="trusted-designation-channel-hint">
            The full ID beginning with UC, not an @handle or channel name.
          </small>
        </label>
        <label>
          <span>Representative video URL</span>
          <input
            name="trustedVideoUrl"
            value={draft.videoUrl}
            onChange={(event) =>
              onChange({ ...draft, videoUrl: event.target.value })
            }
            placeholder="https://www.youtube.com/watch?v=..."
            required
            type="url"
            aria-describedby="trusted-designation-video-hint"
          />
          <small id="trusted-designation-video-hint">
            A watch, Shorts, or youtu.be link that shows human-made work.
          </small>
        </label>
        <label>
          <span>Maintainer rationale</span>
          <textarea
            id="trusted-designation-rationale"
            name="trustedRationale"
            value={draft.rationale}
            onChange={(event) =>
              onChange({ ...draft, rationale: event.target.value })
            }
            required
            maxLength={2000}
            rows={5}
            aria-describedby="trusted-designation-rationale-hint"
          />
          <small id="trusted-designation-rationale-hint">
            Explain why this channel is human-made and should never be filtered.
            Up to 2,000 characters.
          </small>
        </label>
        {existing ? (
          <p className="workflow-note">
            {existing.status === "active"
              ? "This channel already has an active trusted designation. Publishing will record a revision."
              : "This trusted designation was removed. Publishing will add the channel to the whitelist again."}
          </p>
        ) : null}
        <div className="workflow-actions">
          <button className="workflow-button" type="submit">
            {publishing
              ? "Publishing..."
              : existing?.status === "active"
                ? "Publish trusted revision"
                : "Publish trusted designation"}
          </button>
          <button
            className="workflow-button is-quiet"
            type="button"
            onClick={() => {
              onChange(emptyDraft);
              setNotice(null);
            }}
          >
            Clear trusted draft
          </button>
        </div>
      </fieldset>
      <Feedback notice={notice} />
    </form>
  );
}

function Members({
  members,
  currentUserId,
  refresh,
}: {
  members: Maintainer[];
  currentUserId: string;
  refresh: () => Promise<void>;
}) {
  const [memberLogin, setMemberLogin] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function addMember(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const githubLogin = memberLogin.trim();
    if (!githubLogin) {
      setNotice({ kind: "error", message: "Enter a GitHub username first." });
      return;
    }
    setPendingAction("add");
    setNotice(null);
    try {
      await post("/v1/maintainer/members", { githubLogin });
      setMemberLogin("");
      setNotice({
        kind: "success",
        message: `@${githubLogin} now has maintainer access.`,
      });
      await refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't add this maintainer. Try again.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function deactivateMember(member: Maintainer): Promise<void> {
    setPendingAction(member.id);
    setNotice(null);
    try {
      await post(`/v1/maintainer/members/${member.githubUserId}/deactivate`);
      setNotice({
        kind: "success",
        message: `Maintainer access deactivated for @${member.githubLogin}.`,
      });
      await refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't change this person's access. Try again.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section
      className="workflow-panel workflow-members"
      id="maintainers"
      aria-labelledby="members-title"
    >
      <h2 id="members-title">The people behind the catalogue</h2>
      <p className="workflow-muted">
        Maintainers can publish, revise, and remove designations, and manage
        access for others. Add only people you trust with those decisions.
      </p>
      <form
        className="workflow-form"
        onSubmit={addMember}
        aria-busy={pendingAction === "add"}
      >
        <fieldset disabled={pendingAction !== null}>
          <legend className="visually-hidden">Add a maintainer</legend>
          <div className="workflow-member-form">
            <label>
              <span>GitHub username</span>
              <input
                name="githubLogin"
                value={memberLogin}
                onChange={(event) => setMemberLogin(event.target.value)}
                required
                maxLength={255}
                autoCapitalize="none"
                spellCheck={false}
                placeholder="username"
              />
            </label>
            <button className="workflow-button" type="submit">
              {pendingAction === "add" ? "Adding..." : "Add maintainer"}
            </button>
          </div>
        </fieldset>
        <p className="workflow-small">
          Adding an inactive maintainer gives them access again.
        </p>
      </form>
      <Feedback notice={notice} />
      <ul className="workflow-member-list" aria-busy={pendingAction !== null}>
        {members.map((member) => (
          <li key={member.id}>
            <div>
              <span className="workflow-member-name">
                @{member.githubLogin}
              </span>
              {member.githubUserId === currentUserId ? (
                <span className="workflow-badge is-muted">You</span>
              ) : null}
            </div>
            {member.active && member.githubUserId !== currentUserId ? (
              <button
                className="workflow-button is-quiet is-danger"
                disabled={pendingAction !== null}
                onClick={() => void deactivateMember(member)}
                type="button"
                aria-label={`Deactivate @${member.githubLogin}`}
              >
                {pendingAction === member.id ? "Deactivating..." : "Deactivate"}
              </button>
            ) : (
              <span className="workflow-small">
                {member.active ? "Active" : "Inactive"}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MaintainerDashboard({
  dashboard,
  refresh,
}: { dashboard: Dashboard; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState<DesignationDraft>(emptyDraft);
  const [trustedDraft, setTrustedDraft] =
    useState<DesignationDraft>(emptyDraft);
  const [publishing, setPublishing] = useState(false);
  const [publishingTrusted, setPublishingTrusted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const existing = dashboard.designations.find(
    (designation) => designation.youtubeChannelId === draft.channelId.trim(),
  );
  const existingTrusted = dashboard.trustedDesignations.find(
    (designation) =>
      designation.youtubeChannelId === trustedDraft.channelId.trim(),
  );

  async function publishDesignation(value: DesignationDraft): Promise<void> {
    setPublishing(true);
    try {
      await post("/v1/maintainer/designations", value);
      await refresh();
    } finally {
      setPublishing(false);
    }
  }

  async function publishTrustedDesignation(
    value: DesignationDraft,
  ): Promise<void> {
    setPublishingTrusted(true);
    try {
      await post("/v1/maintainer/trusted-designations", value);
      await refresh();
    } finally {
      setPublishingTrusted(false);
    }
  }

  function fillDraft(value: DesignationDraft): void {
    setDraft(value);
    document.getElementById("designation-rationale")?.focus();
  }

  function fillTrustedDraft(value: DesignationDraft): void {
    setTrustedDraft(value);
    document.getElementById("trusted-designation-rationale")?.focus();
  }

  async function signOut(): Promise<void> {
    setSigningOut(true);
    setNotice(null);
    try {
      await post("/auth/logout");
      window.location.assign("/maintain");
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't sign you out. Try again.",
      });
      setSigningOut(false);
    }
  }

  return (
    <>
      <div className="workflow-dashboard-heading">
        <div>
          <p className="workflow-kicker">Maintainers</p>
          <h1>Welcome back, @{dashboard.maintainer.githubLogin}.</h1>
          <p className="workflow-lede">
            A careful look makes a better catalogue. Every published change is
            recorded.
          </p>
        </div>
        <button
          className="workflow-button is-secondary"
          disabled={signingOut || publishing}
          onClick={() => void signOut()}
          type="button"
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
      <Feedback notice={notice} />
      <nav className="workflow-section-nav" aria-label="Maintainer sections">
        <a href="#draft">Write a designation</a>
        <a href="#evidence">Review evidence</a>
        <a href="#designations">Designations</a>
        <a href="#trusted-draft">Whitelist a channel</a>
        <a href="#whitelist-requests">Whitelist requests</a>
        <a href="#trusted-designations">Trusted whitelist</a>
        <a href="#maintainers">Maintainer access</a>
      </nav>
      <div className="workflow-dashboard-grid">
        <section
          className="workflow-panel workflow-draft"
          id="draft"
          aria-labelledby="draft-title"
        >
          <p className="workflow-kicker">Your draft</p>
          <h2 id="draft-title">
            {existing?.status === "active"
              ? "Edit a designation"
              : "Write a designation"}
          </h2>
          <p className="workflow-muted">
            Publishing adds this channel to the public catalogue for filtering.
            Include evidence you have checked yourself.
          </p>
          <DesignationForm
            draft={draft}
            existing={existing}
            onChange={setDraft}
            onPublish={publishDesignation}
            publishing={publishing}
          />
        </section>
        <EvidenceSubmissions
          submissions={dashboard.submissions}
          onDraft={fillDraft}
          publishing={publishing}
          refresh={refresh}
        />
        <Designations
          designations={dashboard.designations}
          onDraft={fillDraft}
          publishing={publishing}
          refresh={refresh}
        />
        <section
          className="workflow-panel workflow-draft"
          id="trusted-draft"
          aria-labelledby="trusted-draft-title"
        >
          <p className="workflow-kicker">Trusted draft</p>
          <h2 id="trusted-draft-title">
            {existingTrusted?.status === "active"
              ? "Edit a trusted designation"
              : "Whitelist a channel"}
          </h2>
          <p className="workflow-muted">
            Publishing adds this channel to the public whitelist. NoAI will
            never filter it and Hide as AI slop won't appear for it. Include
            evidence you have checked yourself.
          </p>
          <TrustedDesignationForm
            draft={trustedDraft}
            existing={existingTrusted}
            onChange={setTrustedDraft}
            onPublish={publishTrustedDesignation}
            publishing={publishingTrusted}
          />
        </section>
        <TrustSubmissions
          submissions={dashboard.trustSubmissions}
          onDraft={fillTrustedDraft}
          publishing={publishingTrusted}
          refresh={refresh}
        />
        <TrustedDesignations
          designations={dashboard.trustedDesignations}
          onDraft={fillTrustedDraft}
          publishing={publishingTrusted}
          refresh={refresh}
        />
        <Members
          members={dashboard.members}
          currentUserId={dashboard.maintainer.githubUserId}
          refresh={refresh}
        />
      </div>
    </>
  );
}

export function MaintainApp() {
  const [state, setState] = useState<ScreenState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const reason = new URLSearchParams(window.location.search).get("auth");

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    void loadDashboard(controller.signal)
      .then((dashboard) => {
        if (!controller.signal.aborted)
          setState(
            dashboard ? { kind: "ready", dashboard } : { kind: "signed-out" },
          );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "We couldn't reach NoAI. Please try again.",
          });
      });
    return () => controller.abort();
  }, []);

  async function retryLoad(): Promise<void> {
    setState({ kind: "loading" });
    try {
      const dashboard = await loadDashboard();
      setState(
        dashboard ? { kind: "ready", dashboard } : { kind: "signed-out" },
      );
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't reach NoAI. Please try again.",
      });
    }
  }

  async function refresh(): Promise<void> {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const dashboard = await loadDashboard();
      if (dashboard) {
        setState({ kind: "ready", dashboard });
      } else {
        setRefreshError(
          "Your session has ended. Sign in again in another tab, then retry. Your draft is still here.",
        );
      }
    } catch {
      setRefreshError(
        "We couldn't refresh the lists. Any confirmed changes were saved, but the lists below may be out of date. Your draft is still here.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="workflow-shell">
      <a className="skip-link" href="#workflow-main">
        Skip to content
      </a>
      <header className="workflow-header">
        <div className="workflow-header-inner">
          <a className="brand" href="/" aria-label="NoAI home">
            <span className="brand-mark" aria-hidden="true">
              N
            </span>
            NoAI
          </a>
          <p className="workflow-tagline">NoAI - a less sloppier web</p>
          <nav aria-label="Main navigation">
            <a href="/">Home</a>
            <a href="/submit">Submit a channel</a>
            <a href="/submit?kind=allowlist">Whitelist a channel</a>
            <a href="/maintain" aria-current="page">
              Maintainers
            </a>
          </nav>
        </div>
      </header>
      <main className="workflow-main" id="workflow-main" tabIndex={-1}>
        {state.kind === "loading" ? (
          <div className="workflow-loading">
            <h1>Getting things ready.</h1>
            <p aria-live="polite">
              Checking your session and loading the catalogue...
            </p>
            <div className="workflow-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
        {state.kind === "signed-out" ? <SignIn reason={reason} /> : null}
        {state.kind === "error" ? (
          <section className="workflow-panel workflow-load-error">
            <h1>We couldn't load your workspace.</h1>
            <p className="workflow-notice is-error" role="alert">
              {state.message}
            </p>
            <p>You can retry without signing out.</p>
            <button
              className="workflow-button"
              onClick={() => void retryLoad()}
              type="button"
            >
              Try again
            </button>
          </section>
        ) : null}
        {state.kind === "ready" ? (
          <>
            <div className="workflow-refresh">
              <span className="workflow-small" aria-live="polite">
                {refreshing
                  ? "Updating the lists..."
                  : "Your maintainer workspace"}
              </span>
              <button
                className="workflow-button is-quiet"
                disabled={refreshing}
                onClick={() => void refresh()}
                type="button"
              >
                {refreshing ? "Refreshing..." : "Refresh lists"}
              </button>
            </div>
            {refreshError ? (
              <div className="workflow-refresh-error">
                <p className="workflow-notice is-error" role="alert">
                  {refreshError}
                </p>
                <div className="workflow-actions">
                  <button
                    className="workflow-button is-secondary"
                    disabled={refreshing}
                    type="button"
                    onClick={() => void refresh()}
                  >
                    Retry refresh
                  </button>
                  <a
                    href={`${apiUrl}/auth/github`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Sign in in a new tab
                  </a>
                </div>
              </div>
            ) : null}
            <MaintainerDashboard
              dashboard={state.dashboard}
              refresh={refresh}
            />
          </>
        ) : null}
      </main>
      <footer className="workflow-footer">
        <p>Human judgment. Room for correction.</p>
        <a href="/">Back to NoAI</a>
      </footer>
    </div>
  );
}
