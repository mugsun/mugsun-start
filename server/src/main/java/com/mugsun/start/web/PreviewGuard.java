package com.mugsun.start.web;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.stats.CacheStats;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 预览的结果缓存与并发上限。
 * <ul>
 * <li>缓存：Caffeine，键是规范化后的请求参数（依赖排序去重，不含请求头），值是遍历好的树（不含 requestId）。
 * 只缓存生成成功的结果；校验失败、生成失败直接抛出，不进缓存。命中时不占并发名额。</li>
 * <li>并发：{@link Semaphore} 限制同时在跑的生成数；等待 {@code acquire-timeout} 仍拿不到名额时返回 429
 * {@code RATE_LIMITED}（带 {@code Retry-After}），不让请求在线程池里无限排队。</li>
 * </ul>
 * 配置项：{@code mugsun.start.preview.cache.max-size}（默认 500）、{@code mugsun.start.preview.cache.ttl}（默认 10m）、
 * {@code mugsun.start.preview.max-concurrent}（默认 4）、{@code mugsun.start.preview.acquire-timeout}（默认 2s）。
 */
@Component
public class PreviewGuard {

	private final Cache<String, PreviewTree.Result> cache;

	private final Semaphore permits;

	private final int maxConcurrent;

	private final Duration acquireTimeout;

	public PreviewGuard(@Value("${mugsun.start.preview.cache.max-size:500}") long maxSize,
			@Value("${mugsun.start.preview.cache.ttl:10m}") Duration ttl,
			@Value("${mugsun.start.preview.max-concurrent:4}") int maxConcurrent,
			@Value("${mugsun.start.preview.acquire-timeout:2s}") Duration acquireTimeout) {
		if (maxSize < 0 || maxConcurrent < 1 || ttl.isNegative() || acquireTimeout.isNegative()) {
			throw new IllegalArgumentException("mugsun.start.preview.*: max-size >= 0, max-concurrent >= 1, "
					+ "ttl and acquire-timeout must not be negative");
		}
		this.cache = Caffeine.newBuilder().maximumSize(maxSize).expireAfterWrite(ttl).recordStats().build();
		this.permits = new Semaphore(maxConcurrent, true);
		this.maxConcurrent = maxConcurrent;
		this.acquireTimeout = acquireTimeout;
	}

	/**
	 * 命中缓存直接返回；否则在并发名额内调用 {@code generate}，成功后写入缓存。
	 * @throws MugsunRequestException 等不到并发名额时（429 {@code RATE_LIMITED}）
	 */
	public PreviewTree.Result get(MugsunProjectRequest request, Supplier<PreviewTree.Result> generate) {
		String key = key(request);
		PreviewTree.Result cached = this.cache.getIfPresent(key);
		if (cached != null) {
			return cached;
		}
		boolean acquired;
		try {
			acquired = this.permits.tryAcquire(this.acquireTimeout.toMillis(), TimeUnit.MILLISECONDS);
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			throw MugsunRequestException.rateLimited(retryAfterSeconds());
		}
		if (!acquired) {
			throw MugsunRequestException.rateLimited(retryAfterSeconds());
		}
		try {
			// 排队期间同一请求可能已被别的线程生成好
			cached = this.cache.getIfPresent(key);
			if (cached != null) {
				return cached;
			}
			PreviewTree.Result result = Objects.requireNonNull(generate.get(), "preview result");
			this.cache.put(key, result);
			return result;
		}
		finally {
			this.permits.release();
		}
	}

	private long retryAfterSeconds() {
		return Math.max(1, (this.acquireTimeout.toMillis() + 999) / 1000);
	}

	/** 规范化后的缓存键：只取影响生成结果的字段；依赖去重排序。 */
	static String key(MugsunProjectRequest r) {
		List<String> deps = new ArrayList<>(r.getDependencies() == null ? List.of() : r.getDependencies());
		deps.replaceAll((d) -> d == null ? "" : d.trim());
		List<String> sorted = deps.stream().filter((d) -> !d.isEmpty()).distinct().sorted().toList();
		List<String> parts = new ArrayList<>();
		parts.add(r.getType());
		parts.add(r.getGroupId());
		parts.add(r.getArtifactId());
		parts.add(r.getName());
		parts.add(r.getDescription());
		parts.add(r.getPackageName());
		parts.add(r.getVersion());
		parts.add(String.join(",", sorted));
		parts.add(r.getBootVersion());
		parts.add(r.getJavaVersion());
		parts.add(r.getPackaging());
		parts.add(r.getLanguage());
		parts.add(r.getConfigurationFileFormat());
		parts.add(r.getDatabase());
		parts.add(r.getBaseDir());
		StringBuilder sb = new StringBuilder();
		for (String p : parts) {
			// 长度前缀，避免字段内容里的分隔符造成两个不同请求拼出同一个键
			String v = (p == null) ? "\u0000" : p;
			sb.append(v.length()).append(':').append(v).append('|');
		}
		return sb.toString();
	}

	public CacheStats stats() {
		return this.cache.stats();
	}

	public long cachedEntries() {
		this.cache.cleanUp();
		return this.cache.estimatedSize();
	}

	public void invalidateAll() {
		this.cache.invalidateAll();
	}

	/** 当前可用的并发名额（测试与排查用） */
	public int availablePermits() {
		return this.permits.availablePermits();
	}

	public int maxConcurrent() {
		return this.maxConcurrent;
	}

	/** 测试用：占住并发名额，模拟生成全部在忙。 */
	Semaphore permits() {
		return this.permits;
	}

}
