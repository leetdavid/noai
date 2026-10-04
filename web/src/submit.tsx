import { useEffect, useRef, useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL ?? "https://api.noai.eslee.io";
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const channelIdPattern = /^UC[\w-]{22}$/;
const videoIdPattern = /^[\w-]{11}$/;

interface Turnstile {
  render: (
    element: HTMLElement,
    options: {
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      sitekey: string;
      size: "flexible" | "compact";
      theme: "light";
    },
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

type SubmissionState =
  | { kind: "ready" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

type VerificationState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "verified" }
  | { kind: "error"; message: string };

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

function getInitialValue(name: string): string {
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

function getSubmissionValidationError({
  channelId,
  rationale,
  turnstileToken,
  videoUrl,
}: {
  channelId: string;
  rationale: string;
  turnstileToken: string;
  videoUrl: string;
}): string | null {
  if (!channelIdPattern.test(channelId.trim())) {
    return "Enter the full YouTube Channel ID: UC followed by 22 characters. A channel name or @handle won't work here.";
  }

  if (!isYouTubeVideoUrl(videoUrl)) {
    return "Add an individual YouTube video URL, not a channel profile URL.";
  }

  if (!rationale.trim()) {
    return "Tell us what you noticed about this channel before sending.";
  }

  return turnstileToken ? null : "Complete the verification before submitting.";
}

async function getSubmissionError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    return "We couldn't send your evidence. Your details are still here. Please try again.";
  }

  return "We couldn't send your evidence. Your details are still here. Please try again.";
}

async function submitEvidence({
  channelId,
  kind,
  rationale,
  turnstileToken,
  videoUrl,
}: {
  channelId: string;
  kind: "slop" | "allowlist";
  rationale: string;
  turnstileToken: string;
  videoUrl: string;
}): Promise<void> {
  const path =
    kind === "allowlist" ? "/v1/trust-submissions" : "/v1/evidence-submissions";
  const response = await fetch(new URL(path, apiUrl), {
    body: JSON.stringify({ channelId, rationale, turnstileToken, videoUrl }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await getSubmissionError(response));
  }
}

function Verification({
  onToken,
  disabled,
  sitekey,
}: { onToken: (token: string) => void; disabled: boolean; sitekey: string }) {
  const [verification, setVerification] = useState<VerificationState>({
    kind: "loading",
  });
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 380px)").matches,
  );
  const turnstileElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 380px)");
    function resize(): void {
      setCompact(media.matches);
    }
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);

  useEffect(() => {
    if (!turnstileElement.current) {
      return;
    }

    let active = true;
    let script: HTMLScriptElement | null = null;
    let widgetId: string | null = null;
    setVerification({ kind: "loading" });
    onToken("");

    function verificationError(message: string): void {
      if (!active) return;
      setVerification({ kind: "error", message });
      onToken("");
    }

    const timeout = window.setTimeout(() => {
      if (widgetId === null)
        verificationError(
          "Verification is taking longer than expected. Check your connection and retry.",
        );
    }, 15000);

    function renderTurnstile(): void {
      if (!active || !turnstileElement.current || widgetId !== null) {
        return;
      }
      if (!window.turnstile) {
        verificationError("Verification couldn't load. Please retry.");
        return;
      }
      window.clearTimeout(timeout);
      setVerification({ kind: "ready" });
      try {
        widgetId = window.turnstile.render(turnstileElement.current, {
          callback: (token) => {
            if (!active) return;
            setVerification({ kind: "verified" });
            onToken(token);
          },
          "error-callback": () =>
            verificationError(
              "Verification didn't complete. Please retry the check. Your details won't be lost.",
            ),
          "expired-callback": () =>
            verificationError(
              "Your verification expired. Please verify again before sending.",
            ),
          "timeout-callback": () =>
            verificationError(
              "The verification timed out. Please try the check again.",
            ),
          sitekey,
          size: compact ? "compact" : "flexible",
          theme: "light",
        });
      } catch {
        verificationError(
          "Verification couldn't start. Please retry the check.",
        );
      }
    }

    function scriptError(): void {
      window.clearTimeout(timeout);
      verificationError(
        "Verification couldn't load. Check your connection or content blocker settings, then retry.",
      );
    }

    if (window.turnstile) {
      renderTurnstile();
    } else {
      script = document.querySelector<HTMLScriptElement>(
        "script[data-noai-turnstile]",
      );
      if (script && verificationAttempt > 0) {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement("script");
        script.dataset.noaiTurnstile = "";
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
      }
      script.addEventListener("load", renderTurnstile);
      script.addEventListener("error", scriptError);
      if (!script.isConnected) document.head.append(script);
    }

    return () => {
      active = false;
      window.clearTimeout(timeout);
      script?.removeEventListener("load", renderTurnstile);
      script?.removeEventListener("error", scriptError);
      if (!window.turnstile) script?.remove();
      if (widgetId !== null) window.turnstile?.remove(widgetId);
    };
  }, [verificationAttempt, onToken, sitekey, compact]);

  return (
    <div className="workflow-verification">
      <p className="workflow-field-title">One quick check</p>
      <p className="workflow-small">
        This helps keep automated spam out of the submissions.
      </p>
      <div className="workflow-turnstile" ref={turnstileElement} />
      {verification.kind === "error" ? (
        <p className="workflow-notice is-error" role="alert">
          {verification.message}
        </p>
      ) : (
        <p className="workflow-small" aria-live="polite">
          {verification.kind === "loading"
            ? "Loading verification..."
            : verification.kind === "verified"
              ? "Verification complete. You're ready to send."
              : "Complete the verification above before sending."}
        </p>
      )}
      {verification.kind === "error" ? (
        <button
          className="workflow-button is-secondary"
          type="button"
          disabled={disabled}
          onClick={() => setVerificationAttempt((value) => value + 1)}
        >
          Retry verification
        </button>
      ) : null}
    </div>
  );
}

