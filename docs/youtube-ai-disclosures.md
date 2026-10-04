# Automatic handling of YouTube AI disclosures

Status: product interview in progress. Channel-level reporting and human approval are agreed; implementation has not started.

## Request

Automatically submit a channel for review when NoAI observes a qualifying YouTube AI disclosure on one of its videos. Maintainer approval adds the entire channel to the public catalogue, not just the reported video.

## Verified evidence

Inspected on 2026-09-08:

- Example: https://www.youtube.com/watch?v=RWjhvGuke6Y, published by Recognition Labs.
- The video has an AI badge with the accessible label "AI: Content was made with AI".
- The badge is attached to this video's title. Clicking it did not reveal a fuller explanation in the inspected signed-out desktop session.
- Its renderer exposes the visible label and accessibility text. These are undocumented UI fields; stability across layouts and languages is not established.
- YouTube's disclosure policy covers fully or partially generated or meaningfully AI-altered content. Labels can be supplied by creators or applied by YouTube, and some labels can later be corrected.

Source: [YouTube: Disclosing use of GenAI content](https://support.google.com/youtube/answer/14328491?hl=en).

## Agreed workflow

- The submission concerns the entire channel, identified by its immutable YouTube Channel ID.
- Observing a qualifying disclosure creates a pending channel report automatically.
- YouTube disclosures about AI generation, editing, or alteration all qualify for submission; reporting is not limited to "Content was made with AI".
- Reports preserve the exact disclosure wording. Different notices are evidence for human review, not interchangeable proof that a channel primarily distributes AI slop.
- Human Maintainer approval remains required before the channel enters the public catalogue. The observation alone does not trigger global filtering.
- The submission identifies the evidence source as a YouTube disclosure and includes the exact message and representative video URL.
- Attribution means NoAI observed a message on YouTube; it does not imply YouTube submitted or endorsed a NoAI designation.
- A separate automatic video blocklist is not the chosen approach.
- Automatic reporting is off until the user explicitly opts in. Enabling filtering does not grant reporting consent.
- The opt-in explains that reports send the channel ID, representative video link, and exact YouTube disclosure text for content encountered during browsing.
- Filtering remains usable without automatic reporting.

## Existing product rules

- Public channel designations currently require a human Maintainer's decision.
- A channel should primarily distribute AI slop; occasional AI use is not enough.
- Personal rules are distinct from the public catalogue.
- Future filter types require opt-in.
- User-initiated evidence submissions remain distinct from automatic disclosure reports.

## Next decision

Should repeated reports about the same channel merge into one review item, with distinct labelled videos attached as evidence?

Recommendation, not yet accepted: maintain one pending review item per channel. Repeated observations of the same video and disclosure should not create duplicate evidence; distinct labelled videos can add useful context. Report volume should not grant automatic approval.

Still unresolved: duplicate reports, evidence verification and abuse prevention, reports about previously reviewed channels, and handling changed or removed disclosures.
