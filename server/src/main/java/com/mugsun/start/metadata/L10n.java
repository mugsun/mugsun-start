package com.mugsun.start.metadata;

/**
 * 中英文文案。metadata 同时下发两种语言，由前端按界面语言选用。
 *
 * @param zh 中文
 * @param en 英文
 */
public record L10n(String zh, String en) {

	boolean complete() {
		return zh != null && !zh.isBlank() && en != null && !en.isBlank();
	}

}
