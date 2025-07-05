// import {
// 	VideoBusInputCmd,
// 	VideoBusInputCmdAudioBufferIds,
// 	VideoBusInputCmdInit,
// 	VideoBusInputCmdMapLoad,
// 	VideoBusInputCmdMapLoadById,
// 	VideoBusInputCmdResize,
// 	VideoBusInputCmdGameModeEdit,
// 	VideoBusInputCmdGameModeEditApply,
// 	VideoBusInputCmdGameModeEditDraw,
// 	VideoBusInputCmdGamePause,
// 	VideoBusInputCmdGamePauseReason,
// 	VideoBusInputCmdGameSave,
// 	VideoBusInputCmdGameStart,
// 	VideoBusInputCmdGameUnpause,
// 	VideoBusInputCmdSettings,
// 	VideoBusPayload,
// 	VideoBusOutputCmd,
// 	VideoBusWorkerPayload,
// } from '../../engines/buses/video.model.bus';

/**
 * @author tknight-dev
 */

self.onmessage = (event: MessageEvent) => {
	// let videoBusPayload: VideoBusPayload = event.data;
	// switch (videoBusPayload.cmd) {
	// 	case VideoBusInputCmd.AUDIO_BUFFER_IDS:
	// 		CalcWorkerEngine.inputAudioBufferIds(<VideoBusInputCmdAudioBufferIds>videoBusPayload.data);
	// 		break;
	// }
};

class CalcWorkerEngine {
	private static self: Window & typeof globalThis;

	public static async initialize(self: Window & typeof globalThis, data: any): Promise<void> {
		CalcWorkerEngine.self = self;
	}

	// public static outputAudioFade(bufferId: number, durationInMs: number, volumePercentage: number): void {
	// 	CalcWorkerEngine.post([
	// 		{
	// 			cmd: VideoBusOutputCmd.AUDIO_FADE,
	// 			data: {
	// 				durationInMs: durationInMs,
	// 				bufferId: bufferId,
	// 				volumePercentage: volumePercentage,
	// 			},
	// 		},
	// 	]);
	// }
}
