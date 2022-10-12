"use strict";

// assets
var csvSrc = "res/csv/atlas.csv";
var atlasSrc = "res/img/atlas.png";

// physics
var xVel = -4;
var gravity = 1.5;
var flapVel = -14;
var maxFallVel = 15;

// bird
var birdX = 69;
var birdStartY = 236;
var birdWidth = 25;
var birdHeight = 15;
var birdRenderOffsetX = -11;
var birdRenderOffsetY = -18;

// bird animation
var sineWaveA = 15;
var sineWaveT = 45;
var swingT = 5;

// pipe
var pipeWidth = 48;
var pipeHeight = 320;
var pipeSpacing = 172;
var pipeGap = 90;
var pipeStartX = 360;
var pipeRandomBoundary = 50;

// land
var landStartX = 0;
var landWidth = 288;
var landY = 400;

// ql
var qlAlpha = 0.6;
var qlGamma = 0.8;
var qlDownSampling = 10;
var qlAliveReward = 1;
var qlDeadReward = -1000;

var avgSampleRange = 20;

// init fps
var inverseDefaultFPS = 1000 / 40;

// dead animation
var deadFlashFrame = 5;

// play ui
var playingScoreMidX = 144;
var playingScoreY = 41;
var playingScoreSpacing = 22;

// game over ui
var gameOverTextX = 40;
var gameOverTextY = 123;
var gameOverPanelX = 24;
var gameOverPanelY = 195;
var panelScoreRightX = 218;
var panelScoreY = 231;
var panelMaxScoreY = 272;
var panelScoreSpacing = 16;
var medalX = 55;
var medalY = 240;

// ready ui
var tutorialX = 88;
var tutorialY = 218;
var readyTextX = 46;
var readyTextY = 146;

function first(v) {
    return v.length > 0 ? v[0] : null;
}

function second(v) {
    return v.length > 1 ? [1] : null;
}

function last(v) {
    return v[v.length - 1];
}

function max(v) {
    if (!v || v.length === 0) return null;

    var index = 0;
    for (var i = 1; i < v.length; ++i) {
        index = v[i] > v[index] ? i : index;
    }
    return v[index];
}

function translate(startPos, vel, time) {
    return Math.floor(time * vel + startPos);
}

function apply(x, funcs) {
    funcs.forEach(function (f) {
        x = f(x);
    });
    return x;
}

function startingState() {
    return {
        mode: "ready",
        startFrame: 0,
        flapFrame: 0,
        birdY: birdStartY,
        birdVel: 0,
        curFrame: 0,
        birdSprite: 0,
        round: 0,
        score: 0,
        totalScore: 0,
        maxScore: 0,
        deadFlash: 0,
        fps: 0,
        pipeList: [],
        landList: [],
        stateSeq: [],
        scoreRecord: [],
    };
}

function resetState(gameState) {
    var round = gameState.round;
    var curFrame = gameState.curFrame;
    var totalScore = gameState.totalScore;
    var maxScore = gameState.maxScore;
    var scoreRecord = gameState.scoreRecord;

    var gameState = startingState();

    gameState.startFrame = curFrame;
    gameState.curFrame = curFrame;
    gameState.round = round + 1;
    gameState.totalScore = totalScore;
    gameState.maxScore = maxScore;
    gameState.scoreRecord = scoreRecord;

    return gameState;
}

function curPipePos(curFrame, pipe) {
    return translate(pipe.startX, xVel, curFrame - pipe.startFrame);
}

function curLandPos(curFrame, land) {
    return translate(land.startX, xVel, curFrame - land.startFrame);
}

function inPipe(pipe) {
    return birdX + birdWidth >= pipe.curX && birdX < pipe.curX + pipeWidth;
}

function inPipeGap(birdY, pipe) {
    return pipe.gapTop < birdY && (pipe.gapTop + pipeGap) > birdY + birdHeight;
}

function hitUpperPile(birdY, pipe) {
    return inPipe(pipe) && birdY <= pipe.gapTop;
}

function hitCeil(birdY) {
    return birdY <= 0;
}

