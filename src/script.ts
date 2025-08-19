import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusOutputDataSave, CalcBusOutputDataStats, masks, Stat, Stats, xyWidthBits } from './workers/calc/calc.model';
import { DOM } from './modules/dom';
import { GamingCanvas, GamingCanvasOrientation } from '@tknight-dev/gaming-canvas';
import { Interaction, InteractionMode } from './modules/interaction';
import { VideoBusEngine } from './workers/video/video.bus';
import { VideoBusInputDataSettingsFPS, VideoBusOutputDataStats } from './workers/video/video.model';
import packageJSON from '../package.json';

/**
 * @author tknight-dev
 */

// ESBuild live reloader
new EventSource('/esbuild').addEventListener('change', () => location.reload());

class Life extends Interaction {
	private static performanceCalc: number = 0;
	private static performanceVideo: number = 0;
	private static timeoutControl: ReturnType<typeof setTimeout>;
	private static timeoutError: ReturnType<typeof setTimeout>;
	private static timeoutFullscreen: ReturnType<typeof setTimeout>;
	private static timeoutPlay: ReturnType<typeof setTimeout>;
	private static timeoutReset: ReturnType<typeof setTimeout>;

	private static initializeDOMHooks(): void {
		DOM.elementRulesClose.onclick = () => {
			DOM.elementRules.style.display = 'none';
		};

		/**
		 * Controls
		 */
		Interaction.elementControlsBackwardFunc = () => {
			Interaction.settingsCalc.iterationsPerSecond = Math.max(1, Math.round(Interaction.settingsCalc.iterationsPerSecond / 2));

			DOM.elementSettingsValueIPS.value = String(Interaction.settingsCalc.iterationsPerSecond);
			DOM.elementIPSRequested.innerText = Interaction.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			DOM.elementIPSRequested.style.display = 'flex';
			DOM.elementIPSRequested.classList.add('show');
			DOM.elementSpinout.classList.remove('show');

			clearTimeout(Life.timeoutControl);
			Life.timeoutControl = setTimeout(() => {
				DOM.elementIPSRequested.classList.remove('show');
				DOM.elementSpinout.classList.add('show');
			}, 1000);

			CalcBusEngine.outputSettings(Interaction.settingsCalc);
		};
		DOM.elementControlsBackward.onclick = Interaction.elementControlsBackwardFunc;

		Interaction.elementControlsForwardFunc = () => {
			Interaction.settingsCalc.iterationsPerSecond = Math.min(
				Interaction.settingsCalcIPSMax,
				Interaction.settingsCalc.iterationsPerSecond * 2,
			);

			DOM.elementSettingsValueIPS.value = String(Interaction.settingsCalc.iterationsPerSecond);
			DOM.elementIPSRequested.innerText = Interaction.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			DOM.elementIPSRequested.style.display = 'flex';
			DOM.elementIPSRequested.classList.add('show');
			DOM.elementSpinout.classList.remove('show');

			clearTimeout(Life.timeoutControl);
			Life.timeoutControl = setTimeout(() => {
				DOM.elementIPSRequested.classList.remove('show');
				DOM.elementSpinout.classList.add('show');
			}, 1000);

			CalcBusEngine.outputSettings(Interaction.settingsCalc);
		};
		DOM.elementControlsForward.onclick = Interaction.elementControlsForwardFunc;

		Interaction.elementControlsPauseFunc = () => {
			DOM.elementControlsPause.style.display = 'none';
			if (!Interaction.gameover) {
				DOM.elementControlsPlay.style.display = 'block';
			}

			DOM.elementStatsCPS.style.display = 'none';

			CalcBusEngine.outputPause();
		};
		DOM.elementControlsPause.onclick = Interaction.elementControlsPauseFunc;
		DOM.elementControlsPause.style.display = 'none';

		Interaction.elementControlsPlayFunc = () => {
			DOM.elementControlsPlay.style.display = 'none';
			DOM.elementControlsPause.style.display = 'block';

			DOM.elementEditMove.click();

			DOM.elementHomeostatic.classList.remove('show');
			DOM.elementStatsCPS.style.display = 'block';
			DOM.elementIPSRequested.innerText = Interaction.settingsCalc.iterationsPerSecond.toLocaleString('en-US') + ' i/s';
			DOM.elementIPSRequested.classList.add('show');
			DOM.elementSpinout.classList.remove('show');
			Life.timeoutPlay = setTimeout(() => {
				DOM.elementHomeostatic.style.display = 'none';
				DOM.elementIPSRequested.classList.remove('show');
				DOM.elementSpinout.style.display = 'none';
			}, 1000);

			CalcBusEngine.outputPlay();
		};
		DOM.elementControlsPlay.onclick = Interaction.elementControlsPlayFunc;

		Interaction.elementControlsResetFunc = () => {
			Interaction.spinner(true);

			const data: Uint32Array = Life.initializeLife();
			VideoBusEngine.outputReset();
			CalcBusEngine.outputReset(data);
			Interaction.cameraReset = true;
			Interaction.gameover = false;

			DOM.elementAlive.innerText = '';
			DOM.elementDead.innerText = '';

			DOM.elementControlsBackward.style.display = 'block';
			DOM.elementControlsForward.style.display = 'block';
			DOM.elementControlsPlay.style.display = 'block';
			DOM.elementControlsPause.style.display = 'none';

			DOM.elementEditAddDeath.style.display = 'flex';
			DOM.elementEditAddLife.style.display = 'flex';
			DOM.elementEditMove.style.display = 'flex';
			DOM.elementEditRemove.style.display = 'flex';

			if (!Interaction.settingsSeedRandom) {
				DOM.elementEditAddLife.click();
			}

			DOM.elementGameOver.classList.remove('show');
			DOM.elementHomeostatic.classList.remove('show');
			DOM.elementIPSRequested.style.display = 'flex';
			DOM.elementSpinout.classList.remove('show');
			Life.timeoutReset = setTimeout(() => {
				DOM.elementGameOver.style.display = 'none';
				DOM.elementHomeostatic.style.display = 'none';
				DOM.elementSpinout.style.display = 'none';
			}, 1000);
			DOM.elementStatsC.innerText = '0';
		};
		DOM.elementControlsReset.onclick = Interaction.elementControlsResetFunc;

		/**
		 * Edit
		 */
		DOM.elementEditAddDeath.onclick = () => {
			if (Interaction.mode !== InteractionMode.DRAW_DEATH && Interaction.settingsVideo.drawDeadCells) {
				Interaction.mode = InteractionMode.DRAW_DEATH;

				DOM.elementEditAddDeath.classList.add('active');
				DOM.elementEditAddLife.classList.remove('active');
				DOM.elementEditMove.classList.remove('active');
				DOM.elementEditRemove.classList.remove('active');

				DOM.elementEdit.classList.add('add');
				DOM.elementEdit.classList.remove('remove');

				DOM.elementVideoInteractive.classList.add('cursor-crosshair');
				DOM.elementVideoInteractive.classList.remove('cursor-grab');

				if (DOM.elementControlsPause.style.display === 'block') {
					DOM.elementControlsPause.click();
				}
			}
		};
		DOM.elementEditAddLife.onclick = () => {
			if (Interaction.mode !== InteractionMode.DRAW_LIFE) {
				Interaction.mode = InteractionMode.DRAW_LIFE;

				DOM.elementEditAddDeath.classList.remove('active');
				DOM.elementEditAddLife.classList.add('active');
				DOM.elementEditMove.classList.remove('active');
				DOM.elementEditRemove.classList.remove('active');

				DOM.elementEdit.classList.add('add');
				DOM.elementEdit.classList.remove('remove');

				DOM.elementVideoInteractive.classList.add('cursor-crosshair');
				DOM.elementVideoInteractive.classList.remove('cursor-grab');

				if (DOM.elementControlsPause.style.display === 'block') {
					DOM.elementControlsPause.click();
				}
			}
		};
		DOM.elementEditMove.onclick = () => {
			if (Interaction.mode !== InteractionMode.MOVE_ZOOM) {
				Interaction.mode = InteractionMode.MOVE_ZOOM;

				DOM.elementEditAddDeath.classList.remove('active');
				DOM.elementEditAddLife.classList.remove('active');
				DOM.elementEditMove.classList.add('active');
				DOM.elementEditRemove.classList.remove('active');

				DOM.elementVideoInteractive.classList.remove('cursor-crosshair');
				DOM.elementVideoInteractive.classList.add('cursor-grab');

				DOM.elementEdit.style.display = 'none';
			}
		};
		DOM.elementEditRemove.onclick = () => {
			if (Interaction.mode !== InteractionMode.ERASE) {
				Interaction.mode = InteractionMode.ERASE;

				DOM.elementEditAddDeath.classList.remove('active');
				DOM.elementEditAddLife.classList.remove('active');
				DOM.elementEditMove.classList.remove('active');
				DOM.elementEditRemove.classList.add('active');

				DOM.elementVideoInteractive.classList.add('cursor-crosshair');
				DOM.elementVideoInteractive.classList.remove('cursor-grab');

				DOM.elementEdit.classList.remove('add');
				DOM.elementEdit.classList.add('remove');

				if (DOM.elementControlsPause.style.display === 'block') {
					DOM.elementControlsPause.click();
				}
			}
		};
		DOM.elementEditScreenshot.onclick = () => {
			if (DOM.elementControlsPause.style.display === 'block') {
				DOM.elementControlsPause.click();
			}
			Interaction.spinner(true);

			setTimeout(async () => {
				const a: HTMLAnchorElement = document.createElement('a');

				// Set anchor
				let downloadData: string = URL.createObjectURL(<Blob>await GamingCanvas.screenshot());
				a.classList.add('hidden');
				a.download = 'screenshot.png';
				a.href = downloadData;

				// Download
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);

				setTimeout(() => {
					URL.revokeObjectURL(downloadData);
					Interaction.spinner(false);
				}, 250);
			}, 250);
		};
		DOM.elementEditSave.onclick = () => {
			if (DOM.elementControlsPause.style.display === 'block') {
				DOM.elementControlsPause.click();
			}
			Interaction.spinner(true);

			setTimeout(() => {
				const a: HTMLAnchorElement = document.createElement('a');

				CalcBusEngine.setCallbackSave((data: CalcBusOutputDataSave) => {
					let downloadData =
						'data:text/json;charset=utf-8,' +
						btoa(
							JSON.stringify({
								alive: Array.from(data.alive),
								dead: Array.from(data.dead),
								ipsTotal: data.ipsTotal,
								tableSizeX: data.tableSizeX,
							}),
						);
					a.classList.add('hidden');
					a.download = 'save.life';
					a.href = downloadData;

					// Download
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);

					setTimeout(() => {
						Interaction.spinner(false);
					}, 250);
				});
				CalcBusEngine.outputSave();
			}, 250);
		};
		DOM.elementEditUpload.onclick = () => {
			if (DOM.elementControlsPause.style.display === 'block') {
				DOM.elementControlsPause.click();
			}

			DOM.elementFile.onchange = (data: any) => {
				if (data.target.files.length === 0) {
					return;
				}
				Interaction.spinner(true);

				setTimeout(() => {
					const fileReader: FileReader = new FileReader();

					fileReader.onloadend = () => {
						try {
							const parsed = JSON.parse(atob(<string>fileReader.result));

							/**
							 * Validate: Settings
							 */
							if (![32, 80, 160, 320, 640, 960, 1280, 1920, 2560].includes(parsed.tableSizeX)) {
								throw new Error('unsupported tableSizeX value: ' + parsed.tableSizeX);
							}

							/**
							 * Restore: Settings
							 */
							Interaction.settingsCalc.tableSizeX = parsed.tableSizeX;
							Interaction.settingsVideo.tableSizeX = parsed.tableSizeX;
							DOM.elementSettingsValueTableSize.value = String(parsed.tableSizeX);
							VideoBusEngine.outputSettings(Interaction.settingsVideo);

							/**
							 * Restore: Data
							 */
							VideoBusEngine.outputReset();
							CalcBusEngine.outputRestore(<CalcBusOutputDataSave>{
								alive: Uint32Array.from(parsed.alive || []),
								dead: Uint32Array.from(parsed.dead || []),
								ipsTotal: parsed.ipsTotal || 0,
								tableSizeX: parsed.tableSizeX,
							});
						} catch (error) {
							console.error('upload failed with', error);

							DOM.elementError.style.display = 'flex';
							setTimeout(() => {
								DOM.elementError.classList.add('show');

								clearTimeout(Life.timeoutError);
								Life.timeoutError = setTimeout(() => {
									DOM.elementError.classList.remove('show');

									Life.timeoutError = setTimeout(() => {
										DOM.elementError.style.display = 'none';
									}, 1000);
								}, 3000);

								Interaction.spinner(false);
							}, 10);
						}
					};
					fileReader.readAsBinaryString(data.target.files[0]);
				}, 250);
			};
			DOM.elementFile.click();
		};

		/**
		 * Fullscreen
		 */
		DOM.elementFullscreen.onclick = async () => {
			DOM.elementControlsPause.click();

			if (GamingCanvas.isFullscreen()) {
				await GamingCanvas.setFullscreen(false);

				DOM.elementControls.classList.remove('fullscreen');
				DOM.elementCounts.classList.remove('fullscreen');
				DOM.elementFPS.classList.remove('fullscreen');
				DOM.elementGame.classList.remove('fullscreen');
				DOM.elementHomeostatic.classList.remove('fullscreen');
				DOM.elementPerformance.classList.remove('fullscreen');
				DOM.elementStats.classList.remove('fullscreen');

				DOM.elementFullscreen.classList.remove('fullscreen-exit');
				DOM.elementFullscreen.classList.add('fullscreen');

				GamingCanvas.isWakeLockSupported() && GamingCanvas.wakeLock(false);
				setTimeout(() => {
					Interaction.pxSizeCalc();
				}, 100);
			} else {
				await GamingCanvas.setFullscreen(true, DOM.elementGame);

				DOM.elementControls.classList.add('fullscreen');
				DOM.elementControls.classList.add('show');
				DOM.elementCounts.classList.add('fullscreen');
				DOM.elementCounts.classList.add('adjust');
				DOM.elementFPS.classList.add('fullscreen');
				DOM.elementFPS.classList.add('adjust');
				DOM.elementGame.classList.add('fullscreen');
				DOM.elementHomeostatic.classList.add('fullscreen');
				DOM.elementHomeostatic.classList.add('adjust');
				DOM.elementPerformance.classList.add('fullscreen');
				DOM.elementPerformance.classList.add('adjust');
				DOM.elementStats.classList.add('fullscreen');
				DOM.elementStats.classList.add('show');

				DOM.elementFullscreen.classList.remove('fullscreen');
				DOM.elementFullscreen.classList.add('fullscreen-exit');

				fullscreenFader();
				setTimeout(() => {
					Interaction.pxSizeCalc();
					GamingCanvas.isWakeLockSupported() && GamingCanvas.wakeLock(true);
				}, 100);
			}
		};
		Interaction.fullscreenClickFunc = () => {
			if (GamingCanvas.isFullscreen()) {
				if (Interaction.mode === InteractionMode.MOVE_ZOOM && DOM.elementControls.classList.contains('show')) {
					DOM.elementControls.classList.remove('show');
					DOM.elementCounts.classList.remove('adjust');
					DOM.elementFPS.classList.remove('adjust');
					DOM.elementHomeostatic.classList.remove('adjust');
					DOM.elementPerformance.classList.remove('adjust');
					DOM.elementStats.classList.remove('show');
				} else {
					DOM.elementControls.classList.add('show');
					DOM.elementCounts.classList.add('adjust');
					DOM.elementFPS.classList.add('adjust');
					DOM.elementHomeostatic.classList.add('adjust');
					DOM.elementPerformance.classList.add('adjust');
					DOM.elementStats.classList.add('show');

					fullscreenFader();
				}
			}
		};
		DOM.elementVideoInteractive.addEventListener('click', Interaction.fullscreenClickFunc);
		const fullscreenFader = () => {
			clearTimeout(Life.timeoutFullscreen);
			if (Interaction.mode === InteractionMode.MOVE_ZOOM) {
				Life.timeoutFullscreen = setTimeout(() => {
					DOM.elementControls.classList.remove('show');
					DOM.elementCounts.classList.remove('adjust');
					DOM.elementFPS.classList.remove('adjust');
					DOM.elementHomeostatic.classList.remove('adjust');
					DOM.elementPerformance.classList.remove('adjust');
					DOM.elementStats.classList.remove('show');
				}, 3000);
			}
		};
		DOM.elementControls.onmouseenter = () => {
			DOM.elementControls.classList.add('show');
			DOM.elementCounts.classList.add('adjust');
			DOM.elementFPS.classList.add('adjust');
			DOM.elementHomeostatic.classList.add('adjust');
			DOM.elementPerformance.classList.add('adjust');
			DOM.elementStats.classList.add('show');
			clearTimeout(Life.timeoutFullscreen);
		};
		DOM.elementStats.onmouseenter = () => {
			DOM.elementControls.classList.add('show');
			DOM.elementCounts.classList.add('adjust');
			DOM.elementFPS.classList.add('adjust');
			DOM.elementHomeostatic.classList.add('adjust');
			DOM.elementPerformance.classList.add('adjust');
			DOM.elementStats.classList.add('show');
			clearTimeout(Life.timeoutFullscreen);
		};
		DOM.elementControls.onmouseleave = () => {
			fullscreenFader();
		};
		DOM.elementStats.onmouseleave = () => {
			fullscreenFader();
		};
		GamingCanvas.setCallbackFullscreen((state: boolean) => {
			if (!state) {
				DOM.elementControls.classList.remove('fullscreen');
				DOM.elementCounts.classList.remove('fullscreen');
				DOM.elementGame.classList.remove('fullscreen');
				DOM.elementFPS.classList.remove('fullscreen');
				DOM.elementHomeostatic.classList.remove('fullscreen');
				DOM.elementPerformance.classList.remove('fullscreen');
				DOM.elementStats.classList.remove('fullscreen');

				DOM.elementFullscreen.classList.remove('fullscreen-exit');
				DOM.elementFullscreen.classList.add('fullscreen');

				GamingCanvas.isWakeLockSupported() && GamingCanvas.wakeLock(false);
				setTimeout(() => {
					Interaction.pxSizeCalc();
				}, 100);
			}
		});

		/**
		 * Menu
		 */
		DOM.elementMenu.onclick = () => {
			DOM.elementLogo.classList.toggle('open');
			DOM.elementMenuContent.classList.toggle('open');
		};
		DOM.elementMenuRules.onclick = () => {
			DOM.elementSettingsCancel.click();

			DOM.elementLogo.classList.remove('open');
			DOM.elementMenuContent.classList.remove('open');

			DOM.elementRules.style.display = 'block';
		};
		DOM.elementMenuSettings.onclick = () => {
			DOM.elementRulesClose.click();

			DOM.elementLogo.classList.remove('open');
			DOM.elementMenuContent.classList.remove('open');

			DOM.elementSettings.style.display = 'block';
		};

		document.addEventListener('click', (event: any) => {
			if (event.target.id !== 'info-menu') {
				DOM.elementLogo.classList.remove('open');
				DOM.elementMenuContent.classList.remove('open');
			}
		});

		/**
		 * Settings
		 */
		DOM.elementSettingsApply.onclick = () => {
			/**
			 * HTML -> JS
			 */
			Interaction.settingsCalc = {
				cpuSpinOutProtection: Boolean(DOM.elementSettingsValueCPUSpinOutProtection.checked),
				debug: Interaction.settingsCalc.debug,
				homeostaticPause: Boolean(DOM.elementSettingsValueHomeostaticPause.checked),
				fps: Number(DOM.elementSettingsValueFPS.value),
				iterationsPerSecond: Math.round(
					Math.max(1, Math.min(Interaction.settingsCalcIPSMax, Number(DOM.elementSettingsValueIPS.value))),
				),
				tableSizeX: <any>Number(DOM.elementSettingsValueTableSize.value),
			};

			Interaction.settingsVideo = {
				debug: Interaction.settingsVideo.debug,
				drawDeadCells: Boolean(DOM.elementSettingsValueDrawDeadCells.checked),
				drawGrid: Boolean(DOM.elementSettingsValueDrawGrid.checked),
				fps: Interaction.settingsCalc.fps,
				resolution: <any>(
					(DOM.elementSettingsValueResolution.value === 'null' ? null : Number(DOM.elementSettingsValueResolution.value))
				),
				tableSizeX: Interaction.settingsCalc.tableSizeX,
			};

			Interaction.settingsGamingCanvas.debug = Interaction.settingsCalc.debug;
			Interaction.settingsGamingCanvas.orientation = Interaction.settingsRotateAutoEnable
				? GamingCanvasOrientation.AUTO
				: GamingCanvasOrientation.LANDSCAPE;
			Interaction.settingsGamingCanvas.resolutionByWidthPx = Interaction.settingsVideo.resolution;

			if (Interaction.settingsVideo.drawDeadCells) {
				DOM.elementEditAddDeath.classList.remove('disable');
			} else {
				DOM.elementEditAddDeath.classList.add('disable');

				if (Interaction.mode === InteractionMode.DRAW_DEATH) {
					DOM.elementEditMove.click();
				}
			}
			Interaction.settingsFPSShow = Boolean(DOM.elementSettingsValueFPSShow.checked);
			if (!Interaction.settingsFPSShow) {
				DOM.elementFPS.innerText = '';
			}
			Interaction.settingsRotateAutoEnable = Boolean(DOM.elementSettingsValueOrientationAutoRotate.checked);
			Interaction.settingsSeedRandom = Boolean(DOM.elementSettingsValueSeedRandom.checked);
			Interaction.settingsStatsShowAliveDead = Boolean(DOM.elementSettingsValueStatsShowAliveDead.checked);
			if (Interaction.settingsStatsShowAliveDead) {
				DOM.elementCounts.style.display = 'block';
			} else {
				DOM.elementCounts.style.display = 'none';
			}
			Interaction.settingsStatsShowPerformance = Boolean(DOM.elementSettingsValueStatsShowPerformance.checked);
			if (Interaction.settingsStatsShowPerformance) {
				DOM.elementPerformance.style.display = 'block';
			} else {
				DOM.elementPerformance.style.display = 'none';
			}

			/**
			 * Main thread -> workers
			 */
			CalcBusEngine.outputSettings(Interaction.settingsCalc);
			GamingCanvas.setOptions(Interaction.settingsGamingCanvas);
			VideoBusEngine.outputSettings(Interaction.settingsVideo);

			/**
			 * Done
			 */
			DOM.elementSettings.style.display = 'none';
			DOM.elementSettingsValueIPS.value = String(Interaction.settingsCalc.iterationsPerSecond);
		};
		DOM.elementSettingsCancel.onclick = () => {
			DOM.elementSettings.style.display = 'none';
		};
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
		Interaction.settingsRotateAutoEnable = true; // def true
		Interaction.settingsSeedRandom = true; // def true
		Interaction.settingsStatsShowAliveDead = true; // def true
		Interaction.settingsStatsShowPerformance = false; // def false

		/*
		 * Video
		 */
		Interaction.settingsVideo = {
			debug: false, // def false
			drawDeadCells: true, // def true
			drawGrid: true, // def true
			fps: VideoBusInputDataSettingsFPS._60, // def 60
			resolution: null, // Native is null
			tableSizeX: 80, // def: 80
		};

		if (Interaction.isMobileOrTablet()) {
			// Mobile devices utilize sub-pixel rendering with their canvas API implementations
			Interaction.settingsVideo.resolution = 640;
		}

		/*
		 * Calc
		 */
		Interaction.settingsCalc = {
			cpuSpinOutProtection: true, // def true
			debug: Interaction.settingsVideo.debug, // def false
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
				case 'debug':
					Interaction.settingsCalc.debug = String(value).toLowerCase() === 'true';
					Interaction.settingsVideo.debug = Interaction.settingsCalc.debug;
					GamingCanvas.setDebug(Interaction.settingsCalc.debug);
					break;
				case 'drawdead':
					Interaction.settingsVideo.drawDeadCells = String(value).toLowerCase() === 'true';
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
							case 2560:
								Interaction.settingsVideo.resolution = <160 | 320 | 640 | 1280 | 1920 | 2560>Number(value);
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
						case 480:
						case 960:
						case 1280:
						case 1920:
						case 2560:
							Interaction.settingsCalc.tableSizeX = <32 | 80 | 160 | 320 | 640 | 960 | 1280 | 1920 | 2560>Number(value);
							Interaction.settingsVideo.tableSizeX = <32 | 80 | 160 | 320 | 640 | 960 | 1280 | 1920 | 2560>Number(value);
							break;
					}
					break;
			}
		}

		/*
		 * HTML
		 */
		DOM.elementSettingsValueCPUSpinOutProtection.checked = Interaction.settingsCalc.cpuSpinOutProtection;

		DOM.elementSettingsValueDrawDeadCells.checked = Interaction.settingsVideo.drawDeadCells;
		if (Interaction.settingsVideo.drawDeadCells) {
			DOM.elementEditAddDeath.classList.remove('disable');
		} else {
			DOM.elementEditAddDeath.classList.add('disable');

			if (Interaction.mode === InteractionMode.DRAW_DEATH) {
				DOM.elementEditMove.click();
			}
		}

		DOM.elementSettingsValueDrawGrid.checked = Interaction.settingsVideo.drawGrid;
		DOM.elementSettingsValueHomeostaticPause.checked = Interaction.settingsCalc.homeostaticPause;
		DOM.elementSettingsValueIPS.value = String(Interaction.settingsCalc.iterationsPerSecond);
		DOM.elementSettingsValueFPS.value = String(Interaction.settingsCalc.fps);

		DOM.elementSettingsValueFPSShow.checked = Interaction.settingsFPSShow;
		if (!Interaction.settingsFPSShow) {
			DOM.elementFPS.innerText = '';
		}

		DOM.elementSettingsValueOrientationAutoRotate.checked = Interaction.settingsRotateAutoEnable;
		DOM.elementSettingsValueResolution.value = String(Interaction.settingsVideo.resolution);
		DOM.elementSettingsValueSeedRandom.checked = Interaction.settingsSeedRandom;

		DOM.elementSettingsValueStatsShowAliveDead.checked = Interaction.settingsStatsShowAliveDead;
		if (Interaction.settingsStatsShowAliveDead) {
			DOM.elementCounts.style.display = 'block';
		} else {
			DOM.elementCounts.style.display = 'none';
		}

		DOM.elementSettingsValueStatsShowPerformance.checked = Interaction.settingsStatsShowPerformance;
		if (Interaction.settingsStatsShowPerformance) {
			DOM.elementPerformance.style.display = 'block';
		} else {
			DOM.elementPerformance.style.display = 'none';
		}

		DOM.elementSettingsValueTableSize.value = String(Interaction.settingsVideo.tableSizeX);
	}

	private static initializeWorkers(): Promise<boolean> {
		return new Promise((resolve) => {
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

				DOM.elementControlsBackward.style.display = 'none';
				DOM.elementControlsForward.style.display = 'none';
				DOM.elementControlsPlay.style.display = 'none';
				DOM.elementControlsPause.style.display = 'none';

				Interaction.mode = InteractionMode.ERASE;
				DOM.elementEditMove.click();
				DOM.elementEditAddLife.style.display = 'none';
				DOM.elementEditRemove.style.display = 'none';

				DOM.elementStatsCPSAll.style.display = 'none';

				DOM.elementIPSRequested.classList.remove('show');
				DOM.elementGameOver.style.display = 'flex';
				setTimeout(() => {
					DOM.elementGameOver.classList.add('show');
				}, 10);
			});
			CalcBusEngine.setCallbackHomeostatic(() => {
				if (Interaction.settingsCalc.homeostaticPause) {
					DOM.elementControlsPause.style.display = 'none';
					DOM.elementControlsPlay.style.display = 'block';
				}
				clearTimeout(Life.timeoutPlay);
				clearTimeout(Life.timeoutReset);

				if (DOM.elementHomeostatic.style.display === 'none') {
					DOM.elementHomeostatic.style.display = 'block';

					setTimeout(() => {
						DOM.elementHomeostatic.classList.add('show');
					}, 10);
				} else {
					DOM.elementHomeostatic.classList.add('show');
				}
			});
			CalcBusEngine.setCallbackSpinOut(() => {
				DOM.elementControlsPause.click();
				DOM.elementSpinout.style.display = 'flex';
				setTimeout(() => {
					DOM.elementSpinout.classList.add('show');
				}, 10);
			});
			CalcBusEngine.setCallbackStats((data: CalcBusOutputDataStats) => {
				// Performance
				const calcAvgInMs: number = Stat.getAVG(data.performance[Stats.CALC_AVG]),
					neighborsAvgInMs: number = Stat.getAVG(data.performance[Stats.CALC_NEIGHBORS_AVG]),
					stateAvgInMs: number = Stat.getAVG(data.performance[Stats.CALC_STATE_AVG]);

				Life.performanceCalc = neighborsAvgInMs + stateAvgInMs;

				DOM.elementPerformanceBus.innerHTML = perf(Stat.getAVG(data.performance[Stats.CALC_BUS_AVG]));
				DOM.elementPerformanceCalc.innerHTML = perf(calcAvgInMs);
				DOM.elementPerformanceHomeostatis.innerHTML = perf(Stat.getAVG(data.performance[Stats.CALC_HOMEOSTASIS_AVG]));
				DOM.elementPerformanceNeighbors.innerHTML = perf(neighborsAvgInMs);
				DOM.elementPerformanceState.innerHTML = perf(stateAvgInMs);

				if (calcAvgInMs > (1000 / Life.settingsCalc.iterationsPerSecond) * 1.2) {
					DOM.elementPerformanceCalc.style.color = 'red';
				} else if (calcAvgInMs > 1000 / Life.settingsCalc.iterationsPerSecond) {
					DOM.elementPerformanceCalc.style.color = 'yellow';
				} else {
					DOM.elementPerformanceCalc.style.color = 'white';
				}

				// Stats
				DOM.elementAlive.innerText = data.alive.toLocaleString('en-US');
				DOM.elementDead.innerText = data.dead.toLocaleString('en-US');

				// too many i/s requests results in deltas >1s
				const ipsEff: number = Math.max(1, (data.ips / (data.ipsDeltaInMS / 1000)) | 0);

				DOM.elementStatsC.innerText = data.ipsTotal.toLocaleString('en-US');
				DOM.elementStatsCPS.innerText = ipsEff.toLocaleString('en-US');
				DOM.elementStatsCPSAll.style.display = 'flex';

				// I/S
				if (ipsEff < Interaction.settingsCalc.iterationsPerSecond * 0.8) {
					DOM.elementStatsCPS.style.color = 'red';
				} else if (ipsEff < Interaction.settingsCalc.iterationsPerSecond * 0.9) {
					DOM.elementStatsCPS.style.color = 'yellow';
				} else {
					DOM.elementStatsCPS.style.color = 'green';
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

					DOM.elementPerformanceAll.innerHTML = perf(Life.performanceCalc + Life.performanceVideo);
					DOM.elementPerformanceCtV.innerHTML = perf(Stat.getAVG(data.performance[Stats.CALC_TO_VIDEO_BUS_AVG]));
					DOM.elementPerformanceDraw.innerHTML = perf(drawAvgInMs);

					if (drawAvgInMs > fpsInMS * 1.2) {
						DOM.elementPerformanceDraw.style.color = 'red';
					} else if (drawAvgInMs > fpsInMS * 1.1) {
						DOM.elementPerformanceDraw.style.color = 'yellow';
					} else {
						DOM.elementPerformanceDraw.style.color = 'white';
					}

					// FPS
					if (Interaction.settingsFPSShow) {
						DOM.elementFPS.innerText = String(data.fps);

						if (data.fps < Interaction.settingsVideo.fps * 0.8) {
							DOM.elementFPS.style.color = 'red';
						} else if (data.fps < Interaction.settingsVideo.fps * 0.9) {
							DOM.elementFPS.style.color = 'yellow';
						} else {
							DOM.elementFPS.style.color = 'green';
						}
					} else {
						DOM.elementFPS.innerText = '';
					}
				});
				VideoBusEngine.initialize(DOM.elementVideoCanvases[0], Interaction.settingsVideo, (status: boolean) => {
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

		// Initialize: Statics
		DOM.initializeDOM();
		DOM.elementVersion.innerText = packageJSON.version;
		Interaction.spinner(true);

		Life.initializeSettings();

		// Initialize: GamingCanvas
		DOM.elementEdit = document.createElement('div');
		DOM.elementEdit.className = 'edit';
		DOM.elementEdit.id = 'edit';
		Interaction.settingsGamingCanvas = {
			callbackReportLimitPerMs: 8, // 8ms is faster than 120fps (8.3333ms)
			debug: Interaction.settingsCalc.debug,
			// direction: GamingCanvasDirection.INVERTED,
			elementInject: [DOM.elementEdit],
			elementInteractive: DOM.elementVideoInteractive,
			orientation: Interaction.settingsRotateAutoEnable ? GamingCanvasOrientation.AUTO : GamingCanvasOrientation.LANDSCAPE,
			resolutionByWidthPx: Interaction.settingsVideo.resolution,
		};

		DOM.elementVideoCanvases = GamingCanvas.initialize(DOM.elementVideo, Interaction.settingsGamingCanvas);

		// Initialize: Dynamics
		Life.initializeDOMHooks();

		GamingCanvas.setCallbackVisibility((state: boolean) => {
			if (!state) {
				DOM.elementControlsPause.click();
			}
		});

		if (await Life.initializeWorkers()) {
			console.log('System Loaded in', performance.now() - then, 'ms');

			// Last
			Life.initializeInteraction();

			// Default to add life if no life current on the board
			if (!Interaction.settingsSeedRandom) {
				DOM.elementEditAddLife.click();
			}
		} else {
			CalcBusEngine.outputPause();

			DOM.elementWebGLNotSupported.style.display = 'flex';
			DOM.elementWebGLNotSupported.classList.add('show');

			DOM.elementControlsBackward.style.display = 'none';
			DOM.elementControlsForward.style.display = 'none';
			DOM.elementControlsPlay.style.display = 'none';
			DOM.elementControlsPause.style.display = 'none';
			DOM.elementControlsReset.style.display = 'none';
		}
	}
}
Life.main();
