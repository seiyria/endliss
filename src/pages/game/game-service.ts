
import { GameStartingDifficulty, Tile, TileColor } from './game-models';
import * as _ from 'lodash';

class GameSettings {
  width: number;
  height: number;
}

export class GameService {

  private settings: GameSettings = {
    width: 6,
    height: 12
  };

  // grid should be 6x15
  private _grid: Array<Tile[]> = [];

  public get grid(): Array<Tile[]> {
    return this._grid;
  }

  // the preview of the next row
  private nextRow: Tile[];

  private difficulty: GameStartingDifficulty = 12;

  // init
  // check possible clears
  // swap
  // add row
  // clear
  // pause
  // resume

  constructor() {
    console.log('init');
  }

  public init(): void {
    // spawn <difficulty> random rows
    // settle the rows (check for matches, clear with no animation)

    for(let i = 0; i < this.settings.height; i++) {
      this._grid.push([]);
    }

    this.nextRow = this.generateRow();

    for(let i = 0; i < this.difficulty; i++) {
      this.addRow();
    }
  }

  private loseGame(): void {
    console.log('YOU LOSE');
  }

  private generateRow(): Tile[] {

    const createRandomTile = () => {
      const tile = new Tile();
      tile.color = _.sample([TileColor.Blue, TileColor.Red, TileColor.Green, TileColor.Yellow]);
      return tile;
    };

    return new Array(this.settings.width).fill(null).map(createRandomTile);
  }

  private addRow(): void {
    const row = this._grid.shift();

    if(_.some(row)) {
      this.loseGame();
      return;
    }

    this._grid.push(this.nextRow);
    this.nextRow = this.generateRow();

    console.log(this._grid);
  }
}
