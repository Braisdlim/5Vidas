import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class CardSchema extends Schema {
    @type("string") id: string = "";
    @type("string") suit: string = "";
    @type("number") rank: number = 0;
}

export class PlayedCardSchema extends Schema {
    @type("string") playerId: string = "";
    @type(CardSchema) card: CardSchema = new CardSchema();
}

export class PlayerSchema extends Schema {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("number") lives: number = 5;
    @type([CardSchema]) hand = new ArraySchema<CardSchema>();
    @type("number") handSize: number = 0;
    @type("boolean") isEliminated: boolean = false;
    @type("boolean") isConnected: boolean = true;
    @type("number") prediction: number = -1;
    @type("number") tricksWon: number = 0;
    @type("number") seatIndex: number = 0;
    @type("string") color: string = "#fff";
    @type("boolean") isBot: boolean = false;
}

export class CincoVidasState extends Schema {
    @type("string") phase: string = "lobby";
    @type([PlayerSchema]) players = new ArraySchema<PlayerSchema>();
    @type("number") currentRound: number = 0;
    @type("number") cardsThisRound: number = 5;
    @type("number") dealerIndex: number = 0;
    @type("number") activePlayerIndex: number = 0;
    @type([PlayedCardSchema]) currentTrick = new ArraySchema<PlayedCardSchema>();
    @type("number") trickNumber: number = 1;
    @type("string") winnerId: string = "";
    @type("number") turnTimer: number = 15;
}
