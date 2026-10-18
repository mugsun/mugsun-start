package com.mugsun.start.metadata;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * S2：{@code GET /api/v1/metadata} 符合 §4.1 契约，并与标准 {@code /metadata/client} 一致。
 */
@SpringBootTest
@AutoConfigureMockMvc
class UiMetadataApiTests {

	@Autowired
	private MockMvc mvc;

	private final ObjectMapper om = new ObjectMapper();

	private MvcResult fetch() throws Exception {
		return this.mvc.perform(get("/api/v1/metadata"))
			.andExpect(status().isOk())
			.andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/json;charset=UTF-8"))
			.andReturn();
	}

	private JsonNode metadata() throws Exception {
		return this.om.readTree(fetch().getResponse().getContentAsString());
	}

	@Test
	@DisplayName("顶层字段齐全且按契约顺序")
	void topLevel() throws Exception {
		List<String> keys = new ArrayList<>();
		metadata().fieldNames().forEachRemaining(keys::add);
		assertThat(keys).containsExactly("version", "templates", "types", "fields", "bootVersion", "javaVersion",
				"packaging", "database", "modules", "postGenerate");
	}

	@Test
	@DisplayName("types：仅后端与前后端，中英文名称，前后端为默认")
	void types() throws Exception {
		JsonNode types = metadata().path("types");
		assertThat(ids(types)).containsExactly("mugsun-backend", "mugsun-fullstack");
		JsonNode backend = types.get(0);
		assertThat(backend.path("name").path("zh").asText()).isEqualTo("仅后端");
		assertThat(backend.path("name").path("en").asText()).isEqualTo("Backend only");
		assertThat(backend.path("action").asText()).isEqualTo("/starter.zip");
		assertThat(backend.path("tags").path("scope").asText()).isEqualTo("backend");
		assertThat(backend.has("default")).isFalse();
		assertThat(types.get(1).path("default").asBoolean()).isTrue();
	}

	@Test
	@DisplayName("fields：默认值来自 initializr，校验规则与设计规格 §3.2 一致")
	void fields() throws Exception {
		JsonNode f = metadata().path("fields");
		assertThat(f.path("groupId").path("default").asText()).isEqualTo("com.example");
		assertThat(f.path("groupId").path("pattern").asText()).isEqualTo("^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$");
		assertThat(f.path("artifactId").path("maxLength").asInt()).isEqualTo(50);
		assertThat(f.path("name").path("follows").asText()).isEqualTo("artifactId");
		assertThat(f.path("packageName").path("pattern").asText())
			.isEqualTo("^[a-z_][a-z0-9_]*(\\.[a-z_][a-z0-9_]*)*$");
		assertThat(f.path("packageName").path("follows").asText()).isEqualTo("groupId+artifactId");
		assertThat(f.path("description").path("default").path("en").asText()).isEqualTo("An admin system built on mugsun");
		assertThat(f.path("description").path("maxLength").asInt()).isEqualTo(200);
		assertThat(f.path("version").path("default").asText()).isEqualTo("0.0.1-SNAPSHOT");
	}

	@Test
	@DisplayName("bootVersion / javaVersion / packaging / database 只读且唯一取值")
	void readOnlySelects() throws Exception {
		JsonNode m = metadata();
		assertThat(m.path("bootVersion").path("default").asText()).isEqualTo("3.5.13");
		assertThat(m.path("javaVersion").path("default").asText()).isEqualTo("21");
		assertThat(m.path("packaging").path("default").asText()).isEqualTo("jar");
		for (String k : List.of("bootVersion", "javaVersion", "packaging", "database")) {
			assertThat(m.path(k).path("readOnly").asBoolean()).as(k).isTrue();
			assertThat(m.path(k).path("values")).as(k).hasSize(1);
		}
		assertThat(m.path("database").path("default").asText()).isEqualTo("postgresql");
		assertThat(m.path("database").path("note").path("zh").asText()).isEqualTo("一期仅支持 PostgreSQL");
	}

	@Test
	@DisplayName("常驻模块：按展示顺序，含工作流与低代码，图标为固定枚举且不重复")
	void alwaysOn() throws Exception {
		JsonNode alwaysOn = metadata().path("modules").path("alwaysOn");
		assertThat(ids(alwaysOn)).containsExactly("core-system", "core-security", "core-audit", "core-file-msg",
				"core-workflow", "core-lowcode", "core-open", "core-ops");
		List<String> icons = new ArrayList<>();
		alwaysOn.forEach((m) -> icons.add(m.path("icon").asText()));
		assertThat(icons).containsExactly("system", "security", "audit", "file", "flow", "lowcode", "open", "ops");
		assertThat(alwaysOn.get(0).path("removableIn").isNull()).isTrue();
		assertThat(alwaysOn.get(4).path("removableIn").asText()).isEqualTo("phase-2");
		alwaysOn.forEach((m) -> assertThat(m.path("name").path("en").asText()).isNotBlank());
	}

