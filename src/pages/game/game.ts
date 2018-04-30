import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, ModalController, ViewController, NavParams } from 'ionic-angular';
import { Storage } from '@ionic/storage';
import { GameService } from './game-service';
import { Subscription } from 'rxjs/Subscription';

import { HomePage } from '../home/home';
import { GameStartingDifficulty, GameSpeed, Tile } from './game-models';

@IonicPage()
@Component({
  selector: 'page-game',
  templateUrl: 'game.html',
  providers: [GameService]
})
export class GamePage {

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
    private storage: Storage,
    private game: GameService
  ) {}

  ionViewDidLoad() {

    const speed = this.navParams.get('speed') || GameSpeed.Normal;
    const difficulty = this.navParams.get('difficulty') || GameStartingDifficulty.Normal;

    this.game.init({ speed, difficulty });

    this.move$ = this.game.$move.subscribe(({ offset }) => {
      this.offset = offset;
    });

    this.lose$ = this.game.$lose.subscribe(async () => {

      const scores = await this.storage.get('scores') || {};
      if(!scores[difficulty]) scores[difficulty] = 0;
      scores[difficulty] = Math.max(scores[difficulty], this.game.currentScore);
      await this.storage.set('scores', scores);

      this.showLoseModal();
    });
  }

  ionViewDidLeave() {
    this.move$.unsubscribe();
    this.lose$.unsubscribe();
  }

  swipeAny(tile: Tile, $event) {
    const dir = $event.deltaX < 0 ? -1 : 1;
    this.swipeTile(tile, dir);
  }

  swipeTile(tile: Tile, dir: -1|1) {
    this.game.swap(tile, dir);
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

  public pauseModal() {
    const modal = this.modalCtrl.create(
      PauseModal,
      {},
      { cssClass: 'shrunk-modal' }
    );

    this.game.pause();

    modal.onDidDismiss((val) => {
      this.game.unpause();

      if(!val) return;
      this.navCtrl.setRoot(HomePage);
    });

    modal.present();
  }

}

@Component({
  template: `
  <ion-header>
    <ion-navbar color="endliss">
      <ion-title>Paused</ion-title>
    </ion-navbar>
  </ion-header>

  <ion-content padding>
    <p>
      You've paused. You can resume, or quit, whichever suits your fancy.
    </p>

    <ion-row>
      <ion-col>
        <button ion-button full color="danger" (click)="quit()">
          Quit
        </button>
      </ion-col>

      <ion-col>
        <button ion-button full color="secondary" (click)="resume()">
          Resume
        </button>
      </ion-col>
    </ion-row>
  </ion-content>
  `
})
export class PauseModal {

  constructor(private viewCtrl: ViewController) {}

  quit() {
    this.viewCtrl.dismiss(true);
  }

  resume() {
    this.viewCtrl.dismiss();
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
      You've made a fatal mistake. But that's okay, you can try again. You broke <strong>{{ score | number }}</strong> blocks this time.
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
