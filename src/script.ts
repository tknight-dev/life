import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusInputDataSettings, CalcBusOutputDataIPS } from './workers/calc/calc.model';
import { VideoBusEngine } from './workers/video/video.bus';
import { VideoBusInputDataSettings, VideoBusInputDataSettingsFPS } from './workers/video/video.model';

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
	private static settingsCalc: CalcBusInputDataSettings;
	private static settingsVideo: VideoBusInputDataSettings;

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

	private static initializeSettings(): void {
		/*
		 * Video
		 */
		Life.settingsVideo = {
			fps: VideoBusInputDataSettingsFPS._60,
			resolution: null, // Native
		};

		if (Life.isMobileOrTablet()) {
			Life.settingsVideo.resolution = 512; // Mobile devices utilize sub-pixel rendering with their canvas implementation
		}

		/*
		 * Calc
		 */
		Life.settingsCalc = {
			fps: Life.settingsVideo.fps,
			iterationsPerSecond: 1000, // 1000 is min
		};
	}

	private static initializeWorkers(): Promise<void> {
		return new Promise((resolve, reject) => {
			/*
			 * Load Calc Engine
			 */
			let then: number = performance.now();
			CalcBusEngine.setCallbackIPS((data: CalcBusOutputDataIPS) => {
				Life.elementStatsC.innerText = String((data.ipsTotal / 1000) | 0);
				Life.elementStatsCPS.innerText = String(data.ips);
			});
			CalcBusEngine.setCallbackPositions((data: Uint32Array) => {
				// console.log('positions', data);
			});
			CalcBusEngine.initialize(Life.settingsCalc, () => {
				console.log('Engine > Calculation: loaded in', performance.now() - then, 'ms');

				/*
				 * Load Video Engine
				 */
				then = performance.now();
				VideoBusEngine.setCallbackFPS((fps: number) => {
					Life.elementFPS.innerText = String(fps);
				});
				VideoBusEngine.initialize(Life.elementCanvas, Life.elementDataContainer, Life.settingsVideo, () => {
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
		Life.initializeSettings();
		await Life.initializeWorkers();

		console.log('System Loaded in', performance.now() - then, 'ms');

		// 1. Allow user to define starting cells (video integration)
		// 2. Submit cells to calc
		// 3. Draw cells in video
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
