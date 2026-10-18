package com.mugsun.start.web;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mugsun.testsupport.FailingContributorConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * S5：{@code POST|GET /api/v1/preview}（契约 §4.3）。
 */
@SpringBootTest
@AutoConfigureMockMvc
class PreviewApiTests {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private PreviewGuard guard;

	/** 每个用例都真实生成，不吃上一个用例的缓存（缓存行为见 PreviewGuardApiTests） */
	@BeforeEach
	void clearPreviewCache() {
		this.guard.invalidateAll();
	}

	private final ObjectMapper om = new ObjectMapper();

	private MvcResult perform(MockHttpServletRequestBuilder builder) throws Exception {
		return this.mvc.perform(builder).andReturn();
	}

	private JsonNode json(MvcResult result) throws Exception {
		return this.om.readTree(result.getResponse().getContentAsString());
	}

	private MockHttpServletRequestBuilder previewPost(Map<String, Object> body) throws Exception {
		return post("/api/v1/preview").contentType(MediaType.APPLICATION_JSON)
			.content(this.om.writeValueAsString(body));
	}

	private static List<String> filePaths(JsonNode nodes) {
		List<String> out = new ArrayList<>();
		for (JsonNode n : nodes) {
			if ("file".equals(n.path("type").asText())) {
				out.add(n.path("path").asText());
			}
			out.addAll(filePaths(n.path("children")));
		}
		return out;
	}

	private static List<String> dirPaths(JsonNode nodes) {
		List<String> out = new ArrayList<>();
		for (JsonNode n : nodes) {
			if ("dir".equals(n.path("type").asText())) {
				out.add(n.path("path").asText());
			}
			out.addAll(dirPaths(n.path("children")));
		}
		return out;
	}

