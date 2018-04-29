
import { GameSpeed, GameStartingDifficulty, Tile, TileColor, Vec2 } from './game-models';
import * as _ from 'lodash';
import { Subject } from 'rxjs/Subject';

const ANIM_DURATION = 250;

class GameSettings {
  width: number;
  height: number;
  difficulty: GameStartingDifficulty;
  speed: GameSpeed;
}

export class GameService {

  private hasInit: boolean;
  private pauseFrames = 0;

  // events
  public $move = new Subject<{ offset: number }>();
  public $lose = new Subject();

  // settings
  private settings: GameSettings = {
    width: 6,
    height: 11,
    difficulty: GameStartingDifficulty.Normal,
    speed: GameSpeed.Normal
  };

  // grid should be 6x15
  private _grid: Array<Tile[]> = [];

  public get grid(): Array<Tile[]> {
    return this._grid;
  }

  // the preview of the next row
  private _nextRow: Tile[];

  public get nextRow(): Tile[] {
    return this._nextRow;
  }

  private isGameOver: boolean;

  public get gameOver(): boolean {
    return this.isGameOver;
  }

  private score = 0;

  public get currentScore(): number {
    return this.score;
  }

  private isPanic: boolean;
  private isSuperPanic: boolean;

  public get panicState(): string {
    if(this.isGameOver)   return '';
    if(this.isSuperPanic) return 'super-panic';
    if(this.isPanic)      return 'panic';
    return '';
  }

  private isPaused: boolean;

  public init(opts?: { speed: GameSpeed, difficulty: GameStartingDifficulty }): void {

    if(opts) {
      const { speed, difficulty } = opts;

      if(speed) this.settings.speed = speed;
      if(difficulty) this.settings.difficulty = difficulty;
    }

    for(let i = 0; i < this.settings.height; i++) {
      this._grid.push([]);
    }

    this._nextRow = this.generateRow();

    for(let i = 0; i < this.settings.difficulty; i++) {
      this.addRow();
    }

    this.settleGameAfterGravity();

    this.hasInit = true;

    this.loop();
  }

  private delayExecutionUnlessInitialized(func: Function) {
    if(!this.hasInit) {
      func();
      return;
    }

    setTimeout(() => {
      func();
    });
  }

  private loop() {
    const MAX_DIST = 42;
    const TRAVEL_SPEED = 2;
    let distToGo = MAX_DIST;

    this.$move.next({ offset: distToGo });

    const doAction = () => {
      if(this.isGameOver) return;

      // pause frames
      if(this.pauseFrames > 0) {
        this.pauseFrames -= this.settings.speed;
        if(this.pauseFrames <= 0) this.pauseFrames = 0;
        setTimeout(doAction, this.settings.speed);
        return;
      }

      // adding a row
      if(distToGo <= 0) {
        distToGo = MAX_DIST;
        this.addRow();

        if(this.isGameOver) return;

        this.$move.next({ offset: distToGo });
        setTimeout(doAction, this.settings.speed);
        return;
      }

      // not paused, not adding a row, go down
      if(!this.isPaused) {
        distToGo -= TRAVEL_SPEED;
        this.$move.next({ offset: distToGo });
        setTimeout(doAction, this.settings.speed);
        return;
      }
    };

    setTimeout(doAction, this.settings.speed);
  }

  public async swap(x: number, y: number, dir: -1|1) {

    if(this.isGameOver) return;

    if(x + dir < 0) return;
    if(x + dir >= this.settings.width) return;

    const leftTile = dir === -1 ? { x: x + dir, y } : { x, y };
    const rightTile = dir === -1 ? { x, y } : { x: x + dir, y };

    const callback = async () => {
      this.swapPositions(x, y, x + dir, y);
      this.checkForMatchesAround(x, y);
      this.checkForMatchesAround(x + dir, y);

      return this.doGravity();
    };

    // await this.animSwap(leftTile, rightTile);

    return callback();
  }

  // TODO pause on match for 100frames (add 100 for every match (bonus for bigger matches), capped at 2000)

  private loseGame(): void {
    this.isGameOver = true;
    this.$lose.next();
  }

  private generateRow(): Tile[] {

    const createRandomTile = () => {
      const tile = new Tile();
      tile.color = _.sample([TileColor.Blue, TileColor.Red, TileColor.Green, TileColor.Yellow]);
      return tile;
    };

    const baseArr = new Array(this.settings.width).fill(null);

    baseArr.forEach((val, idx) => {
      if(idx === 0) {
        baseArr[0] = createRandomTile();
        return;
      }

      const prevTile = baseArr[idx - 1];
      let tile = createRandomTile();

      while(prevTile.color === tile.color) {
        tile = createRandomTile();
      }

      baseArr[idx] = tile;
    });

    return baseArr;
  }

