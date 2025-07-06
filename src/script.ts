import { CalcBusEngine } from './workers/calc/calc.bus';
import { VideoBusEngine } from './workers/video/video.bus';
// import { VideoBusInputCmdInit } from './buses/video.model.bus';

/**
 * @author tknight-dev
 */

// ESBuild live reloader
new EventSource('/esbuild').addEventListener('change', () => location.reload());

class Life {
	private static elementCanvas: HTMLCanvasElement;
	private static elementControlsForward: HTMLElement;
	private static elementControlsPause: HTMLElement;
	private static elementControlsPlay: HTMLElement;
	private static elementControlsReset: HTMLElement;
	private static elementDataContainer: HTMLElement;
	private static elementFPS: HTMLElement;
	private static elementMenuInfo: HTMLElement;
	private static elementStatsC: HTMLElement;
	private static elementStatsCPS: HTMLElement;

	private static initializeDOM(): void {
		Life.elementCanvas = <HTMLCanvasElement>document.getElementById('cavnas');

		Life.elementControlsForward = <HTMLElement>document.getElementById('forward');
		Life.elementControlsPause = <HTMLElement>document.getElementById('pause');
		Life.elementControlsPlay = <HTMLElement>document.getElementById('play');
		Life.elementControlsReset = <HTMLElement>document.getElementById('reset');

		Life.elementMenuInfo = <HTMLElement>document.getElementById('info-click');
		Life.elementMenuInfo.onclick = () => {
			(<any>window).open('https://tknight.dev/#/creations', '_blank').focus();
		};

		Life.elementDataContainer = <HTMLElement>document.getElementById('data-container');
		Life.elementFPS = <HTMLElement>document.getElementById('fps');

		Life.elementStatsC = <HTMLElement>document.getElementById('c');
		Life.elementStatsCPS = <HTMLElement>document.getElementById('cps');
	}

	private static initializeWorkers(): Promise<void> {
		return new Promise((resolve, reject) => {
			let then: number = performance.now();
			CalcBusEngine.initialize(() => {
				console.log('Engine > Calculation: loaded in', performance.now() - then, 'ms');

				then = performance.now();
				VideoBusEngine.setCallbackFPS((fps: number) => {
					Life.elementFPS.innerText = String(fps);
				});
				VideoBusEngine.initialize(Life.elementCanvas, Life.elementDataContainer, () => {
					console.log('Engine > Video: loaded in', performance.now() - then, 'ms');
					resolve();
				});
			});
		});
	}

	public static async main(): Promise<void> {
		let then: number = performance.now();

		// Initialize
		Life.initializeDOM();
		await Life.initializeWorkers();

		console.log('System Loaded in', performance.now() - then, 'ms');
	}
}
Life.main();
