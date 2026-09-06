import { getSettings, saveSettings } from "./shared/settings";
import "./ui.css";

function getElement<T extends HTMLElement>(id: string, type: { new (): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Expected #${id} to be a ${type.name}`);
  }

  return element;
}

const enabledInput = getElement("enabled", HTMLInputElement);
const status = getElement("status", HTMLElement);

function setStatus(enabled: boolean): void {
  status.textContent = enabled ? "Protection is on" : "Protection is paused";
}

async function initialize(): Promise<void> {
  const settings = await getSettings();
  enabledInput.checked = settings.enabled;
  setStatus(settings.enabled);
}

enabledInput.addEventListener("change", async () => {
  await saveSettings({ enabled: enabledInput.checked });
  setStatus(enabledInput.checked);
});

void initialize();