  private addRow(): void {
    const row = this._grid.shift();

    if(_.some(row)) {
      this._grid.unshift(row);
      this.loseGame();
      return;
    }

    this._grid.push(this._nextRow);
    this._nextRow = this.generateRow();

    this.checkPanicState();

    this.settleGameAfterGravity();
  }

  private checkPanicState() {
    this.isPanic = _.some(this._grid[3]);
    this.isSuperPanic = _.some(this._grid[1]);
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

  private gainPauseFrames(brokenTiles: number): void {
    if(this.isGameOver || !this.hasInit) return;

    this.pauseFrames += 150 * brokenTiles;
    if(brokenTiles > 3) this.pauseFrames += 250;
    if(brokenTiles > 4) this.pauseFrames += 250;
    if(brokenTiles > 5) this.pauseFrames += 250;

    this.pauseFrames = Math.min(2000, this.pauseFrames);
  }

  private async checkForMatchesAround(x: number, y: number): Promise<any> {
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

      if(this.hasInit) {
        this.score += brokenTiles.length;
      }

      const callback = async () => {
        this.gainPauseFrames(brokenTiles.length);

        brokenTiles.forEach(({ x, y }) => {
          this.removeTile(x, y);
        });

        return this.doGravity();
      };

      if(!this.hasInit) {
        callback();
        return;
      }

      // wait for animation to finish, then push break
      // await this.animBreak(brokenTiles);

      return callback();
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

            const swapPromise = new Promise(async resolve => {

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

              // await this.animFall({ x, y });

              callback();
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

    this.checkPanicState();
  }

  // pause related
  public pause() {
    this.isPaused = true;
  }

  public unpause() {
    this.isPaused = false;
  }

  // animation related

  private async animSwap(leftTile: Vec2, rightTile: Vec2): Promise<any> {
    const leftEl = <HTMLElement>document.querySelectorAll(`[x="${leftTile.x}"][y="${leftTile.y}"]`)[0];
    const rightEl = <HTMLElement>document.querySelectorAll(`[x="${rightTile.x}"][y="${rightTile.y}"]`)[0];

    const styleChange = {
      transition: `all ${ANIM_DURATION}ms ease 0s`
    };

    _.extend(leftEl.style, styleChange);
    _.extend(rightEl.style, styleChange);

    const leftAnim = (<any>leftEl).animate([
      { transform: 'translateX(0px)' },
      { transform: 'translateX(44px)' }
    ], { duration: ANIM_DURATION });

    const rightAnim = (<any>rightEl).animate([
      { transform: 'translateX(0px)' },
      { transform: 'translateX(-44px)' }
    ], { duration: ANIM_DURATION });

    const isLeftFinished = new Promise(resolve => leftAnim.onfinish = () => resolve());
    const isRightFinished = new Promise(resolve => rightAnim.onfinish = () => resolve());

    return Promise.all([isLeftFinished, isRightFinished]);
  }

  private async animBreak(tiles: Vec2[]): Promise<any> {
    const styleChange = {
      transition: `all ${ANIM_DURATION}ms ease 0s`
    };

    const allElements = tiles.map(({ x, y }) => {
      const el = <HTMLElement>document.querySelectorAll(`[x="${x}"][y="${y}"]`)[0];
      _.extend(el.style, styleChange);
      return el;
    });

    const allAnimations = allElements.map(el => {
      return (<any>el).animate([
        { transform: 'scale(1) rotate(0deg)' },
        { transform: 'scale(0.1) rotate(120deg)' }
      ], { duration: ANIM_DURATION });
    });

    const allPromises = allAnimations.map(anim => new Promise(resolve => anim.onfinish = () => resolve()));

    return Promise.all(allPromises);
  }

  private async animFall(tile: Vec2): Promise<any> {
    const el = <HTMLElement>document.querySelectorAll(`[x="${tile.x}"][y="${tile.y}"]`)[0];

    const styleChange = {
      transition: `all ${ANIM_DURATION}ms ease 0s`
    };

    _.extend(el.style, styleChange);

    const anim = (<any>el).animate([
      { transform: 'translateY(0px)' },
      { transform: 'translateY(44px)' }
    ], { duration: ANIM_DURATION });

    return new Promise(resolve => anim.onfinish = () => resolve());
  }
}
