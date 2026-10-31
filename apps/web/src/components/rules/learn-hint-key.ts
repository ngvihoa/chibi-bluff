// Shared by the hint (a client component) and the root layout (a server component).

export const LEARN_HINT_KEY = "chibi-bluff:learn-hint";

/**
 * Runs in <head> before the first paint: marks <html data-learn-hint="new"> for anyone who has
 * not seen the storyboard, so the hint is laid out from the start instead of appearing after
 * hydration and pushing the page down under the player's finger.
 */
export const LEARN_HINT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(LEARN_HINT_KEY)})!=="1")document.documentElement.dataset.learnHint="new"}catch(e){}`;
