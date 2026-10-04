import {
  addPersonalDesignation,
  addPersonalExemption,
  getSettings,
  removePersonalDesignation,
  removePersonalExemption,
} from "./shared/settings";
import { parseYouTubeChannelId } from "./shared/youtube-channel";

function getElement<T extends HTMLElement>(id: string, type: { new (): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Expected #${id} to be a ${type.name}`);
  }

  return element;
}

const savedStatus = getElement("saved-status", HTMLElement);
const designationForm = getElement("designation-form", HTMLFormElement);
const designationInput = getElement("designation-channel-id", HTMLInputElement);
const designationList = getElement("designation-list", HTMLUListElement);
const exemptionForm = getElement("exemption-form", HTMLFormElement);
const exemptionInput = getElement("exemption-channel-id", HTMLInputElement);
const exemptionList = getElement("exemption-list", HTMLUListElement);
const designationStatus = getElement("designation-status", HTMLElement);
const exemptionStatus = getElement("exemption-status", HTMLElement);

function setFeedback(
  element: HTMLElement,
  message: string,
  state: "success" | "error" | "pending",
): void {
  element.textContent = message;
  element.dataset.state = state;
}

function createRuleItem(
  channelId: string,
  action: "hide" | "show",
  channelName?: string,
): HTMLLIElement {
  const item = document.createElement("li");
  const channel = document.createElement("span");
  const label = document.createElement("a");
  const removeButton = document.createElement("button");

  label.textContent = channelName ?? channelId;
  label.href = `https://www.youtube.com/channel/${channelId}`;
  label.target = "_blank";
  label.rel = "noopener noreferrer";
  label.title = channelId;
  channel.className = "rule-channel";
  channel.append(label);
  if (channelName) {
    const id = document.createElement("span");
    id.className = "rule-channel-id";
    id.textContent = channelId;
    channel.append(id);
  }
  removeButton.dataset.action = action;
  removeButton.dataset.channelId = channelId;
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.setAttribute(
    "aria-label",
    `Remove ${action === "hide" ? "hide" : "always-show"} rule for ${channelId}`,
  );
  item.append(channel, removeButton);
  return item;
}

function renderRuleList(
  list: HTMLUListElement,
  channelIds: string[],
  action: "hide" | "show",
  channelNames: Record<string, string> = {},
): void {
  list.replaceChildren(
    ...channelIds.map((channelId) =>
      createRuleItem(channelId, action, channelNames[channelId]),
    ),
  );
  if (channelIds.length === 0) {
    const message = document.createElement("li");
    message.className = "list-message";
    message.textContent =
      action === "hide"
        ? "No personal designations yet. Add a channel above to hide it."
        : "No personal exemptions yet. Add a channel above to keep seeing it.";
    list.append(message);
  }
  list.setAttribute("aria-busy", "false");
}

async function refreshRules(): Promise<void> {
  try {
    const settings = await getSettings();
    renderRuleList(
      designationList,
      settings.personalDesignations,
      "hide",
      settings.personalDesignationNames,
    );
    renderRuleList(exemptionList, settings.personalExemptions, "show");
    savedStatus.textContent = "";
  } catch {
    setFeedback(
      savedStatus,
      "Couldn't load your personal rules. Reopen settings to try again.",
      "error",
    );
    for (const list of [designationList, exemptionList]) {
      const message = document.createElement("li");
      message.className = "list-message";
      message.textContent = "Your saved channels are unavailable right now.";
      list.replaceChildren(message);
      list.setAttribute("aria-busy", "false");
    }
  }
}

async function submitRule(
  form: HTMLFormElement,
  input: HTMLInputElement,
  feedback: HTMLElement,
  addRule: (channelId: string) => Promise<void>,
  message: string,
): Promise<void> {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button || button.disabled) {
    return;
  }

  const channelId = parseYouTubeChannelId(input.value);
  if (!channelId) {
    input.setAttribute("aria-invalid", "true");
    setFeedback(
      feedback,
      "Enter a valid YouTube Channel ID or /channel/UC... URL, not an @handle.",
      "error",
    );
    input.focus();
    return;
  }

  input.removeAttribute("aria-invalid");
  input.readOnly = true;
  button.disabled = true;
  form.setAttribute("aria-busy", "true");
  setFeedback(feedback, "Saving your rule...", "pending");
  try {
    await addRule(channelId);
    input.value = "";
    setFeedback(feedback, message, "success");
    await refreshRules();
  } catch {
    setFeedback(
      feedback,
      "Couldn't save this rule. Please try again.",
      "error",
    );
  } finally {
    input.readOnly = false;
    button.disabled = false;
    form.setAttribute("aria-busy", "false");
  }
}

designationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitRule(
    designationForm,
    designationInput,
    designationStatus,
    addPersonalDesignation,
    "Channel hidden for you.",
  );
});

exemptionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitRule(
    exemptionForm,
    exemptionInput,
    exemptionStatus,
    addPersonalExemption,
    "Channel will always be shown for you.",
  );
});

for (const input of [designationInput, exemptionInput]) {
  input.addEventListener("input", () => {
    input.removeAttribute("aria-invalid");
    const feedback =
      input === designationInput ? designationStatus : exemptionStatus;
    feedback.textContent = "";
  });
}

document.addEventListener("click", async (event) => {
  const button =
    event.target instanceof Element
      ? event.target.closest("button[data-action]")
      : null;
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const { action, channelId } = button.dataset;
  if (!channelId || (action !== "hide" && action !== "show")) {
    return;
  }

  const removeRule =
    action === "hide" ? removePersonalDesignation : removePersonalExemption;
  const feedback = action === "hide" ? designationStatus : exemptionStatus;
  button.disabled = true;
  setFeedback(feedback, "Removing your rule...", "pending");
  try {
    await removeRule(channelId);
    setFeedback(feedback, "Personal rule removed.", "success");
    await refreshRules();
  } catch {
    setFeedback(
      feedback,
      "Couldn't remove this rule. Please try again.",
      "error",
    );
  } finally {
    button.disabled = false;
  }
});

chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "sync") {
    void refreshRules();
  }
});

void refreshRules();