const submissionCopy = {
  allowlist: {
    footnote:
      "A whitelist request is evidence for a maintainer to consider, not a public trusted designation. Whitelisted channels never show Hide as AI slop.",
    rationaleHint:
      "Explain why this channel is human-made and worth whitelisting. Point to details in the video where you can. Up to 2,000 characters.",
    receivedKicker: "Whitelist request received",
    receivedMessage:
      "Your whitelist request has been sent for maintainer review. Nothing has been added to the whitelist yet, and NoAI keeps filtering this channel until a maintainer approves it.",
  },
  slop: {
    footnote:
      "A submission is evidence for a maintainer to consider, not a public designation.",
    rationaleHint:
      "Explain why the channel primarily distributes AI slop. Point to details in the video where you can. Up to 2,000 characters.",
    receivedKicker: "Evidence received",
    receivedMessage:
      "Your evidence has been sent for maintainer review. Nothing has been added to the catalogue yet.",
  },
} as const;

type SubmissionKind = keyof typeof submissionCopy;

function SubmissionForm({
  kind,
  sitekey,
}: {
  kind: SubmissionKind;
  sitekey: string;
}) {
  const [channelId, setChannelId] = useState(() =>
    getInitialValue("channelId"),
  );
  const [videoUrl, setVideoUrl] = useState(() => getInitialValue("videoUrl"));
  const [rationale, setRationale] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [verificationKey, setVerificationKey] = useState(0);
  const [state, setState] = useState<SubmissionState>({ kind: "ready" });
  const [submitting, setSubmitting] = useState(false);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const sent = state.kind === "sent";

  useEffect(() => {
    if (sent) successHeading.current?.focus();
  }, [sent]);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setState({ kind: "ready" });
    const validationError = getSubmissionValidationError({
      channelId,
      rationale,
      turnstileToken,
      videoUrl: videoUrl.trim(),
    });
    if (validationError) {
      setState({ kind: "error", message: validationError });
      return;
    }

    setSubmitting(true);
    try {
      await submitEvidence({
        channelId: channelId.trim(),
        kind,
        rationale: rationale.trim(),
        turnstileToken,
        videoUrl: videoUrl.trim(),
      });

      setState({ kind: "sent" });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof TypeError
            ? "We couldn't confirm your submission. Check your connection and try again. Your details are still here."
            : error instanceof Error
              ? error.message
              : "We couldn't send your evidence. Your details are still here. Please try again.",
      });
      setTurnstileToken("");
      setVerificationKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  }

  const copy = submissionCopy[kind];

  return (
    <>
      {sent ? (
        <div className="workflow-success">
          <p className="workflow-kicker">{copy.receivedKicker}</p>
          <h2 id="submission-title" ref={successHeading} tabIndex={-1}>
            Thanks for taking a closer look.
          </h2>
          <p aria-live="polite">{copy.receivedMessage}</p>
          <dl className="workflow-context">
            <dt>YouTube Channel ID</dt>
            <dd>{channelId.trim()}</dd>
            <dt>Representative video</dt>
            <dd>{videoUrl.trim()}</dd>
          </dl>
          <div className="workflow-actions">
            <button
              className="workflow-button"
              type="button"
              onClick={() => {
                setChannelId("");
                setVideoUrl("");
                setRationale("");
                setTurnstileToken("");
                setState({ kind: "ready" });
              }}
            >
              Submit another channel
            </button>
            <a className="workflow-button is-quiet" href="/">
              Back to NoAI
            </a>
          </div>
        </div>
      ) : (
        <>
          <h2 id="submission-title">Tell us about the channel</h2>
          <p className="workflow-muted">All three fields are required.</p>
          <form
            className="workflow-form"
            onSubmit={submit}
            aria-busy={submitting}
          >
            <fieldset disabled={submitting}>
              <legend className="visually-hidden">
                Evidence submission details
              </legend>
              <label>
                <span>YouTube Channel ID</span>
                <input
                  name="channelId"
                  value={channelId}
                  onChange={(event) => setChannelId(event.target.value)}
                  placeholder="UC..."
                  required
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-describedby="submission-channel-hint"
                />
                <small id="submission-channel-hint">
                  The full ID beginning with UC, not an @handle or channel name.
                </small>
              </label>
              <details className="workflow-field-help">
                <summary>Where do I find the channel ID?</summary>
                <p>
                  In NoAI on YouTube, choose to submit a channel and these
                  details will be filled in for you. If a channel URL contains{" "}
                  <code>/channel/UC...</code>, you can copy the ID after{" "}
                  <code>/channel/</code>.
                </p>
              </details>
              <label>
                <span>Representative video URL</span>
                <input
                  name="videoUrl"
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                  type="url"
                  aria-describedby="submission-video-hint"
                />
                <small id="submission-video-hint">
                  A watch, Shorts, or youtu.be link. Choose a video that shows
                  what you mean.
                </small>
              </label>
              <label>
                <span>What did you notice?</span>
                <textarea
                  name="rationale"
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                  required
                  rows={5}
                  maxLength={2000}
                  aria-describedby="submission-rationale-hint"
                />
                <small id="submission-rationale-hint">
                  {copy.rationaleHint}
                </small>
              </label>
            </fieldset>
            <Verification
              key={verificationKey}
              onToken={setTurnstileToken}
              disabled={submitting}
              sitekey={sitekey}
            />
            {state.kind === "error" ? (
              <p className="workflow-notice is-error" role="alert">
                {state.message}
              </p>
            ) : null}
            <button
              className="workflow-button"
              disabled={submitting || !turnstileToken}
              type="submit"
            >
              {submitting
                ? "Sending your evidence..."
                : state.kind === "error"
                  ? "Try sending again"
                  : "Send for review"}
            </button>
            <p className="workflow-small">{copy.footnote}</p>
          </form>
        </>
      )}
    </>
  );
}

