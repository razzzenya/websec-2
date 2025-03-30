const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const spriteSheets = {}
const spriteDirections = {
    'down-left': { x: 0, y: 0, width: 30, height: 30 },
    'left': { x: 31, y: 0, width: 31, height: 30 },
    'up-left': { x: 64, y: 0, width: 31, height: 30 },
    'up': { x: 104, y: 0, width: 17, height: 30 },
    'up-right': { x: 130, y: 0, width: 31, height: 30 },
    'right': { x: 162, y: 0, width: 31, height: 30 },
    'down-right': { x: 192, y: 0, width: 31, height: 30 },
    'down': { x: 232, y:0, width: 17, height: 30 }
};

const socket = new WebSocket('ws://localhost:8080');
const keys = {};

let players = {};
let playerName = null;
let star = { x: 0, y: 0 };

const leaderboard = document.createElement('div');
leaderboard.id = 'leaderboard';
document.body.appendChild(leaderboard);

const playerScore = document.createElement('div');
playerScore.id = 'score';
playerScore.textContent = 'Your Score: 0';
document.body.appendChild(playerScore);

const modal = document.createElement('div');
modal.style.position = 'absolute';
modal.style.top = '50%';
modal.style.left = '50%';
modal.style.transform = 'translate(-50%, -50%)';
modal.style.backgroundColor = 'white';
modal.style.padding = '20px';
modal.style.border = '2px solid black';
modal.style.borderRadius = '15px';
modal.style.zIndex = 1000;

const nameInput = document.createElement('input');
nameInput.placeholder = 'Enter your name';
nameInput.style.font = '12px Comic Sans MS';
nameInput.style.padding = '5px';
modal.appendChild(nameInput);

const submitButton = document.createElement('button');
submitButton.textContent = 'Submit';
submitButton.style.font = '12px Comic Sans MS';
submitButton.style.marginLeft = '10px';
submitButton.style.padding = '5px';
submitButton.onclick = () => {
    if (nameInput.value.trim() !== '') {
        playerName = nameInput.value;
        socket.send(JSON.stringify({ type: 'setName', name: playerName }));
        nameInput.disabled = true;
        submitButton.disabled = true;
    }
};
modal.appendChild(submitButton);
document.body.appendChild(modal);

const statusMessage = document.createElement('p');
statusMessage.style.font = '12px Comic Sans MS';
modal.appendChild(statusMessage);

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'leaderboard') {
        leaderboard.innerHTML = '<h3>Leaderboard:</h3>';
        data.leaderboard.forEach((entry, index) => {
            leaderboard.innerHTML += `<p>${index + 1}. ${entry.name}: ${entry.score}</p>`;
        });
    }
    else if (data.type === 'nameSet') {
        playerName = data.name;
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
        console.log('Player name set:', playerName);
    }
    else if (data.type === 'nameTaken') {
        statusMessage.textContent = data.message;
        statusMessage.style.color = 'orange';
        nameInput.disabled = false;
        submitButton.disabled = false;
    }
    else if (data.type === 'connection') {
        nameInput.disabled = false;
        submitButton.disabled = false;
        statusMessage.textContent = 'You can join.';
        statusMessage.style.color = 'green';
        players = data.players;
        star = data.star;
        console.log('Connected as player');
    }
    else if (data.type === 'serverFull') {
        nameInput.disabled = true;
        submitButton.disabled = true;
        statusMessage.textContent = data.message;
        statusMessage.style.color = 'red';
        players = data.players;
        star = data.star;
        console.log('Connected as observer');
    }
    else {
        players = data.players;
        star = data.star;
    }

    if (playerName && players) {
        const currentPlayer = Object.values(players).find(player => player.name === playerName);
        if (currentPlayer) {
            playerScore.textContent = `Your Score: ${currentPlayer.score}`;
        }
    }
};

window.addEventListener('keydown', (e) => {
  if (!playerName) return;
  keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
  if (!playerName) return;
  keys[e.key] = false;
});

loadAllSprites();

function updateMovement() {
    if (!playerName || document.body.contains(modal)) return;
    if (keys['ArrowUp']) socket.send(JSON.stringify({ type: 'move', direction: 'up' }));
    if (keys['ArrowDown']) socket.send(JSON.stringify({ type: 'move', direction: 'down' }));
    if (keys['ArrowLeft']) socket.send(JSON.stringify({ type: 'move', direction: 'left' }));
    if (keys['ArrowRight']) socket.send(JSON.stringify({ type: 'move', direction: 'right' }));
}

function loadSprite(name, src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            console.log(`Sprite ${name} loaded`);
            spriteSheets[name] = img;
            resolve();
        };
        img.onerror = () => {
            console.error(`Failed to load sprite: ${name}`);
            reject(new Error(`Failed to load sprite: ${name}`));
        };
        img.src = src;
    });
}

async function loadAllSprites() {
    try {
        await Promise.all([
            loadSprite('red', 'assets/sprites/spritesheetred.png'),
            loadSprite('blue', 'assets/sprites/spritesheetblue.png'),
            loadSprite('green', 'assets/sprites/spritesheetgreen.png'),
            loadSprite('lapis', 'assets/sprites/spritesheetlapis.png'),
            loadSprite('yellow', 'assets/sprites/spritesheetyellow.png'),
            loadSprite('pink', 'assets/sprites/spritesheetpink.png'),
            loadSprite('orange', 'assets/sprites/spritesheetorange.png'),
            loadSprite('black', 'assets/sprites/spritesheetblack.png'),
            loadSprite('white', 'assets/sprites/spritesheetwhite.png'),
            loadSprite('purple', 'assets/sprites/spritesheetpurple.png'),
            loadSprite('star', 'assets/sprites/Star.png'),
        ]);
        console.log('All sprites loaded');
        draw();
    } catch (error) {
        console.error('Error loading sprites:', error);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
        spriteSheets['star'],
        3, 0, 26, 32,
        star.x - 13, star.y - 16, 26 * 1.3, 32 * 1.3
    );

    Object.values(players).forEach(player => {
        const direction = player.direction;
        const sprite = spriteDirections[direction];
    
        if (sprite) {
            const scale = 1.75;
            const spriteWidth = sprite.width * scale;
            const spriteHeight = sprite.height * scale;

            const drawX = player.x - spriteWidth / 2;
            const drawY = player.y - spriteHeight / 2;

            ctx.drawImage(
                spriteSheets[player.color],
                sprite.x, sprite.y, sprite.width, sprite.height,
                drawX, drawY, spriteWidth, spriteHeight
            );
        }

        ctx.fillStyle = 'black';
        ctx.font = '12px Comic Sans MS';
        ctx.fillText(player.name, player.x - 20, player.y - 25);
    });

    updateMovement();

    requestAnimationFrame(draw);
}