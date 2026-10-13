/*
  PACMAN — учебная версия игры.

  # = стена.
  . = точка.
  P = старт игрока.
  E = старт врага.
  Нужно собрать все точки.
  После первого уровня открывается второй.
  На каждом уровне по три врага.
*/

import { useCallback, useEffect, useMemo, useState } from "react";

// Размер одной клетки лабиринта.
const CELL = 32;
// Размер героя.
const PACMAN_SIZE = 24;
// Размер врага.
const ENEMY_SIZE = 24;
// Скорость движения героя.
const TICK = 115;
// Сколько действует защита.
const POWER_TIME = 7000;
// Количество жизней в начале.
const START_LIVES = 3;

/*
  # = стена
  . = точка
  P = игрок
  E = враг
*/
// Все уровни игры. У каждого своя карта.
// Здесь описаны два простых лабиринта.
// Второй уровень специально отличается от первого.
const LEVELS = [
  {
    id: 1,
    name: "NEON DISTRICT",
    subtitle: "Ночной квартал",
    theme: {
      page: "#070914",
      board: "#05060d",
      wall: "#2563eb",
      wallGlow: "none",
      accent: "#fff",
      pellet: "#e0f2fe",
      power: "#facc15",
    },
    map: [
      "###################",
      "#P....#.....#....E#",
      "#.###.#.###.#.###.#",
      "#.....#...#.#.....#",
      "#.###.###.#.###.#.#",
      "#...#.....#.....#.#",
      "###.#.###.#####.#.#",
      "#...#...#...#...#.#",
      "#.#####.#.#.#.###.#",
      "#.......#.#.#.....#",
      "#.#####.#.#.#####.#",
      "#.....#...#.......#",
      "#.###.#####.#####.#",
      "#E..#.........#..E#",
      "###################",
    ],
  },
  {
    id: 2,
    name: "OLD HARBOR",
    subtitle: "Портовый лабиринт",
    theme: {
      page: "#061014",
      board: "#041014",
      wall: "#2563eb",
      wallGlow: "none",
      accent: "#fff",
      pellet: "#ccfbf1",
      power: "#fbbf24",
    },
    map: [
      "###################",
      "#P...........#...E#",
      "#.#.#.#####.#.#.#.#",
      "#.#.#.....#.#.#.#.#",
      "#...#####.#...#...#",
      "###.......#####.###",
      "#...#.###.....#...#",
      "#.#.#.#.#####.#.#.#",
      "#.#...#...#...#.#.#",
      "#.#####.#.#.#####.#",
      "#.....#.#.#.......#",
      "#.###.#.#.#####.#.#",
      "#E..#...#.....#...#",
      "#...#####.###.##.E#",
      "###################",
    ],
  },
];

// Четыре возможных направления движения.
const DIRS = {
  ArrowUp: { x: 0, y: -1, angle: -90 },
  ArrowDown: { x: 0, y: 1, angle: 90 },
  ArrowLeft: { x: -1, y: 0, angle: 180 },
  ArrowRight: { x: 1, y: 0, angle: 0 },
};

// Цвета трёх врагов.
const ENEMY_COLORS = ["#fb7185", "#60a5fa", "#c084fc"];

// Превращаем текстовую карту в понятные игре данные.
function parseLevel(level) {
// Разбиваем карту на отдельные клетки.
  const grid = level.map.map((row) => row.split(""));
// Здесь будут все обычные точки.
  const pellets = [];
// Здесь будут позиции трёх врагов.
  const enemies = [];
// Начальная позиция игрока.
  let player = { x: 1, y: 1 };

  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === "P") {
        player = { x, y };
        grid[y][x] = ".";
      }

      if (cell === "E") {
        enemies.push({ x, y });
        grid[y][x] = ".";
      }

      if (grid[y][x] === ".") {
        pellets.push(`${x}:${y}`);
      }
    });
  });

  // Один большой бонус всегда находится в центре доступного коридора.
  const candidates = [];
  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell !== "#" && `${x}:${y}` !== `${player.x}:${player.y}`) {
        candidates.push({ x, y });
      }
    });
  });

  const power = candidates[Math.floor(candidates.length / 2)];

  return {
    grid,
    pellets,
    power: power ? `${power.x}:${power.y}` : null,
    player,
    enemies: enemies.slice(0, 3),
  };
}

// Получаем уникальное имя клетки, например "5:3".
function keyOf(x, y) {
  return `${x}:${y}`;
}

// Проверяем, является ли клетка стеной.
function isWall(grid, x, y) {
  return !grid[y] || grid[y][x] === "#";
}

