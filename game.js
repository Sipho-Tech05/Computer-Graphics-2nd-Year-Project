//Game constants
const GRAVITY = 0.9;
const BOUNCE_FORCE = -10; 
const BALL_RADIUS = 12;
const SCORE_INCREMENT = 0.25;
const PLATFORM_HEIGHT = 30;
const OBSTACLE_SPEED = 10;
const MIN_GAP = 150;
const MAX_GAP = 300;
const OBSTACLE_WIDTH = 100;
const OBSTACLE_SPACING = 300;

//Game variables
let canvas, webgl;
let ballY, ballVelocity, ballX;
let score = 0;
let bestScore = 0;
let gameOver = false;
let gameStarted = false;
let lastTime = 0;
let lastObstacleTime = 0;
let obstacles = [];
let stars = [];

//Texture Variables
let obstacleTexture;
let textureProgram, texturePositionAttribute, textureCoordAttribute;
let textureUniform, textureCoordBuffer;
let shaderProgram, positionAttribute, colorUniform;
let vertexBuffer, indexBuffer;

//Pause variable
let isPaused = false;

//Colour of objects to render
const COLORS = {
    BALL: [0.2, 0.6, 1.0, 1.0],
    PLATFORM: [0.4, 0.4, 0.4, 1.0],
    OBSTACLE: [1.0, 1.0, 1.0, 1.0],
    STAR: [1.0, 1.0, 1.0, 1.0],
    BACKGROUND: [0.0, 0.0, 0.0, 1.0]
};

//Initialize WebGL with texture support
function initWebGL() { 
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error(`Canvas element not found`);
        return false;
    }
    
    canvas.width = 800;
    canvas.height = 700;
    
    try {
        webgl = canvas.getContext('webgl');
    } catch (e) {
        console.error('WebGL not supported', e);
        return false;
    }
    
    if (!webgl) {
        console.error('WebGL not supported');
        return false;
    }
    
    webgl.viewport(0, 0, canvas.width, canvas.height);
    webgl.clearColor(...COLORS.BACKGROUND);
    
    // Original shaders
    const vertexShaderSource = `
        attribute vec2 aPosition;
        void main() {
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `;
    
    const fragmentShaderSource = `
        precision mediump float;
        uniform vec4 uColor;
        void main() {
            gl_FragColor = uColor;
        }
    `;
    
    const vertexShader = compileShader(webgl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(webgl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return false;
    
    shaderProgram = webgl.createProgram();
    webgl.attachShader(shaderProgram, vertexShader);
    webgl.attachShader(shaderProgram, fragmentShader);
    webgl.linkProgram(shaderProgram);
    
    if (!webgl.getProgramParameter(shaderProgram, webgl.LINK_STATUS)) {
        console.error('Shader program failed to link:', webgl.getProgramInfoLog(shaderProgram));
        return false;
    }
    
    positionAttribute = webgl.getAttribLocation(shaderProgram, 'aPosition');
    colorUniform = webgl.getUniformLocation(shaderProgram, 'uColor');
    
    //Texture shader
    const textureVertexShaderSource = `
        attribute vec2 aPosition;
        attribute vec2 aTextureCoord;
        varying vec2 vTextureCoord;
        void main() {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vTextureCoord = aTextureCoord;
        }
    `;
    
    const textureFragmentShaderSource = `
        precision mediump float;
        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        void main() {
            gl_FragColor = texture2D(uSampler, vTextureCoord);
        }
    `;
    
    const textureVertexShader = compileShader(webgl.VERTEX_SHADER, textureVertexShaderSource);
    const textureFragmentShader = compileShader(webgl.FRAGMENT_SHADER, textureFragmentShaderSource);

    if (!textureVertexShader || !textureFragmentShader) return false;
    
    textureProgram = webgl.createProgram();
    webgl.attachShader(textureProgram, textureVertexShader);
    webgl.attachShader(textureProgram, textureFragmentShader);
    webgl.linkProgram(textureProgram);
    
    texturePositionAttribute = webgl.getAttribLocation(textureProgram, 'aPosition');
    textureCoordAttribute = webgl.getAttribLocation(textureProgram, 'aTextureCoord');
    textureUniform = webgl.getUniformLocation(textureProgram, 'uSampler');
    
    vertexBuffer = webgl.createBuffer();
    indexBuffer = webgl.createBuffer();
    textureCoordBuffer = webgl.createBuffer();
    
    // Loading asteroid texture
    loadTexture('asteroid2.jpeg');
    
    return true;
}

// Compiling Shaders
function compileShader(type, source) {
    const shader = webgl.createShader(type);
    webgl.shaderSource(shader, source);
    webgl.compileShader(shader);
    
    if (!webgl.getShaderParameter(shader, webgl.COMPILE_STATUS)) {
        console.error('Shader compile error:', webgl.getShaderInfoLog(shader));
        return null;
    }
    
    return shader;
}
//ADD SOUND FUNCTIONALITY
    let sound = new Audio("./ambient-soundscapes-003-space-atmosphere-303242");
    sound.play();
    
// Function to load texture
function loadTexture(url) {
    const image = new Image();
    image.onload = function() {
        obstacleTexture = webgl.createTexture();
        webgl.bindTexture(webgl.TEXTURE_2D, obstacleTexture);
        webgl.texImage2D(webgl.TEXTURE_2D, 0, webgl.RGBA, webgl.RGBA, webgl.UNSIGNED_BYTE, image);
        webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MIN_FILTER, webgl.LINEAR);
        webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_S, webgl.CLAMP_TO_EDGE);
        webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_T, webgl.CLAMP_TO_EDGE);
    };
    image.src = url;
}

