import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { MaintainApp } from "./maintain";
import "./styles.css";

interface CatalogueSnapshot {
  channelIds: string[];
  version: string;
}

type CatalogueState =
  | { kind: "loading" }
  | { kind: "ready"; snapshot: CatalogueSnapshot }
  | { kind: "unavailable" };

const catalogueUrl =
  import.meta.env.VITE_CATALOGUE_URL ??
  "https://api.noai.eslee.io/v1/catalogue";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCatalogueSnapshot(value: unknown): value is CatalogueSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const { channelIds, version } = value;
  return (
    typeof version === "string" &&
    Array.isArray(channelIds) &&
    channelIds.every((channelId) => typeof channelId === "string")
  );
}

function CatalogueStatus({ state }: { state: CatalogueState }) {
  if (state.kind === "loading") {
    return (
      <div className="catalogue-status is-loading" aria-live="polite">
        <span className="status-line" />
        <span className="status-line short" />
      </div>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <div className="catalogue-status">
        <p className="status-label">CATALOGUE STATUS</p>
        <p className="status-title">Temporarily unavailable.</p>
        <p className="status-copy">
          The extension keeps using its last verified snapshot.
        </p>
      </div>
    );
  }

  const channelCount = state.snapshot.channelIds.length;
  return (
    <div className="catalogue-status">
      <p className="status-label">
        LIVE CATALOGUE / VERSION {state.snapshot.version}
      </p>
      <p className="status-title">
        {channelCount} active {channelCount === 1 ? "channel" : "channels"}
      </p>
      <p className="status-copy">
        The extension downloads only these immutable YouTube Channel IDs.
        Evidence and Maintainer data stay out of the browser.
      </p>
    </div>
  );
}

function App() {
  const [catalogueState, setCatalogueState] = useState<CatalogueState>({
    kind: "loading",
  });

  useEffect(() => {
    let active = true;

    void fetch(catalogueUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Catalogue request failed");
        }

        const snapshot: unknown = await response.json();
        if (!isCatalogueSnapshot(snapshot)) {
          throw new Error("Catalogue response was invalid");
        }

        if (active) {
          setCatalogueState({ kind: "ready", snapshot });
        }
      })
      .catch(() => {
        if (active) {
          setCatalogueState({ kind: "unavailable" });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="NoAI home">
          <span>NO</span>
          <span>AI</span>
        </a>
        <p className="header-statement">
          Filtering the synthetic, keeping the signal.
        </p>
        <a className="header-link" href="https://github.com/leetdavid/noai">
          Project source
        </a>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">A QUIETER WEB, BY DESIGN</p>
            <h1 id="hero-title">
              Remove AI slop before it decides what you see.
            </h1>
            <p className="lede">
              NoAI is a browser extension for people who want their feeds to
              feel human again. Its first filter removes designated YouTube
              channels without warnings, counters, or spectacle.
            </p>
            <div className="hero-actions">
              <a
                className="button button-primary"
                href="https://github.com/leetdavid/noai"
              >
                Get the extension
              </a>
              <a className="button button-quiet" href="#catalogue">
                Inspect the catalogue
              </a>
            </div>
            <p className="availability-note">Chrome extension public beta</p>
          </div>

          <div
            className="filter-display"
            aria-label="A feed with synthetic recommendations removed"
          >
            <div className="filter-topline">
              <span>YOUTUBE CHANNELS</span>
              <span className="active-signal">ACTIVE</span>
            </div>
            <div className="feed-canvas">
              <div className="feed-item is-visible">
                <span className="feed-thumbnail" />
                <span className="feed-copy">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <div className="feed-item is-removed">
                <span>REMOVED LOCALLY</span>
              </div>
              <div className="feed-item is-visible offset">
                <span className="feed-thumbnail pale" />
                <span className="feed-copy">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
            <p className="filter-caption">Nothing added. Just less noise.</p>
          </div>
        </section>

        <section className="principles" aria-labelledby="principles-title">
          <div className="section-heading">
            <p className="eyebrow">THE FIRST FILTER</p>
            <h2 id="principles-title">Small public data. Personal control.</h2>
          </div>
          <div className="principle-list">
            <article>
              <span className="principle-index">01</span>
              <div>
                <h3>Human-maintained</h3>
                <p>
                  Trusted Maintainers publish or remove Channel Designations. A
                  channel must primarily distribute AI slop to qualify.
                </p>
              </div>
            </article>
            <article>
              <span className="principle-index">02</span>
              <div>
                <h3>Quietly effective</h3>
                <p>
                  Matching videos disappear from Home, Search, Subscriptions,
                  and recommendation sidebars. No placeholders remain behind.
                </p>
              </div>
            </article>
            <article>
              <span className="principle-index">03</span>
              <div>
                <h3>Yours to adjust</h3>
                <p>
                  Add a Personal Designation or restore a globally filtered
                  channel. Those rules follow your Chrome profile, not NoAI's
                  servers.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section
          className="catalogue-section"
          id="catalogue"
          aria-labelledby="catalogue-title"
        >
          <div className="catalogue-intro">
            <p className="eyebrow">PUBLIC FILTER DATA</p>
            <h2 id="catalogue-title">
              A catalogue built for filtering, not surveillance.
            </h2>
            <p>
              The client fetches a compact snapshot of active YouTube Channel
              IDs. The richer evidence and audit history belong in the public
              directory and maintainer tools, not in every browser.
            </p>
          </div>
          <CatalogueStatus state={catalogueState} />
        </section>

        <section className="closing" aria-labelledby="closing-title">
          <p className="eyebrow">NOAI IS GROWING IN MODULES</p>
          <h2 id="closing-title">
            One filter now. A better baseline for the web.
          </h2>
          <p>
            Future filters will be distinct, transparent, and opt-in. NoAI
            begins by giving YouTube less room to manufacture your attention.
          </p>
          <a className="text-link" href="https://github.com/leetdavid/noai">
            Follow the project <span aria-hidden="true">-&gt;</span>
          </a>
        </section>
      </main>

      <footer>
        <span>NOAI / 2026</span>
        <span>Human curation. Local filtering.</span>
      </footer>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("NoAI web root is missing");
}

createRoot(root).render(
  window.location.pathname === "/maintain" ? <MaintainApp /> : <App />,
);
