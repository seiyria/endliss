import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, ModalController, ViewController, NavParams } from 'ionic-angular';
import { GameService } from './game-service';
import { Subscription } from 'rxjs/Subscription';
import { Vec2 } from './game-models';

import { HomePage } from '../home/home';

import * as _ from 'lodash';

const ANIM_DURATION = 250;

@IonicPage()
@Component({
  selector: 'page-game',
  templateUrl: 'game.html',
  providers: [GameService]
})
export class GamePage {

  private swap$: Subscription;
  private break$: Subscription;
  private fall$: Subscription;
  private move$: Subscription;
  private lose$: Subscription;

  public offset = 0;

  public get transformOffset(): string {
    return `translateY(${this.offset}px)`;
  }

  constructor(
    public navCtrl: NavController,
    public modalCtrl: ModalController,
    public navParams: NavParams,
    private game: GameService
  ) {}

  ionViewDidLoad() {

    const speed = this.navParams.get('speed');
    const difficulty = this.navParams.get('difficulty');

    this.game.init({ speed, difficulty });

    this.swap$ = this.game.$swap.subscribe(({ callback, leftTile, rightTile }) => {
      this.animSwap(callback, leftTile, rightTile);
    });

    this.break$ = this.game.$break.subscribe(({ callback, tiles }) => {
      this.animBreak(callback, tiles);
    });

    this.fall$ = this.game.$fall.subscribe(({ callback, tile }) => {
      this.animFall(callback, tile);
    });

    this.move$ = this.game.$move.subscribe(({ offset }) => {
      this.offset = offset;
    });

    this.lose$ = this.game.$lose.subscribe(() => {
      this.showLoseModal();
    });
  }

  ionViewDidLeave() {
    this.swap$.unsubscribe();
    this.break$.unsubscribe();
    this.fall$.unsubscribe();
    this.move$.unsubscribe();
    this.lose$.unsubscribe();
  }

  swipeTile(x: number, y: number, dir: -1|1) {
    this.game.swap(x, y, dir);
  }

  private showLoseModal() {
    const modal = this.modalCtrl.create(
      GameLoseModal, 
      { score: this.game.currentScore }, 
      { cssClass: 'shrunk-modal', enableBackdropDismiss: false }
    );

    modal.onDidDismiss(() => {
      this.navCtrl.setRoot(HomePage);
    });
    
    modal.present();
  }

  private async animSwap(callback: Function, leftTile: Vec2, rightTile: Vec2): Promise<void> {
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

    await Promise.all([isLeftFinished, isRightFinished]);

    callback();
  }

  private async animBreak(callback: Function, tiles: Vec2[]): Promise<void> {
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

    await Promise.all(allPromises);

    callback();
  }

  private async animFall(callback: Function, tile: Vec2): Promise<void> {
    const el = <HTMLElement>document.querySelectorAll(`[x="${tile.x}"][y="${tile.y}"]`)[0];

    const styleChange = {
      transition: `all ${ANIM_DURATION}ms ease 0s`
    };

    _.extend(el.style, styleChange);

    const anim = (<any>el).animate([
      { transform: 'translateY(0px)' },
      { transform: 'translateY(44px)' }
    ], { duration: ANIM_DURATION });

    await new Promise(resolve => anim.onfinish = () => resolve());

    callback();
  }

}

@Component({
  template: `
  <ion-header>
    <ion-navbar color="endliss">
      <ion-title>Oh No!</ion-title>
    </ion-navbar>
  </ion-header>

  <ion-content padding>
    <p>
      You've made a fatal mistake. But that's ok, you can try again. You broke <strong>{{ score | number }}</strong> blocks, though.
    </p>

    <button ion-button full color="secondary" (click)="tryAgain()">
      Try Again
    </button>
  </ion-content>
  `
})
export class GameLoseModal implements OnInit {
  public score: number;

  constructor(private navParams: NavParams, private viewCtrl: ViewController) {}

  ngOnInit() {
    this.score = this.navParams.get('score');
  }

  tryAgain() {
    this.viewCtrl.dismiss();
  }
}