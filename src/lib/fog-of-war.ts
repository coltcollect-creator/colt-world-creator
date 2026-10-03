// Fog of War (ערפל קרב) Exploration & Discovery Persistence Manager
export const FOW_CELL_SIZE = 45; // 45px per grid cell for high performance and smooth revealing
export const FOW_REVEAL_RADIUS = 340; // Reveal radius around player

export function getFowStorageKey(userId: string | null | undefined, mapId: string | null | undefined): string {
  const u = userId || "guest_user";
  const m = mapId || "main_map";
  return `fow_v1_${u}_${m}`;
}

export function loadDiscoveredCells(userId: string | null | undefined, mapId: string | null | undefined): Set<number> {
  const key = getFowStorageKey(userId, mapId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return new Set(arr);
    }
  } catch (e) {
    console.warn("Failed to load fog of war data:", e);
  }
  return new Set();
}

export function saveDiscoveredCells(
  userId: string | null | undefined,
  mapId: string | null | undefined,
  cells: Set<number>
): void {
  const key = getFowStorageKey(userId, mapId);
  try {
    const arr = Array.from(cells);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.warn("Failed to save fog of war data:", e);
  }
}

/**
 * Reveals a circular region around the player's world coordinates (px, pz).
 * Returns true if new cells were discovered.
 */
export function revealFogCircle(
  discovered: Set<number>,
  px: number,
  pz: number,
  radius: number,
  cols: number,
  rows: number,
  cellSize: number = FOW_CELL_SIZE
): boolean {
  let changed = false;
  const minCol = Math.max(0, Math.floor((px - radius) / cellSize));
  const maxCol = Math.min(cols - 1, Math.floor((px + radius) / cellSize));
  const minRow = Math.max(0, Math.floor((pz - radius) / cellSize));
  const maxRow = Math.min(rows - 1, Math.floor((pz + radius) / cellSize));
  const radSq = radius * radius;

  for (let r = minRow; r <= maxRow; r++) {
    const cellCenterZ = (r + 0.5) * cellSize;
    for (let c = minCol; c <= maxCol; c++) {
      const cellCenterX = (c + 0.5) * cellSize;
      const distSq = (px - cellCenterX) ** 2 + (pz - cellCenterZ) ** 2;
      if (distSq <= radSq) {
        const index = r * cols + c;
        if (!discovered.has(index)) {
          discovered.add(index);
          changed = true;
        }
      }
    }
  }

  return changed;
}

export function calculateFogStats(
  discovered: Set<number>,
  cols: number,
  rows: number
): { percentage: number; discoveredCount: number; totalCount: number } {
  const totalCount = cols * rows;
  if (totalCount === 0) return { percentage: 0, discoveredCount: 0, totalCount: 0 };
  const discoveredCount = discovered.size;
  const percentage = Math.min(100, Math.round((discoveredCount / totalCount) * 100));
  return { percentage, discoveredCount, totalCount };
}