function getFirstPipe(pipeList) {
    var pipeList = pipeList.filter(function (pipe) {
        return birdX < pipe.curX + pipeWidth;
    }).sort(function (a, b) {
        return a.curX - b.curX;
    });

    return first(pipeList);
}

function hitCeilOrUpperPile(gameState) {
    var pipeList = gameState.pipeList;
    var birdY = gameState.birdY;
    var firstPipe = getFirstPipe(pipeList);

    return (firstPipe ? hitUpperPile(birdY, firstPipe) : false) || hitCeil(birdY);
}

function collideGroundOrCeil(birdY) {
    return birdY + birdHeight >= landY || birdY <= 0;
}

function updateCollision(gameState) {
    var birdY = gameState.birdY;
    var pipeList = gameState.pipeList;

    if (collideGroundOrCeil(birdY)) {
        gameState.mode = "dead";
    } else if (pipeList.some(function (pipe) {
        return (inPipe(pipe) && !inPipeGap(birdY, pipe));
    })) {
        gameState.mode = "dead";
    }

    return gameState;
}

function newPipe(curFrame, startX) {
    return {
        startFrame: curFrame,
        startX: startX,
        curX: startX,
        gapTop: Math.floor(pipeRandomBoundary + Math.random() * (landY - pipeGap - 2 * pipeRandomBoundary))
    };
}

function newLand(curFrame, startX) {
    return {
        startFrame: curFrame,
        startX: startX,
        curX: startX,
    };
}

function updatePipes(gameState) {
    if (gameState.mode != "playing") return gameState;

    var curFrame = gameState.curFrame;
    var pipeList = gameState.pipeList.map(function (pipe) {
        pipe.curX = curPipePos(curFrame, pipe);
        return pipe;
    }).filter(function (pipe) {
        return pipe.curX > -pipeWidth;
    }).sort(function (a, b) {
        return a.curX - b.curX;
    });

    while (pipeList.length < 3) {
        var lastPipe = last(pipeList);
        pipeList.push(newPipe(curFrame, lastPipe ? lastPipe.curX + pipeSpacing : pipeStartX));
    }

    gameState.pipeList = pipeList;
    return gameState;
}

function updateLand(gameState) {
    if (gameState.mode == "dead") return gameState;

    var curFrame = gameState.curFrame;
    var landList = gameState.landList.map(function (land) {
        land.curX = curLandPos(curFrame, land);
        return land;
    }).filter(function (land) {
        return land.curX > -landWidth;
    }).sort(function (a, b) {
        return a.curX - b.curX;
    });

    while (landList.length < 2) {
        var lastLand = last(landList);
        landList.push(newLand(curFrame, lastLand ? lastLand.curX + landWidth : landStartX));
    }

    gameState.landList = landList;
    return gameState;
}

function animation(gameState) {
    var mode = gameState.mode;
    var curFrame = gameState.curFrame;

    if (mode === "ready" || mode === "playing") {
        gameState.birdSprite = Math.floor(curFrame / swingT) % 3;
    }

    if (mode === "ready") {
        gameState.birdY = birdStartY + sineWaveA * Math.sin(curFrame * Math.PI * 2 / sineWaveT);
    }

    if (mode === "dead") {
        gameState.deadFlash += 1;
    }

    return gameState;
}

function updateBird(gameState) {
    var curFrame = gameState.curFrame;
    var flapFrame = gameState.flapFrame;
    var birdY = gameState.birdY;
    var mode = gameState.mode;
    if (mode === "playing") {
        var curVel = Math.min(flapVel + gravity * (curFrame - flapFrame), maxFallVel);
        var newY = Math.min(birdY + curVel, landY - birdHeight);
        var newY = Math.max(newY, -birdHeight);
        gameState.birdY = newY;
        gameState.birdVel = curVel;
    }

    return animation(gameState);
}

