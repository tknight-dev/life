import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusOutputDataStats, masks, Stat, Stats, xyWidthBits } from './workers/calc/calc.model';
import { FullscreenEngine } from './engines/fullscreen.engine';
import { Interaction, InteractionMode } from './interaction';
import { KeyboardEngine, KeyAction, KeyCommon } from './engines/keyboard.engine';
import { MouseEngine } from './engines/mouse.engine';
import NoSleep from 'nosleep.js';
import { Orientation, OrientationEngine } from './engines/orientation.engine';
import { TouchEngine } from './engines/touch.engine';
import { VideoBusEngine } from './workers/video/video.bus';
import { VideoBusInputDataSettingsFPS, VideoBusOutputDataStats } from './workers/video/video.model';
import { VisibilityEngine } from './engines/visibility.engine';
import packageJSON from '../package.json';

/**
 * @author tknight-dev
 */

// ESBuild live reloader
new EventSource('/esbuild').addEventListener('change', () => location.reload());

class Life extends Interaction {
	private static elementAlive: HTMLElement;
	private static elementControls: HTMLElement;
	private static elementCounts: HTMLElement;
	private static elementDead: HTMLElement;
	private static elementDataContainer: HTMLElement;
	private static elementEditAddDeath: HTMLElement;
	private static elementEditAddLife: HTMLElement;
	private static elementEditMove: HTMLElement;
	private static elementEditRemove: HTMLElement;
	private static elementGame: HTMLElement;
	private static elementGameOver: HTMLElement;
	private static elementHomeostatic: HTMLElement;
	private static elementFPS: HTMLElement;
	private static elementFullscreen: HTMLElement;
	private static elementIPSRequested: HTMLElement;
	private static elementLogo: HTMLElement;
	private static elementMenu: HTMLElement;
	private static elementMenuContent: HTMLElement;
	private static elementMenuRules: HTMLElement;
	private static elementMenuSettings: HTMLElement;
	private static elementPerformance: HTMLElement;
	private static elementPerformanceAll: HTMLElement;
	private static elementPerformanceBus: HTMLElement;
	private static elementPerformanceCalc: HTMLElement;
	private static elementPerformanceCtV: HTMLElement;
	private static elementPerformanceDraw: HTMLElement;
	private static elementPerformanceHomeostatis: HTMLElement;
	private static elementPerformanceNeighbors: HTMLElement;
	private static elementPerformanceState: HTMLElement;
	private static elementRules: HTMLElement;
	private static elementRulesClose: HTMLButtonElement;
	private static elementSettings: HTMLElement;
	private static elementSettingsApply: HTMLButtonElement;
	private static elementSettingsCancel: HTMLButtonElement;
	private static elementSettingsValueCPUSpinOutProtection: HTMLInputElement;
	private static elementSettingsValueDrawDeadCells: HTMLInputElement;
	private static elementSettingsValueDrawGrid: HTMLInputElement;
	private static elementSettingsValueFPS: HTMLInputElement;
	private static elementSettingsValueFPSShow: HTMLInputElement;
	private static elementSettingsValueHomeostaticPause: HTMLInputElement;
	private static elementSettingsValueIPS: HTMLInputElement;
	private static elementSettingsValueOrientationAutoRotate: HTMLInputElement;
	private static elementSettingsValueResolution: HTMLInputElement;
	private static elementSettingsValueSeedRandom: HTMLInputElement;
	private static elementSettingsValueStatsShowAliveDead: HTMLInputElement;
	private static elementSettingsValueStatsShowPerformance: HTMLInputElement;
	private static elementSettingsValueTableSize: HTMLInputElement;
	private static elementSpinout: HTMLElement;
	private static elementStats: HTMLElement;
	private static elementStatsC: HTMLElement;
	private static elementStatsCPS: HTMLElement;
	private static elementStatsCPSAll: HTMLElement;
	private static elementVersion: HTMLElement;
	private static elementWebGLNotSupported: HTMLElement;
	private static noSleep: NoSleep = new NoSleep();
	private static performanceCalc: number = 0;
	private static performanceVideo: number = 0;
	private static timeoutControl: ReturnType<typeof setTimeout>;
	private static timeoutFullscreen: ReturnType<typeof setTimeout>;
	private static timeoutPlay: ReturnType<typeof setTimeout>;
	private static timeoutReset: ReturnType<typeof setTimeout>;