	@Test
	@DisplayName("可选模块：三项都适用于两种类型，default=false，带 backendOnly 说明、坐标与 pc 裁剪清单")
	void optional() throws Exception {
		JsonNode optional = metadata().path("modules").path("optional");
		assertThat(ids(optional)).containsExactly("gis", "track", "ai");
		List<String> icons = new ArrayList<>();
		for (JsonNode m : optional) {
			icons.add(m.path("icon").asText());
			assertThat(m.path("default").isBoolean()).isTrue();
			assertThat(m.path("default").asBoolean()).isFalse();
			assertThat(texts(m.path("appliesTo"))).containsExactly("mugsun-backend", "mugsun-fullstack");
			assertThat(m.path("requires").isArray()).isTrue();
			assertThat(m.path("conflicts").isArray()).isTrue();
			assertThat(m.path("notes").path("backendOnly").path("zh").asText()).isNotBlank();
			assertThat(m.path("maven").path("groupId").asText()).isEqualTo("com.mugsun");
			assertThat(m.path("maven").path("artifactId").asText()).isEqualTo("mugsun-boot-" + m.path("id").asText());
			assertThat(m.path("pc").path("dir").asText()).isEqualTo("modules/" + m.path("id").asText());
			assertThat(m.path("links").path("reference").asText()).startsWith("https://docs.mugsun.com/");
		}
		assertThat(icons).containsExactly("map", "track", "ai");
		assertThat(texts(optional.get(0).path("pc").path("npmRemove"))).containsExactly("cesium", "ol", "gcoord");
		assertThat(texts(optional.get(1).path("pc").path("npmRemove"))).contains("@mugsun/track-web", "rrweb-player");
		assertThat(optional.get(1).path("notes").path("backendOnly").path("zh").asText()).contains("看板");
	}

	@Test
	@DisplayName("postGenerate：两种类型各有环境要求与命令")
	void postGenerate() throws Exception {
		JsonNode p = metadata().path("postGenerate");
		assertThat(texts(p.path("requirements").path("mugsun-backend"))).containsExactly("JDK 21", "Maven 3.9+", "Docker");
		assertThat(texts(p.path("commands").path("mugsun-fullstack")))
			.contains("cd {artifactId}-pc && pnpm install && pnpm dev");
		assertThat(p.path("docs").asText()).isEqualTo("https://docs.mugsun.com/guide/quick-start");
	}

	@Test
	@DisplayName("与 /metadata/client 一致：常驻 = values[0]，可选 = values[1]")
	void consistentWithClientMetadata() throws Exception {
		JsonNode ui = metadata().path("modules");
		JsonNode client = this.om.readTree(this.mvc
			.perform(get("/metadata/client").accept("application/vnd.initializr.v2.3+json"))
			.andReturn()
			.getResponse()
			.getContentAsString());
		JsonNode groups = client.path("dependencies").path("values");
		assertThat(ids(groups.get(0).path("values"))).isEqualTo(ids(ui.path("alwaysOn")));
		assertThat(ids(groups.get(1).path("values"))).isEqualTo(ids(ui.path("optional")));
	}

	@Test
	@DisplayName("ETag 与 Cache-Control；If-None-Match 命中返回 304")
	void caching() throws Exception {
		MvcResult first = fetch();
		String etag = first.getResponse().getHeader(HttpHeaders.ETAG);
		assertThat(etag).matches("\"[0-9a-f]{32}\"");
		assertThat(first.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("max-age=300, public");
		this.mvc.perform(get("/api/v1/metadata").header(HttpHeaders.IF_NONE_MATCH, etag))
			.andExpect(status().isNotModified())
			.andExpect(header().string(HttpHeaders.ETAG, etag));
	}

	private static List<String> ids(JsonNode values) {
		List<String> ids = new ArrayList<>();
		values.forEach((v) -> ids.add(v.path("id").asText()));
		return ids;
	}

	private static List<String> texts(JsonNode values) {
		List<String> out = new ArrayList<>();
		values.forEach((v) -> out.add(v.asText()));
		return out;
	}

}
