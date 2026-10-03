import {
  Apple,
  Bath,
  BedDouble,
  Bike,
  BookOpen,
  Brain,
  Brush,
  Camera,
  CigaretteOff,
  Code,
  Coffee,
  Dog,
  Droplet,
  Dumbbell,
  Flower2,
  Footprints,
  GraduationCap,
  Guitar,
  Heart,
  Languages,
  Laptop,
  Leaf,
  MessageCircle,
  Moon,
  Mountain,
  Music,
  Palette,
  PenLine,
  PhoneOff,
  PiggyBank,
  Pill,
  Salad,
  Sparkles,
  Sun,
  Target,
  Timer,
  Utensils,
  Waves,
  WineOff,
  type LucideIcon,
} from "lucide-react";

/** The habit icon set. Stored by name in the habit's `icon` field. */
export const HABIT_ICONS: Record<string, LucideIcon> = {
  droplet: Droplet,
  footprints: Footprints,
  dumbbell: Dumbbell,
  bike: Bike,
  waves: Waves,
  mountain: Mountain,
  book: BookOpen,
  pen: PenLine,
  brain: Brain,
  languages: Languages,
  study: GraduationCap,
  code: Code,
  laptop: Laptop,
  guitar: Guitar,
  music: Music,
  palette: Palette,
  camera: Camera,
  moon: Moon,
  bed: BedDouble,
  sun: Sun,
  coffee: Coffee,
  apple: Apple,
  salad: Salad,
  utensils: Utensils,
  pill: Pill,
  brush: Brush,
  bath: Bath,
  heart: Heart,
  leaf: Leaf,
  flower: Flower2,
  dog: Dog,
  call: MessageCircle,
  piggybank: PiggyBank,
  target: Target,
  timer: Timer,
  sparkles: Sparkles,
  "no-smoking": CigaretteOff,
  "no-alcohol": WineOff,
  "no-phone": PhoneOff,
};

export const HABIT_ICON_NAMES = Object.keys(HABIT_ICONS);

/**
 * Renders a habit's icon in its ink color on a tinted tile.
 * Habits created before the icon set stored an emoji; those still render as text.
 */
export function HabitIcon({ icon, color, size = 44, radius = 11 }: { icon: string; color: string; size?: number; radius?: number }) {
  const Icon = HABIT_ICONS[icon];
  return (
    <span
      className="grid shrink-0 place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `color-mix(in oklch, ${color} 14%, var(--sheet))`,
        color: `color-mix(in oklch, ${color} 88%, var(--ink))`,
      }}
      aria-hidden
    >
      {Icon ? <Icon size={Math.round(size * 0.5)} strokeWidth={2} /> : <span style={{ fontSize: Math.round(size * 0.5), lineHeight: 1 }}>{icon}</span>}
    </span>
  );
}
