import { Scene } from 'phaser';
import { GAME_DIMENSIONS } from '../../engine/constants';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    init() {
        const cx = GAME_DIMENSIONS.WIDTH / 2;
        const cy = GAME_DIMENSIONS.HEIGHT / 2;

        // Dark background
        this.cameras.main.setBackgroundColor('#0d1f15');

        // Loading text
        this.add.text(cx, cy - 60, 'CINCO VIDAS', {
            fontFamily: 'Cinzel, serif',
            fontSize: '28px',
            color: '#E6B800',
        }).setOrigin(0.5);

        // Progress bar outline
        this.add.rectangle(cx, cy, 300, 24).setStrokeStyle(2, 0xe6b800);

        // Progress bar fill
        const bar = this.add.rectangle(cx - 146, cy, 4, 18, 0xe6b800);

        this.load.on('progress', (progress: number) => {
            bar.width = 4 + (292 * progress);
        });

        // Loading subtext
        this.add.text(cx, cy + 40, 'Preparando la baraja...', {
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            color: '#8faa9a',
        }).setOrigin(0.5);
    }

    preload() {
        this.load.setPath('assets');
        this.load.image('card-back', 'cards/spanish_deck/back.PNG');

        // Load Spanish Deck 1-40
        for (let i = 1; i <= 40; i++) {
            this.load.image(`card-${i}`, `cards/spanish_deck/${i}.PNG`);
        }
        // Load card atlas (will be created in the asset pipeline step)
        // Since assets are missing, we comment this out for now to avoid errors.
        // Uncomment when 'public/assets/cards' has valid png/json.
        // this.load.atlas('cards', 'cards/cards.png', 'cards/cards.json');
    }

    create() {
        this.scene.start('TableScene');
    }
}
