import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusInputDataSettings, CalcBusOutputDataPS } from './workers/calc/calc.model';
import { FullscreenEngine } from './engines/fullscreen.engine';
import { Orientation, OrientationEngine } from './engines/orientation.engine';
import { VideoBusEngine } from './workers/video/video.bus';
import { VideoBusInputDataSettings, VideoBusInputDataSettingsFPS } from './workers/video/video.model';
import { VisibilityEngine } from './engines/visibility.engine';

/**
 * @author tknight-dev
 */

// ESBuild live reloader
new EventSource('/esbuild').addEventListener('change', () => location.reload());

class Life {
	private static elementAlive: HTMLElement;
	private static elementCanvas: HTMLCanvasElement;
	private static elementControlsBackward: HTMLElement;
	private static elementControlsForward: HTMLElement;
	private static elementControlsPause: HTMLElement;
	private static elementControlsPlay: HTMLElement;
	private static elementControlsReset: HTMLElement;
	private static elementDead: HTMLElement;
	private static elementDataContainer: HTMLElement;
	private static elementGame: HTMLElement;
	private static elementGameOver: HTMLElement;
	private static elementFPS: HTMLElement;
	private static elementFullscreen: HTMLElement;
	private static elementIPSRequested: HTMLElement;
	private static elementMenu: HTMLElement;
	private static elementMenuContent: HTMLElement;
	private static elementMenuInfo: HTMLElement;
	private static elementMenuRules: HTMLElement;
	private static elementMenuSettings: HTMLElement;
	private static elementRules: HTMLElement;
	private static elementRulesClose: HTMLButtonElement;
	private static elementSettings: HTMLElement;
	private static elementSettingsApply: HTMLButtonElement;
	private static elementSettingsCancel: HTMLButtonElement;
	private static elementSettingsValueDrawDeadCells: HTMLInputElement;
	private static elementSettingsValueFPS: HTMLInputElement;
	private static elementSettingsValueDrawGrid: HTMLInputElement;
	private static elementSettingsValueIPS: HTMLInputElement;
	private static elementSettingsValueResolution: HTMLInputElement;
	private static elementSettingsValueTableSize: HTMLInputElement;
	private static elementStatsC: HTMLElement;
	private static elementStatsCPS: HTMLElement;
	private static elementStatsCPSAll: HTMLElement;
	private static elementWebGLNotSupported: HTMLElement;
	private static settingsCalc: CalcBusInputDataSettings;
	private static settingsCalcIPSMax: number = 1024;
	private static settingsVideo: VideoBusInputDataSettings;

