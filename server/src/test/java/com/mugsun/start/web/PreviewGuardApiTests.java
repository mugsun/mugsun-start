package com.mugsun.start.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * 预览缓存与并发上限的接口级行为（{@link PreviewGuard}）。并发上限设为 1、等待 100ms，便于构造「名额用完」。
 */
@SpringBootTest(properties = { "mugsun.start.preview.max-concurrent=1", "mugsun.start.preview.acquire-timeout=100ms" })
@AutoConfigureMockMvc
class PreviewGuardApiTests {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private PreviewGuard guard;

	private final ObjectMapper om = new ObjectMapper();

	@BeforeEach
	void reset() {
		this.guard.invalidateAll();
	}

	private MvcResult preview(String artifactId, String deps) throws Exception {
		return this.mvc.perform(get("/api/v1/preview").param("artifactId", artifactId).param("dependencies", deps))
			.andReturn();
	}

	private JsonNode json(MvcResult r) throws Exception {
		return this.om.readTree(r.getResponse().getContentAsString());
	}

	@Test
	@DisplayName("相同请求（依赖顺序不同）第二次命中缓存：树相同，requestId 各自独立")
	void secondRequestHitsCache() throws Exception {
		long hits = this.guard.stats().hitCount();
		JsonNode first = json(preview("shop", "gis,ai"));
		JsonNode second = json(preview("shop", "ai,gis"));
		assertThat(this.guard.stats().hitCount()).isEqualTo(hits + 1);
		assertThat(second.path("tree")).isEqualTo(first.path("tree"));
		assertThat(second.path("fileCount")).isEqualTo(first.path("fileCount"));
		assertThat(second.path("requestId").asText()).isNotEqualTo(first.path("requestId").asText());
		assertThat(this.guard.cachedEntries()).isEqualTo(1);
	}

	@Test
	@DisplayName("校验失败的请求不进缓存")
	void invalidNotCached() throws Exception {
		assertThat(preview("Bad Artifact", "").getResponse().getStatus()).isEqualTo(400);
		assertThat(this.guard.cachedEntries()).isZero();
		assertThat(this.guard.availablePermits()).isEqualTo(1);
	}

	@Test
	@DisplayName("名额用完：未命中缓存的预览返回 429 RATE_LIMITED + Retry-After；已缓存的照常 200")
	void saturatedReturns429() throws Exception {
		assertThat(preview("cached", "").getResponse().getStatus()).isEqualTo(200);
		this.guard.permits().acquire();
		try {
			MvcResult busy = preview("miss", "");
			assertThat(busy.getResponse().getStatus()).isEqualTo(429);
			assertThat(busy.getResponse().getHeader("Retry-After")).isEqualTo("1");
			JsonNode body = json(busy);
			assertThat(body.path("code").asText()).isEqualTo("RATE_LIMITED");
			assertThat(body.path("requestId").asText()).isNotBlank();
			assertThat(preview("cached", "").getResponse().getStatus()).isEqualTo(200);
		}
		finally {
			this.guard.permits().release();
		}
		assertThat(preview("miss", "").getResponse().getStatus()).isEqualTo(200);
	}

	@Test
	@DisplayName("/starter.zip、/starter.tgz 与预览共用名额：用完时 429 RATE_LIMITED + Retry-After，归还后照常下载")
	void downloadRateLimited() throws Exception {
		this.guard.permits().acquire();
		try {
			for (String path : new String[] { "/starter.zip", "/starter.tgz" }) {
				MvcResult busy = this.mvc.perform(get(path).param("artifactId", "shop")).andReturn();
				assertThat(busy.getResponse().getStatus()).as(path).isEqualTo(429);
				assertThat(busy.getResponse().getHeader("Retry-After")).as(path).isEqualTo("1");
				assertThat(busy.getResponse().getContentType()).as(path).startsWith("application/json");
				JsonNode body = json(busy);
				assertThat(body.path("code").asText()).isEqualTo("RATE_LIMITED");
				assertThat(body.path("requestId").asText()).isEqualTo(busy.getResponse().getHeader("X-Request-Id"));
			}
		}
		finally {
			this.guard.permits().release();
		}
		assertThat(this.guard.availablePermits()).isEqualTo(1);
		MvcResult zip = this.mvc.perform(get("/starter.zip").param("artifactId", "shop")).andReturn();
		assertThat(zip.getResponse().getStatus()).isEqualTo(200);
		assertThat(zip.getResponse().getContentType()).isEqualTo("application/zip");
		MvcResult tgz = this.mvc.perform(get("/starter.tgz").param("artifactId", "shop")).andReturn();
		assertThat(tgz.getResponse().getStatus()).isEqualTo(200);
		assertThat(this.guard.availablePermits()).as("下载结束后名额归还").isEqualTo(1);
	}

	@Test
	@DisplayName("下载参数错误：先拿名额再校验，名额照常归还")
	void invalidDownloadReleasesPermit() throws Exception {
		MvcResult bad = this.mvc.perform(get("/starter.zip").param("artifactId", "Bad Artifact")).andReturn();
		assertThat(bad.getResponse().getStatus()).isEqualTo(400);
		assertThat(this.guard.availablePermits()).isEqualTo(1);
	}

	@Test
	@DisplayName("未传或空白 baseDir：首次与命中缓存时 root 都是 artifactId，不会是 null")
	void rootFallsBackToArtifactIdOnHit() throws Exception {
		JsonNode first = json(this.mvc.perform(get("/api/v1/preview").param("artifactId", "shop")).andReturn());
		JsonNode hit = json(this.mvc.perform(get("/api/v1/preview").param("artifactId", "shop").param("baseDir", " "))
			.andReturn());
		assertThat(first.path("root").asText()).isEqualTo("shop");
		assertThat(hit.path("root").isTextual()).isTrue();
		assertThat(hit.path("root").asText()).isEqualTo("shop");
		assertThat(this.guard.stats().hitCount()).isPositive();
	}

}
