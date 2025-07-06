import {
	VideoBusInputCmd,
	VideoBusInputDataInit,
	VideoBusInputDataResize,
	VideoBusInputDataSettings,
	VideoBusInputDataSettingsFPS,
	VideoBusInputPayload,
	VideoBusOutputCmd,
	VideoBusOutputPayload,
} from './video.model';
import { ResizeEngine } from '../../engines/resize.engine';

/**
 * @author tknight-dev
 */

export class VideoBusEngine {
	private static callbackFPS: (fps: number) => void;
	private static callbackInitComplete: () => void;
	private static canvas: HTMLCanvasElement;
	private static canvasOffscreen: OffscreenCanvas;
	private static complete: boolean;
	private static game: HTMLElement;
	private static resolution: null | 256 | 384 | 512 | 640 | 1280 | 1920;
	private static worker: Worker;

	/**
	 * Start the video streams in another thread
	 */
	public static initialize(canvas: HTMLCanvasElement, game: HTMLElement, callback: () => void): void {
		VideoBusEngine.callbackInitComplete = callback;
		VideoBusEngine.canvas = canvas;
		VideoBusEngine.canvasOffscreen = canvas.transferControlToOffscreen();
		VideoBusEngine.game = game;

		// Config
		ResizeEngine.initialize();
		ResizeEngine.setCallback(VideoBusEngine.resized);

		if (VideoBusEngine.isMobileOrTablet()) {
			VideoBusEngine.resolution = 512;
		}

		// Spawn Video thread
		if (window.Worker) {
			VideoBusEngine.worker = new Worker(new URL('./video.engine.mjs', import.meta.url), {
				name: 'VideoWorkerEngine',
				type: 'module',
			});

			// Setup listener
			VideoBusEngine.input();

			/*
			 * Initialization payload
			 */
			const videoBusInputDataInit: VideoBusInputDataInit = Object.assign(
				{
					canvasOffscreen: VideoBusEngine.canvasOffscreen,
				},
				VideoBusEngine.resized(true),
				{
					fps: VideoBusInputDataSettingsFPS._60,
				},
			);
			const videoBusInputPayload: VideoBusInputPayload = {
				cmd: VideoBusInputCmd.INIT,
				data: videoBusInputDataInit,
			};
			VideoBusEngine.worker.postMessage(videoBusInputPayload, [VideoBusEngine.canvasOffscreen]);
			VideoBusEngine.complete = true;
		} else {
			alert('Web Workers are not supported by your browser');
		}
	}

	/*
	 * Commands from worker (typically audio effect triggers)
	 */
	private static input(): void {
		VideoBusEngine.worker.onmessage = async (event: MessageEvent) => {
			const payloads: VideoBusOutputPayload[] = event.data.payloads;

			for (let i = 0; i < payloads.length; i++) {
				switch (payloads[i].cmd) {
					case VideoBusOutputCmd.FPS:
						VideoBusEngine.callbackFPS(<number>payloads[i].data);
						break;
					case VideoBusOutputCmd.INIT_COMPLETE:
						VideoBusEngine.callbackInitComplete();
						break;
				}
			}
		};
	}

	public static outputResolution(resolution: null | 256 | 384 | 512 | 640 | 1280 | 1920): void {
		VideoBusEngine.resolution = resolution;
		VideoBusEngine.resized(false, true);
	}

	public static outputSettings(data: VideoBusInputDataSettings): void {
		VideoBusEngine.worker.postMessage({
			cmd: VideoBusInputCmd.SETTINGS,
			data: data,
		});
	}

	public static resized(disablePost?: boolean, force?: boolean): VideoBusInputDataResize {
		let data: VideoBusInputDataResize,
			devicePixelRatio: number = Math.round(window.devicePixelRatio * 1000) / 1000,
			devicePixelRatioEff: number = Math.round((1 / window.devicePixelRatio) * 1000) / 1000,
			domRect: DOMRect = VideoBusEngine.game.getBoundingClientRect(),
			height: number,
			scaler: number,
			width: null | number = VideoBusEngine.resolution;

		switch (width) {
			case 128:
				height = 72;
				break;
			case 256:
				height = 144;
				break;
			case 384:
				height = 216;
				break;
			case 512:
				height = 288;
				break;
			case 640: // 360p
				height = 360;
				break;
			case 1280: // 720p
				height = 720;
				break;
			case 1920: // 1080p
				height = 1080;
				break;
			default: // native
				height = domRect.height;
				width = domRect.width;
				break;
		}

		if (VideoBusEngine.resolution !== null) {
			scaler = Math.round(((devicePixelRatioEff * domRect.width) / width) * 1000) / 1000;
		} else {
			scaler = devicePixelRatioEff;
		}

		// Transform the canvas to the intended size
		VideoBusEngine.canvas.style.transform = 'scale(' + scaler + ')';

		data = {
			devicePixelRatio: devicePixelRatio,
			force: force,
			height: Math.round(height),
			scaler: Math.round((domRect.width / width / devicePixelRatioEff) * 1000) / 1000,
			width: Math.round(width),
		};

		if (VideoBusEngine.complete && disablePost !== true) {
			VideoBusEngine.worker.postMessage({
				cmd: VideoBusInputCmd.RESIZE,
				data: data,
			});
		}

		return data;
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

	public static setCallbackFPS(callbackFPS: (fps: number) => void): void {
		VideoBusEngine.callbackFPS = callbackFPS;
	}
}