function updateGameScore(gameState) {
    if (gameState.mode == "playing") {
        var curFrame = gameState.curFrame;
        var startFrame = gameState.startFrame;
        var distance = (curFrame - startFrame) * Math.abs(xVel) + (pipeWidth + birdWidth) * 0.5;
        var newScore = Math.max(Math.floor((distance - pipeStartX + pipeSpacing) / pipeSpacing), 0);
        if (newScore - gameState.score === 1) {
            gameState.score += 1;
            gameState.totalScore += 1;
            gameState.maxScore = Math.max(gameState.score, gameState.maxScore);
        }
    }

    return gameState;
}

function flap(gameState) {
    var mode = gameState.mode;
    var curFrame = gameState.curFrame;

    if (mode === "playing") {
        gameState.flapFrame = curFrame;
    }

    if (mode === "ready" || (mode === "dead")) {
        gameState = resetState(gameState);
        gameState.startFrame = curFrame;
        gameState.mode = "playing";
        if (mode === "ready") {
            gameState.round = 0;
            gameState.scoreRecord = [];
        }
    }

    return gameState;
}

function getQLState(gameState) {
    var pipeList = gameState.pipeList;
    var birdY = gameState.birdY;

    var firstPipe = getFirstPipe(pipeList);
    var S = [birdY, gameState.birdVel];

    if (firstPipe) {
        S = [firstPipe.curX - birdX, firstPipe.gapTop - birdY, gameState.birdVel];
    }

    return S.map(x => Math.floor(x / qlDownSampling));
}

function updateScoreBoard(gameState) {
    var round = gameState.round;

    scoreChart.series[0].addPoint([round, gameState.score]);

    if (round < avgSampleRange - 1) { return; }

    var arrLen = gameState.scoreRecord.length;
    var scoreRecord = gameState.scoreRecord.slice(arrLen - avgSampleRange, arrLen);

    var tempSum = scoreRecord.reduce(function (a, b) { return a + b; }, 0);
    scoreChart.series[1].addPoint([round, tempSum / avgSampleRange]);
}

function updateQL(gameState) {
    if (gameState.mode === "ready") { return gameState; }

    if (!updateQL.Q) {
        updateQL.Q = {};
        updateQL.S = null;
    }

    var Q = updateQL.Q;

    // prev state
    var S = updateQL.S;
    // prev action
    var A = updateQL.A;
    // current state
    var S_ = getQLState(gameState);

    if (S_ && !(S_ in Q)) Q[S_] = [0, 0];

    if (gameState.mode == "playing") {
        updateQL.S = S_;

        // current action, 0 for stay, 1 for flap
        var A_ = Q[S_][0] >= Q[S_][1] ? 0 : 1;

        if (A_ === 1) gameState = flap(gameState);
        updateQL.A = A_;

        gameState.stateSeq.push([S_, A_]);
    } else if (gameState.mode == "dead" && gameState.deadFlash === 0) {
        // gameState.deadFlash === 0: no deadflash displayed
        gameState.scoreRecord = gameState.scoreRecord.concat([gameState.score]);

        if (!(S in Q)) {
            Q[S] = [0, 0];
        }

        Q[S][A] = (1 - qlAlpha) * Q[S][A] + qlAlpha * qlDeadReward;

        var flapPenalty = false;
        if (hitCeilOrUpperPile(gameState)) {
            flapPenalty = true;
        }

        for (var i = gameState.stateSeq.length - 2; i >= 0; i--) {
            var [vS, vA] = gameState.stateSeq[i];
            var [nextS, _] = gameState.stateSeq[i + 1];

            if (flapPenalty && vA === 1) {
                Q[vS][vA] = (1 - qlAlpha) * Q[vS][vA] + qlAlpha * qlDeadReward;
                flapPenalty = false;
            }
            else {
                Q[vS][vA] = (1 - qlAlpha) * Q[vS][vA] + qlAlpha * (qlAliveReward + qlGamma * max(Q[nextS]));
            }
        }

        updateQL.S = null;
        updateQL.A = null;
        updateQL.Q = Q;

        updateScoreBoard(gameState);

        // restart the game
        gameState = flap(gameState);
    }

    return gameState;
}

