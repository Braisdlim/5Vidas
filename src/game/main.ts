import { Boot } from './scenes/Boot';
import { TableScene } from './scenes/TableScene';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { GAME_DIMENSIONS } from '../engine/constants';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: GAME_DIMENSIONS.WIDTH,
    height: GAME_DIMENSIONS.HEIGHT,
    parent: 'game-container',
    backgroundColor: '#0d1f15',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [
        Boot,
        Preloader,
        TableScene,
    ],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
