import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusOutputDataPS, masks, xyWidthBits } from './workers/calc/calc.model';
import { Edit } from './edit';
import { FullscreenEngine } from './engines/fullscreen.engine';
import { KeyboardEngine, KeyAction, KeyCommon } from './engines/keyboard.engine';
import { MouseEngine } from './engines/mouse.engine';
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

class Life extends Edit {
	private static elementAlive: HTMLElement;
	private static elementControls: HTMLElement;
	private static elementControlsPause: HTMLElement;
	private static elementControlsPlay: HTMLElement;
	private static elementControlsReset: HTMLElement;
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
	private static timeoutControl: ReturnType<typeof setTimeout>;
	private static timeoutFullscreen: ReturnType<typeof setTimeout>;
	private static timeoutReset: ReturnType<typeof setTimeout>;

	private static initializeDOM(): void {
		Life.elementAlive = <HTMLElement>document.getElementById('alive');
		Edit.elementCanvas = <HTMLCanvasElement>document.getElementById('canvas');
		Edit.elementCanvasInteractive = <HTMLElement>document.getElementById('canvas-interactive');

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
		Edit.elementRotator = <HTMLElement>document.getElementById('rotator');
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
		Edit.elementControlsBackward = <HTMLElement>document.getElementById('backward');
		Edit.elementControlsBackward.onclick = () => {
			Edit.settingsCalc.iterationsPerSecond = Math.max(1, Math.round(Edit.settingsCalc.iterationsPerSecond / 2));

			Life.elementSettingsValueIPS.value = String(Edit.settingsCalc.iterationsPerSecond);
			Life.elementIPSRequested.innerText = Edit.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			Life.elementIPSRequested.style.display = 'flex';
			Life.elementIPSRequested.classList.add('show');
			Life.elementSpinout.classList.remove('show');

			clearTimeout(Life.timeoutControl);
			Life.timeoutControl = setTimeout(() => {
				Life.elementIPSRequested.classList.remove('show');
				Life.elementSpinout.classList.add('show');
			}, 1000);

			CalcBusEngine.outputSettings(Edit.settingsCalc);
		};
		Edit.elementControlsForward = <HTMLElement>document.getElementById('forward');
		Edit.elementControlsForward.onclick = () => {
			Edit.settingsCalc.iterationsPerSecond = Math.min(Edit.settingsCalcIPSMax, Edit.settingsCalc.iterationsPerSecond * 2);

			Life.elementSettingsValueIPS.value = String(Edit.settingsCalc.iterationsPerSecond);
			Life.elementIPSRequested.innerText = Edit.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			Life.elementIPSRequested.style.display = 'flex';
			Life.elementIPSRequested.classList.add('show');
			Life.elementSpinout.classList.remove('show');

			clearTimeout(Life.timeoutControl);
			Life.timeoutControl = setTimeout(() => {
				Life.elementIPSRequested.classList.remove('show');
				Life.elementSpinout.classList.add('show');
			}, 1000);

			CalcBusEngine.outputSettings(Edit.settingsCalc);
		};
		Life.elementControlsPause = <HTMLElement>document.getElementById('pause');
		Life.elementControlsPause.onclick = () => {
			Life.elementControlsPause.style.display = 'none';
			if (!Edit.gameover) {
				Life.elementControlsPlay.style.display = 'block';
			}

			Life.elementStatsCPS.style.display = 'none';

			CalcBusEngine.outputPause();
		};
		Life.elementControlsPause.style.display = 'none';
		Life.elementControlsPlay = <HTMLElement>document.getElementById('play');
		Life.elementControlsPlay.onclick = (event) => {
			Life.elementControlsPlay.style.display = 'none';
			Life.elementControlsPause.style.display = 'block';

			Edit.mode = null;
			Edit.elementEdit.style.display = 'none';
			Life.elementEditAdd.classList.remove('active');
			Life.elementEditNone.classList.add('active');
			Life.elementEditRemove.classList.remove('active');

			Life.elementHomeostatic.style.display = 'none';
			Life.elementStatsCPS.style.display = 'block';
			Life.elementIPSRequested.innerText = Edit.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			Life.elementIPSRequested.classList.add('show');
			Life.elementSpinout.classList.remove('show');
			setTimeout(() => {
				Life.elementIPSRequested.classList.remove('show');
				Life.elementSpinout.style.display = 'none';
			}, 1000);

			CalcBusEngine.outputPlay();
		};
		Life.elementControlsReset = <HTMLElement>document.getElementById('reset');
		Life.elementControlsReset.onclick = () => {
			const data: Uint32Array[] = Life.initializeLife();
			VideoBusEngine.outputReset(data[0]);
			CalcBusEngine.outputReset(data[1]);
			Edit.gameover = false;

			Life.elementAlive.innerText = '';
			Life.elementDead.innerText = '';

			Edit.elementControlsBackward.style.display = 'block';
			Edit.elementControlsForward.style.display = 'block';
			Life.elementControlsPlay.style.display = 'block';
			Life.elementControlsPause.style.display = 'none';

			Life.elementEditAdd.style.display = 'flex';
			Life.elementEditNone.style.display = 'flex';
			Life.elementEditRemove.style.display = 'flex';

			if (!Edit.settingsSeedRandom) {
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

		/**
		 * Edit
		 */
		Life.elementEditAdd = <HTMLElement>document.getElementById('edit-add');
		Life.elementEditAdd.onclick = () => {
			if (Edit.mode !== true) {
				Edit.mode = true;

				Life.elementEditAdd.classList.add('active');
				Life.elementEditNone.classList.remove('active');
				Life.elementEditRemove.classList.remove('active');

				Life.elementEdit.classList.add('add');
				Life.elementEdit.classList.remove('remove');

				if (Life.elementControlsPause.style.display === 'block') {
					Life.elementControlsPause.click();
				}
			}
		};
		Life.elementEditNone = <HTMLElement>document.getElementById('edit-none');
		Life.elementEditNone.onclick = () => {
			if (Edit.mode !== null) {
				Edit.mode = null;

				Life.elementEditAdd.classList.remove('active');
				Life.elementEditNone.classList.add('active');
				Life.elementEditRemove.classList.remove('active');

				Edit.elementEdit.style.display = 'none';
			}
		};
		Life.elementEditRemove = <HTMLElement>document.getElementById('edit-remove');
		Life.elementEditRemove.onclick = () => {
			if (Edit.mode !== false) {
				Edit.mode = false;

				Life.elementEditAdd.classList.remove('active');
				Life.elementEditNone.classList.remove('active');
				Life.elementEditRemove.classList.add('active');

				Life.elementEdit.classList.remove('add');
				Life.elementEdit.classList.add('remove');

				if (Life.elementControlsPause.style.display === 'block') {
					Life.elementControlsPause.click();
				}
			}
		};

		/**
		 * Fullscreen
		 */
		Life.elementFullscreen.onclick = async () => {
			Life.elementControlsPause.click();

			if (FullscreenEngine.isOpen()) {
				await FullscreenEngine.close();
				Life.elementControls.classList.remove('fullscreen');
				Life.elementCounts.classList.remove('fullscreen');
				Life.elementHomeostatic.classList.remove('fullscreen');
				Life.elementStats.classList.remove('fullscreen');

				Life.elementFullscreen.classList.remove('fullscreen-exit');
				Life.elementFullscreen.classList.add('fullscreen');

				OrientationEngine.unlock();
				setTimeout(() => {
					Edit.pxSizeCalc();
				}, 100);
			} else {
				await FullscreenEngine.open(Life.elementGame);
				Life.elementControls.classList.add('fullscreen');
				Life.elementControls.classList.add('show');
				Life.elementCounts.classList.add('fullscreen');
				Life.elementCounts.classList.add('adjust');
				Life.elementHomeostatic.classList.add('fullscreen');
				Life.elementHomeostatic.classList.add('adjust');
				Life.elementStats.classList.add('fullscreen');
				Life.elementStats.classList.add('show');

				Life.elementFullscreen.classList.remove('fullscreen');
				Life.elementFullscreen.classList.add('fullscreen-exit');

				fullscreenFader();
				setTimeout(() => {
					Edit.pxSizeCalc();
					OrientationEngine.lock(Orientation.LANDSCAPE);
				}, 100);
			}
		};
		document.addEventListener('click', (event) => {
			if (FullscreenEngine.isOpen()) {
				if ((event.target as HTMLElement).id === 'canvas-interactive' && Life.elementControls.classList.contains('show')) {
					if (Edit.mode === null) {
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
				if (Edit.mode === null) {
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
			Life.elementMenuContent.classList.remove('open');

			Life.elementRules.style.display = 'block';
		};
		Life.elementMenuSettings = <HTMLElement>document.getElementById('info-settings');
		Life.elementMenuSettings.onclick = () => {
			Life.elementRulesClose.click();
			Life.elementMenuContent.classList.remove('open');

			Life.elementSettings.style.display = 'block';
		};

		document.addEventListener('click', (event: any) => {
			if (event.target.id !== 'info-menu') {
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
			Edit.settingsCalc = {
				cpuSpinOutProtection: Boolean(Life.elementSettingsValueCPUSpinOutProtection.checked),
				homeostaticPause: Boolean(Life.elementSettingsValueHomeostaticPause.checked),
				fps: Number(Life.elementSettingsValueFPS.value),
				iterationsPerSecond: Math.round(Math.max(1, Math.min(Edit.settingsCalcIPSMax, Number(Life.elementSettingsValueIPS.value)))),
				tableSizeX: <any>Number(Life.elementSettingsValueTableSize.value),
			};

			Edit.settingsVideo = {
				drawDeadCells: Boolean(Life.elementSettingsValueDrawDeadCells.checked),
				drawGrid: Boolean(Life.elementSettingsValueDrawGrid.checked),
				fps: Edit.settingsCalc.fps,
				resolution: <any>(
					(Life.elementSettingsValueResolution.value === 'null' ? null : Number(Life.elementSettingsValueResolution.value))
				),
				tableSizeX: Edit.settingsCalc.tableSizeX,
			};

			Edit.settingsFPSShow = Boolean(Life.elementSettingsValueFPSShow.checked);
			if (!Edit.settingsFPSShow) {
				Life.elementFPS.innerText = '';
			}
			Edit.rotateAvailable = Boolean(Life.elementSettingsValueOrientationAutoRotate.checked);
			Edit.settingsSeedRandom = Boolean(Life.elementSettingsValueSeedRandom.checked);
			Edit.settingsStatsShowAliveDead = Boolean(Life.elementSettingsValueStatsShowAliveDead.checked);
			if (Edit.settingsStatsShowAliveDead) {
				Life.elementCounts.style.display = 'block';
			} else {
				Life.elementCounts.style.display = 'none';
			}

			/**
			 * Main thread -> workers
			 */
			CalcBusEngine.outputSettings(Edit.settingsCalc);
			VideoBusEngine.outputSettings(Edit.settingsVideo);

			/**
			 * Done
			 */
			Life.elementSettings.style.display = 'none';
			Life.elementSettingsValueIPS.value = String(Edit.settingsCalc.iterationsPerSecond);

			Edit.pxSizeCalc();
			Edit.rotator();
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
		if (Edit.settingsSeedRandom) {
			let data: Set<number> = new Set<number>(),
				tableSizeX: number = Edit.settingsCalc.tableSizeX,
				tableSizeY: number = (Edit.settingsCalc.tableSizeX * 9) / 16,
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
		Edit.settingsFPSShow = true; // def true
		Edit.rotateAvailable = true; // def true
		Edit.settingsSeedRandom = true; // def true
		Edit.settingsStatsShowAliveDead = true; // def true

		/*
		 * Video
		 */
		Edit.settingsVideo = {
			drawDeadCells: true,
			drawGrid: true,
			fps: VideoBusInputDataSettingsFPS._60,
			resolution: null, // Native is null
			tableSizeX: 112, // def: 112y
		};

		if (Edit.isMobileOrTablet()) {
			// Mobile devices utilize sub-pixel rendering with their canvas API implementations
			Edit.settingsVideo.resolution = 512;
			Life.elementSettingsValueResolution.value = '512';
		}

		/*
		 * Calc
		 */
		Edit.settingsCalc = {
			cpuSpinOutProtection: true,
			homeostaticPause: false,
			fps: Edit.settingsVideo.fps,
			iterationsPerSecond: 16, // def: 16
			tableSizeX: Edit.settingsVideo.tableSizeX,
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
				Edit.gameover = true;

				Edit.elementControlsBackward.style.display = 'none';
				Edit.elementControlsForward.style.display = 'none';
				Life.elementControlsPlay.style.display = 'none';
				Life.elementControlsPause.style.display = 'none';

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
				if (Edit.settingsCalc.homeostaticPause) {
					Life.elementControlsPause.style.display = 'none';
					Life.elementControlsPlay.style.display = 'block';
				}
				clearTimeout(Life.timeoutReset);

				setTimeout(() => {
					Life.elementHomeostatic.style.display = 'block';
					setTimeout(() => {
						Life.elementHomeostatic.classList.add('show');
					});
				});
			});
			CalcBusEngine.setCallbackPS((data: CalcBusOutputDataPS) => {
				Life.elementAlive.innerText = data.alive.toLocaleString('en-US');
				Life.elementDead.innerText = data.dead.toLocaleString('en-US');

				// too many i/s requests results in deltas >1s
				let ipsEff: number = Math.max(1, (data.ips / (data.ipsDeltaInMS / 1000)) | 0);

				Life.elementStatsC.innerText = data.ipsTotal.toLocaleString('en-US');
				Life.elementStatsCPS.innerText = ipsEff.toLocaleString('en-US');
				Life.elementStatsCPSAll.style.display = 'flex';

				if (ipsEff < Edit.settingsCalc.iterationsPerSecond * 0.8) {
					Life.elementStatsCPS.style.color = 'red';
				} else if (ipsEff < Edit.settingsCalc.iterationsPerSecond * 0.9) {
					Life.elementStatsCPS.style.color = 'yellow';
				} else {
					Life.elementStatsCPS.style.color = 'green';
				}
			});
			CalcBusEngine.setCallbackSpinOut(() => {
				Life.elementControlsPause.click();
				Life.elementSpinout.style.display = 'flex';
				setTimeout(() => {
					Life.elementSpinout.classList.add('show');
				});
			});
			CalcBusEngine.initialize(data[0], Edit.settingsCalc, () => {
				console.log('Engine > Calculation: loaded in', performance.now() - then, 'ms');

				/*
				 * Load Video Engine
				 */
				then = performance.now();
				VideoBusEngine.setCallbackFPS((fps: number) => {
					if (Edit.settingsFPSShow) {
						Life.elementFPS.innerText = String(fps);

						if (fps < Edit.settingsVideo.fps * 0.8) {
							Life.elementFPS.style.color = 'red';
						} else if (fps < Edit.settingsVideo.fps * 0.9) {
							Life.elementFPS.style.color = 'yellow';
						} else {
							Life.elementFPS.style.color = 'green';
						}
					} else {
						Life.elementFPS.innerText = '';
					}
				});
				VideoBusEngine.initialize(Edit.elementCanvas, Life.elementDataContainer, data[1], Edit.settingsVideo, (status: boolean) => {
					if (status) {
						console.log('Engine > Video: loaded in', performance.now() - then, 'ms');
						resolve(true);
					} else {
						resolve(false);
					}
				});
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
				Life.elementHomeostatic.classList.remove('fullscreen');
				Life.elementStats.classList.remove('fullscreen');

				Life.elementFullscreen.classList.remove('fullscreen-exit');
				Life.elementFullscreen.classList.add('fullscreen');

				OrientationEngine.unlock();
				setTimeout(() => {
					Edit.pxSizeCalc();
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
				Edit.elementControlsBackward.click();
			}
		});
		KeyboardEngine.register(KeyCommon.R, (keyAction: KeyAction) => {
			if (keyAction.down) {
				Life.elementControlsReset.click();
			}
		});
		KeyboardEngine.register(KeyCommon.RIGHT, (keyAction: KeyAction) => {
			if (keyAction.down) {
				Edit.elementControlsForward.click();
			}
		});
		KeyboardEngine.register(KeyCommon.SPACE_BAR, (keyAction: KeyAction) => {
			if (keyAction.down) {
				if (Life.elementControlsPlay.style.display === 'none') {
					Life.elementControlsPause.click();
				} else {
					Life.elementControlsPlay.click();
				}
			}
		});
		MouseEngine.initialize(Edit.elementCanvas, Edit.elementCanvasInteractive);
		OrientationEngine.initialize();
		TouchEngine.initialize(Edit.elementCanvas, Edit.elementCanvasInteractive);
		VisibilityEngine.initialize();
		VisibilityEngine.setCallback((state: boolean) => {
			if (!state) {
				Life.elementControlsPause.click();
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

			Edit.elementControlsBackward.style.display = 'none';
			Edit.elementControlsForward.style.display = 'none';
			Life.elementControlsPlay.style.display = 'none';
			Life.elementControlsPause.style.display = 'none';
			Life.elementControlsReset.style.display = 'none';
		}
	}
}
Life.main();