//Function to draw textured rectangles
function drawTexturedRect(x, y, width, height) {
    if (!obstacleTexture) {
        drawRect(x, y, width, height, COLORS.OBSTACLE); // Fallback colour declared at first
        return;
    }
    
    const x1 = (x / canvas.width) * 2 - 1;
    const y1 = 1 - (y / canvas.height) * 2;
    const x2 = ((x + width) / canvas.width) * 2 - 1;
    const y2 = 1 - ((y + height) / canvas.height) * 2;
    
    const vertices = [x1, y1, x2, y1, x2, y2, x1, y2];
    const texCoords = [0, 0, 1, 0, 1, 1, 0, 1];
    const indices = [0, 1, 2, 0, 2, 3];
    
    webgl.useProgram(textureProgram);
    
    webgl.bindBuffer(webgl.ARRAY_BUFFER, vertexBuffer);
    webgl.bufferData(webgl.ARRAY_BUFFER, new Float32Array(vertices), webgl.STATIC_DRAW);
    webgl.enableVertexAttribArray(texturePositionAttribute);
    webgl.vertexAttribPointer(texturePositionAttribute, 2, webgl.FLOAT, false, 0, 0);
    
    webgl.bindBuffer(webgl.ARRAY_BUFFER, textureCoordBuffer);
    webgl.bufferData(webgl.ARRAY_BUFFER, new Float32Array(texCoords), webgl.STATIC_DRAW);
    webgl.enableVertexAttribArray(textureCoordAttribute);
    webgl.vertexAttribPointer(textureCoordAttribute, 2, webgl.FLOAT, false, 0, 0);
    
    webgl.activeTexture(webgl.TEXTURE0);
    webgl.bindTexture(webgl.TEXTURE_2D, obstacleTexture);
    webgl.uniform1i(textureUniform, 0);
    
    webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    webgl.bufferData(webgl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), webgl.STATIC_DRAW);
    webgl.drawElements(webgl.TRIANGLES, indices.length, webgl.UNSIGNED_SHORT, 0);
    
    webgl.useProgram(shaderProgram);
}

//Original function to draw rectangle
function drawRect(x, y, width, height, color) {
    const x1 = (x / canvas.width) * 2 - 1;
    const y1 = 1 - (y / canvas.height) * 2;
    const x2 = ((x + width) / canvas.width) * 2 - 1;
    const y2 = 1 - ((y + height) / canvas.height) * 2;
    
    const vertices = [x1, y1, x2, y1, x2, y2, x1, y2];
    const indices = [0, 1, 2, 0, 2, 3];
    
    webgl.bindBuffer(webgl.ARRAY_BUFFER, vertexBuffer);
    webgl.bufferData(webgl.ARRAY_BUFFER, new Float32Array(vertices), webgl.STATIC_DRAW);
    
    webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    webgl.bufferData(webgl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), webgl.STATIC_DRAW);
    
    webgl.enableVertexAttribArray(positionAttribute);
    webgl.vertexAttribPointer(positionAttribute, 2, webgl.FLOAT, false, 0, 0);
    
    webgl.uniform4fv(colorUniform, color);
    webgl.drawElements(webgl.TRIANGLES, indices.length, webgl.UNSIGNED_SHORT, 0);
}

