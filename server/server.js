const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const players = {};
const observers = [];
let star = { x: Math.random() * 800, y: Math.random() * 600 };
let playerCounter = 0;
const maxSpeed = 7;
const maxPlayers = 10;
const availableColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'lapis', 'white', 'black'];
const usedColors = new Set();

function getRandomPosition() {
    return {
        x: Math.floor(Math.random() * 750),
        y: Math.floor(Math.random() * 550)
    };
}

function assignRandomColor() {
    const freeColors = availableColors.filter(color => !usedColors.has(color));
    const randomIndex = Math.floor(Math.random() * freeColors.length);
    const assignedColor = freeColors[randomIndex];
    usedColors.add(assignedColor);
    return assignedColor;
}

function releaseColor(color) {
    usedColors.delete(color);
}

function broadcastLeaderboard() {
    const leaderboard = Object.values(players)
        .sort((a, b) => b.score - a.score)
        .map(player => ({ name: player.name, score: player.score }));

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'leaderboard', leaderboard }));
        }
    });
}

function getDirection(player) {
    const { speedX, speedY } = player;
    
    if (Math.abs(speedX) < 0.1 && Math.abs(speedY) < 0.1) {
        return player.direction;
    }

    const angle = Math.atan2(speedY, speedX) * (180 / Math.PI);

    if (angle >= -22.5 && angle < 22.5) return 'right';
    if (angle >= 22.5 && angle < 67.5) return 'down-right';
    if (angle >= 67.5 && angle < 112.5) return 'down';
    if (angle >= 112.5 && angle < 157.5) return 'down-left';
    if (angle >= 157.5 || angle < -157.5) return 'left';
    if (angle >= -157.5 && angle < -112.5) return 'up-left';
    if (angle >= -112.5 && angle < -67.5) return 'up';
    if (angle >= -67.5 && angle < -22.5) return 'up-right';
}


function handleMovement(player, direction) {
    const acceleration = 0.5;
    if (!player) return;
    if (direction === 'up') player.accelerationY = -acceleration;
    if (direction === 'down') player.accelerationY = acceleration;
    if (direction === 'left') player.accelerationX = -acceleration;
    if (direction === 'right') player.accelerationX = acceleration;
}

function updatePlayerPhysics(player) {
    const friction = 0.05;

    player.speedX += player.accelerationX || 0;
    player.speedY += player.accelerationY || 0;

    player.speedX *= 1 - friction;
    player.speedY *= 1 - friction;

    player.speedX = Math.max(-maxSpeed, Math.min(maxSpeed, player.speedX));
    player.speedY = Math.max(-maxSpeed, Math.min(maxSpeed, player.speedY));

    player.x += player.speedX;
    player.y += player.speedY;

    player.accelerationX = 0;
    player.accelerationY = 0;

    if (player.x < 0 || player.x > 780) {
        player.speedX *= -0.5;
        player.x = Math.max(0, Math.min(780, player.x));
    }
    if (player.y < 0 || player.y > 580) {
        player.speedY *= -0.5;
        player.y = Math.max(0, Math.min(580, player.y));
    }
    player.direction = getDirection(player);
}

function checkCollisionsBetweenPlayers() {
    const playersArray = Object.values(players);

    for (let i = 0; i < playersArray.length; i++) {
        for (let j = i + 1; j < playersArray.length; j++) {
            const playerA = playersArray[i];
            const playerB = playersArray[j];

            const dx = playerA.x - playerB.x;
            const dy = playerA.y - playerB.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 40) {
                const tempSpeedX = playerA.speedX;
                const tempSpeedY = playerA.speedY;

                playerA.speedX = playerB.speedX;
                playerA.speedY = playerB.speedY;

                playerB.speedX = tempSpeedX;
                playerB.speedY = tempSpeedY;

                const overlap = 40 - distance;
                const adjustX = (dx / distance) * overlap / 2;
                const adjustY = (dy / distance) * overlap / 2;

                playerA.x += adjustX;
                playerA.y += adjustY;
                playerB.x -= adjustX;
                playerB.y -= adjustY;
            }
        }
    }
}

setInterval(() => {
    Object.values(players).forEach(player => {
        player.score = 0;
    });
    broadcastLeaderboard();
}, 10 * 60 * 1000); // сбрасываю каждые 10 минут

wss.on('connection', (ws) => {
    if (Object.keys(players).length >= maxPlayers) {
        observers.push(ws);
        ws.send(JSON.stringify({ type: 'serverFull', message: 'Server is full', players, star }));
    } else {
        const playerId = `player-${++playerCounter}`;
        ws.playerId = playerId;
        const spawnPosition = getRandomPosition();
        players[playerId] = {
            id: playerId,
            x: spawnPosition.x,
            y: spawnPosition.y,
            speedX: 0,
            speedY: 0,
            name: '',
            color: assignRandomColor(),
            score: 0,
            direction: 'up',
            accelerationX: 0,
            accelerationY: 0
        };
        ws.send(JSON.stringify({ type: 'connection', players, star }));
        broadcastLeaderboard()
    }

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const playerId = ws.playerId;

        if (!playerId || !players[playerId]) {
            return;
        }

        if (data.type === 'move') {
            handleMovement(players[playerId], data.direction);
        }
        if (data.type === 'setName' && data.name && data.name.trim()) {
            const name = data.name.trim();
            const nameExists = Object.values(players).some(player => player.name === name);
            if (nameExists) {
                ws.send(JSON.stringify({ type: 'nameTaken', message: 'This name is already taken. Please choose another one.' }));
            } 
            else {
                players[playerId].name = name;
                ws.send(JSON.stringify({ type: 'nameSet', name }));
            }
        }
    });

    ws.on('close', () => {
        const playerId = ws.playerId;
        if (playerId) {
            releaseColor(players[playerId].color);
            delete players[playerId];
            if (observers.length > 0) {
                const observerWs = observers.shift();
                const newPlayerId = `player-${++playerCounter}`;
                observerWs.playerId = newPlayerId;
                const spawnPosition = getRandomPosition();
                players[newPlayerId] = {
                    id: newPlayerId,
                    x: spawnPosition.x,
                    y: spawnPosition.y,
                    speedX: 0,
                    speedY: 0,
                    name: '',
                    color: assignRandomColor(),
                    score: 0,
                    direction: 'up',
                    accelerationX: 0,
                    accelerationY: 0
                };
                observerWs.send(JSON.stringify({ type: 'connection', players, star }));
                broadcastLeaderboard();
                observerWs.on('message', (message) => {
                    const data = JSON.parse(message);
                    const playerId = observerWs.playerId;

                    if (data.type === 'move' && players[playerId]) {
                        handleMovement(players[playerId], data.direction);
                    }

                    if (data.type === 'setName' && data.name && data.name.trim() && players[playerId]) {
                        players[playerId].name = data.name.trim();
                    }
                });
            }
        }

        if (Object.keys(players).length === 0) {
            clearInterval(wss.gameLoop);
            wss.gameLoop = null;
        }
    });

    if (!wss.gameLoop) {
        wss.gameLoop = setInterval(() => {
            Object.values(players).forEach(player => {
                updatePlayerPhysics(player);
            });
    
            checkCollisionsBetweenPlayers();
    
            Object.values(players).forEach(player => {
                if (Math.abs(player.x - star.x) < 20 && Math.abs(player.y - star.y) < 20) {
                    player.score += 1;
                    star = getRandomPosition();
                    broadcastLeaderboard();
                }
            });
    
            const gameState = { players, star };
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(gameState));
                }
            });
        }, 1000 / 60);
    }
});