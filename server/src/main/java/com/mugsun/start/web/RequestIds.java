package com.mugsun.start.web;

import java.security.SecureRandom;
import java.util.regex.Pattern;

/**
 * requestId：客户端传入的 {@code X-Request-Id} 合法时沿用，否则生成 ULID（26 位 Crockford Base32，按时间有序）。
 */
public final class RequestIds {

	public static final String HEADER = "X-Request-Id";

	public static final String MDC_KEY = "requestId";

	/** request attribute，供 ERROR 分派和异常处理读取。 */
	public static final String ATTRIBUTE = RequestIds.class.getName() + ".id";

	private static final Pattern CLIENT_ID = Pattern.compile("^[A-Za-z0-9-]{8,64}$");

	private static final char[] ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();

	private static final SecureRandom RANDOM = new SecureRandom();

	private RequestIds() {
	}

	public static boolean isAcceptable(String candidate) {
		return candidate != null && CLIENT_ID.matcher(candidate).matches();
	}

	public static String ulid() {
		return ulid(System.currentTimeMillis());
	}

	static String ulid(long epochMillis) {
		char[] out = new char[26];
		long time = epochMillis;
		for (int i = 9; i >= 0; i--) {
			out[i] = ALPHABET[(int) (time & 31)];
			time >>>= 5;
		}
		byte[] random = new byte[10];
		RANDOM.nextBytes(random);
		long hi = 0;
		long lo = 0;
		for (int i = 0; i < 5; i++) {
			hi = (hi << 8) | (random[i] & 0xFF);
			lo = (lo << 8) | (random[i + 5] & 0xFF);
		}
		for (int i = 17; i >= 10; i--) {
			out[i] = ALPHABET[(int) (hi & 31)];
			hi >>>= 5;
		}
		for (int i = 25; i >= 18; i--) {
			out[i] = ALPHABET[(int) (lo & 31)];
			lo >>>= 5;
		}
		return new String(out);
	}

}
