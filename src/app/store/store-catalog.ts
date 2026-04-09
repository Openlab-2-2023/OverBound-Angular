export interface StoreItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
  description: string;
  longDescription: string;
}

export const STORE_ITEMS: StoreItem[] = [
  {
    id: 'hat_wanderer',
    name: 'Wanderer Hat',
    icon: 'HAT',
    cost: 25,
    description: 'A classic hat for explorers.',
    longDescription:
      'A simple traveler hat that fits almost any outfit. Great starter cosmetic for your character.',
  },
  {
    id: 'cloak_ember',
    name: 'Ember Cloak',
    icon: 'CLK',
    cost: 55,
    description: 'Warm cloak with ember trim.',
    longDescription:
      'Dark cloak lined with ember-colored seams. Looks best on night maps and dungeon scenes.',
  },
  {
    id: 'blade_pixel',
    name: 'Pixel Blade',
    icon: 'SWD',
    cost: 80,
    description: 'Sharp and very square.',
    longDescription:
      'A stylized sword skin with chunky pixel edges. Built for players who want a classic retro look.',
  },
  {
    id: 'pet_slime',
    name: 'Slime Pet',
    icon: 'PET',
    cost: 120,
    description: 'A tiny companion blob.',
    longDescription:
      'A small cosmetic pet that follows your style theme. Friendly, bouncy, and unmistakably cute.',
  },
];

export function getStoreItemById(id: string): StoreItem | null {
  const normalized = String(id || '').trim().toLowerCase();
  return STORE_ITEMS.find((it) => it.id === normalized) || null;
}
