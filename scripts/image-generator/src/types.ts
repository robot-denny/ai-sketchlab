export interface ArticleMetadata {
  id: string;           // Umbraco document UUID
  name: string;         // Document name
  title: string;        // Display title (from headerControls)
  wordCount: number;    // Derived from contentRows block list
  categories: string[]; // Resolved category names
}

export type RGBColor = [number, number, number];
export type Palette = RGBColor[];

export interface PaletteConfig {
  entries: Record<string, Palette>;
  default: Palette;
}

export interface Particle {
  x: number;
  y: number;
  history: Array<[number, number]>;
  alive: boolean;
}

export interface GeneratorOptions {
  width?: number;       // Default: 1200
  height?: number;      // Default: 630
  gridScale?: number;   // Default: 4 (coarse grid resolution)
  octaves?: number;     // Default: 4
  lineWidth?: number;   // Default: 2.0
  alpha?: number;       // Default: 160
  background?: RGBColor; // Default: [15, 20, 30] (#0F141E)
}