function update(gameState, frameStamp) {
    gameState.curFrame = frameStamp;
    gameState.deltaTime = frameStamp - gameState.flapFrame;

    return apply(gameState, [
        updateLand,
        updateBird,
        updatePipes,
        updateGameScore,
        updateCollision,
        updateQL,
    ]);
}

function drawSprite(renderFunc, spriteName, x, y) {
    var sprite = renderFunc.sprites[spriteName]
    renderFunc.ctx.drawImage(renderFunc.image, sprite[2], sprite[3], sprite[0], sprite[1], x, y, sprite[0], sprite[1]);
}

function renderMainCanvas(gameState) {
    if (!renderMainCanvas.cvs || !renderMainCanvas.ctx) {
        renderMainCanvas.cvs = document.getElementById("mainGame");
        renderMainCanvas.ctx = renderMainCanvas.cvs.getContext("2d");
        renderMainCanvas.image = new Image();
        renderMainCanvas.sprites = {};
        renderMainCanvas.resourcesLoaded = false;
        renderMainCanvas.ctx.font = renderMainCanvas.ctx.font.replace(/\d+px/, "14px");

        renderMainCanvas.image.addEventListener("load", function () {
            fetch(csvSrc)
                .then(response => response.text())
                .then(csvData => {
                    csvData.split('\n').forEach(function (line) {
                        let values = line.split(' ');
                        renderMainCanvas.sprites[values[0]] = [
                            Math.round(parseInt(values[1], 10)),
                            Math.round(parseInt(values[2], 10)),
                            Math.round(parseFloat(values[3]) * renderMainCanvas.image.width),
                            Math.round(parseFloat(values[4]) * renderMainCanvas.image.height)
                        ];
                    });
                    renderMainCanvas.resourcesLoaded = true;
                });
        });
        renderMainCanvas.image.src = atlasSrc;
    }

    var ctx = renderMainCanvas.ctx;

    if (!renderMainCanvas.resourcesLoaded) { return; }

    // clear
    ctx.fillRect(0, 0, renderMainCanvas.cvs.width, renderMainCanvas.cvs.height);

    // draw background
    drawSprite(renderMainCanvas, "bg_day", 0, 0);

    // draw pipes
    gameState.pipeList.forEach(function (pipe) {
        drawSprite(renderMainCanvas, "pipe_down", pipe.curX, pipe.gapTop - pipeHeight) // v
        drawSprite(renderMainCanvas, "pipe_up", pipe.curX, pipe.gapTop + pipeGap); // ^
    });

    // draw land
    gameState.landList.forEach(function (land) {
        drawSprite(renderMainCanvas, "land", land.curX, landY);
    });

    // draw bird
    var birdY = gameState.birdY;
    var birdSprite = gameState.birdSprite;
    drawSprite(renderMainCanvas, "bird0_" + birdSprite, birdX + birdRenderOffsetX, birdY + birdRenderOffsetY);

    if (gameState.mode === "playing") {
        // draw score
        var score = gameState.score.toString();
        for (var i = 0; i < score.length; ++i) {
            var digit = score[i];
            drawSprite(renderMainCanvas, "font_0" + (48 + parseInt(digit)), playingScoreMidX + (i - score.length / 2) * playingScoreSpacing, playingScoreY)
        }
    } else if (gameState.mode === "ready") {
        drawSprite(renderMainCanvas, "text_ready", readyTextX, readyTextY);
        drawSprite(renderMainCanvas, "tutorial", tutorialX, tutorialY);
    } else if (gameState.mode === "dead") {
        drawSprite(renderMainCanvas, "text_game_over", gameOverTextX, gameOverTextY);
        drawSprite(renderMainCanvas, "score_panel", gameOverPanelX, gameOverPanelY);

        // draw score
        var score = gameState.score.toString();
        for (var i = 0; i < score.length; ++i) {
            var digit = score[score.length - i - 1];
            drawSprite(renderMainCanvas, "number_score_0" + digit, panelScoreRightX - i * panelScoreSpacing, panelScoreY);
        }

        // draw max score
        var maxScore = gameState.maxScore.toString();
        for (var i = 0; i < maxScore.length; ++i) {
            var digit = maxScore[maxScore.length - i - 1];
            drawSprite(renderMainCanvas, "number_score_0" + digit, panelScoreRightX - i * panelScoreSpacing, panelMaxScoreY);
        }

        // draw medal
        var medal;
        if (score >= 30) medal = "3";
        else if (score >= 20) medal = "2";
        else if (score >= 10) medal = "1";
        else if (score >= 5) medal = "0";
        if (medal)
            drawSprite(renderMainCanvas, "medals_" + medal, medalX, medalY);

        if (gameState.deadFlash < deadFlashFrame) {
            ctx.globalAlpha = 1 - gameState.deadFlash / deadFlashFrame;
            ctx.fillRect(0, 0, renderMainCanvas.cvs.width, renderMainCanvas.cvs.height);
            ctx.globalAlpha = 1.0;
        }
    }
}

