import { go } from "../lib/router";

export function usePathname(): string {
  return window.location.pathname;
}

export function useRouter() {
  return {
    push: go,
    replace: go,
    refresh: () => window.dispatchEvent(new PopStateEvent("popstate")),
    back: () => window.history.back(),
  };
}
