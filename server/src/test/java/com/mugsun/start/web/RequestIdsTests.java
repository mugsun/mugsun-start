package com.mugsun.start.web;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RequestIdsTests {

	@Test
	void ulidIsSortableBase32() {
		String a = RequestIds.ulid(1_700_000_000_000L);
		String b = RequestIds.ulid(1_700_000_000_001L);
		assertThat(a).hasSize(26).matches("[0-9A-HJKMNP-TV-Z]{26}");
		assertThat(a.substring(0, 10)).isLessThan(b.substring(0, 10));
	}

	@Test
	void clientIdRules() {
		assertThat(RequestIds.isAcceptable("abcd-1234")).isTrue();
		assertThat(RequestIds.isAcceptable("short")).isFalse();
		assertThat(RequestIds.isAcceptable("x".repeat(65))).isFalse();
		assertThat(RequestIds.isAcceptable("has space1")).isFalse();
		assertThat(RequestIds.isAcceptable(null)).isFalse();
	}

}
