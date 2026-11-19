/**
 * Home-page feature/promotional cards. This is deliberately a local, owner-edited list—not an ad
 * network. Put optional banner images in `launcher/src/renderer/assets/promotions/`, set `image`
 * to the packaged relative path (for example `assets/promotions/server.webp`), and use HTTPS URLs.
 */
type HomePromotion = {
  id: string;
  label: string;
  title: string;
  description: string;
  action: string;
  tone: 'blue' | 'violet' | 'mint';
  image?: string;
  url?: string;
};

interface Window {
  lucidPromotions: HomePromotion[];
}

window.lucidPromotions = [
  {
    id: 'slot-1',
    label: 'PROMOTED SPACE',
    title: 'Your first campaign',
    description: 'Add a local banner, message, and HTTPS link in home-promotions.ts.',
    action: 'SET UP SLOT',
    tone: 'blue',
  },
  {
    id: 'slot-2',
    label: 'COMMUNITY SPOTLIGHT',
    title: 'Feature a server, creator, or event',
    description: 'Use this space for a community feature or partner promotion.',
    action: 'CONFIGURE',
    tone: 'violet',
  },
  {
    id: 'slot-3',
    label: 'LUCID FEATURE',
    title: 'What’s new',
    description: 'Reserve this tile for product news, updates, or another promotion.',
    action: 'CONFIGURE',
    tone: 'mint',
  },
];
