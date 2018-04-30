
import { GameSpeed, GameStartingDifficulty, Tile, TileColor, Vec2 } from './game-models';
import * as _ from 'lodash';
import { Subject } from 'rxjs/Subject';

const ANIM_DURATION = 150;

class GameSettings {
  width: number;
  height: number;
  difficulty: GameStartingDifficulty;
  speed: GameSpeed;
}

export class GameService {

  private hasInit: boolean;
  private pauseFrames = 0;
  private allAnimations: any[] = [];

  private curBlockId = 0;

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

  public async init(opts?: { speed: GameSpeed, difficulty: GameStartingDifficulty }): Promise<any> {

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

    await this.settleGameAfterGravity();

    this.hasInit = true;

    this.loop();
  }

  private async delayExecutionUnlessInitialized(func: Function): Promise<any> {
    if(!this.hasInit) {
      func();
      return;
    }

    return new Promise(resolve => {
      setTimeout(async () => {
        await func();
        resolve();
      });
    });
  }

  private loop() {
    const MAX_DIST = 42;
    const TRAVEL_SPEED = 2;
    let distToGo = MAX_DIST;

    this.$move.next({ offset: distToGo });

    const doAction = async () => {

      if(this.isGameOver) return;

      if(this.isPaused) {
        doAfterAnimation();
        return;
      }

      await this.doGravity();
      await this.settleGameAfterGravity();

      setTimeout(async () => {

        // pause frames
        if(this.pauseFrames > 0) {
          this.pauseFrames -= this.settings.speed;
          if(this.pauseFrames <= 0) this.pauseFrames = 0;
          doAfterAnimation();
          return;
        }

        // adding a row
        if(distToGo <= 0) {
          distToGo = MAX_DIST;
          this.addRow();

          if(this.isGameOver) return;

          this.$move.next({ offset: distToGo });
          doAfterAnimation();
          return;
        }

        // not paused, not adding a row, go down
        distToGo -= TRAVEL_SPEED;
        this.$move.next({ offset: distToGo });
        doAfterAnimation();
      });
    };

    const doAfterAnimation = async () => {
      await this.allAnimations;
      this.allAnimations = [];

      setTimeout(doAction, this.settings.speed);
    };

    // start the loop
    doAfterAnimation();
  }

  public async swapBasedOnCoordinate(x: number, y: number): Promise<any> {
    const tile = this.getTile(x, y);
    if(tile) return this.swap(tile, 1);

    const rightTile = this.getTile(x + 1, y);
    if(rightTile) return this.swap(rightTile, -1);
  }

  public async swap(tile: Tile, dir: -1|1): Promise<any> {
    await this.allAnimations;

    if(!tile) return;
    if(this.isGameOver) return;

    const { x, y } = this.getTileXYFromId(tile.id);

    if(x + dir < 0) return;
    if(x + dir >= this.settings.width) return;

    const leftTile = dir === -1 ? { x: x + dir, y } : { x, y };
    const rightTile = dir === -1 ? { x, y } : { x: x + dir, y };

    const leftTileRef = this.getTile(leftTile.x, leftTile.y);
    const rightTileRef = this.getTile(rightTile.x, rightTile.y);

    if(!leftTileRef && !rightTileRef) return;

    if(leftTileRef && (leftTileRef.isBreaking || leftTileRef.isFalling)) return;
    if(rightTileRef && (rightTileRef.isBreaking || rightTileRef.isFalling)) return;

    await this.animSwap(leftTileRef, rightTileRef);

    let leftTileNow = null;
    let rightTileNow = null;

    if(leftTileRef) {
      leftTileNow = this.getTileXYFromId(leftTileRef.id);
    }

    if(rightTileRef) {
      rightTileNow = this.getTileXYFromId(rightTileRef.id);
    }

    if(!leftTileNow) {
      leftTileNow = { x: rightTileNow.x - 1, y: rightTileNow.y };
    }

    if(!rightTileNow) {
      rightTileNow = { x: leftTileNow.x + 1, y: leftTileNow.y };
    }

    this.swapPositions(leftTileNow.x, leftTileNow.y, rightTileNow.x, rightTileNow.y);

    this.delayExecutionUnlessInitialized(() => {
      this.checkForMatchesAround(leftTileNow.x, leftTileNow.y);
      this.checkForMatchesAround(rightTileNow.x, rightTileNow.y);
    });
  }