	/** zip 里的全部目录：显式目录条目，加上每个文件的各级父目录（zip 可以不写目录条目） */
	private static TreeSet<String> zipDirs(byte[] zip) throws Exception {
		TreeSet<String> dirs = new TreeSet<>();
		try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
			for (ZipEntry e = in.getNextEntry(); e != null; e = in.getNextEntry()) {
				String name = e.getName();
				if (e.isDirectory()) {
					dirs.add(name.substring(0, name.length() - 1));
				}
				for (int i = name.indexOf('/'); i > 0 && i < name.length() - 1; i = name.indexOf('/', i + 1)) {
					dirs.add(name.substring(0, i));
				}
			}
		}
		return dirs;
	}

	/** java.io.tmpdir 下 initializr 生成用的 project-* 临时目录 */
	private static TreeSet<String> projectTempDirs() throws IOException {
		Path tmp = Path.of(System.getProperty("java.io.tmpdir"));
		try (Stream<Path> list = Files.list(tmp)) {
			return list.filter(Files::isDirectory)
				.map((p) -> p.getFileName().toString())
				.filter((n) -> n.startsWith("project-"))
				.collect(java.util.stream.Collectors.toCollection(TreeSet::new));
		}
	}

	private static TreeSet<String> zipFiles(byte[] zip) throws Exception {
		TreeSet<String> names = new TreeSet<>();
		try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
			for (ZipEntry e = in.getNextEntry(); e != null; e = in.getNextEntry()) {
				if (!e.isDirectory()) {
					names.add(e.getName());
				}
			}
		}
		return names;
	}

	@Test
	@DisplayName("POST JSON：200，顶层总是带布尔 truncated，根目录 = artifactId，requestId 与响应头一致")
	void postReturnsTree() throws Exception {
		MvcResult result = perform(previewPost(Map.of("type", "mugsun-backend", "artifactId", "shop")));
		assertThat(result.getResponse().getStatus()).isEqualTo(200);
		assertThat(result.getResponse().getContentType()).startsWith("application/json");
		JsonNode body = json(result);
		assertThat(body.has("truncated")).isTrue();
		assertThat(body.get("truncated").isBoolean()).isTrue();
		assertThat(body.get("truncated").asBoolean()).isFalse();
		assertThat(body.path("root").asText()).isEqualTo("shop");
		assertThat(body.path("requestId").asText()).isEqualTo(result.getResponse().getHeader(RequestIds.HEADER));
		assertThat(body.path("fileCount").asInt()).isPositive();
		JsonNode top = body.path("tree");
		assertThat(top.size()).isEqualTo(1);
		assertThat(top.get(0).path("name").asText()).isEqualTo("shop");
		assertThat(top.get(0).path("type").asText()).isEqualTo("dir");
		assertThat(filePaths(top)).hasSize(body.path("fileCount").asInt()).allMatch((p) -> p.startsWith("shop/"));
	}

	@Test
	@DisplayName("空请求体与 GET 无参数都用 metadata 默认值")
	void defaults() throws Exception {
		JsonNode post = json(perform(post("/api/v1/preview").contentType(MediaType.APPLICATION_JSON).content("{}")));
		JsonNode get = json(perform(get("/api/v1/preview")));
		assertThat(post.path("root").asText()).isEqualTo("demo");
		assertThat(filePaths(get.path("tree"))).isEqualTo(filePaths(post.path("tree")));
		assertThat(get.get("truncated").isBoolean()).isTrue();
	}

	@Test
	@DisplayName("预览与 /starter.zip 的文件清单和目录清单都逐条一致（同一请求，GET 与 POST 都比）")
	void sameFilesAsZip() throws Exception {
		MvcResult zip = perform(get("/starter.zip").param("type", "mugsun-backend").param("artifactId", "shop")
			.param("dependencies", "gis,ai"));
		assertThat(zip.getResponse().getStatus()).isEqualTo(200);
		TreeSet<String> expected = zipFiles(zip.getResponse().getContentAsByteArray());
		assertThat(expected).isNotEmpty();
		TreeSet<String> expectedDirs = zipDirs(zip.getResponse().getContentAsByteArray());
		assertThat(expectedDirs).isNotEmpty();

		JsonNode viaGet = json(perform(get("/api/v1/preview").param("type", "mugsun-backend")
			.param("artifactId", "shop").param("dependencies", "gis,ai")));
		assertThat(new TreeSet<>(filePaths(viaGet.path("tree")))).isEqualTo(expected);
		assertThat(new TreeSet<>(dirPaths(viaGet.path("tree")))).isEqualTo(expectedDirs);
		assertThat(viaGet.path("dirCount").asInt()).isEqualTo(expectedDirs.size());
		assertThat(viaGet.path("fileCount").asInt()).isEqualTo(expected.size());

		JsonNode viaPost = json(perform(previewPost(Map.of("type", "mugsun-backend", "artifactId", "shop",
				"dependencies", List.of("gis", "ai")))));
		assertThat(new TreeSet<>(filePaths(viaPost.path("tree")))).isEqualTo(expected);
		assertThat(new TreeSet<>(dirPaths(viaPost.path("tree")))).isEqualTo(expectedDirs);
	}

	@Test
	@DisplayName("目录在前，同类按名称升序；path 稳定（两次请求相同）")
	void orderingAndStablePaths() throws Exception {
		JsonNode a = json(perform(get("/api/v1/preview").param("artifactId", "shop")));
		this.guard.invalidateAll();
		JsonNode b = json(perform(get("/api/v1/preview").param("artifactId", "shop")));
		assertThat(filePaths(a.path("tree"))).isEqualTo(filePaths(b.path("tree")));
		assertOrdered(a.path("tree"));
	}

	private static void assertOrdered(JsonNode nodes) {
		String prevType = null;
		String prevName = null;
		for (JsonNode n : nodes) {
			String type = n.path("type").asText();
			String name = n.path("name").asText();
			if (prevType != null) {
				if (prevType.equals(type)) {
					assertThat(name.compareTo(prevName)).as(prevName + " → " + name).isGreaterThan(0);
				}
				else {
					assertThat(prevType).as("目录在前").isEqualTo("dir");
				}
			}
			prevType = type;
			prevName = name;
			assertOrdered(n.path("children"));
		}
	}

	@ParameterizedTest(name = "{0}")
	@DisplayName("校验与错误体和生成完全相同（状态、code、message、details）")
	@CsvSource(delimiter = '|', textBlock = """
			groupId 格式        | groupId      | 1x
			artifactId 格式     | artifactId   | Shop_App
			包名关键字          | packageName  | com.int.demo
			不支持的 bootVersion | bootVersion  | 3.4.0
			不支持的 type        | type         | maven-project
			未知模块            | dependencies | nope
			版本号格式          | version      | ../x
			""")
	void sameErrorsAsGenerate(String scenario, String field, String value) throws Exception {
		for (String lang : new String[] { "zh", "en" }) {
			MvcResult zip = perform(get("/starter.zip").param(field, value).header("Accept-Language", lang));
			Object jsonValue = "dependencies".equals(field) ? List.of(value) : value;
			MvcResult preview = perform(previewPost(Map.of(field, jsonValue)).header("Accept-Language", lang));
			MvcResult previewGet = perform(get("/api/v1/preview").param(field, value).header("Accept-Language", lang));
			assertThat(zip.getResponse().getStatus()).isBetween(400, 499);
			for (MvcResult r : List.of(preview, previewGet)) {
				assertThat(r.getResponse().getStatus()).as(scenario).isEqualTo(zip.getResponse().getStatus());
				JsonNode expected = json(zip);
				JsonNode actual = json(r);
				assertThat(actual.path("code")).isEqualTo(expected.path("code"));
				assertThat(actual.path("message")).isEqualTo(expected.path("message"));
				assertThat(actual.path("details")).isEqualTo(expected.path("details"));
				assertThat(actual.path("requestId").asText()).isEqualTo(r.getResponse().getHeader(RequestIds.HEADER));
			}
		}
	}

	@Test
	@DisplayName("请求体不是合法 JSON：400 INVALID_PARAMETER，details 指向 body，message 不含异常文本")
	void malformedJson() throws Exception {
		MvcResult result = perform(post("/api/v1/preview").contentType(MediaType.APPLICATION_JSON)
			.content("{\"artifactId\": "));
		assertThat(result.getResponse().getStatus()).isEqualTo(400);
		JsonNode body = json(result);
		assertThat(body.path("code").asText()).isEqualTo("INVALID_PARAMETER");
		assertThat(body.path("details").get(0).path("field").asText()).isEqualTo("body");
		assertThat(body.path("details").get(0).path("reason").asText()).isEqualTo("invalid");
		assertThat(body.path("message").asText()).doesNotContain("JSON parse", "Exception", "Unexpected");

		MvcResult wrongType = perform(post("/api/v1/preview").contentType(MediaType.APPLICATION_JSON)
			.content("{\"dependencies\": {\"a\": 1}}"));
		assertThat(wrongType.getResponse().getStatus()).isEqualTo(400);
	}

	@Test
	@DisplayName("预览过程异常：500 GENERATION_FAILED，通用文案 + requestId，ERROR 日志带真实异常")
	void generationFailed() throws Exception {
		try (ErrorJsonTests.LogCapture logs = ErrorJsonTests.LogCapture.of(ApiExceptionHandler.class)) {
			MvcResult result = perform(previewPost(Map.of("artifactId", FailingContributorConfiguration.TRIGGER))
				.header(RequestIds.HEADER, "preview-boom-01"));
			assertThat(result.getResponse().getStatus()).isEqualTo(500);
			JsonNode body = json(result);
			assertThat(body.path("code").asText()).isEqualTo("GENERATION_FAILED");
			assertThat(body.path("requestId").asText()).isEqualTo("preview-boom-01");
			assertThat(body.path("message").asText()).doesNotContain("simulated", "IllegalState");
			ILoggingEvent event = logs.single(Level.ERROR);
			assertThat(event.getFormattedMessage()).contains("GENERATION_FAILED requestId=preview-boom-01");
			assertThat(event.getThrowableProxy().getMessage()).contains("simulated template failure");
		}
	}

	@Test
	@DisplayName("生成失败时不留下 project-* 临时目录（预览 GET/POST 与 zip 都查）")
	void generationFailureLeavesNoTempDirectory() throws Exception {
		TreeSet<String> before = projectTempDirs();
		assertThat(perform(previewPost(Map.of("artifactId", FailingContributorConfiguration.TRIGGER)))
			.getResponse()
			.getStatus()).isEqualTo(500);
		assertThat(perform(get("/api/v1/preview").param("artifactId", FailingContributorConfiguration.TRIGGER))
			.getResponse()
			.getStatus()).isEqualTo(500);
		assertThat(perform(get("/starter.zip").param("artifactId", FailingContributorConfiguration.TRIGGER))
			.getResponse()
			.getStatus()).isEqualTo(500);
		TreeSet<String> leaked = projectTempDirs();
		leaked.removeAll(before);
		assertThat(leaked).as("生成失败后残留的临时目录").isEmpty();
	}

	@Test
	@DisplayName("成功预览后同样不留下临时目录")
	void successLeavesNoTempDirectory() throws Exception {
		TreeSet<String> before = projectTempDirs();
		assertThat(perform(get("/api/v1/preview").param("artifactId", "shop")).getResponse().getStatus())
			.isEqualTo(200);
		TreeSet<String> leaked = projectTempDirs();
		leaked.removeAll(before);
		assertThat(leaked).isEmpty();
	}

}
