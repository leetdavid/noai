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
      sitekey: string;
      theme: "light";
    },
  ) => string;
  reset: (widgetId: string) => void;
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

function isYouTubeVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
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
  turnstileToken,
  videoUrl,
}: {
  channelId: string;
  turnstileToken: string;
  videoUrl: string;
}): string | null {
  if (!channelIdPattern.test(channelId.trim())) {
    return "Enter the channel's immutable YouTube ID, beginning with UC.";
  }

  if (!isYouTubeVideoUrl(videoUrl)) {
    return "Add an individual YouTube video URL, not a channel profile URL.";
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
    return "Unable to submit this evidence.";
  }

  return "Unable to submit this evidence.";
}

async function submitEvidence({
  channelId,
  rationale,
  turnstileToken,
  videoUrl,
}: {
  channelId: string;
  rationale: string;
  turnstileToken: string;
  videoUrl: string;
}): Promise<void> {
  const response = await fetch(new URL("/v1/evidence-submissions", apiUrl), {
    body: JSON.stringify({ channelId, rationale, turnstileToken, videoUrl }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await getSubmissionError(response));
  }
}

export function SubmitApp() {
  const [channelId, setChannelId] = useState(() =>
    getInitialValue("channelId"),
  );
  const [videoUrl, setVideoUrl] = useState(() => getInitialValue("videoUrl"));
  const [rationale, setRationale] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [state, setState] = useState<SubmissionState>({ kind: "ready" });
  const [submitting, setSubmitting] = useState(false);
  const turnstileElement = useRef<HTMLDivElement>(null);
  const turnstileWidget = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileElement.current) {
      return;
    }

    function renderTurnstile(): void {
      if (
        !window.turnstile ||
        !turnstileElement.current ||
        turnstileWidget.current
      ) {
        return;
      }

      turnstileWidget.current = window.turnstile.render(
        turnstileElement.current,
        {
          callback: setTurnstileToken,
          "error-callback": () => setTurnstileToken(""),
          "expired-callback": () => setTurnstileToken(""),
          sitekey: turnstileSiteKey,
          theme: "light",
        },
      );
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-noai-turnstile]",
    );
    if (existingScript) {
      existingScript.addEventListener("load", renderTurnstile);
      renderTurnstile();
      return () => existingScript.removeEventListener("load", renderTurnstile);
    }

    const script = document.createElement("script");
    script.dataset.noaiTurnstile = "";
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.addEventListener("load", renderTurnstile);
    document.head.append(script);
    return () => script.removeEventListener("load", renderTurnstile);
  }, []);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setState({ kind: "ready" });
    const validationError = getSubmissionValidationError({
      channelId,
      turnstileToken,
      videoUrl,
    });
    if (validationError) {
      setState({ kind: "error", message: validationError });
      return;
    }

    setSubmitting(true);
    try {
      await submitEvidence({
        channelId: channelId.trim(),
        rationale: rationale.trim(),
        turnstileToken,
        videoUrl,
      });

      setState({ kind: "sent" });
      setRationale("");
      setTurnstileToken("");
      if (turnstileWidget.current && window.turnstile) {
        window.turnstile.reset(turnstileWidget.current);
      }
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit this evidence.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="submit-shell">
      <a className="maintain-mark" href="/">
        NOAI
      </a>
      <div className="submit-panel">
        <p className="eyebrow">EVIDENCE SUBMISSION</p>
        <h1>Put a channel on the maintainers' radar.</h1>
        <p>
          This does not change anyone's filter. Maintainers review each
          submission before publishing a Channel Designation.
        </p>
        {turnstileSiteKey ? (
          <form className="submit-form" onSubmit={submit}>
            <label>
              <span>YouTube Channel ID</span>
              <input
                value={channelId}
                onChange={(event) => setChannelId(event.target.value)}
                placeholder="UC..."
                required
              />
            </label>
            <label>
              <span>Representative video</span>
              <input
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                type="url"
              />
              <small>Use a watch, Shorts, or youtu.be video link.</small>
            </label>
            <label>
              <span>Why does this channel primarily distribute AI slop?</span>
              <textarea
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
                required
                rows={5}
              />
            </label>
            <div ref={turnstileElement} />
            <button disabled={submitting} type="submit">
              {submitting ? "Submitting..." : "Submit for review"}
            </button>
            {state.kind === "sent" ? (
              <p className="form-message">Submitted for maintainer review.</p>
            ) : null}
            {state.kind === "error" ? (
              <p className="form-message is-error">{state.message}</p>
            ) : null}
          </form>
        ) : (
          <p className="form-message is-error">
            Anonymous submissions are temporarily unavailable while verification
            is configured.
          </p>
        )}
        <a className="back-link" href="/">
          Return to NoAI
        </a>
      </div>
    </main>
  );
}
