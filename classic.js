const slotDialog = document.querySelector("#saveSlots");
const slotList = document.querySelector("#slotList");
const slotConfirm = document.querySelector("#slotConfirm");
const slotMessage = document.querySelector("#slotMessage");
const helpDialog = document.querySelector("#gameHelp");
const saveKeys = ["save1", "save2", "save3", "save4", "save5"];
const recoveryKey = "beforeLoad";
const saveDate = new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" });
let slotMode;
let pausedGame;

function floorLabel(id) {
    const name = core.floors[id]?.name;
    if (id === "MT0") return "序 章";
    if (id === "MT24") return "地下层";
    return `第 ${name} 层`;
}

function readSlot(key) {
    const data = core.getLocalStorage(key, null);
    if (data?.version === core.firstData.version && core.floors[data.floorId] &&
        data.maps && core.floorIds.every(id => Array.isArray(data.maps[id]) && data.maps[id].length === 13) && data.hero?.loc && typeof data.route === "string" &&
        data.shops && Number.isFinite(data.time)) return data;
    return null;
}

function renderSlots() {
    slotList.hidden = false;
    slotConfirm.hidden = true;
    slotList.replaceChildren();
    const keys = slotMode === "save" ? saveKeys : [...saveKeys, recoveryKey];

    for (const key of keys) {
        const data = readSlot(key);
        if (key === recoveryKey && !data) continue;
        const label = key === recoveryKey ? "读档前备份" : `存档 ${key.slice(-1)}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "slot";
        const name = document.createElement("strong");
        name.textContent = label;
        const summary = document.createElement("span");
        summary.textContent = data ? `${floorLabel(data.floorId)} · 生命 ${data.hero.hp} · 攻 ${data.hero.atk} · 防 ${data.hero.def} · ${saveDate.format(data.time)}` : "空档";
        button.append(name, summary);
        button.disabled = slotMode === "load" && !data;
        button.addEventListener("click", () => chooseSlot(key, label));
        slotList.append(button);
    }
}

function openSaveSlots(mode) {
    if (slotDialog.open || helpDialog.open || !window.core?.firstData) return;
    const playing = core.isPlaying();
    if (mode === "save" && !playing) return;
    if (playing && (core.status.lockControl || !core.status.heroStop ||
        core.status.heroMoving > 0 || core.interval.openDoorAnimate != null)) {
        if (!core.status.lockControl) core.drawTip("请停止移动后再试");
        return;
    }

    slotMode = mode;
    pausedGame = playing ? core.status : null;
    if (pausedGame) {
        core.status.holdingKeys = [];
        core.lockControl();
    }

    const saving = mode === "save";
    document.querySelector("#slotHeading").textContent = saving ? "保存进度" : "读取存档";
    slotMessage.textContent = saving ? "请选择存档位置。" : "请选择要读取的存档。";
    renderSlots();
    slotDialog.showModal();
    (slotList.querySelector("button:not(:disabled)") || document.querySelector("#closeSlots")).focus();
}

function saveOrLoad(key, label) {
    if (slotMode === "save") {
        if (!core.saveData(key)) {
            slotMessage.textContent = "保存失败。请检查浏览器是否允许本地存储，或是否有存储空间。";
            return;
        }
        slotDialog.close();
        core.drawTip(`${label}已保存`);
        return;
    }

    const data = readSlot(key);
    if (!data) {
        slotMessage.textContent = "这个存档无法读取，请选择其他存档。";
        renderSlots();
        return;
    }
    if (pausedGame && !core.saveData(recoveryKey)) {
        slotMessage.textContent = "当前进度备份失败，请先确认浏览器存储可用。";
        return;
    }
    slotDialog.close();
    core.dom.startPanel.style.display = "none";
    core.loadData(data, () => core.drawTip(`已读取${label}`));
}

function chooseSlot(key, label) {
    if (slotMode === "save" && !readSlot(key)) {
        saveOrLoad(key, label);
        return;
    }

    const saving = slotMode === "save";
    slotMessage.textContent = saving
        ? `要覆盖${label}吗？`
        : `要读取${label}吗？${pausedGame ? "当前进度会先保存在「读档前备份」。" : ""}`;
    slotList.hidden = true;
    slotConfirm.hidden = false;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    cancel.addEventListener("click", () => {
        slotMessage.textContent = saving ? "请选择存档位置。" : "请选择要读取的存档。";
        renderSlots();
        const buttons = [...slotList.querySelectorAll("button")];
        buttons[(saving ? saveKeys : [...saveKeys, recoveryKey]).indexOf(key)]?.focus();
    });
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.textContent = saving ? "确认覆盖" : "确认读取";
    confirm.addEventListener("click", () => saveOrLoad(key, label));
    slotConfirm.replaceChildren(cancel, confirm);
    cancel.focus();
}

slotDialog.addEventListener("close", () => {
    if (pausedGame && pausedGame === window.core?.status) core.unLockControl();
    if (window.core?.isPlaying()) core.dom.data.focus({preventScroll: true});
    pausedGame = null;
});
document.querySelector("#closeSlots").addEventListener("click", () => slotDialog.close());
document.querySelector("#saveShortcut").addEventListener("click", () => openSaveSlots("save"));
document.querySelector("#loadShortcut").addEventListener("click", () => openSaveSlots("load"));
document.querySelector("#startHelp").addEventListener("click", () => helpDialog.showModal());

function returnToTitle(restart) {
    if (!core.isPlaying() || core.status.lockControl || !core.status.heroStop ||
        core.status.heroMoving > 0 || core.interval.openDoorAnimate != null) return;
    core.status.event.selection = 1;
    core.ui.drawConfirmBox(restart ? "从序章重新开始？\n未存档的进度会丢失。" : "返回标题？\n未存档的进度会丢失。", () => {
        core.ui.closePanel();
        core.restart();
    }, () => core.ui.closePanel());
}
document.querySelector("#quitShortcut").addEventListener("click", () => returnToTitle(false));
document.querySelector("#restartShortcut").addEventListener("click", () => returnToTitle(true));

function classicKeyDown(event) {
    if (slotDialog.open || helpDialog.open) {
        if (event.code === "Escape") event.preventDefault();
        return true;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)
        && !event.target.closest("button")) event.preventDefault();
    return false;
}

function classicKeyUp(event) {
    const dialog = slotDialog.open ? slotDialog : helpDialog.open ? helpDialog : null;
    if (dialog) {
        if (event.code === "Escape") dialog.close();
        return true;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return true;
    if (event.code === "Escape" && !window.core?.status.lockControl) return true;
    if (event.code === "KeyK" || event.code === "KeyE") return true;
    if (event.code === "KeyL" || event.code === "KeyJ") {
        if (core.isPlaying()) core.keyUp(event.code === "KeyL" ? 88 : 71);
        return true;
    }
    const shortcut = {
        KeyS: () => openSaveSlots("save"),
        KeyA: () => openSaveSlots("load"),
        KeyD: () => openSaveSlots("load"),
        KeyQ: () => returnToTitle(false),
        KeyR: () => returnToTitle(true),
    }[event.code];
    if (!shortcut) return false;
    shortcut();
    return true;
}

function drawClassicGoldShop(content, choices) {
    const canvas = core.canvas.ui;
    const event = core.status.event;
    const shop = event.data.shop;
    const icon = core.material.icons.npcs[shop.icon];

    core.clearMap("ui", 0, 0, 416, 416);
    event.ui = { text: content, choices };
    event.selection = Math.min(choices.length - 1, Math.max(0, event.selection ?? 0));
    core.status.boxAnimateObjs = [];

    canvas.save();
    canvas.fillStyle = "#000";
    canvas.fillRect(118, 104, 207, 207);
    canvas.strokeStyle = "#b8773b";
    canvas.lineWidth = 3;
    canvas.strokeRect(118, 104, 207, 207);
    canvas.drawImage(core.material.images.npcs, 0, icon * 32, 32, 32, 123, 114, 32, 32);
    canvas.fillStyle = "white";
    canvas.font = '14px "Songti SC", SimSun, serif';
    const lines = ["想要增加你的能力吗？", `如果你有 ${shop.need} 个金币，你`, "可以任意选择一项："];
    lines.forEach((line, i) => canvas.fillText(line, 161, 128 + i * 16));
    canvas.textAlign = "center";
    choices.forEach((choice, i) => canvas.fillText(choice.text || choice, 221, 195 + i * 28));
    canvas.strokeStyle = "#f5f5f5";
    canvas.lineWidth = 3;
    canvas.strokeRect(125, 176 + event.selection * 28, 192, 28);
    canvas.restore();
}

function installClassicUI(game) {
    const playfield = document.querySelector("#playfield");
    const touchControls = document.querySelector("#touchControls");
    game.resize = () => {
        touchControls.hidden = !game.isPlaying() && !game.status.isStarting;
        const scale = Math.min(1, playfield.clientWidth / 570, playfield.clientHeight / 410);
        game.dom.gameGroup.style.setProperty("--scale", scale);
        game.domStyle.scale = scale;
        game.domStyle.screenMode = "bigScreen";
        Object.values(game.canvas).forEach(context => { context.imageSmoothingEnabled = false; });
    };
    new ResizeObserver(game.resize).observe(playfield);

    const hideStart = game.hideStartAnimate;
    game.hideStartAnimate = callback => hideStart.call(game, () => {
        game.resize();
        callback?.();
    });

    installTouchControls(game, touchControls);
    for (const surface of [playfield, touchControls]) {
        surface.addEventListener("contextmenu", event => event.preventDefault());
        surface.addEventListener("dragstart", event => event.preventDefault());
    }

    game.getClickLoc = (x, y) => {
        const rect = game.dom.data.getBoundingClientRect();
        const localX = x - rect.left;
        const localY = y - rect.top;
        const size = rect.width / 13;
        // The map is inset by one tile, while panels use the whole canvas.
        if (!game.status.lockControl &&
            (localX < size || localX >= 12 * size || localY < size || localY >= 12 * size)) return null;
        return { x: localX, y: localY, size };
    };

    const update = game.updateStatusBar;
    game.updateStatusBar = () => {
        update.call(game);
        game.statusBar.floor.textContent = floorLabel(game.status.floorId);
        for (const key of ["yellowKey", "blueKey", "redKey"]) {
            game.statusBar[key].textContent = game.status.hero.items.keys[key];
        }
    };

    const drawChoices = main.ui.drawChoices;
    main.ui.drawChoices = (content, choices) => {
        if (game.status.event.id === "shop" && game.status.event.data.shop.id.startsWith("moneyShop")) {
            drawClassicGoldShop(content, choices);
        } else {
            drawChoices.call(main.ui, content, choices);
        }
    };

    const dataCanvas = game.dom.data;
    const findGoldShopChoice = (clientX, clientY) => {
        const event = game.status.event;
        if (event?.id !== "shop" || !event.data.shop.id.startsWith("moneyShop")) return null;
        const rect = dataCanvas.getBoundingClientRect();
        const x = (clientX - rect.x) * 416 / rect.width;
        const y = (clientY - rect.y) * 416 / rect.height;
        const choice = Math.floor((y - 176) / 28);
        return x >= 125 && x <= 317 && choice >= 0 && choice < event.ui.choices.length ? choice : -1;
    };
    const chooseGoldShop = (clientX, clientY) => {
        const choice = findGoldShopChoice(clientX, clientY);
        if (choice === null) return false;
        if (choice >= 0) {
            const count = game.status.event.data.shop.choices.length;
            game.events.clickShop(6, 6 - Math.floor(count / 2) + choice);
        }
        return true;
    };
    dataCanvas.addEventListener("mousedown", event => {
        if (event.button === 0 && chooseGoldShop(event.clientX, event.clientY)) event.stopImmediatePropagation();
    }, { capture: true });
    dataCanvas.addEventListener("touchstart", event => {
        const touch = event.changedTouches[0];
        if (chooseGoldShop(touch.clientX, touch.clientY)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, { capture: true, passive: false });
}

function installTouchControls(game, controls) {
    let activePointer;

    const keepButtonActivation = event => {
        if (event.code === "Enter" || event.code === "Space") event.stopPropagation();
    };
    controls.addEventListener("keydown", keepButtonActivation);
    controls.addEventListener("keyup", keepButtonActivation);

    function cancelDirection() {
        const pointer = activePointer;
        activePointer = null;
        if (pointer && game.keyboardInput?.key === pointer.keyCode) game.stopKeyboardMove();
    }

    function finishDirection(event) {
        if (event.pointerId !== activePointer?.id) return;
        if (event.type !== "pointerup") {
            cancelDirection();
            return;
        }
        const { keyCode } = activePointer;
        activePointer = null;
        game.onkeyUp({ keyCode });
    }

    window.addEventListener("pointerup", finishDirection, true);
    window.addEventListener("pointercancel", finishDirection, true);
    controls.addEventListener("lostpointercapture", finishDirection);
    window.addEventListener("blur", cancelDirection);
    window.addEventListener("pagehide", cancelDirection);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) cancelDirection();
    });

    for (const button of controls.querySelectorAll("[data-direction]")) {
        const keyCode = Number(button.dataset.direction);
        button.addEventListener("pointerdown", event => {
            if (event.button !== 0 || !(game.isPlaying() || game.status.lockControl)) return;
            if (activePointer) {
                // A new primary pointer of the same type means the previous gesture ended.
                if (!event.isPrimary || event.pointerType !== activePointer.type) return;
                cancelDirection();
            }
            event.preventDefault();
            button.setPointerCapture(event.pointerId);
            activePointer = { id: event.pointerId, type: event.pointerType, keyCode };
            game.onkeyDown({ keyCode });
        });
        button.addEventListener("click", event => {
            if (event.detail === 0 && (game.isPlaying() || game.status.lockControl)) {
                game.onkeyDown({ keyCode });
                game.onkeyUp({ keyCode });
            }
        });
    }

    for (const button of controls.querySelectorAll("[data-game-key]")) {
        const keyCode = Number(button.dataset.gameKey);
        button.addEventListener("click", () => {
            if (game.status.lockControl || (game.isPlaying() && keyCode !== 27)) game.onkeyUp({ keyCode });
            game.dom.data.focus({ preventScroll: true });
        });
    }
    for (const button of controls.querySelectorAll("[data-slot-mode]")) {
        button.addEventListener("click", () => openSaveSlots(button.dataset.slotMode));
    }
}

const battleArt = new Image();
battleArt.src = "images/classic/battle.png";
const battleCanvas = document.querySelector("#battle");

function drawClassicBattle(id, done) {
    const monster = core.material.enemys[id];
    const hero = core.status.hero;
    const openingDamage = core.enemys.getExtraDamage(monster) +
        (core.enemys.hasSpecial(monster.special, 11) ? Math.floor(hero.hp * monster.value) : 0);
    const outgoing = Math.max(1, hero.atk - monster.def);
    const returning = Math.max(0, monster.atk - hero.def);
    let enemyHP = monster.hp;
    let heroHP = hero.hp - openingDamage;
    let heroTurn = true;
    let struck = null;
    const ownsEvent = !core.status.event.id;
    if (ownsEvent) core.status.event.id = "battle";
    core.lockControl();
    battleCanvas.hidden = false;
    const context = battleCanvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    const paint = () => {
        context.clearRect(0, 0, 570, 410);
        if (battleArt.complete && battleArt.naturalWidth) context.drawImage(battleArt, 7, 27);
        context.drawImage(core.material.images.enemys, 0, 32 * core.material.icons.enemys[id], 32, 32, 37, 76, 64, 64);
        context.drawImage(core.material.images.hero, 0, 0, 32, 32, 473, 76, 64, 64);
        context.fillStyle = "white";
        context.font = "italic bold 20px Arial, sans-serif";
        context.textAlign = "right";
        [enemyHP, monster.atk, monster.def].forEach((value, row) => context.fillText(value, 212, 105 + row * 57));
        context.textAlign = "left";
        [heroHP, hero.atk, hero.def].forEach((value, row) => context.fillText(value, 358, 105 + row * 57));
        if (struck !== null) {
            context.fillStyle = "#f5ae6266";
            context.fillRect(struck, 76, 64, 64);
        }
    };
    paint();
    const timer = setInterval(() => {
        if (heroTurn) {
            const critical = Math.floor(Math.random() * 200) <= hero.lv;
            enemyHP = Math.max(0, enemyHP - outgoing * (critical ? 2 : 1));
            core.playSound(critical ? "classic-critical.mp3" : "classic-hit.mp3");
            struck = 37;
        } else {
            heroHP = Math.max(0, heroHP - returning);
            core.playSound(returning ? "classic-retaliate.mp3" : "classic-guard.mp3");
            struck = 473;
        }
        paint();
        if (heroHP <= 0 || (!heroTurn && enemyHP === 0)) {
            clearInterval(timer);
            setTimeout(() => {
                battleCanvas.hidden = true;
                if (ownsEvent) {
                    core.status.event.id = null;
                    core.unLockControl();
                }
                done(hero.hp - heroHP);
            }, 220);
        }
        heroTurn = !heroTurn;
    }, 150);
}

let playClock = 0;

function installClassicRules(game) {
    const mathDamage = game.enemys.getDamage;
    game.enemys.getDamage = function(id) {
        const monster = game.material.enemys[id];
        const hero = game.status.hero;
        const deterministic = mathDamage.call(this, id);
        if (hero.atk <= monster.def) return deterministic;
        // The original pre-fight check uses the integer quotient.
        const remainder = monster.hp % (hero.atk - monster.def);
        return deterministic + (remainder === 0 ? Math.max(0, monster.atk - hero.def) : 0);
    };
    const init = game.events.afterLoadData;
    game.events.afterLoadData = function(data) {
        init.call(this, data);
        playClock = Date.now() - (data?.elapsedMs || 0);
    };
    game.events.beforeSaveData = data => {
        data.elapsedMs = Math.max(0, Date.now() - playClock);
    };

    setInterval(() => {
        if (!game.isPlaying() || game.status.lockControl || !playClock ||
            game.hasFlag("secretTreasure") || game.hasFlag("timedRewardExpired") ||
            Date.now() - playClock < 25 * 60 * 1000) return;
        game.setFlag("timedRewardExpired", true);
        const npc = game.getBlock(5, 5, "MT16", false);
        if (npc) {
            const wall = game.maps.getBlock(5, 5, 1);
            game.maps.addInfo(wall);
            Object.assign(npc.block, wall);
            if (game.status.floorId === "MT16") {
                game.drawMap("MT16");
                const {direction, x, y} = game.status.hero.loc;
                game.drawHero(direction, x, y, "stop");
            }
        }
    }, 500);
    game.ui.drawBattleAnimate = drawClassicBattle;
}