	private static initializeDOM(): void {
		Life.elementAlive = <HTMLCanvasElement>document.getElementById('alive');
		Life.elementCanvas = <HTMLCanvasElement>document.getElementById('cavnas');

		Life.elementRules = <HTMLButtonElement>document.getElementById('rules');
		Life.elementRulesClose = <HTMLButtonElement>document.getElementById('rules-close');
		Life.elementRulesClose.onclick = () => {
			Life.elementRules.style.display = 'none';
		};

		Life.elementDataContainer = <HTMLElement>document.getElementById('data-container');
		Life.elementDead = <HTMLCanvasElement>document.getElementById('dead');
		Life.elementGame = <HTMLElement>document.getElementById('game');
		Life.elementGameOver = <HTMLElement>document.getElementById('game-over');
		Life.elementFPS = <HTMLElement>document.getElementById('fps');
		Life.elementFullscreen = <HTMLElement>document.getElementById('fullscreen');
		Life.elementFullscreen.onclick = async () => {
			Life.elementControlsPause.click();

			if (FullscreenEngine.isOpen()) {
				await FullscreenEngine.close();
				Life.elementFullscreen.classList.remove('fullscreen-exit');
				Life.elementFullscreen.classList.add('fullscreen');
				OrientationEngine.unlock();
			} else {
				await FullscreenEngine.open(Life.elementGame);
				Life.elementFullscreen.classList.remove('fullscreen');
				Life.elementFullscreen.classList.add('fullscreen-exit');
				setTimeout(() => {
					OrientationEngine.lock(Orientation.LANDSCAPE);
				});
			}
		};
		Life.elementIPSRequested = <HTMLElement>document.getElementById('ips-requested');

		Life.elementStatsC = <HTMLElement>document.getElementById('c');
		Life.elementStatsCPS = <HTMLElement>document.getElementById('cps');
		Life.elementStatsCPSAll = <HTMLElement>document.getElementById('cps-all');

		Life.elementWebGLNotSupported = <HTMLElement>document.getElementById('webgl-not-supported');

		/**
		 * Controls
		 */
		Life.elementControlsBackward = <HTMLElement>document.getElementById('backward');
		Life.elementControlsBackward.onclick = () => {
			Life.settingsCalc.iterationsPerSecond = Math.max(1, Math.round(Life.settingsCalc.iterationsPerSecond / 2));

			Life.elementSettingsValueIPS.value = String(Life.settingsCalc.iterationsPerSecond);
			Life.elementIPSRequested.innerText = Life.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			Life.elementIPSRequested.style.display = 'flex';
			Life.elementIPSRequested.classList.add('show');
			setTimeout(() => {
				Life.elementIPSRequested.classList.remove('show');
			}, 1000);

			CalcBusEngine.outputSettings(Life.settingsCalc);
		};
		Life.elementControlsForward = <HTMLElement>document.getElementById('forward');
		Life.elementControlsForward.onclick = () => {
			Life.settingsCalc.iterationsPerSecond = Math.min(Life.settingsCalcIPSMax, Life.settingsCalc.iterationsPerSecond * 2);

			Life.elementSettingsValueIPS.value = String(Life.settingsCalc.iterationsPerSecond);
			Life.elementIPSRequested.innerText = Life.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			Life.elementIPSRequested.style.display = 'flex';
			Life.elementIPSRequested.classList.add('show');
			setTimeout(() => {
				Life.elementIPSRequested.classList.remove('show');
			}, 1000);

			CalcBusEngine.outputSettings(Life.settingsCalc);
		};
		Life.elementControlsPause = <HTMLElement>document.getElementById('pause');
		Life.elementControlsPause.onclick = () => {
			Life.elementControlsPause.style.display = 'none';
			Life.elementControlsPlay.style.display = 'block';

			Life.elementStatsCPS.style.display = 'none';

			CalcBusEngine.outputPause();
		};
		Life.elementControlsPause.style.display = 'none';
		Life.elementControlsPlay = <HTMLElement>document.getElementById('play');
		Life.elementControlsPlay.onclick = () => {
			Life.elementControlsPlay.style.display = 'none';
			Life.elementControlsPause.style.display = 'block';

			Life.elementStatsCPS.style.display = 'block';
			Life.elementIPSRequested.innerText = Life.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			Life.elementIPSRequested.classList.add('show');
			setTimeout(() => {
				Life.elementIPSRequested.classList.remove('show');
			}, 1000);

			CalcBusEngine.outputPlay();
		};
		Life.elementControlsReset = <HTMLElement>document.getElementById('reset');
		Life.elementControlsReset.onclick = () => {
			const data: Uint32Array[] = Life.initializeLife();
			VideoBusEngine.outputData(data[0]);
			CalcBusEngine.outputReset(data[1]);

			Life.elementAlive.innerText = '';
			Life.elementDead.innerText = '';

			Life.elementControlsBackward.style.display = 'block';
			Life.elementControlsForward.style.display = 'block';
			Life.elementControlsPlay.style.display = 'block';
			Life.elementControlsPause.style.display = 'none';

			Life.elementGameOver.classList.remove('show');
			Life.elementIPSRequested.style.display = 'flex';
			setTimeout(() => {
				Life.elementGameOver.style.display = 'none';
			}, 1000);
			Life.elementStatsC.innerText = '0';
		};

		/**
		 * Menu
		 */
		Life.elementMenu = <HTMLElement>document.getElementById('info-menu');
		Life.elementMenu.onclick = () => {
			Life.elementMenuContent.classList.toggle('open');
		};
		Life.elementMenuContent = <HTMLElement>document.getElementById('menu-content');
		Life.elementMenuInfo = <HTMLElement>document.getElementById('info-click');
		Life.elementMenuInfo.onclick = () => {
			(<any>window).open('https://tknight.dev/#/creations', '_blank').focus();
		};
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
			Life.settingsCalc = {
				fps: Number(Life.elementSettingsValueFPS.value),
				iterationsPerSecond: Math.round(Math.max(1, Math.min(Life.settingsCalcIPSMax, Number(Life.elementSettingsValueIPS.value)))),
				tableSizeX: <any>Number(Life.elementSettingsValueTableSize.value),
			};

			Life.settingsVideo = {
				drawDeadCells: Boolean(Life.elementSettingsValueDrawDeadCells.checked),
				drawGrid: Boolean(Life.elementSettingsValueDrawGrid.checked),
				fps: Life.settingsCalc.fps,
				resolution: <any>(
					(Life.elementSettingsValueResolution.value === 'null' ? null : Number(Life.elementSettingsValueResolution.value))
				),
				tableSizeX: Life.settingsCalc.tableSizeX,
			};

			/**
			 * Main thread -> workers
			 */
			CalcBusEngine.outputSettings(Life.settingsCalc);
			VideoBusEngine.outputSettings(Life.settingsVideo);

			/**
			 * Done
			 */
			Life.elementSettings.style.display = 'none';
			Life.elementSettingsValueIPS.value = String(Life.settingsCalc.iterationsPerSecond);
		};
		Life.elementSettingsCancel = <HTMLButtonElement>document.getElementById('settings-cancel');
		Life.elementSettingsCancel.onclick = () => {
			Life.elementSettings.style.display = 'none';
		};
		Life.elementSettingsValueDrawDeadCells = <HTMLInputElement>document.getElementById('settings-value-draw-dead-cells');
		Life.elementSettingsValueFPS = <HTMLInputElement>document.getElementById('settings-value-fps');
		Life.elementSettingsValueDrawGrid = <HTMLInputElement>document.getElementById('settings-value-draw-grid');
		Life.elementSettingsValueIPS = <HTMLInputElement>document.getElementById('settings-value-ips');
		Life.elementSettingsValueResolution = <HTMLInputElement>document.getElementById('settings-value-resolution');
		Life.elementSettingsValueTableSize = <HTMLInputElement>document.getElementById('settings-value-table-size');
	}

	private static initializeLife(): Uint32Array[] {
		let data: Set<number> = new Set<number>(),
			tableSizeX: number = Life.settingsCalc.tableSizeX,
			tableSizeY: number = (Life.settingsCalc.tableSizeX * 9) / 16,
			x: number,
			xyMaskAlive: number = 0x40000000, // 0x40000000 is 1 << 30 (alive)
			y: number;

		// Random
		for (x = 0; x < tableSizeX; x++) {
			for (y = 0; y < tableSizeY; y++) {
				if (Math.random() > 0.5) {
					data.add((x << 15) | y | xyMaskAlive);
				}
			}
		}

		// The array buffer must be passed to each web worker independently
		return [Uint32Array.from(data), Uint32Array.from(data)];
	}

	/**
	 * Update the HTML defaults to match the values set here
	 */
	private static initializeSettings(): void {
		/*
		 * Video
		 */
		Life.settingsVideo = {
			drawDeadCells: true,
			drawGrid: true,
			fps: VideoBusInputDataSettingsFPS._60,
			resolution: null, // Native
			tableSizeX: 240, // def: 112 (240 for testing)
		};

		if (Life.isMobileOrTablet()) {
			// Mobile devices utilize sub-pixel rendering with their canvas API implementations
			Life.settingsVideo.resolution = 512;
		}

		/*
		 * Calc
		 */
		Life.settingsCalc = {
			fps: Life.settingsVideo.fps,
			iterationsPerSecond: 64, // 1 is min - def is 8 (64 for testing)
			tableSizeX: Life.settingsVideo.tableSizeX,
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
				Life.elementControlsBackward.style.display = 'none';
				Life.elementControlsForward.style.display = 'none';
				Life.elementControlsPlay.style.display = 'none';
				Life.elementControlsPause.style.display = 'none';

				Life.elementStatsCPSAll.style.display = 'none';

				Life.elementIPSRequested.classList.remove('show');
				Life.elementGameOver.style.display = 'flex';
				Life.elementGameOver.classList.add('show');
			});
			CalcBusEngine.setCallbackPS((data: CalcBusOutputDataPS) => {
				Life.elementAlive.innerText = data.alive.toLocaleString('en-US');
				Life.elementDead.innerText = data.dead.toLocaleString('en-US');

				// too many i/s requests results in deltas >1s
				let ipsEff: number = Math.max(1, (data.ips / (data.ipsDeltaInMS / 1000)) | 0);

				Life.elementStatsC.innerText = data.ipsTotal.toLocaleString('en-US');
				Life.elementStatsCPS.innerText = ipsEff.toLocaleString('en-US');
				Life.elementStatsCPSAll.style.display = 'flex';

				if (ipsEff < Life.settingsCalc.iterationsPerSecond * 0.8) {
					Life.elementStatsCPS.style.color = 'red';
				} else if (ipsEff < Life.settingsCalc.iterationsPerSecond * 0.9) {
					Life.elementStatsCPS.style.color = 'yellow';
				} else {
					Life.elementStatsCPS.style.color = 'green';
				}
			});
			CalcBusEngine.initialize(data[0], Life.settingsCalc, () => {
				console.log('Engine > Calculation: loaded in', performance.now() - then, 'ms');

				/*
				 * Load Video Engine
				 */
				then = performance.now();
				VideoBusEngine.setCallbackFPS((fps: number) => {
					Life.elementFPS.innerText = String(fps);

					if (fps < Life.settingsVideo.fps * 0.8) {
						Life.elementFPS.style.color = 'red';
					} else if (fps < Life.settingsVideo.fps * 0.9) {
						Life.elementFPS.style.color = 'yellow';
					} else {
						Life.elementFPS.style.color = 'green';
					}
				});
				VideoBusEngine.initialize(Life.elementCanvas, Life.elementDataContainer, data[1], Life.settingsVideo, (status: boolean) => {
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
		FullscreenEngine.setCallback((state: boolean) => {});
		OrientationEngine.initialize();
		OrientationEngine.setCallback((orientation: Orientation) => {});
		VisibilityEngine.initialize();
		VisibilityEngine.setCallback((state: boolean) => {
			if (!state) {
				Life.elementControlsPause.click();
			}
		});

		if (await Life.initializeWorkers()) {
			console.log('System Loaded in', performance.now() - then, 'ms');

			// Initialize: Life Seed

			// 1. Allow user to define starting cells (video integration)
			// 2. Submit cells to calc
			// 3. Draw cells in video

			// Life.elementControlsReset.click(); // delete me, autostarts game for dev
		} else {
			CalcBusEngine.outputPause();

			Life.elementWebGLNotSupported.style.display = 'flex';
			Life.elementWebGLNotSupported.classList.add('show');

			Life.elementControlsBackward.style.display = 'none';
			Life.elementControlsForward.style.display = 'none';
			Life.elementControlsPlay.style.display = 'none';
			Life.elementControlsPause.style.display = 'none';
			Life.elementControlsReset.style.display = 'none';
		}
	}

	// http://detectmobilebrowsers.com/
	public static isMobileOrTablet(): boolean {
		let check = false;
		(function (a) {
			if (
				/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(
					a,
				) ||
				/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
					a.substr(0, 4),
				)
			)
				check = true;
		})(navigator.userAgent || navigator.vendor);
		return check;
	}
}
Life.main();