  private loseGame(): void {
    this.isGameOver = true;
    this.$lose.next();
  }

  private getTileXYFromId(id: number): { x: number, y: number } {
    for(let x = 0; x < this.settings.width; x++) {
      for(let y = 0; y < this.settings.height; y++) {
        const tile = this.getTile(x, y);
        if(!tile) continue;

        if(tile.id === id) return { x, y };
      }
    }

    return { x: -1, y: -1 };
  }

  private generateRow(): Tile[] {

    const createRandomTile = () => {
      const tile = new Tile();
      tile.color = _.sample([TileColor.Blue, TileColor.Red, TileColor.Green, TileColor.Yellow]);
      tile.id = ++this.curBlockId;
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

    this.delayExecutionUnlessInitialized(() => {
      this.settleGameAfterGravity();
    });
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

  private async settleGameAfterGravity(): Promise<any> {

    const promises = [];

    for(let y = 0; y < this.settings.height; y++) {
      for(let x = 0; x < this.settings.width; x++) {
        const promise = this.checkForMatchesAround(x, y);
        await promise;
        promises.push(promise);
      }
    }

    this.checkPanicState();
    return Promise.all(promises);
  }

  private canTileBeBroken(x: number, y: number): boolean {
    for(let i = y; i < this.settings.height; i++) {
      const isTileBelow = this.getTile(x, i);
      if(!isTileBelow) return false;
    }

    return true;
  }

  private getPauseFrameMultiplierForDifficulty(): number {
    switch(this.settings.difficulty) {
      case GameStartingDifficulty.Beginner:   return 2;
      case GameStartingDifficulty.Easy:       return 1.5;
      case GameStartingDifficulty.Normal:     return 1;
      case GameStartingDifficulty.Hard:       return 0.75;
      case GameStartingDifficulty.Expert:     return 0.5;
      case GameStartingDifficulty.Impossible: return 0.1;
      default:                                return 1;
    }
  }

  private gainPauseFrames(brokenTiles: number): void {
    if(this.isGameOver || !this.hasInit) return;

    const frameMult = this.getPauseFrameMultiplierForDifficulty();
    const bonus = 100 * frameMult;

    this.pauseFrames += 75 * brokenTiles * frameMult;

    if(brokenTiles > 3) this.pauseFrames += bonus;
    if(brokenTiles > 4) this.pauseFrames += bonus;
    if(brokenTiles > 5) this.pauseFrames += bonus;
    if(brokenTiles > 6) this.pauseFrames += bonus;

    this.pauseFrames = Math.min(1000, this.pauseFrames);
  }

  private async checkForMatchesAround(x: number, y: number): Promise<any> {
    await this.allAnimations;

    const tile = this.getTile(x, y);
    if(!tile) return;

    if(!this.canTileBeBroken(x, y)) return;

    const verticalContinuity = [{ x, y }];
    const horizontalContinuity = [{ x, y }];

    // get horizontal continuity, ie, how many tiles are in a row horizontally
    for(let checkX = x - 1; checkX >= 0; checkX--) {
      const checkTile = this.getTile(checkX, y);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;
      if(!this.canTileBeBroken(checkX, y)) return;

      horizontalContinuity.unshift({ x: checkX, y });
    }

    for(let checkX = x + 1; checkX < this.settings.width; checkX++) {
      const checkTile = this.getTile(checkX, y);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;
      if(!this.canTileBeBroken(checkX, y)) return;

      horizontalContinuity.push({ x: checkX, y });
    }

    // get vertical continuity, ie, how many tiles are in a row vertically
    for(let checkY = y - 1; checkY >= 0; checkY--) {
      const checkTile = this.getTile(x, checkY);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;
      if(!this.canTileBeBroken(x, checkY)) return;

      verticalContinuity.unshift({ x, y: checkY });
    }

    for(let checkY = y + 1; checkY < this.settings.height; checkY++) {
      const checkTile = this.getTile(x, checkY);
      if(!checkTile) break;
      if(checkTile.color !== tile.color) break;
      if(!this.canTileBeBroken(x, checkY)) return;

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

      brokenTiles.forEach(({ x, y }) => {
        const tile = this.getTile(x, y);
        tile.isBreaking = true;
      });

      // wait for animation to finish, then push break
      await this.animBreak(brokenTiles);

      this.gainPauseFrames(brokenTiles.length);

      brokenTiles.forEach(({ x, y }) => {
        this.removeTile(x, y);
      });
    }
  }

  private async doGravity() {
    for(let y = this.settings.height - 1; y >= 0; y--) {

      for(let x = 0; x < this.settings.width; x++) {

        // if we have a tile here, we don't swap it down
        const tile = this.getTile(x, y);
        if(tile) continue;

        // if there is no next tile, we don't swap air with air
        const nextTile = this.getTile(x, y - 1);
        if(!nextTile) continue;

        // game NOT initialized - swap immediately for no animation
        this.swapPositions(x, y, x, y - 1, true);
      }
    }
  }

  // pause related
  public pause() {
    this.isPaused = true;
  }

  public unpause() {
    this.isPaused = false;
  }

  // animation related

  private async animSwap(leftTile: Tile, rightTile: Tile): Promise<any> {
    if(!this.hasInit) return;

    return new Promise(resolve => {
      setTimeout(async () => {
        await this.allAnimations;

        const allPromises = [];

        const styleChange = {
          transition: `all ${ANIM_DURATION}ms ease 0s`
        };

        if(leftTile) {
          const leftEl = <HTMLElement>document.querySelectorAll(`[tile-id="${leftTile.id}"]`)[0];
          _.extend(leftEl.style, styleChange);

          const leftAnim = (<any>leftEl).animate([
            { transform: 'translateX(0px)' },
            { transform: 'translateX(44px)' }
          ], { duration: ANIM_DURATION });

          const isLeftFinished = new Promise(resolve => leftAnim.onfinish = () => resolve());

          allPromises.push(isLeftFinished);
        }

        if(rightTile) {
          const rightEl = <HTMLElement>document.querySelectorAll(`[tile-id="${rightTile.id}"]`)[0];
          _.extend(rightEl.style, styleChange);

          const rightAnim = (<any>rightEl).animate([
            { transform: 'translateX(0px)' },
            { transform: 'translateX(-44px)' }
          ], { duration: ANIM_DURATION });

          const isRightFinished = new Promise(resolve => rightAnim.onfinish = () => resolve());

          allPromises.push(isRightFinished);
        }

        const promise = Promise.all(allPromises);

        this.allAnimations.push(promise);

        await promise;
        resolve();
      });
    });
  }

  private async animBreak(tiles: Vec2[]): Promise<any> {
    if(!this.hasInit) return;

    return new Promise(resolve => {
      setTimeout(async () => {
        await this.allAnimations;

        const styleChange = {
          transition: `all ${ANIM_DURATION}ms ease 0s`
        };

        const allElements = _.compact(tiles.map(({ x, y }) => {
          const el = <HTMLElement>document.querySelectorAll(`[x="${x}"][y="${y}"]`)[0];
          if(!el) return null;

          _.extend(el.style, styleChange);
          return el;
        }));

        if(allElements.length === 0) return;

        const allAnimations = allElements.map(el => {
          return (<any>el).animate([
            { transform: 'scale(1) rotate(0deg)' },
            { transform: 'scale(0.1) rotate(120deg)' }
          ], { duration: ANIM_DURATION });
        });

        const allPromises = allAnimations.map(anim => new Promise(resolve => anim.onfinish = resolve));

        const promise = Promise.all(allPromises);

        this.allAnimations.push(promise);

        await promise;
        resolve();
      })
    });
  }
}