	private static initializeDOM(): void {
		Life.elementAlive = <HTMLElement>document.getElementById('alive');
		Interaction.elementCanvas = <HTMLCanvasElement>document.getElementById('canvas');
		Interaction.elementCanvasInteractive = <HTMLElement>document.getElementById('canvas-interactive');

		Life.elementRules = <HTMLButtonElement>document.getElementById('rules');
		Life.elementRulesClose = <HTMLButtonElement>document.getElementById('rules-close');
		Life.elementRulesClose.onclick = () => {
			Life.elementRules.style.display = 'none';
		};

		Life.elementCounts = <HTMLElement>document.getElementById('counts');
		Life.elementDataContainer = <HTMLElement>document.getElementById('data-container');
		Life.elementDead = <HTMLCanvasElement>document.getElementById('dead');
		Life.elementFPS = <HTMLElement>document.getElementById('fps');
		Life.elementFullscreen = <HTMLElement>document.getElementById('fullscreen');
		Life.elementGame = <HTMLElement>document.getElementById('game');
		Life.elementGameOver = <HTMLElement>document.getElementById('game-over');
		Life.elementHomeostatic = <HTMLElement>document.getElementById('homeostatic');
		Life.elementIPSRequested = <HTMLElement>document.getElementById('ips-requested');
		Life.elementLogo = <HTMLElement>document.getElementById('logo');
		Interaction.elementRotator = <HTMLElement>document.getElementById('rotator');
		Interaction.elementSpinner = <HTMLElement>document.getElementById('spinner');
		Life.elementSpinout = <HTMLElement>document.getElementById('spinout');
		Life.elementStats = <HTMLElement>document.getElementById('stats');
		Life.elementStatsC = <HTMLElement>document.getElementById('c');
		Life.elementStatsCPS = <HTMLElement>document.getElementById('cps');
		Life.elementStatsCPSAll = <HTMLElement>document.getElementById('cps-all');
		Life.elementVersion = <HTMLElement>document.getElementById('version');
		Life.elementVersion.innerText = `v${packageJSON.version}`;
		Life.elementWebGLNotSupported = <HTMLElement>document.getElementById('webgl-not-supported');

		/**
		 * Controls
		 */
		Life.elementControls = <HTMLElement>document.getElementById('controls');
		Interaction.elementControlsBackward = <HTMLElement>document.getElementById('backward');
		Interaction.elementControlsBackwardFunc = () => {
			Interaction.settingsCalc.iterationsPerSecond = Math.max(1, Math.round(Interaction.settingsCalc.iterationsPerSecond / 2));

			Life.elementSettingsValueIPS.value = String(Interaction.settingsCalc.iterationsPerSecond);
			Life.elementIPSRequested.innerText = Interaction.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			Life.elementIPSRequested.style.display = 'flex';
			Life.elementIPSRequested.classList.add('show');
			Life.elementSpinout.classList.remove('show');

			clearTimeout(Life.timeoutControl);
			Life.timeoutControl = setTimeout(() => {
				Life.elementIPSRequested.classList.remove('show');
				Life.elementSpinout.classList.add('show');
			}, 1000);

			CalcBusEngine.outputSettings(Interaction.settingsCalc);
		};
		Interaction.elementControlsBackward.onclick = Interaction.elementControlsBackwardFunc;

		Interaction.elementControlsForward = <HTMLElement>document.getElementById('forward');
		Interaction.elementControlsForwardFunc = () => {
			Interaction.settingsCalc.iterationsPerSecond = Math.min(
				Interaction.settingsCalcIPSMax,
				Interaction.settingsCalc.iterationsPerSecond * 2,
			);

			Life.elementSettingsValueIPS.value = String(Interaction.settingsCalc.iterationsPerSecond);
			Life.elementIPSRequested.innerText = Interaction.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			Life.elementIPSRequested.style.display = 'flex';
			Life.elementIPSRequested.classList.add('show');
			Life.elementSpinout.classList.remove('show');

			clearTimeout(Life.timeoutControl);
			Life.timeoutControl = setTimeout(() => {
				Life.elementIPSRequested.classList.remove('show');
				Life.elementSpinout.classList.add('show');
			}, 1000);

			CalcBusEngine.outputSettings(Interaction.settingsCalc);
		};
		Interaction.elementControlsForward.onclick = Interaction.elementControlsForwardFunc;

		Interaction.elementControlsPause = <HTMLElement>document.getElementById('pause');
		Interaction.elementControlsPauseFunc = () => {
			Interaction.elementControlsPause.style.display = 'none';
			if (!Interaction.gameover) {
				Interaction.elementControlsPlay.style.display = 'block';
			}

			Life.elementStatsCPS.style.display = 'none';

			CalcBusEngine.outputPause();
		};
		Interaction.elementControlsPause.onclick = Interaction.elementControlsPauseFunc;
		Interaction.elementControlsPause.style.display = 'none';

		Interaction.elementControlsPlay = <HTMLElement>document.getElementById('play');
		Interaction.elementControlsPlayFunc = () => {
			Interaction.elementControlsPlay.style.display = 'none';
			Interaction.elementControlsPause.style.display = 'block';

			Life.elementEditMove.click();

			Life.elementHomeostatic.classList.remove('show');
			Life.elementStatsCPS.style.display = 'block';
			Life.elementIPSRequested.innerText = Interaction.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			Life.elementIPSRequested.classList.add('show');
			Life.elementSpinout.classList.remove('show');
			Life.timeoutPlay = setTimeout(() => {
				Life.elementHomeostatic.style.display = 'none';
				Life.elementIPSRequested.classList.remove('show');
				Life.elementSpinout.style.display = 'none';
			}, 1000);

			CalcBusEngine.outputPlay();
		};
		Interaction.elementControlsPlay.onclick = Interaction.elementControlsPlayFunc;

		Interaction.elementControlsReset = <HTMLElement>document.getElementById('reset');
		Interaction.elementControlsResetFunc = () => {
			Interaction.spinner(true);

			const data: Uint32Array = Life.initializeLife();
			VideoBusEngine.outputReset();
			CalcBusEngine.outputReset(data);
			Interaction.gameover = false;

			Life.elementAlive.innerText = '';
			Life.elementDead.innerText = '';

			Interaction.elementControlsBackward.style.display = 'block';
			Interaction.elementControlsForward.style.display = 'block';
			Interaction.elementControlsPlay.style.display = 'block';
			Interaction.elementControlsPause.style.display = 'none';

			Life.elementEditAddDeath.style.display = 'flex';
			Life.elementEditAddLife.style.display = 'flex';
			Life.elementEditMove.style.display = 'flex';
			Life.elementEditRemove.style.display = 'flex';

			if (!Interaction.settingsSeedRandom) {
				Life.elementEditAddLife.click();
			}

			Life.elementGameOver.classList.remove('show');
			Life.elementHomeostatic.classList.remove('show');
			Life.elementIPSRequested.style.display = 'flex';
			Life.elementSpinout.classList.remove('show');
			Life.timeoutReset = setTimeout(() => {
				Life.elementGameOver.style.display = 'none';
				Life.elementHomeostatic.style.display = 'none';
				Life.elementSpinout.style.display = 'none';
			}, 1000);
			Life.elementStatsC.innerText = '0';
		};
		Interaction.elementControlsReset.onclick = Interaction.elementControlsResetFunc;

		/**
		 * Edit
		 */
		Life.elementEditAddDeath = <HTMLElement>document.getElementById('edit-add-death');
		Life.elementEditAddDeath.onclick = () => {
			if (Interaction.mode !== InteractionMode.DRAW_DEATH && Interaction.settingsVideo.drawDeadCells) {
				Interaction.mode = InteractionMode.DRAW_DEATH;

				Life.elementEditAddDeath.classList.add('active');
				Life.elementEditAddLife.classList.remove('active');
				Life.elementEditMove.classList.remove('active');
				Life.elementEditRemove.classList.remove('active');

				Life.elementEdit.classList.add('add');
				Life.elementEdit.classList.remove('remove');

				Interaction.elementCanvasInteractive.classList.add('cursor-crosshair');
				Interaction.elementCanvasInteractive.classList.remove('cursor-grab');

				if (Interaction.elementControlsPause.style.display === 'block') {
					Interaction.elementControlsPause.click();
				}
			}
		};
		Life.elementEditAddLife = <HTMLElement>document.getElementById('edit-add-life');
		Life.elementEditAddLife.onclick = () => {
			if (Interaction.mode !== InteractionMode.DRAW_LIFE) {
				Interaction.mode = InteractionMode.DRAW_LIFE;

				Life.elementEditAddDeath.classList.remove('active');
				Life.elementEditAddLife.classList.add('active');
				Life.elementEditMove.classList.remove('active');
				Life.elementEditRemove.classList.remove('active');

				Life.elementEdit.classList.add('add');
				Life.elementEdit.classList.remove('remove');

				Interaction.elementCanvasInteractive.classList.add('cursor-crosshair');
				Interaction.elementCanvasInteractive.classList.remove('cursor-grab');

				if (Interaction.elementControlsPause.style.display === 'block') {
					Interaction.elementControlsPause.click();
				}
			}
		};
		Life.elementEditMove = <HTMLElement>document.getElementById('edit-move');
		Life.elementEditMove.onclick = () => {
			if (Interaction.mode !== InteractionMode.MOVE_ZOOM) {
				Interaction.mode = InteractionMode.MOVE_ZOOM;

				Life.elementEditAddDeath.classList.remove('active');
				Life.elementEditAddLife.classList.remove('active');
				Life.elementEditMove.classList.add('active');
				Life.elementEditRemove.classList.remove('active');

				Interaction.elementCanvasInteractive.classList.remove('cursor-crosshair');
				Interaction.elementCanvasInteractive.classList.add('cursor-grab');

				Interaction.elementEdit.style.display = 'none';
			}
		};
		Life.elementEditRemove = <HTMLElement>document.getElementById('edit-remove');
		Life.elementEditRemove.onclick = () => {
			if (Interaction.mode !== InteractionMode.ERASE) {
				Interaction.mode = InteractionMode.ERASE;

				Life.elementEditAddDeath.classList.remove('active');
				Life.elementEditAddLife.classList.remove('active');
				Life.elementEditMove.classList.remove('active');
				Life.elementEditRemove.classList.add('active');

				Interaction.elementCanvasInteractive.classList.add('cursor-crosshair');
				Interaction.elementCanvasInteractive.classList.remove('cursor-grab');

				Life.elementEdit.classList.remove('add');
				Life.elementEdit.classList.add('remove');

				if (Interaction.elementControlsPause.style.display === 'block') {
					Interaction.elementControlsPause.click();
				}
			}
		};

		/**
		 * Fullscreen
		 */
		Life.elementFullscreen.onclick = async () => {
			Interaction.elementControlsPause.click();

			if (FullscreenEngine.isOpen()) {
				await FullscreenEngine.close();

				Life.elementControls.classList.remove('fullscreen');
				Life.elementCounts.classList.remove('fullscreen');
				Life.elementGame.classList.remove('fullscreen');
				Life.elementHomeostatic.classList.remove('fullscreen');
				Life.elementPerformance.classList.remove('fullscreen');
				Life.elementStats.classList.remove('fullscreen');

				Life.elementFullscreen.classList.remove('fullscreen-exit');
				Life.elementFullscreen.classList.add('fullscreen');

				OrientationEngine.unlock();
				Life.noSleep.disable();
				setTimeout(() => {
					Interaction.pxSizeCalc();
				}, 100);
			} else {
				await FullscreenEngine.open(Life.elementGame);

				Life.elementControls.classList.add('fullscreen');
				Life.elementControls.classList.add('show');
				Life.elementCounts.classList.add('fullscreen');
				Life.elementCounts.classList.add('adjust');
				Life.elementGame.classList.add('fullscreen');
				Life.elementHomeostatic.classList.add('fullscreen');
				Life.elementHomeostatic.classList.add('adjust');
				Life.elementPerformance.classList.add('fullscreen');
				Life.elementPerformance.classList.add('adjust');
				Life.elementStats.classList.add('fullscreen');
				Life.elementStats.classList.add('show');

				Life.elementFullscreen.classList.remove('fullscreen');
				Life.elementFullscreen.classList.add('fullscreen-exit');

				fullscreenFader();
				setTimeout(() => {
					Interaction.pxSizeCalc();
					OrientationEngine.lock(Orientation.LANDSCAPE);
					Life.noSleep.enable();
				}, 100);
			}
		};
		document.addEventListener('click', (event) => {
			if (FullscreenEngine.isOpen()) {
				if ((event.target as HTMLElement).id === 'canvas-interactive' && Life.elementControls.classList.contains('show')) {
					if (Interaction.mode === null) {
						Life.elementControls.classList.remove('show');
						Life.elementCounts.classList.remove('adjust');
						Life.elementHomeostatic.classList.remove('adjust');
						Life.elementPerformance.classList.remove('adjust');
						Life.elementStats.classList.remove('show');
					}
				} else {
					Life.elementControls.classList.add('show');
					Life.elementCounts.classList.add('adjust');
					Life.elementHomeostatic.classList.add('adjust');
					Life.elementPerformance.classList.add('adjust');
					Life.elementStats.classList.add('show');

					fullscreenFader();
				}
			}
		});
		const fullscreenFader = () => {
			clearTimeout(Life.timeoutFullscreen);
			Life.timeoutFullscreen = setTimeout(() => {
				if (Interaction.mode === null) {
					Life.elementControls.classList.remove('show');
					Life.elementCounts.classList.remove('adjust');
					Life.elementHomeostatic.classList.remove('adjust');
					Life.elementPerformance.classList.remove('adjust');
					Life.elementStats.classList.remove('show');
				} else {
					fullscreenFader();
				}
			}, 3000);
		};
		Life.elementControls.onmouseenter = () => {
			Life.elementControls.classList.add('show');
			Life.elementCounts.classList.add('adjust');
			Life.elementHomeostatic.classList.add('adjust');
			Life.elementPerformance.classList.add('adjust');
			Life.elementStats.classList.add('show');
			clearTimeout(Life.timeoutFullscreen);
		};
		Life.elementStats.onmouseenter = () => {
			Life.elementControls.classList.add('show');
			Life.elementCounts.classList.add('adjust');
			Life.elementHomeostatic.classList.add('adjust');
			Life.elementPerformance.classList.add('adjust');
			Life.elementStats.classList.add('show');
			clearTimeout(Life.timeoutFullscreen);
		};
		Life.elementControls.onmouseleave = () => {
			fullscreenFader();
		};
		Life.elementStats.onmouseleave = () => {
			fullscreenFader();
		};

		/**
		 * Menu
		 */
		Life.elementMenu = <HTMLElement>document.getElementById('info-menu');
		Life.elementMenu.onclick = () => {
			Life.elementLogo.classList.toggle('open');
			Life.elementMenuContent.classList.toggle('open');
		};
		Life.elementMenuContent = <HTMLElement>document.getElementById('menu-content');
		Life.elementMenuRules = <HTMLElement>document.getElementById('info-rules');
		Life.elementMenuRules.onclick = () => {
			Life.elementSettingsCancel.click();

			Life.elementLogo.classList.remove('open');
			Life.elementMenuContent.classList.remove('open');

			Life.elementRules.style.display = 'block';
		};
		Life.elementMenuSettings = <HTMLElement>document.getElementById('info-settings');
		Life.elementMenuSettings.onclick = () => {
			Life.elementRulesClose.click();

			Life.elementLogo.classList.remove('open');
			Life.elementMenuContent.classList.remove('open');

			Life.elementSettings.style.display = 'block';
		};

		document.addEventListener('click', (event: any) => {
			if (event.target.id !== 'info-menu') {
				Life.elementLogo.classList.remove('open');
				Life.elementMenuContent.classList.remove('open');
			}
		});

		/**
		 * Performance
		 */
		Life.elementPerformance = <HTMLElement>document.getElementById('performance');
		Life.elementPerformanceAll = <HTMLElement>document.getElementById('performance-all');
		Life.elementPerformanceBus = <HTMLElement>document.getElementById('performance-bus');
		Life.elementPerformanceCalc = <HTMLElement>document.getElementById('performance-calc');
		Life.elementPerformanceCtV = <HTMLElement>document.getElementById('performance-ctv');
		Life.elementPerformanceDraw = <HTMLElement>document.getElementById('performance-draw');
		Life.elementPerformanceHomeostatis = <HTMLElement>document.getElementById('performance-homeostatis');
		Life.elementPerformanceNeighbors = <HTMLElement>document.getElementById('performance-neighbors');
		Life.elementPerformanceState = <HTMLElement>document.getElementById('performance-state');

		/**
		 * Settings
		 */
		Life.elementSettings = <HTMLElement>document.getElementById('settings');
		Life.elementSettingsApply = <HTMLButtonElement>document.getElementById('settings-apply');
		Life.elementSettingsApply.onclick = () => {
			/**
			 * HTML -> JS
			 */
			Interaction.settingsCalc = {
				cpuSpinOutProtection: Boolean(Life.elementSettingsValueCPUSpinOutProtection.checked),
				homeostaticPause: Boolean(Life.elementSettingsValueHomeostaticPause.checked),
				fps: Number(Life.elementSettingsValueFPS.value),
				iterationsPerSecond: Math.round(
					Math.max(1, Math.min(Interaction.settingsCalcIPSMax, Number(Life.elementSettingsValueIPS.value))),
				),
				tableSizeX: <any>Number(Life.elementSettingsValueTableSize.value),
			};

			Interaction.settingsVideo = {
				drawDeadCells: Boolean(Life.elementSettingsValueDrawDeadCells.checked),
				drawGrid: Boolean(Life.elementSettingsValueDrawGrid.checked),
				fps: Interaction.settingsCalc.fps,
				resolution: <any>(
					(Life.elementSettingsValueResolution.value === 'null' ? null : Number(Life.elementSettingsValueResolution.value))
				),
				tableSizeX: Interaction.settingsCalc.tableSizeX,
			};

			if (Interaction.settingsVideo.drawDeadCells) {
				Life.elementEditAddDeath.classList.remove('disable');
			} else {
				Life.elementEditAddDeath.classList.add('disable');

				if (Interaction.mode === InteractionMode.DRAW_DEATH) {
					Life.elementEditMove.click();
				}
			}
			Interaction.settingsFPSShow = Boolean(Life.elementSettingsValueFPSShow.checked);
			if (!Interaction.settingsFPSShow) {
				Life.elementFPS.innerText = '';
			}
			Interaction.rotateAvailable = Boolean(Life.elementSettingsValueOrientationAutoRotate.checked);
			Interaction.settingsSeedRandom = Boolean(Life.elementSettingsValueSeedRandom.checked);
			Interaction.settingsStatsShowAliveDead = Boolean(Life.elementSettingsValueStatsShowAliveDead.checked);
			if (Interaction.settingsStatsShowAliveDead) {
				Life.elementCounts.style.display = 'block';
			} else {
				Life.elementCounts.style.display = 'none';
			}
			Interaction.settingsStatsShowPerformance = Boolean(Life.elementSettingsValueStatsShowPerformance.checked);
			if (Interaction.settingsStatsShowPerformance) {
				Life.elementPerformance.style.display = 'block';
			} else {
				Life.elementPerformance.style.display = 'none';
			}

			/**
			 * Main thread -> workers
			 */
			CalcBusEngine.outputSettings(Interaction.settingsCalc);
			VideoBusEngine.outputSettings(Interaction.settingsVideo);

			/**
			 * Done
			 */
			Life.elementSettings.style.display = 'none';
			Life.elementSettingsValueIPS.value = String(Interaction.settingsCalc.iterationsPerSecond);

			Interaction.pxSizeCalc();
			Interaction.rotator();
		};
		Life.elementSettingsCancel = <HTMLButtonElement>document.getElementById('settings-cancel');
		Life.elementSettingsCancel.onclick = () => {
			Life.elementSettings.style.display = 'none';
		};
		Life.elementSettingsValueCPUSpinOutProtection = <HTMLInputElement>document.getElementById('settings-value-cpu-spin-out-protection');
		Life.elementSettingsValueDrawDeadCells = <HTMLInputElement>document.getElementById('settings-value-draw-dead-cells');
		Life.elementSettingsValueHomeostaticPause = <HTMLInputElement>document.getElementById('settings-value-homeostatic-pause');
		Life.elementSettingsValueFPS = <HTMLInputElement>document.getElementById('settings-value-fps');
		Life.elementSettingsValueFPSShow = <HTMLInputElement>document.getElementById('settings-value-fps-show');
		Life.elementSettingsValueDrawGrid = <HTMLInputElement>document.getElementById('settings-value-draw-grid');
		Life.elementSettingsValueIPS = <HTMLInputElement>document.getElementById('settings-value-ips');
		Life.elementSettingsValueOrientationAutoRotate = <HTMLInputElement>(
			document.getElementById('settings-value-orientation-auto-rotate')
		);
		Life.elementSettingsValueResolution = <HTMLInputElement>document.getElementById('settings-value-resolution');
		Life.elementSettingsValueSeedRandom = <HTMLInputElement>document.getElementById('settings-value-seed-random');
		Life.elementSettingsValueStatsShowAliveDead = <HTMLInputElement>document.getElementById('settings-value-stats-show-alive-dead');
		Life.elementSettingsValueStatsShowPerformance = <HTMLInputElement>document.getElementById('settings-value-stats-show-performance');
		Life.elementSettingsValueTableSize = <HTMLInputElement>document.getElementById('settings-value-table-size');
	}

