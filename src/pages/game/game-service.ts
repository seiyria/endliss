
import { GameSpeed, GameStartingDifficulty, Tile, TileColor, Vec2 } from './game-models';
import * as _ from 'lodash';
import { Subject } from 'rxjs/Subject';

class GameSettings {
  width: number;
  height: number;
  difficulty: GameStartingDifficulty;
  speed: GameSpeed;
}

export class GameService {

  // events
  private hasInit: boolean;

  public $swap = new Subject<{ callback: Function, leftTile: Vec2, rightTile: Vec2 }>();
  public $break = new Subject<{ callback: Function, tiles: Vec2[] }>();
  public $fall = new Subject<{ callback: Function, tile: Vec2 }>();

  // settings
  private settings: GameSettings = {
    width: 6,
    height: 12,
    difficulty: 10,
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

    this.hasInit = true;
    console.log('init')
  }

  private delayExecutionUnlessInitialized(func: Function) {
    console.log(func, this.hasInit);
    if(!this.hasInit) {
      func();
      return;
    }

    setTimeout(() => {
      func();
    });
  }

  public swap(x: number, y: number, dir: -1|1) {

    if(x + dir < 0) return;
    if(x + dir >= this.settings.width) return;

    const leftTile = dir === -1 ? { x: x + dir, y } : { x, y };
    const rightTile = dir === -1 ? { x, y } : { x: x + dir, y };

    const callback = () => {
      this.swapPositions(x, y, x + dir, y);
      this.checkForMatchesAround(x, y);
      this.checkForMatchesAround(x + dir, y);

      this.delayExecutionUnlessInitialized(() => this.doGravity());
    };

    this.$swap.next({
      callback,
      leftTile,
      rightTile
    });
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

  private swapPositions(oldX: number, oldY: number, newX: number, newY: number, force = false): void {
    const oldTile = this.getTile(oldX, oldY);
    const newTile = this.getTile(newX, newY);

    if(!force && oldTile && oldTile.isFalling) return;
    if(!force && newTile && newTile.isFalling) return;

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

    const verticalContinuity = [{ x, y }];
    const horizontalContinuity = [{ x, y }];

    // get horizontal continuity, ie, how many tiles are in a row horizontally
    for(let checkX = x - 1; checkX >= 0; checkX--) {
      const checkTile = this.getTile(checkX, y);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;

      horizontalContinuity.unshift({ x: checkX, y });
    }

    for(let checkX = x + 1; checkX < this.settings.width; checkX++) {
      const checkTile = this.getTile(checkX, y);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;

      horizontalContinuity.push({ x: checkX, y });
    }

    // get vertical continuity, ie, how many tiles are in a row vertically
    for(let checkY = y - 1; checkY >= 0; checkY--) {
      const checkTile = this.getTile(x, checkY);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;

      verticalContinuity.unshift({ x, y: checkY });
    }

    for(let checkY = y + 1; checkY < this.settings.height; checkY++) {
      const checkTile = this.getTile(x, checkY);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;

      verticalContinuity.push({ x, y: checkY });
    }

    let hasHorizontalMatch = false;
    let hasVerticalMatch = false;

    const brokenTiles = [];

    if(horizontalContinuity.length >= 3) {
      hasHorizontalMatch = true;
      brokenTiles.push(...horizontalContinuity);
    }

    if(verticalContinuity.length >= 3) {
      hasVerticalMatch = true;
      brokenTiles.push(...verticalContinuity);
    }

    if(hasHorizontalMatch || hasVerticalMatch) {

      const callback = () => {
        brokenTiles.forEach(({ x, y }) => {
          this.removeTile(x, y);
        });

        this.delayExecutionUnlessInitialized(() => this.doGravity());
      };

      if(!this.hasInit) {
        callback();
        return;
      }

      // wait for animation to finish, then push break
      setTimeout(() => {
        this.$break.next({
          callback,
          tiles: brokenTiles
        });
      });
    }
  }

  private async doGravity() {
    // if anything falls, check the whole board for matches
    let didAnythingFall = false;

    const innerGravity = () => {
      let swapPromises = [];

      for(let y = this.settings.height - 1; y >= 0; y--) {

        for(let x = 0; x < this.settings.width; x++) {

          // if we have a tile here, we don't swap it down
          const tile = this.getTile(x, y);
          if(tile) continue;

          // if there is no next tile, we don't swap air with air
          const nextTile = this.getTile(x, y - 1);
          if(!nextTile) continue;

          // game NOT initialized - swap immediately for no animation
          if(!this.hasInit) {
            this.swapPositions(x, y, x, y - 1, true);
            swapPromises.push(true);

          // game initialized - we do the swap if this tile is an air tile, and the one above is not
          } else {

            const swapPromise = new Promise(resolve => {

              const meTile = this.getTile(x, y - 1);

              const callback = () => {
                meTile.isFalling = false;
                resolve();
              };

              meTile.isFalling = true;
              this.swapPositions(x, y, x, y - 1, true);

              if(!this.hasInit) {
                callback();
                return;
              }

              this.$fall.next({
                callback,
                tile: { x, y }
              });

            });

            swapPromises.push(swapPromise);
          }
        }
      }

      return swapPromises;
    };

    if(!this.hasInit) {

      while(innerGravity().length > 0) {
        didAnythingFall = true;
      }

    } else {
      let innerGravityPromises = [];

      do {

        innerGravityPromises = innerGravity();
        if(innerGravityPromises.length > 0) {
          didAnythingFall = true;
        }

        await Promise.all(innerGravityPromises);

      } while(innerGravityPromises.length > 0);
    }

    if(didAnythingFall) {
      this.settleGameAfterGravity();
    }
  }
}

// TODO loop = send animation information to component, component sends back when done
