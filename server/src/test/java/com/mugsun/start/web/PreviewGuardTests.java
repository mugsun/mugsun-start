package com.mugsun.start.web;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PreviewGuardTests {

	private static final PreviewTree.Result RESULT = new PreviewTree.Result(List.of(Map.of("name", "demo")), 1, 1,
			false);

	private static PreviewGuard guard(int maxConcurrent, Duration timeout) {
		return new PreviewGuard(100, Duration.ofMinutes(10), maxConcurrent, timeout);
	}

	private static MugsunProjectRequest request(String artifactId, String... deps) {
		MugsunProjectRequest r = new MugsunProjectRequest();
		r.setType("mugsun-backend");
		r.setGroupId("com.example");
		r.setArtifactId(artifactId);
		r.setDependencies(new ArrayList<>(List.of(deps)));
		return r;
	}

	@Test
	@DisplayName("缓存键：依赖顺序与重复不影响；任一字段不同则键不同")
	void keyNormalization() {
		assertThat(PreviewGuard.key(request("shop", "gis", "ai"))).isEqualTo(PreviewGuard.key(request("shop", "ai", "gis", "ai")));
		assertThat(PreviewGuard.key(request("shop", "gis"))).isNotEqualTo(PreviewGuard.key(request("shop2", "gis")));
		MugsunProjectRequest a = request("shop");
		MugsunProjectRequest b = request("shop");
		b.setBaseDir("other");
		assertThat(PreviewGuard.key(a)).isNotEqualTo(PreviewGuard.key(b));
		// 分隔符不能让两个不同请求拼出同一个键
		MugsunProjectRequest c = request("a|b");
		MugsunProjectRequest d = request("a");
		d.setName("b");
		assertThat(PreviewGuard.key(c)).isNotEqualTo(PreviewGuard.key(d));
	}

	@Test
	@DisplayName("相同请求第二次命中缓存，不再生成")
	void cachesSuccess() {
		PreviewGuard guard = guard(2, Duration.ofSeconds(1));
		AtomicInteger calls = new AtomicInteger();
		assertThat(guard.get(request("shop"), () -> { calls.incrementAndGet(); return RESULT; })).isSameAs(RESULT);
		assertThat(guard.get(request("shop"), () -> { calls.incrementAndGet(); return RESULT; })).isSameAs(RESULT);
		assertThat(calls).hasValue(1);
		assertThat(guard.stats().hitCount()).isEqualTo(1);
		assertThat(guard.availablePermits()).isEqualTo(2);
	}

	@Test
	@DisplayName("生成失败不进缓存，名额照常归还")
	void failureNotCached() {
		PreviewGuard guard = guard(1, Duration.ofSeconds(1));
		assertThatThrownBy(() -> guard.get(request("boom"), () -> { throw new IllegalStateException("boom"); }))
			.isInstanceOf(IllegalStateException.class);
		assertThat(guard.cachedEntries()).isZero();
		assertThat(guard.availablePermits()).isEqualTo(1);
		AtomicInteger calls = new AtomicInteger();
		guard.get(request("boom"), () -> { calls.incrementAndGet(); return RESULT; });
		assertThat(calls).hasValue(1);
	}

	@Test
	@DisplayName("名额用完时等待超时返回 RATE_LIMITED（带 Retry-After）；缓存命中不受影响")
	void saturatedRejectsButHitsServe() throws Exception {
		PreviewGuard guard = guard(1, Duration.ofMillis(50));
		guard.get(request("cached"), () -> RESULT);
		guard.permits().acquire();
		try {
			assertThatThrownBy(() -> guard.get(request("miss"), () -> RESULT))
				.isInstanceOfSatisfying(MugsunRequestException.class, (ex) -> {
					assertThat(ex.code()).isEqualTo(ErrorCode.RATE_LIMITED);
					assertThat(ex.retryAfterSeconds()).isEqualTo(1L);
				});
			assertThat(guard.get(request("cached"), () -> { throw new AssertionError("should hit cache"); }))
				.isSameAs(RESULT);
		}
		finally {
			guard.permits().release();
		}
		assertThat(guard.get(request("miss"), () -> RESULT)).isSameAs(RESULT);
	}

	@Test
	@DisplayName("同时在跑的生成数不超过 max-concurrent")
	void concurrencyCapped() throws Exception {
		PreviewGuard guard = guard(2, Duration.ofSeconds(10));
		AtomicInteger running = new AtomicInteger();
		AtomicInteger peak = new AtomicInteger();
		CountDownLatch release = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(6);
		try {
			List<Future<PreviewTree.Result>> futures = new ArrayList<>();
			for (int i = 0; i < 6; i++) {
				String artifact = "p" + i;
				futures.add(pool.submit(() -> guard.get(request(artifact), () -> {
					peak.accumulateAndGet(running.incrementAndGet(), Math::max);
					try {
						release.await(5, TimeUnit.SECONDS);
					}
					catch (InterruptedException ex) {
						Thread.currentThread().interrupt();
					}
					running.decrementAndGet();
					return RESULT;
				})));
			}
			Thread.sleep(300);
			assertThat(running.get()).isEqualTo(2);
			release.countDown();
			for (Future<PreviewTree.Result> f : futures) {
				assertThat(f.get(10, TimeUnit.SECONDS)).isSameAs(RESULT);
			}
		}
		finally {
			pool.shutdownNow();
		}
		assertThat(peak.get()).isEqualTo(2);
		assertThat(guard.availablePermits()).isEqualTo(2);
	}

	@Test
	@DisplayName("非法配置启动即报错")
	void rejectsBadConfig() {
		assertThatIllegalArgumentException().isThrownBy(() -> new PreviewGuard(10, Duration.ofMinutes(1), 0, Duration.ZERO));
		assertThatIllegalArgumentException().isThrownBy(() -> new PreviewGuard(-1, Duration.ofMinutes(1), 1, Duration.ZERO));
	}

}