	private static initializeLife(): Uint32Array {
		const { xyValueAlive } = masks;

		if (Interaction.settingsSeedRandom) {
			let arrayCalc: number[] = [],
				tableSizeX: number = Interaction.settingsCalc.tableSizeX,
				tableSizeY: number = (Interaction.settingsCalc.tableSizeX * 9) / 16,
				x: number,
				y: number;

			// Random
			for (x = 0; x < tableSizeX; x++) {
				for (y = 0; y < tableSizeY; y++) {
					Math.random() > 0.5 && arrayCalc.push((x << xyWidthBits) | y | xyValueAlive);
				}
			}

			return Uint32Array.from(arrayCalc);
		} else {
			return new Uint32Array();
		}
	}

	/**
	 * Update the HTML defaults to match the values set here
	 */
	private static initializeSettings(): void {
		Interaction.settingsFPSShow = true; // def true
		Interaction.rotateAvailable = true; // def true
		Interaction.settingsSeedRandom = true; // def true
		Interaction.settingsStatsShowAliveDead = true; // def true
		Interaction.settingsStatsShowPerformance = false; // def false

		/*
		 * Video
		 */
		Interaction.settingsVideo = {
			drawDeadCells: true, // def true
			drawGrid: true, // def true
			fps: VideoBusInputDataSettingsFPS._60, // def 60
			resolution: null, // Native is null
			tableSizeX: 112, // def: 112y
		};

		if (Interaction.isMobileOrTablet()) {
			// Mobile devices utilize sub-pixel rendering with their canvas API implementations
			Interaction.settingsVideo.resolution = 512;
			Life.elementSettingsValueResolution.value = '512';
		}

		/*
		 * Calc
		 */
		Interaction.settingsCalc = {
			cpuSpinOutProtection: true, // def true
			homeostaticPause: false, // def false
			fps: Interaction.settingsVideo.fps,
			iterationsPerSecond: 16, // def: 16
			tableSizeX: Interaction.settingsVideo.tableSizeX,
		};

		/*
		 * URL Params
		 */
		const params: URLSearchParams = new URLSearchParams(document.location.search);
		for (let [name, value] of params.entries()) {
			switch (name.toLowerCase()) {
				case 'ad':
					Interaction.settingsStatsShowAliveDead = String(value).toLowerCase() === 'true';
					break;
				case 'fps':
					Interaction.settingsFPSShow = String(value).toLowerCase() === 'true';
					break;
				case 'i_s':
					Interaction.settingsCalc.iterationsPerSecond = Math.round(
						Math.max(1, Math.min(Interaction.settingsCalcIPSMax, Number(value) || 0)),
					);
					break;
				case 'perf':
					Interaction.settingsStatsShowPerformance = String(value).toLowerCase() === 'true';
					break;
				case 'res':
					if (String(value).toLowerCase() === 'null') {
						Interaction.settingsVideo.resolution = null;
					} else {
						switch (Number(value)) {
							case 256:
							case 384:
							case 512:
							case 640:
							case 1280:
							case 1920:
								Interaction.settingsVideo.resolution = <256 | 384 | 512 | 640 | 1280 | 1920>Number(value);
								break;
						}
					}
				case 'seedrandom':
					Interaction.settingsSeedRandom = String(value).toLowerCase() === 'true';
					break;
				case 'table':
					switch (Number(value)) {
						case 48:
						case 112:
						case 240:
						case 496:
						case 1008:
						case 2032:
							Interaction.settingsCalc.tableSizeX = <48 | 112 | 240 | 496 | 1008 | 2032>Number(value);
							Interaction.settingsVideo.tableSizeX = <48 | 112 | 240 | 496 | 1008 | 2032>Number(value);
							break;
					}
					break;
			}
		}

		/*
		 * HTML
		 */
		Life.elementSettingsValueCPUSpinOutProtection.checked = Interaction.settingsCalc.cpuSpinOutProtection;
		Life.elementSettingsValueDrawDeadCells.checked = Interaction.settingsVideo.drawDeadCells;
		Life.elementSettingsValueDrawGrid.checked = Interaction.settingsVideo.drawGrid;
		Life.elementSettingsValueHomeostaticPause.checked = Interaction.settingsCalc.homeostaticPause;
		Life.elementSettingsValueIPS.value = String(Interaction.settingsCalc.iterationsPerSecond);
		Life.elementSettingsValueFPS.value = String(Interaction.settingsCalc.fps);

		Life.elementSettingsValueFPSShow.checked = Interaction.settingsFPSShow;
		if (!Interaction.settingsFPSShow) {
			Life.elementFPS.innerText = '';
		}

		Life.elementSettingsValueOrientationAutoRotate.checked = Interaction.rotateAvailable;
		Life.elementSettingsValueResolution.value = String(Interaction.settingsVideo.resolution);
		Life.elementSettingsValueSeedRandom.checked = Interaction.settingsSeedRandom;

		Life.elementSettingsValueStatsShowAliveDead.checked = Interaction.settingsStatsShowAliveDead;
		if (Interaction.settingsStatsShowAliveDead) {
			Life.elementCounts.style.display = 'block';
		} else {
			Life.elementCounts.style.display = 'none';
		}

		Life.elementSettingsValueStatsShowPerformance.checked = Interaction.settingsStatsShowPerformance;
		if (Interaction.settingsStatsShowPerformance) {
			Life.elementPerformance.style.display = 'block';
		} else {
			Life.elementPerformance.style.display = 'none';
		}

		Life.elementSettingsValueTableSize.value = String(Interaction.settingsVideo.tableSizeX);
	}

