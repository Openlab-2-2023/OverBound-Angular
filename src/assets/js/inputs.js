let keys = {
  d: {
    pressed: false,
  },
  a: {
    pressed: false,
  },
  s: {
    pressed: false,
  },
  w: {
    pressed: false,
  },
  e: {
    pressed: false,
  },
  o: {
    pressed: false,
  },
  i: {
    pressed: false,
  },
};

const KEYBINDS_STORAGE_KEY = 'overbound_keybinds_v1';
const DEFAULT_KEYBINDS = {
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  crouch: 'KeyS',
  jump: 'KeyW',
  jumpAlt: 'Space',
  dash: 'KeyO',
  attack: 'KeyI',
  talk: 'KeyE',
};

let keybinds = loadKeybinds();

function loadKeybinds() {
  try {
    const savedKeybinds = JSON.parse(localStorage.getItem(KEYBINDS_STORAGE_KEY) || '{}');
    return {
      ...DEFAULT_KEYBINDS,
      ...savedKeybinds,
    };
  } catch (error) {
    return { ...DEFAULT_KEYBINDS };
  }
}

function saveKeybinds(nextKeybinds) {
  keybinds = {
    ...DEFAULT_KEYBINDS,
    ...nextKeybinds,
  };
  localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(keybinds));
  window.overboundKeybinds = { ...keybinds };
}

function getActionForCode(code) {
  for (const action in keybinds) {
    if (keybinds[action] === code) return action;
  }

  return null;
}

window.overboundKeybindDefaults = { ...DEFAULT_KEYBINDS };
window.overboundKeybinds = { ...keybinds };
window.setOverboundKeybinds = saveKeybinds;

window.addEventListener('overbound:keybinds-updated', () => {
  keybinds = loadKeybinds();
  window.overboundKeybinds = { ...keybinds };
  resetGameplayKeys();
});

function isNpcChatOpen() {
  return Boolean(window.npcChatOpen);
}

function isGamePaused() {
  return Boolean(window.gamePaused);
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (target.isContentEditable) return true;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

function shouldHandleGameplayInput(event) {
  if (isEditableTarget(event.target)) return false;
  if (!window.location.pathname.startsWith('/game')) return false;
  if (typeof player === 'undefined') return false;
  return true;
}

function resetGameplayKeys() {
  keys.d.pressed = false;
  keys.a.pressed = false;
  keys.s.pressed = false;
  keys.w.pressed = false;
  keys.e.pressed = false;
  keys.o.pressed = false;
  keys.i.pressed = false;
}

window.addEventListener("keydown", (event) => {
  if (!shouldHandleGameplayInput(event)) {
    return;
  }

  if (isGamePaused()) {
    resetGameplayKeys();
    return;
  }

  const action = getActionForCode(event.code);

  if (isNpcChatOpen()) {
    if (event.code === 'Escape') {
      if (typeof window.closeNpcChat === 'function') {
        window.closeNpcChat();
      } else {
        window.npcChatOpen = false;
      }
    }
    resetGameplayKeys();
    return;
  }

  if (action === 'jump' || action === 'jumpAlt') {
    event.preventDefault();
  }

  switch (action) {
    case "moveRight":
      // move right (D)
      keys.d.pressed = true;
      break;
    case "moveLeft":
      //move left (A)
      keys.a.pressed = true;
      break;
    case "crouch":
      //duckujes 
      keys.s.pressed = true;
      break;
    case "jump":
    case "jumpAlt":
      keys.w.pressed = true;

      if(keys.s.pressed && player.velocity.y == 0) {
        if(currentDifficulty === 'normal') {
          player.velocity.y = -60;
        } else {
          player.velocity.y = -20;
        }
        
        keys.s.pressed = false
      }
      //maly jump
      if(player.velocity.y == 0) {
        if(currentDifficulty === 'normal') {
          player.velocity.y = -50;
        } else {
          player.velocity.y = -17;
        }
        
      }

      break;

      case "talk":
      if (event.repeat) break;
      keys.e.pressed = true;
      keys.e.usedForNpc = false;
      break;

      case "attack":
      // attack key (I) – one-shot per press
      if (event.repeat) break;
      keys.i.pressed = true;
      if (typeof dismissAttackGuide === 'function') {
        dismissAttackGuide();
      }
      if (typeof player !== 'undefined' && typeof player.performAttack === 'function') {
        player.performAttack();
      }
      break;

      

  }
});


window.addEventListener("keyup", (event) => {
  if (!shouldHandleGameplayInput(event)) {
    return;
  }

  if (isGamePaused()) {
    resetGameplayKeys();
    return;
  }

  const action = getActionForCode(event.code);

  if (isNpcChatOpen()) {
    resetGameplayKeys();
    return;
  }

  switch (action) {
    case "moveRight":
      keys.d.pressed = false;
      player.switchSprite('idleRight')
      break;
    case "moveLeft":
      keys.a.pressed = false;
      player.switchSprite('idleLeft')
      break;
    case "crouch":
      keys.s.pressed = false;
      if(player.lastDirection === 'right') {
        player.switchSprite('idleRight')
      } else if(player.lastDirection === 'left') {
        player.switchSprite('idleLeft')
      }
      break;
    case "talk":
      keys.e.pressed = false;
      keys.e.usedForNpc = false;
      break;
    case "jump":
    case "jumpAlt":
      keys.w.pressed = false;
      break;

    case "attack":
      keys.i.pressed = false;
      break;


      
  }
})

window.addEventListener('keydown', (event) => {
  if (!shouldHandleGameplayInput(event)) {
    return;
  }

  if (isGamePaused()) {
    resetGameplayKeys();
    return;
  }

  if (isNpcChatOpen()) return;
  if (event.repeat) return;
  const action = getActionForCode(event.code);

  if (action === 'dash') {
    keys.o.pressed = true
  }
});
