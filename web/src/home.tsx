import { type FormEvent, useEffect, useState } from "react";

import {
  type CatalogueSnapshot,
  parseCatalogueSnapshot,
} from "../../src/shared/catalogue";
import { parseYouTubeChannelId } from "../../src/shared/youtube-channel";

const catalogueUrl =
  import.meta.env.VITE_CATALOGUE_URL ??
  "https://api.noai.eslee.io/v1/catalogue";

type CatalogueState =
  | { kind: "loading" }
  | { kind: "ready"; snapshot: CatalogueSnapshot }
  | { kind: "unavailable" };

function FeedPreview() {
  const [filtering, setFiltering] = useState(true);

  return (
    <figure className="feed-preview">
      <div className="preview-paper">
        <div className="preview-heading">
          <span>Something worth watching</span>
          <button
            type="button"
            className="preview-switch"
            aria-label="Filter the example feed"
            aria-pressed={filtering}
            onClick={() => setFiltering(!filtering)}
          >
            <span className="switch-track" aria-hidden="true">
              <span />
            </span>
            NoAI {filtering ? "on" : "off"}
          </button>
        </div>
        <div className="preview-feed">
          <article className="preview-video">
            <div className="preview-art pottery-art" aria-hidden="true">
              <svg viewBox="0 0 180 110" fill="none" aria-hidden="true">
                <ellipse cx="91" cy="93" rx="57" ry="5" fill="#D6B59E" />
                <path
                  d="M45 29H107V66C107 83 94 91 76 91C58 91 45 81 45 66V29Z"
                  fill="#BD7657"
                />
                <path
                  d="M109 39C144 29 149 73 111 74"
                  stroke="#BD7657"
                  strokeWidth="11"
                  strokeLinecap="round"
                />
                <ellipse cx="76" cy="29" rx="31" ry="7" fill="#DEAC8B" />
                <path
                  d="M66 25C55 13 78 10 67 1M84 22C77 14 93 12 86 4"
                  stroke="#99765D"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M57 44V65C57 71 60 77 65 80"
                  stroke="#D99070"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <h3>A mug, made slowly</h3>
              <p>Made by hand. A little wonky.</p>
            </div>
          </article>
          {!filtering ? (
            <article className="preview-video synthetic-video">
              <div className="synthetic-art" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div>
                <h3>Another AI-generated upload</h3>
                <p>From a designated AI Slop Channel</p>
              </div>
            </article>
          ) : null}
          <article className="preview-video">
            <div className="preview-art walking-art" aria-hidden="true">
              <svg viewBox="0 0 180 110" fill="none" aria-hidden="true">
                <circle cx="136" cy="25" r="12" fill="#E9CB8F" />
                <path
                  d="M0 76Q46 34 99 64Q141 36 180 60V110H0Z"
                  fill="#9CAF8D"
                />
                <path
                  d="M0 94Q53 59 111 89Q147 69 180 76V110H0Z"
                  fill="#698667"
                />
                <path
                  d="M74 110C60 85 128 86 110 70"
                  stroke="#E8E2C6"
                  strokeWidth="12"
                />
                <path
                  d="M31 80V23M16 60L31 44L47 60M21 39L31 26L41 39"
                  stroke="#446447"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h3>Taking the long way home</h3>
              <p>A walk with no particular plan.</p>
            </div>
          </article>
        </div>
        <p className="preview-note" aria-live="polite">
          {filtering
            ? "The good stuff stays. The slop quietly goes."
            : "Switch NoAI on to see what changes."}
        </p>
      </div>
      <figcaption>
        Just an example. We don't read your browsing history.
      </figcaption>
      <span className="preview-sticker" aria-hidden="true">
        A little less noise.
      </span>
    </figure>
  );
}

