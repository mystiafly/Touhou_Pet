const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('immersive mode is protected from fullscreen-game auto-hide', () => {
    const enterStart = mainSource.indexOf("ipcMain.on('enter-immersive-mode'");
    const exitStart = mainSource.indexOf("ipcMain.on('exit-immersive-mode'");
    assert.notEqual(enterStart, -1, 'enter-immersive-mode handler should exist');
    assert.ok(exitStart > enterStart, 'exit handler should follow enter handler');
    const enterHandler = mainSource.slice(enterStart, exitStart);
    assert.match(enterHandler, /autoHiddenByGame\s*=\s*false/);
    assert.match(enterHandler, /win\.show\(\)/);
    assert.match(enterHandler, /win\.focus\(\)/);

    const gameCheckLoop = mainSource.match(
        /const gameCheckTimer\s*=\s*setInterval\(\(\)\s*=>\s*\{[\s\S]*?\n\s*\},\s*1500\);/,
    )?.[0];
    assert.ok(gameCheckLoop, 'fullscreen-game check loop should exist');
    assert.equal(
        (gameCheckLoop.match(/if\s*\(win\.isImmersiveMode\)\s*return;/g) || []).length,
        2,
        'both the timer and its in-flight response must respect immersive mode',
    );
});
