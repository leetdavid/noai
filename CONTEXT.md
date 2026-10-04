# NoAI Directory

The curated catalogue of YouTube channels that NoAI can filter for people using the extension.

## Language

**AI Slop Channel**:
A YouTube channel that primarily distributes AI slop and that the Maintainers have designated for filtering by NoAI.
_Avoid_: blocked channel, blacklist entry

**Channel Designation**:
A published record that identifies a YouTube channel as an AI Slop Channel. Any Maintainer may publish, revise, or remove a designation; its history remains auditable.
_Avoid_: vote, report

**YouTube Channel ID**:
The immutable YouTube identifier for a channel, beginning with `UC`, that NoAI uses as the canonical channel identity.
_Avoid_: channel name, handle

**Catalogue Snapshot**:
A versioned public list of active YouTube Channel IDs plus whitelisted Trusted Channel IDs that NoAI downloads to filter content. It contains no evidence, rationale, or Maintainer data.
_Avoid_: review queue, channel record

**Trusted Channel**:
A YouTube channel that Maintainers have designated as human-made and worth keeping. NoAI never filters it, and Hide as AI slop never appears for it. It takes precedence over AI Slop Channel designations and personal designations.
_Avoid_: whitelist entry, approved channel

**Trusted Designation**:
A published record that identifies a YouTube channel as a Trusted Channel. Any Maintainer may publish, revise, or remove it; its history remains auditable.
_Avoid_: vote, approval

**Whitelist Request**:
A report containing supporting context and a representative video URL for a proposed Trusted Designation, supplied by a person. It does not change global filtering unless a Maintainer approves the trusted designation.
_Avoid_: designation, vote, appeal

**Filtering**:
The removal of content from an AI Slop Channel from a person's feed, without placeholders, warnings, or prompts.
_Avoid_: soft block, content warning

**Evidence Submission**:
A report containing supporting context and a representative video URL for a proposed Channel Designation, supplied by a person or gathered by NoAI from a YouTube disclosure. It does not change global filtering unless a Maintainer approves the designation.
_Avoid_: designation, vote

**YouTube Disclosure Report**:
A channel-level Evidence Submission created automatically by NoAI for an opted-in user after observing a YouTube disclosure about AI generation, editing, or alteration, preserving its exact wording. It identifies YouTube as the source of the disclosure, not the submitter, and remains subject to human approval.
_Avoid_: YouTube endorsement, automatic Channel Designation

**Personal Designation**:
An unpublished designation a person adds to their own NoAI installation. It takes effect immediately, follows their Chrome profile, and does not alter the public catalogue.
_Avoid_: Channel Designation, submission

**Personal Exemption**:
An unpublished rule that restores a globally designated AI Slop Channel for one person's NoAI installation. It takes precedence over the public catalogue for that person only.
_Avoid_: removal, global override

**Maintainer**:
A trusted human authorized to add, change, or remove AI Slop Channel and Trusted Channel designations.
_Avoid_: voter, automated moderator
