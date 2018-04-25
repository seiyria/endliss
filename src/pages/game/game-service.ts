
import { GameSpeed, GameStartingDifficulty, Tile, TileColor } from './game-models';
import * as _ from 'lodash';

class GameSettings {
  width: number;
  height: number;
  difficulty: GameStartingDifficulty;
  speed: GameSpeed;
}

export class GameService {

  private settings: GameSettings = {
    width: 6,
    height: 12,
    difficulty: GameStartingDifficulty.Normal,
    speed: GameSpeed.Normal
  };

  // grid should be 6x15
  private _grid: Array<Tile[]> = [];

  public get grid(): Array<Tile[]> {
    return this._grid;
  }

  // the preview of the next row
  private nextRow: Tile[];

  public init(): void {

    for(let i = 0; i < this.settings.height; i++) {
      this._grid.push([]);
    }

    this.nextRow = this.generateRow();

    for(let i = 0; i < this.settings.difficulty; i++) {
      this.addRow();
    }

    this.settleGameAfterGravity();
  }

  public swap(x: number, y: number, dir: -1|1) {

    if(x + dir < 0) return;
    if(x + dir >= this.settings.width) return;

    this.swapPositions(x, y, x + dir, y);
    this.checkForMatchesAround(x, y);
    this.checkForMatchesAround(x + dir, y);
    this.doGravity();
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
  }

  private getTile(x: number, y: number): Tile {
    if(y < 0 || x < 0 || y >= this.settings.height || x >= this.settings.width) return null;

    return this._grid[y][x];
  }

  private setTile(x: number, y: number, tile: Tile): void {
    this._grid[y][x] = tile;
  }

  private removeTile(x: number, y: number): void {
    delete this._grid[y][x];
  }

  private swapPositions(oldX: number, oldY: number, newX: number, newY: number): void {
    const oldTile = this.getTile(oldX, oldY);
    const newTile = this.getTile(newX, newY);

    this.setTile(oldX, oldY, newTile);
    this.setTile(newX, newY, oldTile);
  }

  private settleGameAfterGravity(): void {
    for(let y = 0; y < this.settings.height; y++) {
      for(let x = 0; x < this.settings.width; x++) {
        this.checkForMatchesAround(x, y);
      }
    }
  }

  private checkForMatchesAround(x: number, y: number) {
    const tile = this.getTile(x, y);
    if(!tile) return;

    const isOnTile = this.getTile(x, y + 1);
    if(!isOnTile && y !== this.settings.height - 1) return;

    const verticalContinuity = [{ x, y, tile }];
    const horizontalContinuity = [{ x, y, tile }];

    // get horizontal continuity, ie, how many tiles are in a row horizontally
    for(let checkX = x - 1; checkX >= 0; checkX--) {
      const checkTile = this.getTile(checkX, y);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;

      horizontalContinuity.unshift({ tile: checkTile, x: checkX, y });
    }

    for(let checkX = x + 1; checkX < this.settings.width; checkX++) {
      const checkTile = this.getTile(checkX, y);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;

      horizontalContinuity.push({ tile: checkTile, x: checkX, y });
    }

    // get vertical continuity, ie, how many tiles are in a row vertically
    for(let checkY = y - 1; checkY >= 0; checkY--) {
      const checkTile = this.getTile(x, checkY);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;

      verticalContinuity.unshift({ tile: checkTile, x, y: checkY });
    }

    for(let checkY = y + 1; checkY < this.settings.height; checkY++) {
      const checkTile = this.getTile(x, checkY);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;

      verticalContinuity.push({ tile: checkTile, x, y: checkY });
    }

    let hasHorizontalMatch = false;
    let hasVerticalMatch = false;

    if(horizontalContinuity.length >= 3) {
      hasHorizontalMatch = true;
      horizontalContinuity.forEach(({ tile, x, y }) => {
        this.removeTile(x, y);
      });
    }

    if(verticalContinuity.length >= 3) {
      hasVerticalMatch = true;
      verticalContinuity.forEach(({ tile, x, y }) => {
        this.removeTile(x, y);
      });
    }

    if(hasHorizontalMatch || hasVerticalMatch) {
      this.doGravity();
    }
  }

  private doGravity() {
    // if anything falls, check the whole board for matches
    let didAnythingFall = false;

    const innerGravity = () => {
      let didAnythingSwap = false;

      for(let y = this.settings.height - 1; y >= 0; y--) {

        for(let x = 0; x < this.settings.width; x++) {

          // if we have a tile here, we don't swap it down
          const tile = this.getTile(x, y);
          if(tile) continue;

          // if there is no next tile, we don't swap air with air
          const nextTile = this.getTile(x, y - 1);
          if(!nextTile) continue;

          // we do the swap if this tile is an air tile, and the one above is not
          didAnythingSwap = true;
          this.swapPositions(x, y, x, y - 1);
        }
      }

      return didAnythingSwap;
    };

    while(innerGravity()) {
      didAnythingFall = true;
    }

    if(didAnythingFall) {
      this.settleGameAfterGravity();
    }
  }
}
