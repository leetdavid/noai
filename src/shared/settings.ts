import { isYouTubeChannelId } from "./youtube-channel";

export interface Settings {
  enabled: boolean;
  personalDesignations: string[];
  personalDesignationNames: Record<string, string>;
  personalExemptions: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  personalDesignations: [],
  personalDesignationNames: {},
  personalExemptions: [],
};

function getChannelIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (channelId) =>
          typeof channelId === "string" && isYouTubeChannelId(channelId),
      ),
    ),
  ].sort();
}

function getChannelNames(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([channelId, channelName]) =>
        isYouTubeChannelId(channelId) &&
        typeof channelName === "string" &&
        channelName.trim().length > 0,
    ),
  );
}

export async function getSettings(): Promise<Settings> {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const personalDesignations = getChannelIds(settings.personalDesignations);
  const personalDesignationNames = getChannelNames(
    settings.personalDesignationNames,
  );

  return {
    enabled:
      typeof settings.enabled === "boolean"
        ? settings.enabled
        : DEFAULT_SETTINGS.enabled,
    personalDesignations,
    personalDesignationNames: Object.fromEntries(
      Object.entries(personalDesignationNames).filter(([channelId]) =>
        personalDesignations.includes(channelId),
      ),
    ),
    personalExemptions: getChannelIds(settings.personalExemptions),
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(settings);
}

export async function addPersonalDesignation(
  channelId: string,
  channelName?: string | null,
): Promise<void> {
  const settings = await getSettings();
  const personalDesignationNames = { ...settings.personalDesignationNames };
  if (channelName?.trim()) {
    personalDesignationNames[channelId] = channelName.trim();
  }

  await saveSettings({
    personalDesignations: [
      ...new Set([...settings.personalDesignations, channelId]),
    ].sort(),
    personalDesignationNames,
    personalExemptions: settings.personalExemptions.filter(
      (existingChannelId) => existingChannelId !== channelId,
    ),
  });
}

export async function addPersonalExemption(channelId: string): Promise<void> {
  const settings = await getSettings();
  const personalDesignationNames = { ...settings.personalDesignationNames };
  delete personalDesignationNames[channelId];

  await saveSettings({
    personalDesignations: settings.personalDesignations.filter(
      (existingChannelId) => existingChannelId !== channelId,
    ),
    personalDesignationNames,
    personalExemptions: [
      ...new Set([...settings.personalExemptions, channelId]),
    ].sort(),
  });
}

export async function removePersonalDesignation(
  channelId: string,
): Promise<void> {
  const settings = await getSettings();
  const personalDesignationNames = { ...settings.personalDesignationNames };
  delete personalDesignationNames[channelId];

  await saveSettings({
    personalDesignations: settings.personalDesignations.filter(
      (existingChannelId) => existingChannelId !== channelId,
    ),
    personalDesignationNames,
  });
}

export async function removePersonalExemption(
  channelId: string,
): Promise<void> {
  const settings = await getSettings();
  await saveSettings({
    personalExemptions: settings.personalExemptions.filter(
      (existingChannelId) => existingChannelId !== channelId,
    ),
  });
}