//Fuunction to draw circle
function drawCircle(x, y, radius, color) {
    const segments = 16;
    const vertices = [];
    const indices = [];

    vertices.push((x / canvas.width) * 2 - 1, 1 - (y / canvas.height) * 2);
    
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const vx = (x + Math.cos(angle) * radius) / canvas.width * 2 - 1;
        const vy = 1 - (y + Math.sin(angle) * radius) / canvas.height * 2;
        vertices.push(vx, vy);
        
        if (i > 0) {
            indices.push(0, i, i + 1);
        }
    }
    
    webgl.bindBuffer(webgl.ARRAY_BUFFER, vertexBuffer);
    webgl.bufferData(webgl.ARRAY_BUFFER, new Float32Array(vertices), webgl.STATIC_DRAW);
    
    webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    webgl.bufferData(webgl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), webgl.STATIC_DRAW);
    
    webgl.enableVertexAttribArray(positionAttribute);
    webgl.vertexAttribPointer(positionAttribute, 2, webgl.FLOAT, false, 0, 0);
    
    webgl.uniform4fv(colorUniform, color);
    webgl.drawElements(webgl.TRIANGLES, indices.length, webgl.UNSIGNED_SHORT, 0);
}

//Function to draw Star on background
function drawStar(x, y, size, color) {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.4;
    const vertices = [];
    const indices = [];
    
    vertices.push((x / canvas.width) * 2 - 1, 1 - (y / canvas.height) * 2);

    for (let i = 0; i < spikes * 2; i++) {
        const angle = (i / (spikes * 2)) * Math.PI * 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const vx = (x + Math.cos(angle) * radius) / canvas.width * 2 - 1;
        const vy = 1 - (y + Math.sin(angle) * radius) / canvas.height * 2;
        vertices.push(vx, vy);
        
        if (i > 0) {
            indices.push(0, i, i + 1);
        }
    }
    indices.push(0, spikes * 2 - 1, 1);
    
    webgl.bindBuffer(webgl.ARRAY_BUFFER, vertexBuffer);
    webgl.bufferData(webgl.ARRAY_BUFFER, new Float32Array(vertices), webgl.STATIC_DRAW);
    
    webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    webgl.bufferData(webgl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), webgl.STATIC_DRAW);
    
    webgl.enableVertexAttribArray(positionAttribute);
    webgl.vertexAttribPointer(positionAttribute, 2, webgl.FLOAT, false, 0, 0);
    
    webgl.uniform4fv(colorUniform, color);
    webgl.drawElements(webgl.TRIANGLES, indices.length, webgl.UNSIGNED_SHORT, 0);
}

//Function that initialize gameplay making sure all objects fits withing the specified canvas
function initGame() {
    ballX = canvas.width / 2;
    ballY = canvas.height / 2;
    ballVelocity = 0;
    score = 0;
    gameOver = false;
    gameStarted = false;
    lastTime = 0;
    lastObstacleTime = 0;
    obstacles = [];
    
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: 1 + Math.random() * 2,
            speed: 0.1 + Math.random() * 0.3
        });
    }
    
    document.getElementById('score-display').textContent = 'Score: 0';
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
}

function bounce() {
    if (!gameStarted) {
        gameStarted = true;
        document.getElementById('start-screen').style.display = 'none';
        lastTime = Date.now();
        lastObstacleTime = Date.now();
        return;
    }
    
    if (gameOver) return;
    
    ballVelocity = BOUNCE_FORCE;
}

//Function to generate game obstacles
function generateObstacles() {
    const now = Date.now();
    
    if (now - lastObstacleTime > 1500 && 
        (obstacles.length === 0 || 
         (canvas.width - obstacles[obstacles.length-1].x) > OBSTACLE_SPACING)) {
        
        const gap = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
        const gapY = Math.random() * (canvas.height - PLATFORM_HEIGHT * 2 - gap - 100) + PLATFORM_HEIGHT + 50;
        
        obstacles.push({
            x: canvas.width,
            topHeight: gapY,
            bottomY: gapY + gap,
            passed: false,
            speed: OBSTACLE_SPEED * (1 + score / 500)
        });
        
        lastObstacleTime = now;
    }
}

