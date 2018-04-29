import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, ModalController, ViewController, NavParams } from 'ionic-angular';
import { GameService } from './game-service';
import { Subscription } from 'rxjs/Subscription';
import { Vec2 } from './game-models';

import { HomePage } from '../home/home';

import * as _ from 'lodash';

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
    private game: GameService
  ) {}

  ionViewDidLoad() {

    const speed = this.navParams.get('speed');
    const difficulty = this.navParams.get('difficulty');

    this.game.init({ speed, difficulty });

    this.move$ = this.game.$move.subscribe(({ offset }) => {
      this.offset = offset;
    });

    this.lose$ = this.game.$lose.subscribe(() => {
      this.showLoseModal();
    });
  }

  ionViewDidLeave() {
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

  private pauseModal() {
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