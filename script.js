(function () {
	var skyStops = [
		{ h: 0,    top: '#04061a', bottom: '#0b1440' },
		{ h: 4,    top: '#04061a', bottom: '#10225c' },
		{ h: 6,    top: '#2b3a6e', bottom: '#dd8a52' },
		{ h: 8,    top: '#4fa8e0', bottom: '#d9f0ff' },
		{ h: 12,   top: '#3d8fe0', bottom: '#bfe6ff' },
		{ h: 16,   top: '#4f7fc0', bottom: '#f0c383' },
		{ h: 18,   top: '#d1546b', bottom: '#ffcf7a' },
		{ h: 20,   top: '#241b45', bottom: '#7a4a68' },
		{ h: 22,   top: '#0a0e2e', bottom: '#1c1f4d' },
		{ h: 24,   top: '#04061a', bottom: '#0b1440' }
	];

	function hexToRgb(hex) {
		var n = parseInt(hex.slice(1), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}
	function lerp(a, b, t) { return a + (b - a) * t; }
	function mixRgb(c1, c2, t) {
		return 'rgb(' +
			Math.round(lerp(c1[0], c2[0], t)) + ',' +
			Math.round(lerp(c1[1], c2[1], t)) + ',' +
			Math.round(lerp(c1[2], c2[2], t)) + ')';
	}

	function applySky() {
		var now = new Date();
		var h = now.getHours() + now.getMinutes() / 60;
		var a = skyStops[0], b = skyStops[skyStops.length - 1];
		for (var i = 0; i < skyStops.length - 1; i++) {
			if (h >= skyStops[i].h && h <= skyStops[i + 1].h) {
				a = skyStops[i];
				b = skyStops[i + 1];
				break;
			}
		}
		var t = (h - a.h) / ((b.h - a.h) || 1);
		var top = mixRgb(hexToRgb(a.top), hexToRgb(b.top), t);
		var bottom = mixRgb(hexToRgb(a.bottom), hexToRgb(b.bottom), t);
		document.documentElement.style.setProperty('--sky-top', top);
		document.documentElement.style.setProperty('--sky-bottom', bottom);
	}
	applySky();
	setInterval(applySky, 60 * 1000);
})();

var SoundState = { muted: true, stepSounds: [] };

(function () {
	var soundToggleBtn = document.querySelector('.sound-toggle');
	var soundIconImg = document.querySelector('.sound-icon');
	var ICON_ON = 'images/sound-on.png';
	var ICON_OFF = 'images/sound-off.png';

	soundToggleBtn.addEventListener('click', function () {
		SoundState.muted = !SoundState.muted;
		soundToggleBtn.setAttribute('data-muted', SoundState.muted);

		if (SoundState.muted) {
			soundIconImg.src = ICON_OFF;
			soundIconImg.alt = "Sound Off Icon";
		} else {
			soundIconImg.src = ICON_ON;
			soundIconImg.alt = "Sound On Icon";
			SoundState.stepSounds.forEach(function (snd) {
				snd.play().then(function () {
					snd.pause();
				}).catch(function (e) {});
			});
		}
	});
})();

(function () {
	var treeAssets = [
		{ src: 'images/tree-a.png', w: 35, h: 34 },
		{ src: 'images/tree-b.png', w: 32, h: 32 },
		{ src: 'images/tree-c.png', w: 32, h: 41 },
		{ src: 'images/tree-d.png', w: 25, h: 19 }
	];

	var layer = document.querySelector('.trees');
	var slots = window.innerWidth < 700 ? 5 : 9;

	for (var i = 0; i < slots; i++) {
		var asset = treeAssets[Math.floor(Math.random() * treeAssets.length)];
		var el = document.createElement('div');
		el.className = 'tree';
		el.style.backgroundImage = "url('" + asset.src + "')";
		el.style.width = 'calc(var(--art-px) * ' + asset.w + ')';
		el.style.height = 'calc(var(--art-px) * ' + asset.h + ')';

		var slotWidth = 100 / slots;
		var left = slotWidth * i + Math.random() * (slotWidth * 0.6);
		el.style.left = left.toFixed(1) + '%';
		el.style.transform = Math.random() < 0.5 ? 'scaleX(-1)' : 'none';

		layer.appendChild(el);
	}
})();

function spawnCharacter(opts) {
	var sprite = document.querySelector(opts.selector);
	var wrap = sprite.closest('.char-wrap');
	var className = opts.selector.slice(1);
	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	var nameLabel = wrap.querySelector('.char-name');
	if (nameLabel && opts.name) nameLabel.textContent = opts.name;

	var frame = 0;
	var frameTimer = null;

	var stepSound = null;
	if (opts.stepSound) {
		stepSound = new Audio(opts.stepSound);
		stepSound.volume = opts.stepSoundVolume != null ? opts.stepSoundVolume : 0.4;
		SoundState.stepSounds.push(stepSound);
	}

	function playStepSound(state, currentFrame) {
		if (!stepSound || state !== 'run' || SoundState.muted) return;
		if (!opts.stepFrames || opts.stepFrames.indexOf(currentFrame) === -1) return;
		stepSound.currentTime = 0;
		stepSound.play().catch(function (e) {});
	}

	function setState(state) {
		if (sprite.dataset.state === state) return;
		sprite.dataset.state = state;
		sprite.className = className + ' ' + state;
		frame = 0;
		sprite.style.backgroundPositionX = '0%';
		clearInterval(frameTimer);
		if (reduceMotion) return;
		var count = opts.frameCounts[state];
		frameTimer = setInterval(function () {
			frame = (frame + 1) % count;
			// exact frame offset as a fraction of the sheet, no off-by-one drift
			sprite.style.backgroundPositionX = (frame / (count - 1) * 100) + '%';
			playStepSound(state, frame);
		}, opts.frameDurations[state]);
	}

	setState('idle');
	if (reduceMotion) return; // stand still, no patrol

	var minX = opts.minX, maxX = opts.maxX;
	var x = opts.startX;
	wrap.style.left = x + 'vw';
	var patrolTimeout = null;

	function goTo(targetX) {
		var dist = Math.abs(targetX - x);
		var duration = dist / opts.speed;
		sprite.style.transform = targetX > x ? 'scaleX(1)' : 'scaleX(-1)';
		setState('run');
		wrap.style.transition = 'left ' + duration.toFixed(2) + 's linear';
		requestAnimationFrame(function () {
			wrap.style.left = targetX + 'vw';
		});
		x = targetX;
		return duration;
	}

	function idleThen(next) {
		setState('idle');
		var pause = opts.pauseMin + Math.random() * opts.pauseRange;
		patrolTimeout = setTimeout(next, pause);
	}

	function nextLeg() {
		var target;
		do {
			target = minX + Math.random() * (maxX - minX);
		} while (Math.abs(target - x) < opts.minDist);
		var duration = goTo(target);
		patrolTimeout = setTimeout(function () {
			idleThen(nextLeg);
		}, duration * 1000);
	}

	idleThen(nextLeg);

	document.addEventListener('visibilitychange', function () {
		if (document.hidden) {
			clearTimeout(patrolTimeout);
			clearInterval(frameTimer);
			var computedLeft = window.getComputedStyle(wrap).left;
			wrap.style.transition = 'none';
			wrap.style.left = computedLeft;
			x = (parseFloat(computedLeft) / window.innerWidth) * 100;
			wrap.style.left = x + 'vw';
		} else {
			sprite.dataset.state = '';
			idleThen(nextLeg);
		}
	});
}

spawnCharacter({
	selector: '.knight',
	name: 'Trigger',
	frameCounts: { run: 8, idle: 2 },
	frameDurations: { run: 50, idle: 333.33 },
	speed: 15,
	minX: 1, maxX: 91,
	startX: 1,
	pauseMin: 2000, pauseRange: 4000,
	minDist: 20,
	stepSound: 'sounds/step-knight.wav',
	stepSoundVolume: 0.1,
	stepFrames: [3, 7]
});

spawnCharacter({
	selector: '.darkin',
	name: 'Spectre',
	frameCounts: { run: 3, idle: 2 },
	frameDurations: { run: 140, idle: 333.33 },
	speed: 15,
	minX: 1, maxX: 91,
	startX: 31,
	pauseMin: 1900, pauseRange: 6000,
	minDist: 20,
	stepSound: 'sounds/step-darkin.wav',
	stepSoundVolume: 0.1,
	stepFrames: [2]
});

spawnCharacter({
	selector: '.dweller',
	name: 'Stalker',
	frameCounts: { run: 8, idle: 2 },
	frameDurations: { run: 60, idle: 333.33 },
	speed: 15,
	minX: 1, maxX: 91,
	startX: 61,
	pauseMin: 1800, pauseRange: 7000,
	minDist: 20,
	stepSound: 'sounds/step-dweller.wav',
	stepSoundVolume: 0.1,
	stepFrames: [3, 7]
});

spawnCharacter({
	selector: '.cyclops',
	name: 'Hunter',
	frameCounts: { run: 8, idle: 2 },
	frameDurations: { run: 80, idle: 333.33 },
	speed: 15,
	minX: 1, maxX: 91,
	startX: 91,
	pauseMin: 1700, pauseRange: 8000,
	minDist: 20,
	stepSound: 'sounds/step-cyclops.wav',
	stepSoundVolume: 0.1,
	stepFrames: [3, 7]
});
