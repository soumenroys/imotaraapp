// src/lib/appRoutes.ts
// Which routes are "the app" rather than the marketing site.
//
// One list, because two things depend on it and they must agree: the mobile
// tab bar shows here, and nothing else should try to ship a second header on
// these routes. Before UX-23 there were two headers stacked on every one of
// them, each with a different set of destinations and its own ⌘K handler.

export const APP_ROUTES = ["/chat", "/history", "/feel"] as const;
