import { atom } from 'nanostores';

export const sidebarOpenAtom = atom<boolean>(false);

export function toggleSidebar() {
  sidebarOpenAtom.set(!sidebarOpenAtom.get());
}

export function openSidebar() {
  sidebarOpenAtom.set(true);
}

export function closeSidebar() {
  sidebarOpenAtom.set(false);
}
