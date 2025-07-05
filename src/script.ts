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

		Life.elementStatsC = <HTMLElement>document.getElementById('c');
		Life.elementStatsCPS = <HTMLElement>document.getElementById('cps');
	}

	private static initializeWorkers(): void {
		let then: number = performance.now();
		VideoBusEngine.initialize(Life.elementCanvas, () => {
			console.log('VideoBusEngine: loaded in', performance.now() - then, 'ms');
		});
	}

	public static main(): void {
		Life.initializeDOM();
		Life.initializeWorkers();
	}
}
Life.main();
