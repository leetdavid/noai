import { isYouTubeChannelId } from "./youtube-channel";

export interface Settings {
  enabled: boolean;
  personalDesignations: string[];
  personalExemptions: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  personalDesignations: [],
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

export async function getSettings(): Promise<Settings> {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  return {
    enabled:
      typeof settings.enabled === "boolean"
        ? settings.enabled
        : DEFAULT_SETTINGS.enabled,
    personalDesignations: getChannelIds(settings.personalDesignations),
    personalExemptions: getChannelIds(settings.personalExemptions),
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(settings);
}

export async function addPersonalDesignation(channelId: string): Promise<void> {
  const settings = await getSettings();
  await saveSettings({
    personalDesignations: [
      ...new Set([...settings.personalDesignations, channelId]),
    ].sort(),
    personalExemptions: settings.personalExemptions.filter(
      (existingChannelId) => existingChannelId !== channelId,
    ),
  });
}

export async function addPersonalExemption(channelId: string): Promise<void> {
  const settings = await getSettings();
  await saveSettings({
    personalDesignations: settings.personalDesignations.filter(
      (existingChannelId) => existingChannelId !== channelId,
    ),
    personalExemptions: [
      ...new Set([...settings.personalExemptions, channelId]),
    ].sort(),
  });
}

export async function removePersonalDesignation(
  channelId: string,
): Promise<void> {
  const settings = await getSettings();
  await saveSettings({
    personalDesignations: settings.personalDesignations.filter(
      (existingChannelId) => existingChannelId !== channelId,
    ),
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
