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

	private static PreviewTree.Result sized(int files, int dirs) {
		return new PreviewTree.Result(List.of(), files, dirs, false);
	}

	@Test
	@DisplayName("缓存按权重（fileCount + dirCount）淘汰：总权重不超过 max-weight，超重的单条不留")
	void weighedByNodeCount() {
		assertThat(PreviewGuard.weight(sized(4, 2))).isEqualTo(6);
		assertThat(PreviewGuard.weight(sized(0, 0))).as("至少 1").isEqualTo(1);
		PreviewGuard guard = new PreviewGuard(10, Duration.ofMinutes(10), 2, Duration.ofSeconds(1));
		guard.get(request("a"), () -> sized(4, 2));
		assertThat(guard.weightedSize()).isEqualTo(6);
		guard.get(request("b"), () -> sized(3, 1));
		assertThat(guard.weightedSize()).isEqualTo(10);
		assertThat(guard.cachedEntries()).isEqualTo(2);
		guard.get(request("c"), () -> sized(2, 1));
		assertThat(guard.weightedSize()).isLessThanOrEqualTo(10);
		assertThat(guard.cachedEntries()).isLessThan(3);
		guard.invalidateAll();
		guard.get(request("huge"), () -> sized(50, 10));
		assertThat(guard.cachedEntries()).as("单条权重超过上限不缓存").isZero();
	}

	@Test
	@DisplayName("withPermit：与预览共用名额；用完时 RATE_LIMITED + Retry-After，执行异常也归还名额")
	void withPermitSharesPermits() throws Exception {
		PreviewGuard guard = guard(1, Duration.ofMillis(50));
		assertThat(guard.withPermit(() -> "zip")).isEqualTo("zip");
		assertThatThrownBy(() -> guard.withPermit(() -> { throw new java.io.IOException("disk"); }))
			.isInstanceOf(java.io.IOException.class);
		assertThat(guard.availablePermits()).isEqualTo(1);
		CountDownLatch inside = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		ExecutorService pool = Executors.newSingleThreadExecutor();
		try {
			// 一个预览生成占住唯一名额，下载拿不到
			Future<PreviewTree.Result> running = pool.submit(() -> guard.get(request("slow"), () -> {
				inside.countDown();
				try {
					release.await(5, TimeUnit.SECONDS);
				}
				catch (InterruptedException ex) {
					Thread.currentThread().interrupt();
				}
				return RESULT;
			}));
			assertThat(inside.await(5, TimeUnit.SECONDS)).isTrue();
			assertThatThrownBy(() -> guard.withPermit(() -> "zip"))
				.isInstanceOfSatisfying(MugsunRequestException.class, (ex) -> {
					assertThat(ex.code()).isEqualTo(ErrorCode.RATE_LIMITED);
					assertThat(ex.retryAfterSeconds()).isEqualTo(1L);
				});
			release.countDown();
			running.get(5, TimeUnit.SECONDS);
		}
		finally {
			release.countDown();
			pool.shutdownNow();
		}
		assertThat(guard.withPermit(() -> "zip")).isEqualTo("zip");
	}

	@Test
	@DisplayName("缓存的树不可变：深层节点也改不动，不会污染下一次命中")
	void cachedTreeImmutable() {
		Map<String, Object> child = new java.util.LinkedHashMap<>(Map.of("name", "pom.xml"));
		Map<String, Object> root = new java.util.LinkedHashMap<>();
		root.put("name", "demo");
		root.put("children", new ArrayList<>(List.of(child)));
		List<Map<String, Object>> tree = new ArrayList<>(List.of(root));
		PreviewTree.Result result = new PreviewTree.Result(tree, 1, 1, false);
		// 构造之后改原始结构，不影响结果
		child.put("name", "changed");
		tree.clear();
		assertThat(result.tree()).hasSize(1);
		Map<String, Object> top = result.tree().get(0);
		@SuppressWarnings("unchecked")
		List<Map<String, Object>> kids = (List<Map<String, Object>>) top.get("children");
		assertThat(kids.get(0).get("name")).isEqualTo("pom.xml");
		assertThatThrownBy(() -> result.tree().add(Map.of())).isInstanceOf(UnsupportedOperationException.class);
		assertThatThrownBy(() -> top.put("x", 1)).isInstanceOf(UnsupportedOperationException.class);
		assertThatThrownBy(() -> kids.clear()).isInstanceOf(UnsupportedOperationException.class);
		assertThatThrownBy(() -> kids.get(0).put("name", "x")).isInstanceOf(UnsupportedOperationException.class);
	}

	@Test
	@DisplayName("非法配置启动即报错")
	void rejectsBadConfig() {
		assertThatIllegalArgumentException().isThrownBy(() -> new PreviewGuard(10, Duration.ofMinutes(1), 0, Duration.ZERO));
		assertThatIllegalArgumentException().isThrownBy(() -> new PreviewGuard(-1, Duration.ofMinutes(1), 1, Duration.ZERO));
	}

}
