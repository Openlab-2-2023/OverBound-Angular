export interface StoreItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
  description: string;
  longDescription: string;
  type?: 'frame';
}

export const STORE_ITEMS: StoreItem[] = [
  {
    id: 'frame_solar',
    name: 'Solar Flare Frame',
    icon: 'FRM',
    cost: 45,
    type: 'frame',
    description: 'Molten gold frame with a warm pulse.',
    longDescription:
      'A radiant frame forged in ember-light. Its glow gently pulses around your profile like a miniature sunrise.',
  },
  {
    id: 'frame_frost',
    name: 'Frostbite Frame',
    icon: 'FRM',
    cost: 50,
    type: 'frame',
    description: 'Icy blue frame with a cold shimmer.',
    longDescription:
      'A crisp frame cut from frozen light. Soft blue highlights sweep across it like wind over ice.',
  },
  {
    id: 'frame_neon',
    name: 'Neon Circuit Frame',
    icon: 'FRM',
    cost: 60,
    type: 'frame',
    description: 'Electric neon frame with arcade energy.',
    longDescription:
      'A vivid cyber-styled profile frame with shifting magenta and cyan glow, built for loud futuristic flair.',
  },
  {
    id: 'frame_royal',
    name: 'Royal Nova Frame',
    icon: 'FRM',
    cost: 75,
    type: 'frame',
    description: 'Regal violet-blue frame with a starry drift.',
    longDescription:
      'A polished high-tier frame with luminous blue-violet edges and a slow royal shimmer fit for leaderboard climbers.',
  },
  {
    id: 'frame_blossom',
    name: 'Blossom Wave Frame',
    icon: 'FRM',
    cost: 58,
    type: 'frame',
    description: 'Pink-coral frame with soft flowing motion.',
    longDescription:
      'A bright pastel frame with a gentle animated sweep, perfect for players who want something stylish and playful.',
  },
];

export function getStoreItemById(id: string): StoreItem | null {
  const normalized = String(id || '').trim().toLowerCase();
  return STORE_ITEMS.find((it) => it.id === normalized) || null;
}