	private static initializeWorkers(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			const data: Uint32Array = Life.initializeLife(),
				perf = (timeInMs: number) => {
					return timeInMs.toFixed(1).padStart(7, '_').replaceAll('_', '&nbsp;') + 'ms';
				};
			let then: number = performance.now();

			/*
			 * Load Calc Engine
			 */
			CalcBusEngine.setCallbackGameOver(() => {
				clearTimeout(Life.timeoutReset);
				Interaction.gameover = true;

				Interaction.elementControlsBackward.style.display = 'none';
				Interaction.elementControlsForward.style.display = 'none';
				Interaction.elementControlsPlay.style.display = 'none';
				Interaction.elementControlsPause.style.display = 'none';

				Interaction.mode = InteractionMode.ERASE;
				Life.elementEditMove.click();
				Life.elementEditAddLife.style.display = 'none';
				Life.elementEditRemove.style.display = 'none';

				Life.elementStatsCPSAll.style.display = 'none';

				Life.elementIPSRequested.classList.remove('show');
				Life.elementGameOver.style.display = 'flex';
				setTimeout(() => {
					Life.elementGameOver.classList.add('show');
				}, 10);
			});
			CalcBusEngine.setCallbackHomeostatic(() => {
				if (Interaction.settingsCalc.homeostaticPause) {
					Interaction.elementControlsPause.style.display = 'none';
					Interaction.elementControlsPlay.style.display = 'block';
				}
				clearTimeout(Life.timeoutPlay);
				clearTimeout(Life.timeoutReset);

				if (Life.elementHomeostatic.style.display === 'none') {
					Life.elementHomeostatic.style.display = 'block';

					setTimeout(() => {
						Life.elementHomeostatic.classList.add('show');
					}, 10);
				} else {
					Life.elementHomeostatic.classList.add('show');
				}
			});
			CalcBusEngine.setCallbackSpinOut(() => {
				Interaction.elementControlsPause.click();
				Life.elementSpinout.style.display = 'flex';
				setTimeout(() => {
					Life.elementSpinout.classList.add('show');
				}, 10);
			});
			CalcBusEngine.setCallbackStats((data: CalcBusOutputDataStats) => {
				// Performance
				const calcAvgInMs: number = Stat.getAVG(data.performance[Stats.CALC_AVG]),
					neighborsAvgInMs: number = Stat.getAVG(data.performance[Stats.CALC_NEIGHBORS_AVG]),
					stateAvgInMs: number = Stat.getAVG(data.performance[Stats.CALC_STATE_AVG]);

				Life.performanceCalc = neighborsAvgInMs + stateAvgInMs;

				Life.elementPerformanceBus.innerHTML = perf(Stat.getAVG(data.performance[Stats.CALC_BUS_AVG]));
				Life.elementPerformanceCalc.innerHTML = perf(calcAvgInMs);
				Life.elementPerformanceHomeostatis.innerHTML = perf(Stat.getAVG(data.performance[Stats.CALC_HOMEOSTASIS_AVG]));
				Life.elementPerformanceNeighbors.innerHTML = perf(neighborsAvgInMs);
				Life.elementPerformanceState.innerHTML = perf(stateAvgInMs);

				if (calcAvgInMs > (1000 / Life.settingsCalc.iterationsPerSecond) * 1.2) {
					Life.elementPerformanceCalc.style.color = 'red';
				} else if (calcAvgInMs > 1000 / Life.settingsCalc.iterationsPerSecond) {
					Life.elementPerformanceCalc.style.color = 'yellow';
				} else {
					Life.elementPerformanceCalc.style.color = 'white';
				}

				// Stats
				Life.elementAlive.innerText = data.alive.toLocaleString('en-US');
				Life.elementDead.innerText = data.dead.toLocaleString('en-US');

				// too many i/s requests results in deltas >1s
				const ipsEff: number = Math.max(1, (data.ips / (data.ipsDeltaInMS / 1000)) | 0);

				Life.elementStatsC.innerText = data.ipsTotal.toLocaleString('en-US');
				Life.elementStatsCPS.innerText = ipsEff.toLocaleString('en-US');
				Life.elementStatsCPSAll.style.display = 'flex';

				// I/S
				if (ipsEff < Interaction.settingsCalc.iterationsPerSecond * 0.8) {
					Life.elementStatsCPS.style.color = 'red';
				} else if (ipsEff < Interaction.settingsCalc.iterationsPerSecond * 0.9) {
					Life.elementStatsCPS.style.color = 'yellow';
				} else {
					Life.elementStatsCPS.style.color = 'green';
				}
			});
			CalcBusEngine.initialize(data, Interaction.settingsCalc, () => {
				console.log('Engine > Calculation: loaded in', performance.now() - then, 'ms');

				/*
				 * Load Video Engine
				 */
				then = performance.now();
				VideoBusEngine.setCallbackResetComplete(() => {
					Interaction.spinner(false);
				});
				VideoBusEngine.setCallbackStats((data: VideoBusOutputDataStats) => {
					// Performance
					const drawAvgInMs: number = Stat.getAVG(data.performance[Stats.VIDEO_DRAW_AVG]),
						fpsInMS: number = 1000 / Interaction.settingsVideo.fps;

					Life.performanceVideo = drawAvgInMs;

					Life.elementPerformanceAll.innerHTML = perf(Life.performanceCalc + Life.performanceVideo);
					Life.elementPerformanceCtV.innerHTML = perf(Stat.getAVG(data.performance[Stats.CALC_TO_VIDEO_BUS_AVG]));
					Life.elementPerformanceDraw.innerHTML = perf(drawAvgInMs);

					if (drawAvgInMs > fpsInMS * 1.2) {
						Life.elementPerformanceDraw.style.color = 'red';
					} else if (drawAvgInMs > fpsInMS * 1.1) {
						Life.elementPerformanceDraw.style.color = 'yellow';
					} else {
						Life.elementPerformanceDraw.style.color = 'white';
					}

					// FPS
					if (Interaction.settingsFPSShow) {
						Life.elementFPS.innerText = String(data.fps);

						if (data.fps < Interaction.settingsVideo.fps * 0.8) {
							Life.elementFPS.style.color = 'red';
						} else if (data.fps < Interaction.settingsVideo.fps * 0.9) {
							Life.elementFPS.style.color = 'yellow';
						} else {
							Life.elementFPS.style.color = 'green';
						}
					} else {
						Life.elementFPS.innerText = '';
					}
				});
				VideoBusEngine.initialize(
					Interaction.elementCanvas,
					Life.elementDataContainer,
					Interaction.settingsVideo,
					(status: boolean) => {
						if (status) {
							console.log('Engine > Video: loaded in', performance.now() - then, 'ms');
							resolve(true);
						} else {
							resolve(false);
						}
					},
				);
			});
		});
	}

	public static async main(): Promise<void> {
		let then: number = performance.now();

		// Initialize
		Life.initializeDOM();
		Life.initializeSettings();
		Interaction.spinner(true);

		// Initialize: Engines
		FullscreenEngine.initialize();
		FullscreenEngine.setCallback((state: boolean) => {
			if (!state) {
				Life.elementControls.classList.remove('fullscreen');
				Life.elementCounts.classList.remove('fullscreen');
				Life.elementGame.classList.remove('fullscreen');
				Life.elementHomeostatic.classList.remove('fullscreen');
				Life.elementPerformance.classList.remove('fullscreen');
				Life.elementStats.classList.remove('fullscreen');

				Life.elementFullscreen.classList.remove('fullscreen-exit');
				Life.elementFullscreen.classList.add('fullscreen');

				OrientationEngine.unlock();
				Life.noSleep.disable();
				setTimeout(() => {
					Interaction.pxSizeCalc();
				}, 100);
			}
		});
		KeyboardEngine.initialize();
		KeyboardEngine.register(KeyCommon.F, (keyAction: KeyAction) => {
			if (keyAction.down) {
				Life.elementFullscreen.click();
			}
		});
		KeyboardEngine.register(KeyCommon.LEFT, (keyAction: KeyAction) => {
			if (keyAction.down) {
				Interaction.elementControlsBackward.click();
			}
		});
		KeyboardEngine.register(KeyCommon.R, (keyAction: KeyAction) => {
			if (keyAction.down) {
				Interaction.elementControlsReset.click();
			}
		});
		KeyboardEngine.register(KeyCommon.RIGHT, (keyAction: KeyAction) => {
			if (keyAction.down) {
				Interaction.elementControlsForward.click();
			}
		});
		KeyboardEngine.register(KeyCommon.SPACE_BAR, (keyAction: KeyAction) => {
			if (keyAction.down) {
				if (Interaction.elementControlsPlay.style.display === 'none') {
					Interaction.elementControlsPause.click();
				} else {
					Interaction.elementControlsPlay.click();
				}
			}
		});
		MouseEngine.initialize(Interaction.elementCanvas, Interaction.elementCanvasInteractive);
		OrientationEngine.initialize();
		TouchEngine.initialize(Interaction.elementCanvas, Interaction.elementCanvasInteractive);
		VisibilityEngine.initialize();
		VisibilityEngine.setCallback((state: boolean) => {
			if (!state) {
				Interaction.elementControlsPause.click();
			}
		});

		if (await Life.initializeWorkers()) {
			console.log('System Loaded in', performance.now() - then, 'ms');

			// Last
			Life.initializeInteraction();

			// Default to add life if no life current on the board
			if (!Interaction.settingsSeedRandom) {
				Life.elementEditAddLife.click();
			}
		} else {
			CalcBusEngine.outputPause();

			Life.elementWebGLNotSupported.style.display = 'flex';
			Life.elementWebGLNotSupported.classList.add('show');

			Interaction.elementControlsBackward.style.display = 'none';
			Interaction.elementControlsForward.style.display = 'none';
			Interaction.elementControlsPlay.style.display = 'none';
			Interaction.elementControlsPause.style.display = 'none';
			Interaction.elementControlsReset.style.display = 'none';
		}
	}
}
Life.main();
