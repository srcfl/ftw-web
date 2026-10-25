export const review = {
  version: "0.5.0",
  build: 16,
  source: "70f4e02dd58d158955014ead2846e5229e2fe386",
  sourceUrl:
    "https://github.com/srcfl/ftw-app/tree/70f4e02dd58d158955014ead2846e5229e2fe386",
  releaseRun: "https://github.com/srcfl/ftw-app/actions/runs/40186014332",
  captured: "2026-10-25",
  discord: "https://discord.gg/UK2ygPBu8N",
};
export const screens = [
  {
    id: "now",
    name: "Now",
    description:
      "The home’s energy ring, the car’s goal and the next hours in one view.",
  },
  {
    id: "plan",
    name: "Plan",
    description:
      "The day ahead, its planned energy and the home’s planning choices.",
  },
  {
    id: "history",
    name: "History",
    description:
      "The day’s recorded energy, with a shared timeline for the home’s devices.",
  },
  {
    id: "home",
    name: "Home",
    description: "Cars, assistants, the watch, connected homes and this phone.",
  },
  {
    id: "car",
    name: "Car",
    description: "The car’s level, departure goal, charging plan and controls.",
  },
  {
    id: "battery",
    name: "Home battery",
    description: "Stored energy and the home battery’s timeline.",
  },
  {
    id: "grid",
    name: "Grid connection",
    description:
      "The site’s single connection to the grid, with its timeline and phases.",
  },
];
export function screenMedia(baseline, screen = "now", appearance = "dark") {
  return (
    baseline.media.find(
      (m) => m.screen === screen && m.appearance === appearance,
    ) ||
    baseline.media.find((m) => m.screen === screen) ||
    baseline.media[0]
  );
}
export function feedbackMessage(target, body, origin) {
  const url = new URL("/future/", origin);
  if (target?.id) {
    url.hash = target.id;
    if (target.type === "released") {
      url.searchParams.set("screen", target.screen);
      if (target.appearance)
        url.searchParams.set("appearance", target.appearance);
    }
  } else url.hash = "feedback";
  return [
    `FTW ${review.version} design feedback`,
    target ? `Design: ${target.code} · ${target.name}` : "A new idea for FTW",
    target?.screen
      ? `Screen: ${screens.find((s) => s.id === target.screen)?.name || target.screen}`
      : "",
    "",
    body.trim(),
    "",
    `Design link: ${url.href}`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
