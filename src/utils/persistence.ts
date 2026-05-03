export function clearSave(): void {
  localStorage.removeItem('airline-empire-save');
}

export function hasSave(): boolean {
  return localStorage.getItem('airline-empire-save') !== null;
}
