/** Fixed public destinations; legacy drafts without a kind remain Beartrap. */
export function toolsDraftDestination(draft: string | null, simulator: string | null): URL | null {
  if (draft !== null && !/^[a-f0-9]{64}$/.test(draft)) return null;
  if (simulator !== null && simulator !== "beartrap" && simulator !== "pvp") return null;
  const destination = new URL(draft && simulator !== "pvp"
    ? "https://sim.wos-2277.net/bear"
    : "https://sim.wos-2277.net/simulate");
  if (draft) destination.searchParams.set("draft", draft);
  return destination;
}
