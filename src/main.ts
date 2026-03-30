// ── Main entry point ────────────────────────────────────────

import {
  GameState, createGameState, createTutorialState, drawCards, endPlayerTurn,
  drawBogeyCard, placeBogeyCard, playCardToPile, discardCard,
  getValidPiles, saveUndo, performUndo, resign, canPlayToPile,
  GamePhase,
} from './game.js';
import { Renderer } from './renderer.js';
import { AnimationSystem } from './animation.js';
import { Rank, Suit } from './card.js';
import {
  resumeAudio, playCardPlace, playCardFlip, playCardDraw,
  playShuffle, playWin, playLose, playUndo, playClick,
} from './audio.js';
import { cardName } from './card.js';

// ── App state ───────────────────────────────────────────────

let state: GameState = { phase: 'menu' } as GameState;
let selectedHandIndex: number | null = null;
let tutorialActive = false;
let tutorialStep = 0;

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const anims = new AnimationSystem();

// Flags to pace automatic transitions
let bogeyDelayTimer = 0;
let drawDelayTimer = 0;
let drawAnimating = false;

function phase(): GamePhase { return state.phase; }

// ── Input handling ──────────────────────────────────────────

function getCanvasPos(e: MouseEvent | Touch): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function handleClick(x: number, y: number): void {
  resumeAudio();

  if (renderer.shareDialogVisible) return;

  // ── Menu ──────────────────────────────────────────────────
  if (phase() === 'menu') {
    const btn = renderer.hitTestButton(x, y);
    if (btn) {
      playClick();
      if (btn.id === 'tutorial') {
        startTutorial();
      } else {
        startGame();
      }
    }
    return;
  }

  // ── End screens ───────────────────────────────────────────
  if (phase() === 'bogey_loss') {
    state.phase = 'game_over';
    state.message = "Game over.";
    return;
  }

  if (phase() === 'game_over' || phase() === 'game_won') {
    const btn = renderer.hitTestButton(x, y);
    if (btn?.id === 'restart') {
      playClick();
      state = { phase: 'menu' } as GameState;
    } else if (btn?.id === 'share') {
      playClick();
      renderer.showShareDialog(state);
    }
    return;
  }

  if (tutorialActive) {
    // Steps 0-3 advance with any click
    if (tutorialStep < 4) {
      tutorialStep++;
      return;
    }
    // Final step 8 returns to menu when clicked
    if (tutorialStep === 8) {
      tutorialActive = false;
      tutorialStep = 0;
      state = { phase: 'menu' } as GameState;
      selectedHandIndex = null;
      return;
    }
    // Step 4-7 require specific player interactions
  }

  // ── Buttons ───────────────────────────────────────────────
  const btn = renderer.hitTestButton(x, y);
  if (btn) {
    handleButton(btn.id);
    return;
  }

  // ── Discard pile (click to discard selected card) ────────
  if (phase() === 'player_turn' && selectedHandIndex !== null) {    // Tutorial step 4: Block discarding
    const discardArea = renderer.discardPileArea;
    if (discardArea && x >= discardArea.x && x < discardArea.x + discardArea.w &&
      y >= discardArea.y && y < discardArea.y + discardArea.h) {
      if (tutorialActive && tutorialStep === 4) {
        flashMessage('No discarding yet!');
      } else {
        const handPos = renderer.getHandCardPos(selectedHandIndex, state.hand.length);
        const discardPos = renderer.getDiscardPos();
        const card = state.hand[selectedHandIndex];
        playClick();
        saveUndo(state);
        discardCard(state, selectedHandIndex);
        renderer.addFlyingCard(card, handPos.x, handPos.y, discardPos.x, discardPos.y, {
          duration: 200, compact: true,
        });
        selectedHandIndex = null;
        return;
      }
    }
  }

  // ── Card interactions ─────────────────────────────────────
  const hit = renderer.hitTestCard(x, y);
  if (!hit) {
    // Clicked empty space — deselect
    selectedHandIndex = null;
    return;
  }

  if (phase() === 'player_turn') {
    if (hit.type === 'hand') {
      // Tutorial step 4: Only allow selecting Queen of Spades (index 4)
      if (tutorialActive && tutorialStep === 4) {
        if (hit.index === 4) {
          selectedHandIndex = 4;
        } else {
          flashMessage('Select the Queen');
        }
        return;
      }
      // Tutorial step 5: Only allow selecting Jack (index 0) or Queen (index 4)
      if (tutorialActive && tutorialStep === 5) {
        if (hit.index === 0 || hit.index === 4) {
          if (selectedHandIndex === hit.index) {
            selectedHandIndex = null;
          } else {
            selectedHandIndex = hit.index;
          }
        } else {
          flashMessage('Select the Jack or Queen');
        }
        return;
      }
      // Normal play
      if (selectedHandIndex === hit.index) {
        // Toggle off
        selectedHandIndex = null;
      } else {
        selectedHandIndex = hit.index;
      }
    } else if ((hit.type === 'pile' || hit.type === 'new_pile') && selectedHandIndex !== null) {
      // Direct play: card selected in hand → click a pile to place it
      const pileIdx = hit.index;
      const card = state.hand[selectedHandIndex];

      // Tutorial step 4: Only allow Queen to new pile
      if (tutorialActive && tutorialStep === 4) {
        if (card && card.rank === Rank.Queen && card.suit === Suit.Spades && pileIdx === state.piles.length) {
          saveUndo(state);
          playCardToPile(state, selectedHandIndex, pileIdx);
          playCardPlace();
          selectedHandIndex = null;
          tutorialStep = 5;
          return;
        } else if (pileIdx !== state.piles.length) {
          flashMessage('Play to a new pile');
          return;
        } else if (!card || card.rank !== Rank.Queen || card.suit !== Suit.Spades) {
          flashMessage('Only the Queen can be played in this step');
          return;
        }
      }

      if (card && getValidPiles(card, state.piles).includes(pileIdx)) {
        const handPos = renderer.getHandCardPos(selectedHandIndex, state.hand.length);
        const pileCardCount = pileIdx < state.piles.length ? state.piles[pileIdx].length : 0;
        saveUndo(state);
        playCardToPile(state, selectedHandIndex, pileIdx);
        const destPos = renderer.getPilePos(pileIdx, pileCardCount, state.piles.length);
        renderer.addFlyingCard(card, handPos.x, handPos.y, destPos.x, destPos.y, {
          duration: 200, compact: true,
        });
        playCardPlace();
        selectedHandIndex = null;

        // Tutorial progression
        if (tutorialActive && tutorialStep === 5 && card.rank === Rank.Jack && card.suit === Suit.Spades) {
          tutorialStep = 6;
        }
      } else {
        flashMessage("Can't play there");
      }
    }
  }

  if (phase() === 'bogey_place') {
    if (hit.type === 'pile' || hit.type === 'new_pile') {
      const pileIdx = hit.index;
      if (state.bogeyCard && getValidPiles(state.bogeyCard, state.piles).includes(pileIdx)) {
        const bogeyCard = state.bogeyCard;
        const { logicalW } = renderer.layout;
        const handY = renderer.layout.handStartY;
        const bx = logicalW / 2 - 35; // CARD_W/2
        const by = handY - 70 - 20;
        const pileCardCount = pileIdx < state.piles.length ? state.piles[pileIdx].length : 0;
        placeBogeyCard(state, pileIdx);
        const destPos = renderer.getPilePos(pileIdx, pileCardCount, state.piles.length);
        renderer.addFlyingCard(bogeyCard, bx, by, destPos.x, destPos.y, {
          duration: 250, compact: true,
        });
        playCardPlace();
        // Tutorial: Show completion message after bogey places card
        if (tutorialActive && tutorialStep === 7) {
          tutorialStep = 8;
          state.message = 'You\'ve learned the basics!';
          state.messageTimer = 120;
        }
        if (phase() === 'game_won') {
          playWin();
        }
      } else {
        flashMessage("Can't place there");
      }
    }
  }
}

