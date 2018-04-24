
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

export class Tile {
  color: TileColor;
}