function CatalogueLookup() {
  const [state, setState] = useState<CatalogueState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    let active = true;
    setState({ kind: "loading" });
    setResult(null);

    void fetch(catalogueUrl, {
      signal: controller.signal,
      cache: attempt === 0 ? "default" : "reload",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalogue unavailable");
        const snapshot = parseCatalogueSnapshot(await response.json());
        if (!snapshot) throw new Error("Invalid catalogue");
        if (active) setState({ kind: "ready", snapshot });
      })
      .catch(() => {
        if (active) setState({ kind: "unavailable" });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "ready") return;
    const channelId = parseYouTubeChannelId(query);
    if (!channelId) {
      setResult(
        "Use the full UC Channel ID or a youtube.com/channel/UC... link. Channel names and @handles aren't supported yet.",
      );
      return;
    }
    if (state.snapshot.trustedChannelIds.includes(channelId)) {
      setResult(
        "This channel is on the public whitelist. NoAI never filters it and Hide as AI slop won't appear for it.",
      );
      return;
    }
    setResult(
      state.snapshot.channelIds.includes(channelId)
        ? "This channel is in the public catalogue. NoAI filters its videos unless you add a personal exemption."
        : "This channel isn't in the public catalogue. You can still hide it for yourself, submit evidence for review, or request it for the whitelist.",
    );
  }

  return (
    <div className="catalogue-lookup">
      <div className="catalogue-caption">
        <span className="status-dot" aria-hidden="true" />
        The public catalogue
      </div>
      {state.kind === "loading" ? (
        <div className="catalogue-loading" aria-live="polite">
          <span />
          Checking the latest snapshot...
        </div>
      ) : state.kind === "unavailable" ? (
        <div className="catalogue-error" aria-live="polite">
          <h3>We couldn't reach the catalogue.</h3>
          <p>
            NoAI can still use its last saved snapshot. Try again in a moment.
          </p>
          <button
            className="home-button small-button"
            type="button"
            onClick={() => setAttempt(attempt + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <p className="catalogue-number">
            {state.snapshot.channelIds.length.toLocaleString()}{" "}
            <span>
              designated{" "}
              {state.snapshot.channelIds.length === 1 ? "channel" : "channels"}
              {" · "}
              {state.snapshot.trustedChannelIds.length.toLocaleString()}{" "}
              whitelisted
            </span>
          </p>
          <p className="catalogue-version">
            Snapshot {state.snapshot.version}. Chosen by people, downloaded by
            NoAI.
          </p>
          <form className="lookup-form" onSubmit={search}>
            <label htmlFor="catalogue-query">Check a channel</label>
            <div className="lookup-input-row">
              <input
                id="catalogue-query"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setResult(null);
                }}
                placeholder="YouTube Channel ID or /channel/UC... URL"
                aria-describedby="catalogue-help"
                autoComplete="off"
                spellCheck={false}
                required
              />
              <button type="submit" className="home-button">
                Check
              </button>
            </div>
            <p id="catalogue-help">
              Use its permanent UC ID, rather than its @handle.
            </p>
          </form>
          {result ? (
            <p className="lookup-result" aria-live="polite">
              {result}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export function HomeApp() {
  return (
    <div className="home-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="home-header">
        <a className="brand" href="/" aria-label="NoAI home">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          NoAI
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="/submit">Submit a channel</a>
          <a href="/submit?kind=allowlist">Whitelist a channel</a>
          <a className="home-button small-button" href="#install">
            Get NoAI
          </a>
        </nav>
      </header>

      <main id="main">
        <section className="home-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="home-kicker">
              <span className="tiny-leaf" aria-hidden="true" />A little more
              room for the human stuff
            </p>
            <h1 id="hero-title">
              NoAI - <span>a less sloppier web</span>
            </h1>
            <p className="hero-description">
              You came for a good video. Not another wall of AI slop. NoAI
              quietly removes it from your feed, starting with YouTube channels.
            </p>
            <a className="home-button" href="#install">
              Make room for better browsing <span aria-hidden="true">→</span>
            </a>
            <p className="hero-footnote">
              For Chrome. Open source. No account needed to filter.
            </p>
          </div>
          <FeedPreview />
        </section>

        <div className="home-aside">
          <span>YouTube is just the beginning.</span>
          <p>More filters will follow. You'll choose which ones to turn on.</p>
        </div>

        <section
          id="how-it-works"
          className="how-section"
          aria-labelledby="how-title"
        >
          <div className="how-heading">
            <p className="home-kicker">Less fuss. More of what you like.</p>
            <h2 id="how-title">
              A small extension.
              <br />A more familiar feed.
            </h2>
            <p>
              NoAI works in the background. Open it when you're curious. Leave
              it alone when you're not.
            </p>
          </div>
          <div className="how-details">
            <article>
              <span className="detail-mark" aria-hidden="true">
                01
              </span>
              <div>
                <h3>People make the call.</h3>
                <p>
                  Maintainers review evidence and designate channels that
                  primarily publish AI slop. Occasional use of AI tools isn't
                  enough.
                </p>
              </div>
            </article>
            <article>
              <span className="detail-mark" aria-hidden="true">
                02
              </span>
              <div>
                <h3>It simply leaves your feed.</h3>
                <p>
                  Videos from designated channels are hidden on YouTube. No
                  warning boxes, no empty spaces, no extra decisions while you
                  scroll.
                </p>
              </div>
            </article>
            <article>
              <span className="detail-mark" aria-hidden="true">
                03
              </span>
              <div>
                <h3>Your taste still comes first.</h3>
                <p>
                  Hide a channel just for yourself, or always show one you
                  enjoy. Your personal rules sync with your Chrome profile.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section
          id="catalogue"
          className="home-catalogue"
          aria-labelledby="catalogue-title"
        >
          <div>
            <p className="home-kicker">A shared list, made with care</p>
            <h2 id="catalogue-title">
              Curated by people.
              <br />
              Open for a look.
            </h2>
            <p>
              The public catalogue tells NoAI which channels to filter, and
              which trusted channels to never filter. Your extension downloads
              channel IDs, not anybody's private notes or personal rules.
              Whitelisted channels never show Hide as AI slop.
            </p>
            <a className="home-text-link" href="/submit">
              Spotted a channel we should review?{" "}
              <span aria-hidden="true">→</span>
            </a>
            <br />
            <a className="home-text-link" href="/submit?kind=allowlist">
              Know a channel to whitelist? <span aria-hidden="true">→</span>
            </a>
          </div>
          <CatalogueLookup />
        </section>

        <section
          id="install"
          className="install-section"
          aria-labelledby="install-title"
        >
          <div className="install-intro">
            <span className="brand-mark" aria-hidden="true">
              N
            </span>
            <p className="home-kicker">Ready when you are</p>
            <h2 id="install-title">Bring NoAI along.</h2>
            <p>
              NoAI is available to load locally in Chrome. There's no Web Store
              listing yet, but the source is open and ready to try.
            </p>
            <a className="home-button" href="https://github.com/leetdavid/noai">
              Get the source on GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
          <ol className="install-steps">
            <li>
              <span>1</span>
              <div>
                <h3>Get the project</h3>
                <p>
                  Clone or download{" "}
                  <a href="https://github.com/leetdavid/noai">leetdavid/noai</a>
                  . You'll need Node.js and pnpm.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Build the extension</h3>
                <p>In the project directory, run:</p>
                <code>
                  pnpm install
                  <br />
                  pnpm build:extension
                </code>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Make yourself at home</h3>
                <p>
                  Open <code>chrome://extensions</code>, enable Developer mode,
                  choose Load unpacked, and select the <code>dist</code> folder.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </main>

      <footer className="home-footer">
        <div>
          <a className="brand" href="/" aria-label="NoAI home">
            <span className="brand-mark" aria-hidden="true">
              N
            </span>
            NoAI
          </a>
          <p>NoAI - a less sloppier web</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/submit">Submit a channel</a>
          <a href="/submit?kind=allowlist">Whitelist a channel</a>
          <a href="/maintain">Maintainers</a>
          <a href="https://github.com/leetdavid/noai">GitHub</a>
        </nav>
      </footer>
    </div>
  );
}
