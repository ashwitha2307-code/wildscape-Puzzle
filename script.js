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
  let activeDrag = null;
  let keyboardDrag = null;
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
    cancelPointerDrag();
    cancelKeyboardDrag();
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

  function movePieces(first, second) {
    if (first === second || !game.tiles.length || game.complete) return;
    [game.tiles[first], game.tiles[second]] = [game.tiles[second], game.tiles[first]];
    game.moves += 1;
    const placedCorrectly = game.tiles[second] === second;
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
    if (placedCorrectly) {
      showToast('A piece found its place.', 'success');
    } else {
      showToast('Not quite — try another space.', 'error');
    }
    clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => {
      wrongPositions = [];
      render();
    }, 1400);
  }

  function cancelPointerDrag() {
    if (!activeDrag) return;
    const drag = activeDrag;
    activeDrag = null;
    drag.piece.classList.remove('is-dragging');
    drag.ghost.remove();
    if (board.hasPointerCapture(drag.pointerId)) board.releasePointerCapture(drag.pointerId);
  }

  function cancelKeyboardDrag() {
    if (!keyboardDrag) return;
    const source = board.children[keyboardDrag.origin];
    source?.classList.remove('is-keyboard-dragging');
    board.children[keyboardDrag.destination]?.classList.remove('is-keyboard-target');
    if (source && game.tiles.length) {
      const originalIndex = game.tiles[keyboardDrag.origin];
      source.setAttribute(
        'aria-label',
        `Piece for space ${originalIndex + 1}, currently in space ${keyboardDrag.origin + 1}${originalIndex === keyboardDrag.origin ? ', correctly placed' : ''}`
      );
    }
    keyboardDrag = null;
  }

  function updateKeyboardDestination(destination) {
    if (!keyboardDrag || destination < 0 || destination >= game.tiles.length) return;
    board.children[keyboardDrag.destination]?.classList.remove('is-keyboard-target');
    keyboardDrag.destination = destination;
    board.children[destination]?.classList.add('is-keyboard-target');
    const originalIndex = game.tiles[keyboardDrag.origin];
    board.children[keyboardDrag.origin]?.setAttribute(
      'aria-label',
      `Picked up piece for space ${originalIndex + 1}. Destination space ${destination + 1}.`
    );
  }

  function finishKeyboardDrag() {
    if (!keyboardDrag) return;
    const { origin, destination } = keyboardDrag;
    cancelKeyboardDrag();
    if (origin !== destination) movePieces(origin, destination);
    else showToast('Piece returned to its space.');
    board.children[destination]?.focus();
  }

  function getDropPosition(clientX, clientY) {
    const boardBounds = board.getBoundingClientRect();
    if (clientX < boardBounds.left || clientX > boardBounds.right ||
        clientY < boardBounds.top || clientY > boardBounds.bottom) return null;

    let nearestPosition = null;
    let nearestDistance = Infinity;
    Array.from(board.children).forEach((piece, position) => {
      const bounds = piece.getBoundingClientRect();
      const deltaX = clientX - (bounds.left + bounds.width / 2);
      const deltaY = clientY - (bounds.top + bounds.height / 2);
      const distance = deltaX * deltaX + deltaY * deltaY;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPosition = position;
      }
    });
    return nearestPosition;
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
    if (!piece || game.complete || !game.tiles.length || activeDrag ||
        event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    cancelKeyboardDrag();
    event.preventDefault();
    const bounds = piece.getBoundingClientRect();
    const ghost = piece.cloneNode(false);
    ghost.classList.remove('is-correct', 'is-wrong', 'hint-source', 'hint-target');
    ghost.classList.add('is-drag-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.removeAttribute('role');
    ghost.tabIndex = -1;
    ghost.style.width = `${bounds.width}px`;
    ghost.style.height = `${bounds.height}px`;
    ghost.style.left = '0';
    ghost.style.top = '0';
    document.body.append(ghost);
    activeDrag = {
      pointerId: event.pointerId,
      origin: Number(piece.dataset.position),
      piece,
      ghost,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top
    };
    piece.classList.add('is-dragging');
    ghost.style.transform = `translate3d(${event.clientX - activeDrag.offsetX}px, ${event.clientY - activeDrag.offsetY}px, 0)`;
    board.setPointerCapture(event.pointerId);
  });

  board.addEventListener('pointermove', (event) => {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    event.preventDefault();
    activeDrag.ghost.style.transform =
      `translate3d(${event.clientX - activeDrag.offsetX}px, ${event.clientY - activeDrag.offsetY}px, 0)`;
  });

  board.addEventListener('pointerup', (event) => {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    const { origin } = activeDrag;
    const destination = getDropPosition(event.clientX, event.clientY);
    cancelPointerDrag();
    if (destination === null) {
      showToast('Piece returned to its space.');
    } else if (destination !== origin) {
      movePieces(origin, destination);
    }
  });

  board.addEventListener('pointercancel', (event) => {
    if (activeDrag?.pointerId === event.pointerId) cancelPointerDrag();
  });

  board.addEventListener('lostpointercapture', (event) => {
    if (activeDrag?.pointerId === event.pointerId) cancelPointerDrag();
  });

  board.addEventListener('keydown', (event) => {
    const piece = event.target.closest('.puzzle-piece');
    if (!piece || !game.tiles.length || game.complete) return;
    const position = Number(piece.dataset.position);
    const size = levels[game.level];
    const movement = {
      ArrowLeft: position % size > 0 ? position - 1 : position,
      ArrowRight: position % size < size - 1 ? position + 1 : position,
      ArrowUp: position >= size ? position - size : position,
      ArrowDown: position < game.tiles.length - size ? position + size : position
    };

    if (keyboardDrag && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const { destination } = keyboardDrag;
      const nextDestination = {
        ArrowLeft: destination % size > 0 ? destination - 1 : destination,
        ArrowRight: destination % size < size - 1 ? destination + 1 : destination,
        ArrowUp: destination >= size ? destination - size : destination,
        ArrowDown: destination < game.tiles.length - size ? destination + size : destination
      }[event.key];
      updateKeyboardDestination(nextDestination);
      return;
    }

    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (keyboardDrag) {
        finishKeyboardDrag();
      } else {
        const originalIndex = game.tiles[position];
        keyboardDrag = { origin: position, destination: position };
        piece.classList.add('is-keyboard-dragging', 'is-keyboard-target');
        piece.setAttribute('aria-label', `Picked up piece for space ${originalIndex + 1}. Use arrow keys to choose a destination, then press Enter or Space to drop. Press Escape to cancel.`);
        showToast('Piece picked up. Choose a destination with the arrow keys.');
      }
      return;
    }

    if (event.key === 'Escape' && keyboardDrag) {
      event.preventDefault();
      const origin = keyboardDrag.origin;
      cancelKeyboardDrag();
      board.children[origin]?.focus();
      showToast('Move cancelled.');
      return;
    }

    if (!keyboardDrag && movement[event.key] !== undefined && movement[event.key] !== position) {
      event.preventDefault();
      board.children[movement[event.key]]?.focus();
    }
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