// Проверяем, можно ли войти в клетку.
function canMove(grid, x, y) {
  return x >= 0 && y >= 0 && !isWall(grid, x, y);
}

// Считаем расстояние между двумя клетками.
function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Выбираем следующий шаг конкретного врага.
function getEnemyMove(enemy, player, grid, enemyIndex) {
  const possible = Object.values(DIRS)
    .map(({ x, y }) => ({ x: enemy.x + x, y: enemy.y + y, dx: x, dy: y }))
    .filter(({ x, y }) => canMove(grid, x, y));

  if (!possible.length) return enemy;

  // У каждого врага свой характер:
  // 0 — преследователь, 1 — старается держать дистанцию,
  // 2 — случайный патруль.
  if (enemyIndex === 0) {
    possible.sort(
      (a, b) =>
        distance(a, player) -
        distance(b, player)
    );
    return { x: possible[0].x, y: possible[0].y };
  }

  if (enemyIndex === 1) {
    possible.sort(
      (a, b) =>
        distance(b, player) -
        distance(a, player)
    );
    return Math.random() < 0.75
      ? { x: possible[0].x, y: possible[0].y }
      : possible[Math.floor(Math.random() * possible.length)];
  }

  return possible[Math.floor(Math.random() * possible.length)];
}

// Главный компонент всей игры.
function Pacman() {
// Номер текущего уровня: 0 или 1.
  const [level, setLevel] = useState(0);
// Данные текущего уровня.
  const [levelData, setLevelData] = useState(() => parseLevel(LEVELS[0]));
// Где сейчас находится игрок.
  const [player, setPlayer] = useState(levelData.player);
// Текущее направление движения.
  const [direction, setDirection] = useState(DIRS.ArrowRight);
// Направление, которое игрок хочет выбрать следующим.
  const [queuedDirection, setQueuedDirection] = useState(DIRS.ArrowRight);
// Текущие позиции трёх врагов.
  const [enemies, setEnemies] = useState(levelData.enemies);
// Точки, которые ещё не собраны.
  const [pellets, setPellets] = useState(() => new Set(levelData.pellets));
// Большая бонусная точка.
  const [power, setPower] = useState(levelData.power);
// true = игрок временно сильнее врагов.
  const [powerMode, setPowerMode] = useState(false);
  const [powerUntil, setPowerUntil] = useState(0);
// Счёт игрока.
  const [score, setScore] = useState(0);
// Оставшиеся жизни.
  const [lives, setLives] = useState(START_LIVES);
// Состояние игры: playing, gameover или won.
  const [status, setStatus] = useState("playing");
  const [levelMessage, setLevelMessage] = useState("");

  const grid = levelData.grid;
  const rows = grid.length;
  const cols = grid[0].length;

  const boardWidth = cols * CELL;
  const boardHeight = rows * CELL;

// Подготавливаем выбранный уровень заново.
  const resetLevel = useCallback(
    (nextLevel, keepScore = true) => {
      const parsed = parseLevel(LEVELS[nextLevel]);

      setLevel(nextLevel);
      setLevelData(parsed);
      setPlayer(parsed.player);
      setDirection(DIRS.ArrowRight);
      setQueuedDirection(DIRS.ArrowRight);
      setEnemies(parsed.enemies);
      setPellets(new Set(parsed.pellets));
      setPower(parsed.power);
      setPowerMode(false);
      setPowerUntil(0);
      if (!keepScore) setScore(0);
    },
    []
  );

// Полный перезапуск игры.
  const restartGame = useCallback(() => {
    resetLevel(0, false);
    setLives(START_LIVES);
    setStatus("playing");
    setLevelMessage("");
  }, [resetLevel]);

// Переход на следующий уровень.
  const nextLevel = useCallback(() => {
    if (level < LEVELS.length - 1) {
      setLevelMessage(`УРОВЕНЬ ${level + 1} ПРОЙДЕН`);
      setTimeout(() => {
        resetLevel(level + 1);
        setLevelMessage("");
      }, 1000);
    } else {
      setStatus("won");
    }
  }, [level, resetLevel]);

  useEffect(() => {
// Реагируем на нажатие стрелки.
    const onKeyDown = (event) => {
      const next = DIRS[event.key];
      if (!next) return;

      event.preventDefault();
      setQueuedDirection(next);
    };

    window.addEventListener("keydown", onKeyDown);
    // Ниже описываем то, что увидит игрок на экране.
  return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

// Регулярно двигаем персонажа или врагов.
    const timer = setInterval(() => {
      setPlayer((current) => {
        let move = queuedDirection;

        const queuedX = current.x + move.x;
        const queuedY = current.y + move.y;

        if (!canMove(grid, queuedX, queuedY)) {
          move = direction;
        }

        const nextX = current.x + move.x;
        const nextY = current.y + move.y;

        if (!canMove(grid, nextX, nextY)) {
          return current;
        }

        setDirection(move);
        return { x: nextX, y: nextY };
      });
    }, TICK);

    return () => clearInterval(timer);
  }, [direction, grid, queuedDirection, status]);

  // Враги самостоятельно двигаются по свободным клеткам.
  useEffect(() => {
    if (status !== "playing") return;

    const timer = setInterval(() => {
      setEnemies((current) =>
        current.map((enemy, index) =>
          getEnemyMove(enemy, player, grid, index)
        )
      );
    }, TICK * 2);

    return () => clearInterval(timer);
  }, [grid, player, status]);

  // Проверяем, наступил ли игрок на точку или бонус.
  useEffect(() => {
    if (status !== "playing") return;

    const currentKey = keyOf(player.x, player.y);

    if (pellets.has(currentKey)) {
      setPellets((current) => {
        const next = new Set(current);
        next.delete(currentKey);
        return next;
      });
      // Обычная точка даёт 10 очков.
      setScore((current) => current + 10);
    }

    if (power === currentKey) {
      // Убираем бонус после его подбора.
      setPower(null);
      // Включаем временную защиту.
      setPowerMode(true);
      setPowerUntil(Date.now() + POWER_TIME);
      // Большая точка даёт 50 очков.
      setScore((current) => current + 50);
    }

    if (pellets.size === 1 && pellets.has(currentKey)) {
      nextLevel();
    }
  }, [pellets, player, power, status, nextLevel]);

  // Следим за временем действия бонуса.
  useEffect(() => {
    if (!powerMode) return;

    const timer = setInterval(() => {
      if (Date.now() >= powerUntil) {
        setPowerMode(false);
        setPowerUntil(0);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [powerMode, powerUntil]);

  // Проверяем столкновение игрока с каждым врагом.
  useEffect(() => {
    if (status !== "playing") return;

    const hit = enemies.findIndex(
      (enemy) => enemy.x === player.x && enemy.y === player.y
    );

    if (hit === -1) return;

    if (powerMode) {
      // Победа над врагом даёт 200 очков.
      setScore((current) => current + 200);
      setEnemies((current) =>
        current.map((enemy, index) =>
          index === hit ? levelData.enemies[index] : enemy
        )
      );
      return;
    }

    setLives((current) => {
      const nextLives = current - 1;

      if (nextLives <= 0) {
        // Если жизни закончились — игра заканчивается.
      setStatus("gameover");
      }

      return nextLives;
    });

    // Возвращаем игрока на старт.
    setPlayer(levelData.player);
    setDirection(DIRS.ArrowRight);
    setQueuedDirection(DIRS.ArrowRight);
    // Возвращаем врагов на старт.
    setEnemies(levelData.enemies);
  }, [enemies, levelData, player, powerMode, status]);

  const powerSeconds = Math.max(
    0,
    Math.ceil((powerUntil - Date.now()) / 1000)
  );

  const theme = LEVELS[level].theme;

  const pelletItems = useMemo(
    () => Array.from(pellets).map((item) => item.split(":").map(Number)),
    [pellets]
  );

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        background: "#111",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                color: "#aaa",
                fontWeight: "bold",
              }}
            >
              LEVEL {level + 1} / {LEVELS.length}
            </div>

            <h1
              style={{
                margin: "4px 0 2px",
                fontSize: 28,
                lineHeight: 1,
              }}
            >
              {LEVELS[level].name}
            </h1>

            <div style={{ color: "#aaa", fontSize: 14 }}>
              {LEVELS[level].subtitle}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "stretch",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {[
              ["SCORE", score],
              ["LIVES", "●".repeat(lives) || "—"],
              ["DOTS", pellets.size],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: "4px 0",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#aaa",
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 16, fontWeight: "bold", marginTop: 2 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            overflow: "auto",
            borderRadius: 4,
          }}
        >
          <div
            style={{
              position: "relative",
              width: boardWidth,
              height: boardHeight,
              minWidth: boardWidth,
              background: "#000",
              border: "4px solid #2563eb",
              boxSizing: "border-box",
              overflow: "hidden",
              borderRadius: 18,
            }}
          >
            {/* Рисуем стены лабиринта. */}
            {grid.map((row, y) =>
              row.map((cell, x) =>
                cell === "#" ? (
                  <div
                    key={`${x}-${y}`}
                    style={{
                      position: "absolute",
                      left: x * CELL + 3,
                      top: y * CELL + 3,
                      width: CELL - 6,
                      height: CELL - 6,
                      borderRadius: 2,
                      background: "#2563eb",
                    }}
                  />
                ) : null
              )
            )}

            {/* Рисуем маленькие точки. */}
            {pelletItems.map(([x, y]) => (
              <span
                key={`pellet-${x}-${y}`}
                style={{
                  position: "absolute",
                  left: x * CELL + CELL / 2 - 3,
                  top: y * CELL + CELL / 2 - 3,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: theme.pellet,
                  boxShadow: "none",
                }}
              />
            ))}

            {/* Рисуем большую бонусную точку. */}
            {power && (
              <span
                style={{
                  position: "absolute",
                  left:
                    Number(power.split(":")[0]) * CELL + CELL / 2 - 8,
                  top:
                    Number(power.split(":")[1]) * CELL + CELL / 2 - 8,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: theme.power,
                  boxShadow: "0 0 5px #ffff00",
                  // Просто мигающая точка без сложной анимации.
                }}
              />
            )}

            <div
              style={{
                position: "absolute",
                left: player.x * CELL + 4,
                top: player.y * CELL + 4,
                width: PACMAN_SIZE,
                height: PACMAN_SIZE,
                borderRadius: "50%",
                background: "#ffff00",
                transform: `rotate(${direction.angle}deg)`,
                transition: `left ${TICK - 10}ms linear, top ${TICK - 10}ms linear`,
                zIndex: 5,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: -1,
                  top: 6,
                  width: 0,
                  height: 0,
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                  borderRight: "12px solid " + theme.board,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 5,
                  top: 5,
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#111827",
                }}
              />
            </div>

            {/* Рисуем трёх врагов. */}
            {enemies.map((enemy, index) => (
              <div
                key={`enemy-${index}`}
                style={{
                  position: "absolute",
                  left: enemy.x * CELL + 4,
                  top: enemy.y * CELL + 4,
                  width: ENEMY_SIZE,
                  height: ENEMY_SIZE,
                  zIndex: 4,
                  transition: `left ${TICK * 2 - 15}ms linear, top ${
                    TICK * 2 - 15
                  }ms linear`,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "78%",
                    borderRadius: "50% 50% 38% 38%",
                    background: powerMode
                      ? "#38bdf8"
                      : ENEMY_COLORS[index],
                    boxShadow: "none",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 5,
                      top: 6,
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "white",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: 5,
                      top: 6,
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "white",
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Показываем оставшееся время защиты. */}
            {powerMode && (
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 10,
                  padding: "5px 9px",
                  borderRadius: 8,
                  background: "#222",
                  border: "1px solid #555",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: ".08em",
                  zIndex: 10,
                }}
              >
                POWER {powerSeconds}s
              </div>
            )}

            {/* Показываем сообщение о переходе уровня. */}
            {levelMessage && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,.8)",
                  zIndex: 20,
                }}
              >
                <div
                  style={{
                    padding: "20px",
                    borderRadius: 4,
                    background: "#111",
                    border: "1px solid #fff",
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: "bold",
                  }}
                >
                  {levelMessage}
                </div>
              </div>
            )}

            {/* Экран победы или поражения. */}
            {status !== "playing" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  background: "rgba(0,0,0,.85)",
                  zIndex: 30,
                }}
              >
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: "bold",
                  }}
                >
                  {status === "won" ? "YOU WIN" : "GAME OVER"}
                </div>

                <div style={{ color: "#aaa" }}>
                  {status === "won"
                    ? `Оба уровня пройдены. Счёт: ${score}`
                    : `Счёт: ${score}`}
                </div>

                <button
                  onClick={restartGame}
                  style={{
                    border: 0,
                    cursor: "pointer",
                    padding: "11px 18px",
                    borderRadius: 10,
                    background: "#facc15",
                    color: "#000",
                    fontWeight: "bold",
                  }}
                >
                  PLAY AGAIN
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            color: "#aaa",
            fontSize: 12,
          }}
        >
          <span>Стрелки — движение</span>
          <span>Жёлтая энергия — временная защита</span>
          <span>3 врага на каждом уровне</span>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {Object.entries(DIRS).map(([key, dir]) => (
            <button
              key={key}
              onClick={() => setQueuedDirection(dir)}
              aria-label={key}
              style={{
                width: 42,
                height: 36,
                borderRadius: 9,
                border: "1px solid #555",
                background: "#222",
                color: "white",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              {key === "ArrowUp"
                ? "↑"
                : key === "ArrowDown"
                ? "↓"
                : key === "ArrowLeft"
                ? "←"
                : "→"}
            </button>
          ))}
        </div>
      </div>

      {/* Здесь нет сложного CSS — игра сделана максимально просто. */}
    </div>
  );
}

export default Pacman;
