
export enum GameSpeed {
  Slowest = 100,
  Slow = 80,
  Normal = 60,
  Fast = 40,
  Fastest = 20
}

export enum GameStartingDifficulty {
  Beginner = 1,
  Easy = 3,
  Normal = 5,
  Hard = 7,
  Expert = 9,
  Impossible = 11
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
