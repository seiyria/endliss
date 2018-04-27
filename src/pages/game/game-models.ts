
export enum GameSpeed {
  Slowest = 400,
  Slow = 320,
  Normal = 240,
  Fast = 160,
  Fastest = 80
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

  isFalling: boolean;
}
