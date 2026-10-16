import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as loadSerif } from '@remotion/google-fonts/DMSerifDisplay';

const { fontFamily: montserrat } = loadMontserrat('normal', { weights: ['700', '800', '900'], subsets: ['latin', 'latin-ext'] });
const { fontFamily: serif } = loadSerif('normal', { weights: ['400'], subsets: ['latin'] });

export const SANS = `${montserrat}, "Noto Color Emoji", "Apple Color Emoji", sans-serif`;
export const SERIF = `${serif}, Georgia, serif`;