function SubmissionUnavailable() {
  const channelId = getInitialValue("channelId");
  const videoUrl = getInitialValue("videoUrl");

  return (
    <div className="workflow-unavailable">
      <p className="workflow-kicker">Please check back</p>
      <h2 id="submission-title">Submissions are temporarily unavailable.</h2>
      <p className="workflow-notice is-error" aria-live="polite">
        We can't accept evidence until our verification check is configured.
        Nothing has been sent.
      </p>
      {channelId || videoUrl ? (
        <>
          <p>
            The details from your link are still here. You can return to this
            URL when submissions are available.
          </p>
          <dl className="workflow-context">
            {channelId ? (
              <>
                <dt>YouTube Channel ID</dt>
                <dd>{channelId}</dd>
              </>
            ) : null}
            {videoUrl ? (
              <>
                <dt>Representative video</dt>
                <dd>{videoUrl}</dd>
              </>
            ) : null}
          </dl>
        </>
      ) : (
        <p>
          Please try again later. You don't need to sign in to submit evidence
          when the form is available.
        </p>
      )}
      <div className="workflow-actions">
        <button
          className="workflow-button"
          type="button"
          onClick={() => window.location.reload()}
        >
          Check again
        </button>
        <a className="workflow-button is-quiet" href="/">
          Back to NoAI
        </a>
      </div>
    </div>
  );
}

