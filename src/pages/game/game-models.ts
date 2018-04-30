
export enum GameSpeed {
  Slowest = 150,
  Slow = 120,
  Normal = 90,
  Fast = 60,
  Fastest = 30
}

export enum GameStartingDifficulty {
  Beginner = 1,
  Easy = 2,
  Normal = 4,
  Hard = 6,
  Expert = 7,
  Impossible = 9
}

export enum TileColor {
  Red = 'red',
  Blue = 'blue',
  Green = 'green',
  Yellow = 'yellow'
}

export class Vec2 {
  x: number;
  y: number;
}

export class Tile {
  color: TileColor;
  id: number;

  isFalling: boolean;
  isBreaking: boolean;
}
