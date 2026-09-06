import {
  addPersonalDesignation,
  addPersonalExemption,
  getSettings,
  removePersonalDesignation,
  removePersonalExemption,
} from "./shared/settings";
import { parseYouTubeChannelId } from "./shared/youtube-channel";
import "./ui.css";

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

function createRuleItem(
  channelId: string,
  action: "hide" | "show",
): HTMLLIElement {
  const item = document.createElement("li");
  const label = document.createElement("code");
  const removeButton = document.createElement("button");

  label.textContent = channelId;
  removeButton.dataset.action = action;
  removeButton.dataset.channelId = channelId;
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  item.append(label, removeButton);
  return item;
}

function renderRuleList(
  list: HTMLUListElement,
  channelIds: string[],
  action: "hide" | "show",
): void {
  list.replaceChildren(
    ...channelIds.map((channelId) => createRuleItem(channelId, action)),
  );
}

async function refreshRules(): Promise<void> {
  const settings = await getSettings();
  renderRuleList(designationList, settings.personalDesignations, "hide");
  renderRuleList(exemptionList, settings.personalExemptions, "show");
}

async function submitRule(
  input: HTMLInputElement,
  addRule: (channelId: string) => Promise<void>,
  message: string,
): Promise<void> {
  const channelId = parseYouTubeChannelId(input.value);
  if (!channelId) {
    savedStatus.textContent =
      "Enter a YouTube Channel ID or /channel/UC... URL.";
    return;
  }

  await addRule(channelId);
  input.value = "";
  savedStatus.textContent = message;
  await refreshRules();
}

designationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitRule(
    designationInput,
    addPersonalDesignation,
    "Channel hidden for you.",
  );
});

exemptionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitRule(
    exemptionInput,
    addPersonalExemption,
    "Channel restored for you.",
  );
});

document.addEventListener("click", (event) => {
  const button = event.target;
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const { action, channelId } = button.dataset;
  if (!channelId || (action !== "hide" && action !== "show")) {
    return;
  }

  const removeRule =
    action === "hide" ? removePersonalDesignation : removePersonalExemption;
  void removeRule(channelId).then(async () => {
    savedStatus.textContent = "Personal rule removed.";
    await refreshRules();
  });
});

chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "sync") {
    void refreshRules();
  }
});

void refreshRules();
