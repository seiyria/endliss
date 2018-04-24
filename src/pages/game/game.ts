import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { GameService } from './game-service';

@IonicPage()
@Component({
  selector: 'page-game',
  templateUrl: 'game.html',
  providers: [GameService]
})
export class GamePage {

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private game: GameService
  ) {}

  ionViewDidLoad() {
    this.game.init();
  }

}
