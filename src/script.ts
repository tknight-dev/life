import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusOutputDataPS, masks, xyWidthBits } from './workers/calc/calc.model';
import { FullscreenEngine } from './engines/fullscreen.engine';
import { Interaction } from './interaction';
import { KeyboardEngine, KeyAction, KeyCommon } from './engines/keyboard.engine';
import { MouseEngine } from './engines/mouse.engine';
import NoSleep from 'nosleep.js';
import { Orientation, OrientationEngine } from './engines/orientation.engine';
import { TouchEngine } from './engines/touch.engine';
import { VideoBusEngine } from './workers/video/video.bus';
import { VideoBusInputDataSettingsFPS } from './workers/video/video.model';
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
	private static elementEditAdd: HTMLElement;
	private static elementEditNone: HTMLElement;
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
	private static elementRules: HTMLElement;
	private static elementRulesClose: HTMLButtonElement;
	private static elementSettings: HTMLElement;
	private static elementSettingsApply: HTMLButtonElement;
	private static elementSettingsCancel: HTMLButtonElement;
	private static elementSettingsValueCPUSpinOutProtection: HTMLInputElement;
	private static elementSettingsValueDrawDeadCells: HTMLInputElement;
	private static elementSettingsValueHomeostaticPause: HTMLInputElement;
	private static elementSettingsValueFPS: HTMLInputElement;
	private static elementSettingsValueFPSShow: HTMLInputElement;
	private static elementSettingsValueDrawGrid: HTMLInputElement;
	private static elementSettingsValueIPS: HTMLInputElement;
	private static elementSettingsValueOrientationAutoRotate: HTMLInputElement;
	private static elementSettingsValueResolution: HTMLInputElement;
	private static elementSettingsValueSeedRandom: HTMLInputElement;
	private static elementSettingsValueStatsShowAliveDead: HTMLInputElement;
	private static elementSettingsValueTableSize: HTMLInputElement;
	private static elementSpinout: HTMLElement;
	private static elementStats: HTMLElement;
	private static elementStatsC: HTMLElement;
	private static elementStatsCPS: HTMLElement;
	private static elementStatsCPSAll: HTMLElement;
	private static elementVersion: HTMLElement;
	private static elementWebGLNotSupported: HTMLElement;
	private static noSleep: NoSleep = new NoSleep();
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

			Interaction.mode = null;
			Interaction.elementEdit.style.display = 'none';
			Life.elementEditAdd.classList.remove('active');
			Life.elementEditNone.classList.add('active');
			Life.elementEditRemove.classList.remove('active');

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
			const data: Uint32Array[] = Life.initializeLife();
			VideoBusEngine.outputReset(data[0]);
			CalcBusEngine.outputReset(data[1]);
			Interaction.gameover = false;

			Life.elementAlive.innerText = '';
			Life.elementDead.innerText = '';

			Interaction.elementControlsBackward.style.display = 'block';
			Interaction.elementControlsForward.style.display = 'block';
			Interaction.elementControlsPlay.style.display = 'block';
			Interaction.elementControlsPause.style.display = 'none';

			Life.elementEditAdd.style.display = 'flex';
			Life.elementEditNone.style.display = 'flex';
			Life.elementEditRemove.style.display = 'flex';

			if (!Interaction.settingsSeedRandom) {
				Life.elementEditAdd.click();
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
		Life.elementEditAdd = <HTMLElement>document.getElementById('edit-add');
		Life.elementEditAdd.onclick = () => {
			if (Interaction.mode !== true) {
				Interaction.mode = true;

				Life.elementEditAdd.classList.add('active');
				Life.elementEditNone.classList.remove('active');
				Life.elementEditRemove.classList.remove('active');

				Life.elementEdit.classList.add('add');
				Life.elementEdit.classList.remove('remove');

				if (Interaction.elementControlsPause.style.display === 'block') {
					Interaction.elementControlsPause.click();
				}
			}
		};
		Life.elementEditNone = <HTMLElement>document.getElementById('edit-none');
		Life.elementEditNone.onclick = () => {
			if (Interaction.mode !== null) {
				Interaction.mode = null;

				Life.elementEditAdd.classList.remove('active');
				Life.elementEditNone.classList.add('active');
				Life.elementEditRemove.classList.remove('active');

				Interaction.elementEdit.style.display = 'none';
			}
		};
		Life.elementEditRemove = <HTMLElement>document.getElementById('edit-remove');
		Life.elementEditRemove.onclick = () => {
			if (Interaction.mode !== false) {
				Interaction.mode = false;

				Life.elementEditAdd.classList.remove('active');
				Life.elementEditNone.classList.remove('active');
				Life.elementEditRemove.classList.add('active');

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
						Life.elementStats.classList.remove('show');
					}
				} else {
					Life.elementControls.classList.add('show');
					Life.elementCounts.classList.add('adjust');
					Life.elementHomeostatic.classList.add('adjust');
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
			Life.elementStats.classList.add('show');
			clearTimeout(Life.timeoutFullscreen);
		};
		Life.elementStats.onmouseenter = () => {
			Life.elementControls.classList.add('show');
			Life.elementCounts.classList.add('adjust');
			Life.elementHomeostatic.classList.add('adjust');
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
		Life.elementSettingsValueTableSize = <HTMLInputElement>document.getElementById('settings-value-table-size');
	}

	private static initializeLife(): Uint32Array[] {
		if (Interaction.settingsSeedRandom) {
			let data: Set<number> = new Set<number>(),
				tableSizeX: number = Interaction.settingsCalc.tableSizeX,
				tableSizeY: number = (Interaction.settingsCalc.tableSizeX * 9) / 16,
				x: number,
				y: number;

			const { xyValueAlive } = masks;

			// Random
			for (x = 0; x < tableSizeX; x++) {
				for (y = 0; y < tableSizeY; y++) {
					if (Math.random() > 0.5) {
						data.add((x << xyWidthBits) | y | xyValueAlive);
					}
				}
			}

			// The array buffer must be passed to each web worker independently
			return [Uint32Array.from(data), Uint32Array.from(data)];
		} else {
			return [new Uint32Array(), new Uint32Array()];
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

		/*
		 * Video
		 */
		Interaction.settingsVideo = {
			drawDeadCells: true,
			drawGrid: true,
			fps: VideoBusInputDataSettingsFPS._60,
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
			cpuSpinOutProtection: true,
			homeostaticPause: false,
			fps: Interaction.settingsVideo.fps,
			iterationsPerSecond: 16, // def: 16
			tableSizeX: Interaction.settingsVideo.tableSizeX,
		};
	}

	private static initializeWorkers(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			let data: Uint32Array[] = Life.initializeLife(),
				then: number = performance.now();

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

				Life.elementEditAdd.style.display = 'none';
				Life.elementEditNone.style.display = 'none';
				Life.elementEditRemove.style.display = 'none';

				Life.elementStatsCPSAll.style.display = 'none';

				Life.elementIPSRequested.classList.remove('show');
				Life.elementGameOver.style.display = 'flex';
				setTimeout(() => {
					Life.elementGameOver.classList.add('show');
				});
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
					});
				} else {
					Life.elementHomeostatic.classList.add('show');
				}
			});
			CalcBusEngine.setCallbackPS((data: CalcBusOutputDataPS) => {
				Life.elementAlive.innerText = data.alive.toLocaleString('en-US');
				Life.elementDead.innerText = data.dead.toLocaleString('en-US');

				// too many i/s requests results in deltas >1s
				let ipsEff: number = Math.max(1, (data.ips / (data.ipsDeltaInMS / 1000)) | 0);

				Life.elementStatsC.innerText = data.ipsTotal.toLocaleString('en-US');
				Life.elementStatsCPS.innerText = ipsEff.toLocaleString('en-US');
				Life.elementStatsCPSAll.style.display = 'flex';

				if (ipsEff < Interaction.settingsCalc.iterationsPerSecond * 0.8) {
					Life.elementStatsCPS.style.color = 'red';
				} else if (ipsEff < Interaction.settingsCalc.iterationsPerSecond * 0.9) {
					Life.elementStatsCPS.style.color = 'yellow';
				} else {
					Life.elementStatsCPS.style.color = 'green';
				}
			});
			CalcBusEngine.setCallbackSpinOut(() => {
				Interaction.elementControlsPause.click();
				Life.elementSpinout.style.display = 'flex';
				setTimeout(() => {
					Life.elementSpinout.classList.add('show');
				});
			});
			CalcBusEngine.initialize(data[0], Interaction.settingsCalc, () => {
				console.log('Engine > Calculation: loaded in', performance.now() - then, 'ms');

				/*
				 * Load Video Engine
				 */
				then = performance.now();
				VideoBusEngine.setCallbackFPS((fps: number) => {
					if (Interaction.settingsFPSShow) {
						Life.elementFPS.innerText = String(fps);

						if (fps < Interaction.settingsVideo.fps * 0.8) {
							Life.elementFPS.style.color = 'red';
						} else if (fps < Interaction.settingsVideo.fps * 0.9) {
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
					data[1],
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

		// Initialize: Engines
		FullscreenEngine.initialize();
		FullscreenEngine.setCallback((state: boolean) => {
			if (!state) {
				Life.elementControls.classList.remove('fullscreen');
				Life.elementCounts.classList.remove('fullscreen');
				Life.elementGame.classList.remove('fullscreen');
				Life.elementHomeostatic.classList.remove('fullscreen');
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
			Life.initializeEdit();
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
