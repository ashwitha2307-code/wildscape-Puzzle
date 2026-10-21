(() => {
  const STORAGE_KEY = 'wildscape-puzzle-v1';
  const levels = { easy: 3, medium: 4, hard: 5 };
  const fallbackPhoto = 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=85';
  const scenes = {
    waterfall: {
      name: 'Waterfalls', location: 'Mossy falls, Iceland',
      image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1200&q=85'
    },
    forest: {
      name: 'Lush green forests', location: 'Ancient forest, Oregon', image: fallbackPhoto
    },
    mountain: {
      name: 'Mountains', location: 'Alpine stillness, Dolomites',
      image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85'
    },
    coast: {
      name: 'Beaches & oceans', location: 'Open water, Pacific coast',
      image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=85'
    },
    lake: {
      name: 'Lakes & rivers', location: 'Alpine waters, Italy',
      image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=85'
    },
    flowers: {
      name: 'Flowers & gardens', location: 'Wild blooms, Holland',
      image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=85'
    },
    wildlife: {
      name: 'Wildlife', location: 'Elephant country, Kenya',
      image: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?auto=format&fit=crop&w=1200&q=85'
    },
    sunrise: {
      name: 'Sunrise & sunset landscapes', location: 'First and last light, Tuscany',
      image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85'
    }
  };

  const board = document.querySelector('#puzzle-board');
  const timerDisplay = document.querySelector('#timer');
  const movesDisplay = document.querySelector('#moves');
  const statusDisplay = document.querySelector('#board-status');
  const countDisplay = document.querySelector('#piece-count');
  const shuffleLabel = document.querySelector('#shuffle-label');
  const completeMessage = document.querySelector('#complete-message');
  const boardStage = document.querySelector('.board-stage');
  const toast = document.querySelector('#toast');
  let game = loadGame();
  let selectedIndex = null;
  let dragIndex = null;
  let toastTimeout;
  let feedbackTimeout;
  let hintTimeout;
  let wrongPositions = [];
  let hintPositions = null;
  const checkedImages = new Set();
  const failedImages = new Set();

  function loadGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && levels[saved.level] && scenes[saved.scene] && Array.isArray(saved.tiles)) {
        const size = levels[saved.level] ** 2;
        const validTiles = saved.tiles.length === size && saved.tiles.every((tile) => Number.isInteger(tile) && tile >= 0 && tile < size) && new Set(saved.tiles).size === size;
          const validInitialTiles = Array.isArray(saved.initialTiles) && saved.initialTiles.length === size && saved.initialTiles.every((tile) => Number.isInteger(tile) && tile >= 0 && tile < size) && new Set(saved.initialTiles).size === size && !saved.initialTiles.every((tile, index) => tile === index);
        if (validTiles) {
            const complete = Boolean(saved.complete && saved.tiles.every((tile, index) => tile === index));
          return {
            ...saved,
            initialTiles: [...(validInitialTiles ? saved.initialTiles : saved.tiles)],
            moves: Math.max(0, Number(saved.moves) || 0),
            elapsed: Math.max(0, Number(saved.elapsed) || 0),
              startedAt: complete ? null : Number(saved.startedAt) || null,
              complete
          };
        }
      }
    } catch (_) {
        return { level: 'easy', scene: 'forest', tiles: [], initialTiles: [], moves: 0, elapsed: 0, startedAt: null, complete: false };
    }
    return { level: 'easy', scene: 'forest', tiles: [], initialTiles: [], moves: 0, elapsed: 0, startedAt: null, complete: false };
  }

  function saveGame() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    } catch (_) {
      return;
    }
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  }

  function elapsedNow() {
    return game.elapsed + (game.startedAt ? Math.floor((Date.now() - game.startedAt) / 1000) : 0);
  }

  function updateTimer() {
    timerDisplay.textContent = formatTime(elapsedNow());
    if (game.startedAt && !game.complete) saveGame();
  }

  function checkSceneImage(sceneKey) {
    if (checkedImages.has(sceneKey) || failedImages.has(sceneKey)) return;
    checkedImages.add(sceneKey);
    const image = new Image();
    image.onerror = () => {
      failedImages.add(sceneKey);
      if (game.scene !== sceneKey) return;
      showToast(sceneKey === 'forest' ? 'The landscape photo could not load.' : 'Photo unavailable; using the forest image instead.', 'error');
      render();
    };
    image.src = scenes[sceneKey].image;
  }

  function render() {
    const size = levels[game.level];
    const tiles = game.tiles;
    const sceneKey = game.scene;
    const imageUrl = failedImages.has(sceneKey) ? fallbackPhoto : scenes[sceneKey].image;
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
    board.style.gridTemplateRows = `repeat(${size}, minmax(0, 1fr))`;
    board.style.setProperty('--preview-image', `url("${imageUrl}")`);
    boardStage.classList.toggle('has-image-fallback', sceneKey === 'forest' && failedImages.has(sceneKey));
    board.classList.toggle('is-idle', tiles.length === 0);
    board.classList.toggle('is-complete', game.complete);
    board.classList.remove('show-reference');
    document.querySelector('#preview-button').setAttribute('aria-pressed', 'false');
    selectedIndex = null;
    completeMessage.hidden = !game.complete;

    tiles.forEach((originalIndex, position) => {
      const piece = document.createElement('div');
      const originalRow = Math.floor(originalIndex / size);
      const originalColumn = originalIndex % size;
      const horizontalPosition = size === 1 ? 0 : (originalColumn / (size - 1)) * 100;
      const verticalPosition = size === 1 ? 0 : (originalRow / (size - 1)) * 100;
      const correct = tiles.length > 0 && originalIndex === position;
      piece.className = 'puzzle-piece';
      piece.dataset.position = position;
      piece.setAttribute('role', 'gridcell');
      piece.setAttribute('aria-label', `Piece for space ${originalIndex + 1}, currently in space ${position + 1}${correct ? ', correctly placed' : ''}`);
      piece.tabIndex = game.complete ? -1 : 0;
      piece.style.backgroundImage = `url("${imageUrl}")`;
      piece.style.backgroundSize = `${size * 100}% ${size * 100}%`;
      piece.style.backgroundPosition = `${horizontalPosition}% ${verticalPosition}%`;
      if (correct) piece.classList.add('is-correct');
      else if (wrongPositions.includes(position)) piece.classList.add('is-wrong');
      if (hintPositions?.source === position) piece.classList.add('hint-source');
      if (hintPositions?.target === position) piece.classList.add('hint-target');
      board.append(piece);
    });

    if (tiles.length) checkSceneImage(sceneKey);

    document.querySelectorAll('.level-button').forEach((button) => {
      const active = button.dataset.level === game.level;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.landscape-choice').forEach((button) => {
      const active = button.dataset.scene === game.scene;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const pieceTotal = size * size;
    countDisplay.textContent = `${pieceTotal} PIECES`;
    movesDisplay.textContent = String(game.moves);
    timerDisplay.textContent = formatTime(elapsedNow());
    statusDisplay.textContent = game.complete ? 'PUZZLE COMPLETE' : tiles.length ? 'IN PROGRESS' : 'READY WHEN YOU ARE';
    shuffleLabel.textContent = game.complete ? 'Play again' : tiles.length ? 'Shuffle puzzle' : 'Start a puzzle';
    document.querySelector('#puzzle-heading').textContent = `${scenes[game.scene].name} in pieces`;
    document.querySelector('#final-time').textContent = formatTime(elapsedNow());
    document.querySelector('#final-moves').textContent = String(game.moves);
    saveGame();
  }

  function makePuzzle() {
    const total = levels[game.level] ** 2;
    game.tiles = Array.from({ length: total }, (_, index) => index);
    for (let index = game.tiles.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [game.tiles[index], game.tiles[randomIndex]] = [game.tiles[randomIndex], game.tiles[index]];
    }
    if (game.tiles.every((tile, index) => tile === index)) {
      [game.tiles[0], game.tiles[1]] = [game.tiles[1], game.tiles[0]];
    }
    game.initialTiles = [...game.tiles];
    game.moves = 0;
    game.elapsed = 0;
    game.startedAt = Date.now();
    game.complete = false;
    wrongPositions = [];
    hintPositions = null;
    clearTimeout(feedbackTimeout);
    clearTimeout(hintTimeout);
    render();
    updateTimer();
  }

  function restartPuzzle() {
    if (!game.tiles.length || game.initialTiles.length !== levels[game.level] ** 2) {
      makePuzzle();
      return;
    }
    game.tiles = [...game.initialTiles];
    game.moves = 0;
    game.elapsed = 0;
    game.startedAt = Date.now();
    game.complete = false;
    wrongPositions = [];
    hintPositions = null;
    clearTimeout(feedbackTimeout);
    clearTimeout(hintTimeout);
    render();
    updateTimer();
  }

  function swapPieces(first, second) {
    if (first === second || !game.tiles.length || game.complete) return;
    const wasCorrectAtFirst = game.tiles[first] === first;
    const wasCorrectAtSecond = game.tiles[second] === second;
    [game.tiles[first], game.tiles[second]] = [game.tiles[second], game.tiles[first]];
    game.moves += 1;
    const correctAtFirst = game.tiles[first] === first;
    const correctAtSecond = game.tiles[second] === second;
    const newlyCorrect = (!wasCorrectAtFirst && correctAtFirst) || (!wasCorrectAtSecond && correctAtSecond);
    hintPositions = null;
    wrongPositions = [first, second].filter((position) => game.tiles[position] !== position);

    if (game.tiles.every((tile, index) => tile === index) && !game.complete) {
      game.complete = true;
      game.elapsed = elapsedNow();
      game.startedAt = null;
      wrongPositions = [];
      clearTimeout(feedbackTimeout);
      clearTimeout(hintTimeout);
      hintPositions = null;
      render();
      return;
    }
    render();
    if (wrongPositions.length) {
      showToast(newlyCorrect ? 'A piece found its place. Try again!' : 'Try again!', 'error');
    } else if (newlyCorrect) {
      showToast('A piece found its place.', 'success');
    }
    clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => {
      wrongPositions = [];
      render();
    }, 1400);
  }

  function choosePiece(position) {
    if (!game.tiles.length || game.complete) return;
    if (selectedIndex === null) {
      selectedIndex = position;
      board.children[position].classList.add('is-selected');
      return;
    }
    const previous = selectedIndex;
    selectedIndex = null;
    board.children[previous]?.classList.remove('is-selected');
    if (previous !== position) swapPieces(previous, position);
  }

  function showToast(message, kind = '') {
    toast.textContent = message;
    toast.classList.remove('is-error', 'is-success');
    if (kind) toast.classList.add(`is-${kind}`);
    toast.classList.add('is-visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  function showHint() {
    if (!game.tiles.length || game.complete) {
      showToast('Start a puzzle first.');
      return;
    }
    const source = game.tiles.findIndex((tile, position) => tile !== position);
    if (source < 0) return;
    hintPositions = { source, target: game.tiles[source] };
    render();
    showToast(`Highlighted a piece and its correct space: ${hintPositions.target + 1}.`, 'success');
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => {
      hintPositions = null;
      render();
    }, 3000);
  }

  document.querySelector('#shuffle-button').addEventListener('click', makePuzzle);
  document.querySelector('#play-again').addEventListener('click', makePuzzle);
  document.querySelector('#restart-button').addEventListener('click', restartPuzzle);
  document.querySelector('#hint-button').addEventListener('click', showHint);

  document.querySelectorAll('.level-button').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.level === game.level) return;
      const shouldStart = game.tiles.length > 0;
      game.level = button.dataset.level;
      if (shouldStart) {
        makePuzzle();
      } else {
        game.tiles = [];
        game.initialTiles = [];
        game.moves = 0;
        game.elapsed = 0;
        game.startedAt = null;
        game.complete = false;
        wrongPositions = [];
        hintPositions = null;
        render();
      }
    });
  });

  document.querySelectorAll('.landscape-choice').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.scene === game.scene) return;
      game.scene = button.dataset.scene;
      makePuzzle();
    });
  });

  board.addEventListener('pointerdown', (event) => {
    const piece = event.target.closest('.puzzle-piece');
    if (!piece || game.complete || !game.tiles.length) return;
    dragIndex = Number(piece.dataset.position);
    piece.classList.add('is-dragging');
  });

  board.addEventListener('pointerup', (event) => {
    if (dragIndex === null) return;
    const piece = event.target.closest('.puzzle-piece');
    const origin = dragIndex;
    board.children[origin]?.classList.remove('is-dragging');
    dragIndex = null;
    if (!piece) return;
    const destination = Number(piece.dataset.position);
    if (destination !== origin) swapPieces(origin, destination);
    else choosePiece(destination);
  });

  board.addEventListener('pointercancel', () => {
    if (dragIndex !== null) board.children[dragIndex]?.classList.remove('is-dragging');
    dragIndex = null;
  });

  document.addEventListener('pointerup', (event) => {
    if (dragIndex === null || board.contains(event.target)) return;
    board.children[dragIndex]?.classList.remove('is-dragging');
    dragIndex = null;
  });

  board.addEventListener('keydown', (event) => {
    const piece = event.target.closest('.puzzle-piece');
    if (!piece || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    choosePiece(Number(piece.dataset.position));
  });

  document.querySelector('#preview-button').addEventListener('click', () => {
    if (!game.tiles.length) {
      showToast('Start a puzzle to see the full reference.');
      return;
    }
    const visible = board.classList.toggle('show-reference');
    document.querySelector('#preview-button').setAttribute('aria-pressed', String(visible));
    showToast(visible ? 'Reference image shown' : 'Reference image hidden');
  });

  document.querySelectorAll('.landscape-choice img').forEach((image) => {
    function useFallback() {
      if (image.dataset.fallbackAttempted) {
        image.classList.add('is-unavailable');
        image.removeEventListener('error', useFallback);
        return;
      }
      image.dataset.fallbackAttempted = 'true';
      image.src = fallbackPhoto;
    }
    image.addEventListener('error', useFallback);
  });

  window.setInterval(updateTimer, 1000);
  render();
})();
