const PINNED_NAME = 'raghavendra g shetty';

export function sortEmployeesWithPinnedFirst(employees) {
  return [...employees].sort((a, b) => {
    const aName = (a?.displayName || '').trim().toLowerCase();
    const bName = (b?.displayName || '').trim().toLowerCase();
    const aPinned = aName === PINNED_NAME;
    const bPinned = bName === PINNED_NAME;
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return (a?.displayName || '').localeCompare(b?.displayName || '');
  });
}
