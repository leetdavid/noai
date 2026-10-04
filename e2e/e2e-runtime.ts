import type { Page } from "@playwright/test";

/** Collects uncaught page errors so a test can assert a clean runtime. */
export function trackPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (error) => {
    errors.push(error);
  });
  return errors;
}

/** Stubs Cloudflare Turnstile so submissions can complete without network. */
export async function stubTurnstile(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const stub = {
      render: (
        _element: HTMLElement,
        options: { callback: (token: string) => void },
      ) => {
        window.setTimeout(() => options.callback("e2e-turnstile-token"), 0);
        return "e2e-widget";
      },
      remove: () => {},
    };
    (window as unknown as { turnstile: typeof stub }).turnstile = stub;
  });
}