export function SubmitApp() {
  const kind =
    new URLSearchParams(window.location.search).get("kind") === "allowlist"
      ? "allowlist"
      : "slop";
  const isAllowlist = kind === "allowlist";
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
            <a href="/submit" aria-current={isAllowlist ? undefined : "page"}>
              Submit a channel
            </a>
            <a
              href="/submit?kind=allowlist"
              aria-current={isAllowlist ? "page" : undefined}
            >
              Whitelist a channel
            </a>
            <a href="/maintain">Maintainers</a>
          </nav>
        </div>
      </header>
      <main className="workflow-main" id="workflow-main" tabIndex={-1}>
        <div className="workflow-intro-grid">
          <div className="workflow-intro">
            <p className="workflow-kicker">
              {isAllowlist ? "Whitelist a channel" : "Submit a channel"}
            </p>
            <h1>
              {isAllowlist
                ? "Know a channel that should never be filtered?"
                : "Found a channel we should look at?"}
            </h1>
            <p className="workflow-lede">
              {isAllowlist
                ? "Share why you trust it. A human maintainer will decide whether it belongs on the NoAI whitelist, where Hide as AI slop never appears."
                : "Share what you noticed. A human maintainer will decide whether it belongs in the NoAI catalogue."}
            </p>
            <div className="workflow-guidance">
              <h2>A little context helps.</h2>
              <p>
                {isAllowlist
                  ? "Send a representative video and explain why the channel is human-made and worth keeping. Specific examples are more useful than a channel name alone."
                  : "Send a representative video and explain why you think the channel primarily distributes AI slop. Specific examples are more useful than a channel name alone."}
              </p>
              <p>
                You don't need an account. Sending evidence doesn't change
                anyone's filter. Only a maintainer can publish a channel
                designation.
              </p>
            </div>
          </div>
          <section
            className="workflow-panel workflow-submit-panel"
            aria-labelledby="submission-title"
          >
            {turnstileSiteKey ? (
              <SubmissionForm kind={kind} sitekey={turnstileSiteKey} />
            ) : (
              <SubmissionUnavailable />
            )}
          </section>
        </div>
      </main>
      <footer className="workflow-footer">
        <p>A better feed starts with people who care.</p>
        <a href="/maintain">Maintainer sign-in</a>
      </footer>
    </div>
  );
}