//Function to update the rendering of objects on screen
function update() {
    if (!gameStarted || gameOver || isPaused) return;
    
    const currentTime = Date.now();
    score += SCORE_INCREMENT * (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    document.getElementById('score-display').textContent = 'Score: ' + Math.floor(score);
    
    ballVelocity += GRAVITY;
    ballY += ballVelocity;
    
    generateObstacles();
    
    stars.forEach(star => {
        star.x -= star.speed;
        if (star.x < 0) {
            star.x = canvas.width;
            star.y = Math.random() * canvas.height;
        }
    });
    
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= obstacles[i].speed;
        
        if (!obstacles[i].passed && obstacles[i].x + OBSTACLE_WIDTH < ballX - BALL_RADIUS) {
            obstacles[i].passed = true;
            score += 5;
            document.getElementById('score-display').textContent = 'Score: ' + Math.floor(score);
        }
        
        if (ballX + BALL_RADIUS > obstacles[i].x &&
            ballX - BALL_RADIUS < obstacles[i].x + OBSTACLE_WIDTH &&
            (ballY - BALL_RADIUS < obstacles[i].topHeight || 
             ballY + BALL_RADIUS > obstacles[i].bottomY)) {
            endGame();
            break;
        }
        
        if (obstacles[i].x + OBSTACLE_WIDTH < 0) obstacles.splice(i, 1);
    }
    
    if (ballY - BALL_RADIUS < PLATFORM_HEIGHT) {
        ballY = PLATFORM_HEIGHT + BALL_RADIUS;
        ballVelocity = BOUNCE_FORCE * 0.7;
    }
    
    if (ballY + BALL_RADIUS > canvas.height - PLATFORM_HEIGHT) {
        ballY = canvas.height - PLATFORM_HEIGHT - BALL_RADIUS;
        ballVelocity = BOUNCE_FORCE * 0.7;
    }
}

//Function that controls the end-game screen that pops up
function endGame() {
    gameOver = true;
    bestScore = Math.max(bestScore, Math.floor(score));
    document.getElementById('final-score').textContent = Math.floor(score);
    document.getElementById('best-score').textContent = bestScore;
    document.getElementById('game-over').style.display = 'flex';
}

// Modified render function to use textures for obstacles
function render() {
    webgl.clear(webgl.COLOR_BUFFER_BIT);
    
    stars.forEach(star => {
        drawStar(star.x, star.y, star.size, COLORS.STAR);
    });
    
    obstacles.forEach(obs => {
        drawTexturedRect(obs.x, 0, OBSTACLE_WIDTH, obs.topHeight);
        drawTexturedRect(obs.x, obs.bottomY, OBSTACLE_WIDTH, canvas.height - obs.bottomY);
    });
    
    drawCircle(ballX, ballY, BALL_RADIUS, COLORS.BALL);
    
    drawRect(0, 0, canvas.width, PLATFORM_HEIGHT, COLORS.PLATFORM);
    drawRect(0, canvas.height - PLATFORM_HEIGHT, canvas.width, PLATFORM_HEIGHT, COLORS.PLATFORM);
}

//Function to keep on rendering objects on canvas
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}
//Function to control pause/resume Logic
function gameLoop() {
    if (!isPaused) {
        update();
    }
    render();
    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        bounce();
    } else if (e.code === 'KeyP') {
        isPaused = !isPaused;

        const pauseButton = document.getElementById(`pause-btn`);
        pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';        
    }
});

//Function to start game and use space to start bouncing
function startGame() {
    if (initWebGL()) {
        initGame();

         document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') bounce();
        });

        canvas.addEventListener('click', bounce);
        
        document.getElementById('restart-btn').addEventListener('click', () => {
           initGame();
            document.getElementById('game-over').style.display = 'none';
            window.location.href = 'landingCover.html';
        });  //Issue fixed
        
        gameLoop();
    } else {
        document.getElementById('start-screen').innerHTML = `
            <h1 style="color:black ">WebGL Not Supported</h1>
        `;
    }
}

window.addEventListener('load', startGame);