function renderDistantMap(gameState) {
    if (!renderDistantMap.cvs || !renderDistantMap.ctx) {
        renderDistantMap.cvs = document.getElementById("distanceMap");
        renderDistantMap.ctx = renderDistantMap.cvs.getContext("2d");
        renderDistantMap.image = new Image();
        renderDistantMap.sprites = {};
        renderDistantMap.resourcesLoaded = false;
        renderDistantMap.ctx.font = "20px Georgia";

        renderDistantMap.image.addEventListener("load", function () {
            fetch(csvSrc)
                .then(response => response.text())
                .then(csvData => {
                    csvData.split('\n').forEach(function (line) {
                        let values = line.split(' ');
                        renderDistantMap.sprites[values[0]] = [
                            Math.round(parseInt(values[1], 10)),
                            Math.round(parseInt(values[2], 10)),
                            Math.round(parseFloat(values[3]) * renderDistantMap.image.width),
                            Math.round(parseFloat(values[4]) * renderDistantMap.image.height)
                        ];
                    });
                    renderDistantMap.resourcesLoaded = true;
                });
        });
        renderDistantMap.image.src = atlasSrc;
    }

    var ctx = renderDistantMap.ctx;

    if (!renderDistantMap.resourcesLoaded) { return; }

    // clear
    ctx.fillStyle = window.getComputedStyle(renderDistantMap.cvs).getPropertyValue("background-color");
    ctx.fillRect(0, 0, renderDistantMap.cvs.width, renderDistantMap.cvs.height);

    if (gameState.pipeList.length > 0) {
        gameState.pipeList.forEach(function (pipe, index) {
            if (pipe.curX > renderDistantMap.cvs.width) { return; }

            var colorDepth = 1;

            if (pipe.curX > birdX) {
                colorDepth = 1 - (pipe.curX - birdX) / renderDistantMap.cvs.width;
            }
            else if (birdX > pipe.curX + pipeWidth) {
                colorDepth = 1 - (birdX - (pipe.curX + pipeWidth)) / renderDistantMap.cvs.width;
            }

            colorDepth = Math.pow(colorDepth, 2);

            ctx.fillStyle = "rgba(119, 152, 191, " + colorDepth + ")";
            ctx.fillRect(pipe.curX, pipe.gapTop,
                pipeWidth, pipeGap);
        });

        var firstPipe = getFirstPipe(gameState.pipeList);
        var [adjustedBirdX, adjustedBirdY] = [birdX + birdWidth, gameState.birdY + 0.3 * birdHeight];

        if (adjustedBirdX < firstPipe.curX) {
            ctx.setLineDash([5, 3]);
            ctx.strokeStyle = "rgba(0, 0, 0, 1)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(adjustedBirdX, adjustedBirdY);
            ctx.lineTo(firstPipe.curX, firstPipe.gapTop + pipeGap);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(100, 132, 237, 0.9)";
            ctx.beginPath();
            ctx.moveTo(adjustedBirdX, adjustedBirdY);
            ctx.lineTo(firstPipe.curX, adjustedBirdY);

            ctx.fillStyle = ctx.strokeStyle;
            ctx.fillText('dx',
                (adjustedBirdX + firstPipe.curX) / 2,
                adjustedBirdY + 20);

            ctx.stroke();

            ctx.strokeStyle = "rgba(223, 83, 83, 0.8)";
            ctx.beginPath();
            ctx.moveTo(firstPipe.curX, adjustedBirdY);
            ctx.lineTo(firstPipe.curX, firstPipe.gapTop + pipeGap);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fillText('dy',
                firstPipe.curX + 5,
                (adjustedBirdY + firstPipe.gapTop + pipeGap) / 2);

            ctx.stroke();
        }
    }

    // draw bird
    var birdY = gameState.birdY;
    var birdSprite = gameState.birdSprite;
    drawSprite(renderDistantMap, "bird0_" + birdSprite, birdX + birdRenderOffsetX, birdY + birdRenderOffsetY);
}

