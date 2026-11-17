import {
  Briefcase, Car, Dumbbell, Footprints, Hammer, HeartPulse, IceCreamBowl, PawPrint, Pill, Pizza,
  Sandwich, Scissors, Shirt, ShoppingBasket, Sparkles, Store, Utensils, UtensilsCrossed, Wrench,
  Coffee, Cake, Baby, BookOpen, Flower2, GraduationCap, Laptop, Music, Stethoscope, Truck, House,
  type LucideIcon,
} from 'lucide-react';

// Ícones disponíveis para categorias (o admin escolhe pelo nome).
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase, car: Car, dumbbell: Dumbbell, footprints: Footprints, hammer: Hammer,
  'heart-pulse': HeartPulse, 'ice-cream-bowl': IceCreamBowl, 'paw-print': PawPrint, pill: Pill,
  pizza: Pizza, sandwich: Sandwich, scissors: Scissors, shirt: Shirt, 'shopping-basket': ShoppingBasket,
  sparkles: Sparkles, store: Store, utensils: Utensils, 'utensils-crossed': UtensilsCrossed, wrench: Wrench,
  coffee: Coffee, cake: Cake, baby: Baby, 'book-open': BookOpen, 'flower-2': Flower2,
  'graduation-cap': GraduationCap, laptop: Laptop, music: Music, stethoscope: Stethoscope, truck: Truck, house: House,
};

export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]) || Store;
  return <Icon aria-hidden className={className} />;
}