function handleButton(id: string): void {
  playClick();
  switch (id) {
    case 'end_turn':
      selectedHandIndex = null;
      // Tutorial progression: Step 6 -> Step 7
      if (tutorialActive && tutorialStep === 6) {
        tutorialStep = 7;
        state.message = 'Now the Bogey plays its card...';
        state.messageTimer = 120;
      }
      endPlayerTurn(state);
      bogeyDelayTimer = 8; // brief pause before bogey plays
      break;
    case 'undo':
      if (performUndo(state)) {
        playUndo();
        selectedHandIndex = null;
      }
      break;
    case 'resign':
      resign(state);
      playLose();
      break;
  }
}

// ── Game flow ───────────────────────────────────────────────

function startGame(): void {
  tutorialActive = false;
  tutorialStep = 0;
  state = createGameState();
  selectedHandIndex = null;
  bogeyDelayTimer = 0;
  drawDelayTimer = 5; // brief pause then auto-draw
  drawAnimating = false;
}

function startTutorial(): void {
  tutorialActive = true;
  tutorialStep = 0;
  state = createTutorialState();
  selectedHandIndex = null;
  bogeyDelayTimer = 0;
  drawDelayTimer = 0;
  drawAnimating = false;
}

function flashMessage(msg: string): void {
  state.message = msg;
  state.messageTimer = 90;
}

