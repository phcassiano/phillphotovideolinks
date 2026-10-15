import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily: montserrat } = loadFont('normal', { weights: ['600', '700', '800', '900'], subsets: ['latin', 'latin-ext'] });

// Emoji (🎁) cai na fonte de emoji do sistema
export const FONT = `${montserrat}, "Noto Color Emoji", "Apple Color Emoji", sans-serif`;
