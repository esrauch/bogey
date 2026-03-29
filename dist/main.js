// ── Main entry point ────────────────────────────────────────
import { createGameState, drawCards, endPlayerTurn, drawBogeyCard, placeBogeyCard, playCardToColumn, discardCard, getValidColumns, saveUndo, performUndo, resign, } from './game.js';
import { Renderer } from './renderer.js';
import { AnimationSystem } from './animation.js';
import { playCardPlace, playCardFlip, playCardDraw, playWin, playLose, playUndo, playClick, } from './audio.js';
// ── App state ───────────────────────────────────────────────
let state = { phase: 'menu' };
let selectedHandIndex = null;
let placingHandIndex = null; // hand card being placed onto a column
const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const anims = new AnimationSystem();
// Flags to pace automatic transitions
let bogeyDelayTimer = 0;
let drawDelayTimer = 0;
let drawAnimating = false;
function phase() { return state.phase; }
// ── Input handling ──────────────────────────────────────────
function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}
function handleClick(x, y) {
    //resumeAudio();
    // ── Menu ──────────────────────────────────────────────────
    if (phase() === 'menu') {
        const btn = renderer.hitTestButton(x, y);
        if (btn) {
            playClick();
            startGame(btn.id);
        }
        return;
    }
    // ── End screens ───────────────────────────────────────────
    if (phase() === 'game_over' || phase() === 'game_won') {
        const btn = renderer.hitTestButton(x, y);
        if (btn?.id === 'restart') {
            playClick();
            state = { phase: 'menu' };
        }
        return;
    }
    // ── Buttons ───────────────────────────────────────────────
    const btn = renderer.hitTestButton(x, y);
    if (btn) {
        handleButton(btn.id);
        return;
    }
    // ── Discard pile (click to discard selected card) ────────
    if (phase() === 'player_turn' && selectedHandIndex !== null) {
        const discardArea = renderer.discardPileArea;
        if (discardArea && x >= discardArea.x && x < discardArea.x + discardArea.w &&
            y >= discardArea.y && y < discardArea.y + discardArea.h) {
            playClick();
            saveUndo(state);
            discardCard(state, selectedHandIndex);
            selectedHandIndex = null;
            return;
        }
    }
    // ── Card interactions ─────────────────────────────────────
    const hit = renderer.hitTestCard(x, y);
    if (!hit) {
        // Clicked empty space — deselect
        selectedHandIndex = null;
        placingHandIndex = null;
        return;
    }
    if (phase() === 'player_turn') {
        if (hit.type === 'hand') {
            if (selectedHandIndex === hit.index) {
                // Toggle off
                selectedHandIndex = null;
            }
            else {
                selectedHandIndex = hit.index;
            }
        }
        else if ((hit.type === 'column' || hit.type === 'new_column') && selectedHandIndex !== null) {
            // Direct play: card selected in hand → click a column to place it
            const colIdx = hit.index;
            const card = state.hand[selectedHandIndex];
            if (card && getValidColumns(card, state.columns).includes(colIdx)) {
                saveUndo(state);
                playCardToColumn(state, selectedHandIndex, colIdx);
                playCardPlace();
                selectedHandIndex = null;
            }
            else {
                flashMessage("Can't play there");
            }
        }
    }
    if (phase() === 'bogey_place') {
        if (hit.type === 'column' || hit.type === 'new_column') {
            const colIdx = hit.index;
            if (state.bogeyCard && getValidColumns(state.bogeyCard, state.columns).includes(colIdx)) {
                placeBogeyCard(state, colIdx);
                playCardPlace();
                if (phase() === 'game_won') {
                    playWin();
                }
            }
            else {
                flashMessage("Can't place there");
            }
        }
    }
}
function handleButton(id) {
    playClick();
    switch (id) {
        case 'end_turn':
            selectedHandIndex = null;
            placingHandIndex = null;
            endPlayerTurn(state);
            bogeyDelayTimer = 8; // brief pause before bogey plays
            break;
        case 'undo':
            if (performUndo(state)) {
                playUndo();
                selectedHandIndex = null;
                placingHandIndex = null;
            }
            break;
        case 'resign':
            resign(state);
            playLose();
            break;
    }
}
// ── Game flow ───────────────────────────────────────────────
function startGame(difficulty) {
    state = createGameState(difficulty);
    selectedHandIndex = null;
    placingHandIndex = null;
    bogeyDelayTimer = 0;
    drawDelayTimer = 5; // brief pause then auto-draw
    drawAnimating = false;
}
function flashMessage(msg) {
    state.message = msg;
    state.messageTimer = 90;
}
// ── Game loop ───────────────────────────────────────────────
function update() {
    // Tick message timer
    if (state.messageTimer > 0) {
        state.messageTimer--;
        if (state.messageTimer <= 0) {
            state.message = '';
        }
    }
    // Auto-draw phase
    if (phase() === 'player_draw') {
        if (drawDelayTimer > 0) {
            drawDelayTimer--;
        }
        else if (!drawAnimating) {
            const drawn = drawCards(state);
            if (drawn.length > 0) {
                playCardDraw();
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
        }
        else {
            const card = drawBogeyCard(state);
            if (card) {
                playCardFlip();
                if (phase() === 'game_over') {
                    playLose();
                }
            }
            else {
                // No cards left to draw — game should be won or we handle edge case
                if (phase() !== 'game_won') {
                    // Edge case: all cards are in hand/discard/table
                    // Just go back to player turn
                    state.phase = 'player_draw';
                    drawDelayTimer = 5;
                }
                else {
                    playWin();
                }
            }
        }
    }
    anims.update(performance.now());
}
function render() {
    if (phase() === 'menu') {
        renderer.renderMenu();
    }
    else if (phase() === 'game_over' || phase() === 'game_won') {
        renderer.renderEndScreen(state);
    }
    else {
        renderer.renderGame(state, selectedHandIndex, placingHandIndex);
    }
}
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}
// ── Event listeners ─────────────────────────────────────────
let touchHandled = false;
canvas.addEventListener('click', (e) => {
    if (touchHandled) {
        touchHandled = false;
        return;
    }
    const pos = getCanvasPos(e);
    handleClick(pos.x, pos.y);
    render(); // immediate visual feedback
});
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchHandled = true;
    if (e.changedTouches.length > 0) {
        const pos = getCanvasPos(e.changedTouches[0]);
        handleClick(pos.x, pos.y);
        render(); // immediate visual feedback
    }
}, { passive: false });
// Cursor style
canvas.addEventListener('mousemove', (e) => {
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
//# sourceMappingURL=main.js.map