import { Component, OnInit } from '@angular/core';
import { NavController } from 'ionic-angular';
import { GameSpeed, GameStartingDifficulty } from '../game/game-models';
import { Storage } from '@ionic/storage';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage implements OnInit {

  // TODO store score per difficulty and display it on the home page

  public get difficulties() {
    return [
      { label: 'Beginner',    scale: GameStartingDifficulty.Beginner },
      { label: 'Easy',        scale: GameStartingDifficulty.Easy },
      { label: 'Normal',      scale: GameStartingDifficulty.Normal },
      { label: 'Hard',        scale: GameStartingDifficulty.Hard },
      { label: 'Expert',      scale: GameStartingDifficulty.Expert },
      { label: 'Impossible',  scale: GameStartingDifficulty.Impossible }
    ];
  }

  public get speeds() {
    return [
      { label: 'Slowest',     scale: GameSpeed.Slowest },
      { label: 'Slow',        scale: GameSpeed.Slow },
      { label: 'Normal',      scale: GameSpeed.Normal },
      { label: 'Fast',        scale: GameSpeed.Fast },
      { label: 'Fastest',     scale: GameSpeed.Fastest }
    ];
  }

  public currentDifficulty: number;
  public currentSpeed: number;

  public get currentDifficultyString(): string {
    const diff = this.difficulties[this.currentDifficulty];
    if(!diff) return '???';

    return diff.label;
  }

  public get currentSpeedString(): string {
    const diff = this.speeds[this.currentSpeed];
    if(!diff) return '???';

    return diff.label;
  }

  public get difficultyScale(): GameStartingDifficulty {
    const diff = this.difficulties[this.currentDifficulty];
    if(!diff) return GameStartingDifficulty.Normal;

    return diff.scale;
  }

  public get speedScale(): GameSpeed {
    const diff = this.speeds[this.currentSpeed];
    if(!diff) return GameSpeed.Normal;

    return diff.scale;
  }

  constructor(
    public navCtrl: NavController,
    private storage: Storage
  ) {}

  async ngOnInit() {
    this.currentDifficulty = await this.storage.get('currentDifficulty') || 2;
    this.currentSpeed = await this.storage.get('currentSpeed') || 2;
  }

  public changeDifficulty(dir: -1|1) {
    if(this.currentDifficulty === 0 && dir === -1) {
      this.currentDifficulty = this.difficulties.length - 1;

    } else if(this.currentDifficulty === this.difficulties.length - 1 && dir === 1) {
      this.currentDifficulty = 0;

    } else {
      this.currentDifficulty = this.currentDifficulty + dir;

    }

    this.storage.set('currentDifficulty', this.currentDifficulty);
  }

  public changeSpeed(dir: -1|1) {
    if(this.currentSpeed === 0 && dir === -1) {
      this.currentSpeed = this.speeds.length - 1;

    } else if(this.currentSpeed === this.speeds.length - 1 && dir === 1) {
      this.currentSpeed = 0;

    } else {
      this.currentSpeed = this.currentSpeed + dir;

    }

    this.storage.set('currentSpeed', this.currentSpeed);
  }

  public startGame() {
    this.navCtrl.push('GamePage', { difficulty: this.difficultyScale, speed: this.speedScale });
  }

}