// ── Game loop ───────────────────────────────────────────────

function update(): void {
  // Tick message timer
  if (state.messageTimer > 0) {
    state.messageTimer--;
    if (state.messageTimer <= 0) {
      state.message = '';
    }
  }

  // Tutorial progression: Step 6 -> Step 7 on End Turn
  if (tutorialActive && tutorialStep === 6) {
    // When End Turn is called from handleButton, we'll advance to step 7
  }

  // Auto-draw phase
  if (phase() === 'player_draw') {
    if (drawDelayTimer > 0) {
      drawDelayTimer--;
    } else if (!drawAnimating) {
      const deckPos = renderer.getDeckPos();
      const drawn = drawCards(state);
      if (drawn.length > 0) {
        playCardDraw();
        drawAnimating = true;
        // Animate each drawn card from deck to its final hand position.
        // Use current hand length after draw so partial draws are placed correctly.
        const totalHand = state.hand.length;
        const firstDrawnIndex = totalHand - drawn.length;
        for (let i = 0; i < drawn.length; i++) {
          const handPos = renderer.getHandCardPos(firstDrawnIndex + i, totalHand);
          renderer.addFlyingCard(drawn[i], deckPos.x, deckPos.y, handPos.x, handPos.y, {
            duration: 200 + i * 60,
          });
        }
      }
      // If hand is empty and nothing to draw, still move to player_turn
      state.phase = 'player_turn';
    }
  }

  // Bogey auto-play delay
  const startPhase = phase();
  if (startPhase === 'bogey_turn') {
    if (bogeyDelayTimer > 0) {
      bogeyDelayTimer--;
    } else {
      const card = drawBogeyCard(state);
      if (card) {
        playCardFlip();
        if (phase() === 'bogey_loss') {
          playLose();
        }
      } else {
        // No cards left to draw — game should be won or we handle edge case
        if (phase() !== 'game_won') {
          // Edge case: all cards are in hand/discard/table
          // Just go back to player turn
          state.phase = 'player_draw';
          drawDelayTimer = 5;
        } else {
          playWin();
        }
      }
    }
  }

  anims.update(performance.now());

  // Clear deal animation flag when flying cards finish
  if (drawAnimating && !renderer.hasFlyingCards()) {
    drawAnimating = false;
  }
}

function render(): void {
  if (phase() === 'menu') {
    renderer.renderMenu();
  } else if (phase() === 'game_over' || phase() === 'game_won') {
    renderer.renderEndScreen(state);
  } else {
    renderer.renderGame(state, selectedHandIndex, drawAnimating);
    renderer.drawFlyingCards();
    if (tutorialActive) {
      renderer.renderTutorialOverlay(state, tutorialStep);
    }
  }
}

function gameLoop(): void {
  update();
  render();
  renderer.updateFlyingCards(); // update AFTER drawing so cards render at final position before removal
  requestAnimationFrame(gameLoop);
}

// ── Event listeners ─────────────────────────────────────────

let touchHandled = false;

canvas.addEventListener('click', (e: MouseEvent) => {
  if (touchHandled) {
    touchHandled = false;
    return;
  }
  const pos = getCanvasPos(e);
  handleClick(pos.x, pos.y);
  render(); // immediate visual feedback
});

canvas.addEventListener('touchend', (e: TouchEvent) => {
  e.preventDefault();
  touchHandled = true;
  if (e.changedTouches.length > 0) {
    const pos = getCanvasPos(e.changedTouches[0]);
    handleClick(pos.x, pos.y);
    render(); // immediate visual feedback
  }
}, { passive: false });

// Cursor style
canvas.addEventListener('mousemove', (e: MouseEvent) => {
  const pos = getCanvasPos(e);
  const overButton = renderer.hitTestButton(pos.x, pos.y);
  const overCard = renderer.hitTestCard(pos.x, pos.y);
  canvas.style.cursor = (overButton || overCard) ? 'pointer' : 'default';
});

window.addEventListener('resize', () => {
  renderer.updateLayout();
});

// ── Start ───────────────────────────────────────────────────

gameLoop();
