import { Tab } from '../types';

export const TAB_CHANGE_EVENT = 'ml:tab-change';

export const requestTabChange = (tab: Tab) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<Tab>(TAB_CHANGE_EVENT, { detail: tab }));
};

export const subscribeTabChange = (callback: (tab: Tab) => void) => {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<Tab>;
    const nextTab = customEvent.detail;
    if (!nextTab) return;
    callback(nextTab);
  };

  window.addEventListener(TAB_CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener(TAB_CHANGE_EVENT, handler);
  };
};