var gameState = startingState();

window.addEventListener("keydown", function (e) {
    if (e.keyCode != 32) { return; }
    e.preventDefault();

    if (gameState.mode === "ready") {
        gameState = flap(gameState);
    }
});

mainGame.addEventListener("mousedown", function (e) {
    e.preventDefault();

    if (gameState.mode === "ready") {
        gameState = flap(gameState);
    }
});

mainGame.addEventListener("touchstart", function (e) {
    e.preventDefault();

    if (gameState.mode === "ready") {
        gameState = flap(gameState);
    }
});

function gameLoop() {
    if (!gameLoop.timeScale) {
        gameLoop.timeScale = 1;
        gameLoop.frameCount = 0;
        gameLoop.lastTime = (new Date).getTime();
    }

    gameState = update(gameState, gameLoop.frameCount++);
    renderMainCanvas(gameState);
    renderDistantMap(gameState);

    // draw fps
    var curTime = (new Date).getTime();
    var lastTime = gameLoop.lastTime;
    gameLoop.lastTime = curTime;
    renderMainCanvas.ctx.fillText(Math.floor(1000 / (curTime - lastTime)) + 'fps', 15, 25);

    gameLoop.eachFrame.update(gameState);

    setTimeout(gameLoop, inverseDefaultFPS / gameLoop.timeScale);
}

gameLoop.eachFrame = function (cb) {
    if (!gameLoop.eachFrame.callbacks) {
        gameLoop.eachFrame.callbacks = [];
    }
    gameLoop.eachFrame.callbacks.push(cb);
}

gameLoop.eachFrame.update = function (gameState) {
    (gameLoop.eachFrame.callbacks || []).forEach(function (cb) {
        cb(gameState);
    });
}

gameLoop.start = function () {
    setTimeout(gameLoop, inverseDefaultFPS);
}

var scoreChart = Highcharts.chart('scoreChart', {
    chart: {
        type: 'scatter',
        zoomType: 'xy',
    },
    title: {
        text: 'Scoreboard'
    },
    subtitle: {
        text: ''
    },
    legend: {
        layout: 'vertical',
        itemStyle: {
            fontWeight: 'lighter',
        }
    },
    xAxis: {
        title: {
            enabled: true,
            text: 'round'
        },
        startOnTick: true,
        endOnTick: true,
        showLastLabel: true,
        allowDecimals: false,
        min: 0,
    },
    yAxis: {
        title: {
            text: 'score'
        },
        allowDecimals: false,
        min: 0,
    },
    plotOptions: {
        scatter: {
            states: {
                hover: {
                    marker: {
                        enabled: false
                    }
                }
            },
            tooltip: {
                headerFormat: '<b>{series.name}</b><br>',
                pointFormat: 'round {point.x}: {point.y}'
            }
        }
    },
    series: [
        {
            name: 'score',
            color: 'rgba(119, 152, 191, 0.8)',
            data: [],
            marker: {
                radius: 1.5,
            },
        },
        {
            name: "avg (last " + avgSampleRange + " rounds)",
            color: 'rgba(223, 83, 83, 0.8)',
            data: [],
            marker: {
                radius: 1,
            },
            lineWidth: 2,
        }
    ]
});

console.log("bird.js loaded");
