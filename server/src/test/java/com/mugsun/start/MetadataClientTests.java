package com.mugsun.start;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * S1：标准 Initializr 元数据（IDE / curl 用）与生成接口可用。
 */
@SpringBootTest
@AutoConfigureMockMvc
class MetadataClientTests {

	private static final String V23 = "application/vnd.initializr.v2.3+json";

	@Autowired
	private MockMvc mvc;

	private final ObjectMapper om = new ObjectMapper();

	private JsonNode metadata() throws Exception {
		MvcResult result = mvc.perform(get("/metadata/client").accept(V23))
			.andExpect(status().isOk())
			.andReturn();
		assertThat(result.getResponse().getContentType()).startsWith(V23);
		return om.readTree(result.getResponse().getContentAsString());
	}

	@Test
	@DisplayName("/metadata/client：两种工程类型，默认前后端")
	void types() throws Exception {
		JsonNode type = metadata().path("type");
		assertThat(type.path("default").asText()).isEqualTo("mugsun-fullstack");
		assertThat(ids(type.path("values"))).containsExactly("mugsun-backend", "mugsun-fullstack");
	}

	@Test
	@DisplayName("/metadata/client：values[0] 为常驻模块组，values[1] 为可选模块组")
	void dependencyGroups() throws Exception {
		JsonNode groups = metadata().path("dependencies").path("values");
		assertThat(groups).hasSize(2);
		assertThat(groups.get(0).path("name").asText()).isEqualTo("常驻模块");
		assertThat(ids(groups.get(0).path("values"))).contains("core-system", "core-workflow", "core-lowcode");
		assertThat(groups.get(1).path("name").asText()).isEqualTo("可选模块");
		assertThat(ids(groups.get(1).path("values"))).containsExactly("gis", "track", "ai");
	}

	@Test
	@DisplayName("/metadata/client：JDK 21、Boot 3.5.13、jar、java、yaml 均为唯一取值")
	void fixedOptions() throws Exception {
		JsonNode m = metadata();
		assertThat(m.path("javaVersion").path("default").asText()).isEqualTo("21");
		assertThat(m.path("bootVersion").path("default").asText()).isEqualTo("3.5.13");
		assertThat(m.path("packaging").path("default").asText()).isEqualTo("jar");
		assertThat(m.path("language").path("default").asText()).isEqualTo("java");
		assertThat(m.path("configurationFileFormat").path("default").asText()).isEqualTo("yaml");
		assertThat(m.path("groupId").path("default").asText()).isEqualTo("com.example");
		assertThat(m.path("artifactId").path("default").asText()).isEqualTo("demo");
	}

	@Test
	@DisplayName("/starter.zip：默认参数可生成 zip（S4 前为 Initializr 默认骨架）")
	void starterZip() throws Exception {
		MvcResult result = mvc.perform(get("/starter.zip").param("type", "mugsun-backend"))
			.andExpect(status().isOk())
			.andExpect(header().string("Content-Type", "application/zip"))
			.andExpect(header().string("Content-Disposition", "attachment; filename=\"demo.zip\""))
			.andReturn();
		byte[] zip = result.getResponse().getContentAsByteArray();
		assertThat(zip.length).isGreaterThan(100);
		assertThat(new String(zip, 0, 2)).isEqualTo("PK");
	}

	@Test
	@DisplayName("健康检查可用")
	void health() throws Exception {
		mvc.perform(get("/actuator/health")).andExpect(status().isOk());
	}

	private static List<String> ids(JsonNode values) {
		List<String> ids = new ArrayList<>();
		values.forEach(v -> ids.add(v.path("id").asText()));
		return ids;
	}
}
