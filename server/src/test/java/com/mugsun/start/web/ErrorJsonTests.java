package com.mugsun.start.web;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mugsun.testsupport.FailingContributorConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * S3：参数校验、统一错误 JSON、requestId、CORS（契约 §4.2、§4.4）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class ErrorJsonTests {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ErrorResponses errors;

	private final ObjectMapper om = new ObjectMapper();

	private MvcResult perform(MockHttpServletRequestBuilder builder) throws Exception {
		return this.mvc.perform(builder).andReturn();
	}

	private JsonNode json(MvcResult result) throws Exception {
		return this.om.readTree(result.getResponse().getContentAsString());
	}

	private static MockHttpServletRequestBuilder zip() {
		return get("/starter.zip").param("type", "mugsun-backend");
	}

	private JsonNode expectError(MvcResult result, int status, String code) throws Exception {
		assertThat(result.getResponse().getStatus()).isEqualTo(status);
		assertThat(result.getResponse().getContentType()).startsWith("application/json");
		JsonNode body = json(result);
		assertThat(body.path("code").asText()).isEqualTo(code);
		assertThat(body.path("message").asText()).isNotBlank();
		assertThat(body.path("requestId").asText()).isEqualTo(result.getResponse().getHeader(RequestIds.HEADER));
		assertThat(body.path("timestamp").asText()).matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\+08:00");
		assertThat(body.path("details").isArray()).isTrue();
		return body;
	}

	@ParameterizedTest(name = "{0}={1} → {2}")
	@DisplayName("字段校验失败：400 INVALID_PARAMETER，details 给出 field 与 reason")
	@CsvSource(delimiter = '|', textBlock = """
			groupId     | Com.Example                                          | pattern
			groupId     | 1com.example                                         | pattern
			groupId     | ''                                                   | required
			artifactId  | Demo                                                 | pattern
			artifactId  | -demo                                                | pattern
			artifactId  | a234567890123456789012345678901234567890123456789012 | maxLength
			name        | ''                                                   | required
			packageName | com.example.Demo                                     | pattern
			packageName | com.1example                                         | pattern
			version     | 1.0 beta                                             | pattern
			baseDir     | ../evil                                              | pattern
			""")
	void invalidField(String field, String value, String reason) throws Exception {
		JsonNode body = expectError(perform(zip().param(field, value)), 400, "INVALID_PARAMETER");
		assertThat(body.path("details")).hasSize(1);
		assertThat(body.path("details").get(0).path("field").asText()).isEqualTo(field);
		assertThat(body.path("details").get(0).path("reason").asText()).isEqualTo(reason);
		assertThat(body.path("message").asText()).isEqualTo(body.path("details").get(0).path("message").asText());
	}

	@Test
	@DisplayName("description 超过 200 个字符")
	void descriptionTooLong() throws Exception {
		JsonNode body = expectError(perform(zip().param("description", "描".repeat(201))), 400, "INVALID_PARAMETER");
		assertThat(body.path("details").get(0).path("reason").asText()).isEqualTo("maxLength");
	}

	@Test
	@DisplayName("多个字段同时出错时逐项列出")
	void multipleFields() throws Exception {
		JsonNode body = expectError(perform(zip().param("groupId", "1x").param("artifactId", "X")), 400,
				"INVALID_PARAMETER");
		assertThat(body.path("details")).hasSize(2);
		assertThat(body.path("message").asText()).isEqualTo("请求参数不符合要求，请检查标出的字段。");
	}

	@ParameterizedTest(name = "packageName={0}")
	@DisplayName("包名任一段为 Java 关键字或 true/false/null：400，field=packageName，reason=keyword")
	@ValueSource(strings = { "com.example.class", "com.int.demo", "package.demo", "com.example.true",
			"com.false.demo", "com.example.null", "com.example._", "com.goto.demo", "com.example.enum" })
	void packageKeyword(String packageName) throws Exception {
		JsonNode body = expectError(perform(zip().param("packageName", packageName)), 400, "INVALID_PARAMETER");
		JsonNode detail = body.path("details").get(0);
		assertThat(detail.path("field").asText()).isEqualTo("packageName");
		assertThat(detail.path("reason").asText()).isEqualTo("keyword");
	}

	@Test
	@DisplayName("/pom.xml 等只生成构建文件的接口一期不支持：400 UNSUPPORTED_OPTION（type=maven-build）")
	void buildOnlyEndpointsUnsupported() throws Exception {
		JsonNode body = expectError(perform(get("/pom.xml")), 400, "UNSUPPORTED_OPTION");
		assertThat(body.path("details").get(0).path("field").asText()).isEqualTo("type");
	}

	@Test
	@DisplayName("未传 packageName 时，由 groupId.artifactId 推导出的包名同样不能含关键字")
	void derivedPackageKeyword() throws Exception {
		JsonNode body = expectError(perform(zip().param("groupId", "com.example").param("artifactId", "new")
			.param("packageName", "")), 400, "INVALID_PARAMETER");
		assertThat(body.path("details").get(0).path("field").asText()).isEqualTo("packageName");
	}

	@ParameterizedTest(name = "packageName={0}")
	@DisplayName("上下文关键字（var、record 等）不是保留字，可以用")
	@ValueSource(strings = { "com.example.record", "com.var.demo", "com.example.module", "com.example.truex" })
	void contextualKeywordsAllowed(String packageName) throws Exception {
		assertThat(perform(zip().param("packageName", packageName)).getResponse().getStatus()).isEqualTo(200);
	}

	@ParameterizedTest(name = "{0}={1}")
	@DisplayName("可选参数传了非默认值：400 UNSUPPORTED_OPTION")
	@CsvSource(delimiter = '|', textBlock = """
			type                    | gradle-project
			language                | kotlin
			configurationFileFormat | properties
			bootVersion             | 3.4.0
			javaVersion             | 17
			packaging               | war
			database                | mysql
			""")
	void unsupportedOption(String field, String value) throws Exception {
		JsonNode body = expectError(perform(get("/starter.zip").param(field, value)), 400, "UNSUPPORTED_OPTION");
		assertThat(body.path("details").get(0).path("field").asText()).isEqualTo(field);
		assertThat(body.path("details").get(0).path("reason").asText()).isEqualTo("unsupported");
		assertThat(body.path("message").asText()).contains(value);
	}

	@Test
	@DisplayName("可选参数传默认值或不传都可以；version 缺省为 0.0.1-SNAPSHOT")
	void defaultsAccepted() throws Exception {
		MvcResult ok = perform(zip().param("language", "java").param("configurationFileFormat", "yaml")
			.param("bootVersion", "3.5.13").param("javaVersion", "21").param("packaging", "jar")
			.param("database", "postgresql"));
		assertThat(ok.getResponse().getStatus()).isEqualTo(200);
		assertThat(pom(ok)).contains("<version>0.0.1-SNAPSHOT</version>");
	}

	@Test
	@DisplayName("未知模块：400 UNKNOWN_DEPENDENCY")
	void unknownDependency() throws Exception {
		JsonNode body = expectError(perform(zip().param("dependencies", "gis,web")), 400, "UNKNOWN_DEPENDENCY");
		assertThat(body.path("details").get(0).path("field").asText()).isEqualTo("dependencies");
		assertThat(body.path("details").get(0).path("reason").asText()).isEqualTo("unknown");
		assertThat(body.path("message").asText()).contains("web");
	}

	private static String pom(MvcResult zip) throws Exception {
		try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip.getResponse().getContentAsByteArray()))) {
			for (ZipEntry e = in.getNextEntry(); e != null; e = in.getNextEntry()) {
				if (e.getName().equals("demo/pom.xml")) {
					return new String(in.readAllBytes(), StandardCharsets.UTF_8);
				}
			}
		}
		throw new AssertionError("zip 中没有 pom.xml");
	}

	@Test
	@DisplayName("baseDir 缺省为 artifactId")
	void baseDirDefaultsToArtifactId() throws Exception {
		MvcResult result = perform(zip().param("artifactId", "shop-admin").param("packageName", "com.example.shop"));
		assertThat(result.getResponse().getHeader("Content-Disposition")).contains("shop-admin.zip");
		try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(result.getResponse().getContentAsByteArray()))) {
			assertThat(in.getNextEntry().getName()).startsWith("shop-admin/");
		}
	}

	@Test
	@DisplayName("常驻模块 id 传了会被忽略，可选模块照常生效")
	void alwaysOnIgnored() throws Exception {
		MvcResult result = perform(zip().param("dependencies", "core-system,core-workflow,gis"));
		assertThat(result.getResponse().getStatus()).isEqualTo(200);
		assertThat(pom(result)).contains("<artifactId>mugsun-boot-gis</artifactId>").doesNotContain("mugsun-boot-core");
	}

	@Test
	@DisplayName("message 按 Accept-Language 本地化，缺省中文")
	void localized() throws Exception {
		JsonNode en = expectError(perform(zip().param("groupId", "1x").header(HttpHeaders.ACCEPT_LANGUAGE, "en-US")),
				400, "INVALID_PARAMETER");
		assertThat(en.path("message").asText()).startsWith("The group can only contain");
		JsonNode zh = expectError(perform(zip().param("groupId", "1x").header(HttpHeaders.ACCEPT_LANGUAGE, "zh-CN")),
				400, "INVALID_PARAMETER");
		assertThat(zh.path("message").asText()).startsWith("Group 只能包含");
		JsonNode none = expectError(perform(zip().param("groupId", "1x")), 400, "INVALID_PARAMETER");
		assertThat(none.path("message").asText()).isEqualTo(zh.path("message").asText());
	}

	@Test
	@DisplayName("POST 表单与 GET 同一套校验")
	void postForm() throws Exception {
		expectError(perform(post("/starter.zip").param("type", "mugsun-backend").param("artifactId", "Bad")), 400,
				"INVALID_PARAMETER");
	}

	@Test
	@DisplayName("X-Request-Id：合法的客户端值原样回写，非法或缺省时生成 ULID")
	void requestIdHeader() throws Exception {
		String client = "web-1234abcd";
		MvcResult echoed = perform(get("/api/v1/metadata").header(RequestIds.HEADER, client));
		assertThat(echoed.getResponse().getHeader(RequestIds.HEADER)).isEqualTo(client);
		MvcResult generated = perform(get("/api/v1/metadata"));
		assertThat(generated.getResponse().getHeader(RequestIds.HEADER)).matches("[0-9A-HJKMNP-TV-Z]{26}");
		MvcResult replaced = perform(get("/api/v1/metadata").header(RequestIds.HEADER, "bad id<script>"));
		assertThat(replaced.getResponse().getHeader(RequestIds.HEADER)).matches("[0-9A-HJKMNP-TV-Z]{26}");
		MvcResult error = perform(zip().param("groupId", "1x").header(RequestIds.HEADER, client));
		assertThat(json(error).path("requestId").asText()).isEqualTo(client);
	}

	@Test
	@DisplayName("生成过程异常：500 GENERATION_FAILED，服务端 ERROR 日志带同一个 requestId")
	void generationFailed(CapturedOutput output) throws Exception {
		MvcResult result = perform(zip().param("artifactId", FailingContributorConfiguration.TRIGGER)
			.header(RequestIds.HEADER, "boom-req-0001"));
		expectError(result, 500, "GENERATION_FAILED");
		assertThat(output.getOut()).contains("ERROR [boom-req-0001]")
			.contains("GENERATION_FAILED requestId=boom-req-0001")
			.contains("artifactId=boom-fail")
			.contains("simulated template failure");
	}

	@Test
	@DisplayName("参数被拒绝时 INFO 日志也带 requestId（MDC）")
	void rejectedRequestLogged(CapturedOutput output) throws Exception {
		perform(zip().param("groupId", "1x").header(RequestIds.HEADER, "reject-req-01"));
		assertThat(output.getOut()).contains("[reject-req-01]").contains("生成请求被拒绝：INVALID_PARAMETER");
	}

	@Test
	@DisplayName("不存在的地址：404 NOT_FOUND，同样是统一错误体")
	void notFound() throws Exception {
		expectError(perform(get("/api/v1/nope")), 404, "NOT_FOUND");
	}

	@Test
	@DisplayName("Retry-After 只用整数秒")
	void retryAfterSeconds() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setAttribute(RequestIds.ATTRIBUTE, "rate-req-001");
		ResponseEntity<Object> limited = this.errors.entity(request, MugsunRequestException.rateLimited(30));
		assertThat(limited.getStatusCode().value()).isEqualTo(429);
		assertThat(limited.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("30");
		ResponseEntity<Object> min = this.errors.entity(request, MugsunRequestException.rateLimited(0));
		assertThat(min.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("1");
	}

	@Test
	@DisplayName("CORS：允许的来源可读取 Content-Disposition、X-Request-Id、Retry-After")
	void cors() throws Exception {
		MvcResult preflight = perform(options("/starter.zip").header(HttpHeaders.ORIGIN, "http://localhost:5173")
			.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"));
		assertThat(preflight.getResponse().getStatus()).isEqualTo(200);
		assertThat(preflight.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN))
			.isEqualTo("http://localhost:5173");
		MvcResult actual = perform(zip().header(HttpHeaders.ORIGIN, "https://start.mugsun.com"));
		assertThat(actual.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS))
			.contains("Content-Disposition", "X-Request-Id", "Retry-After");
		MvcResult denied = perform(zip().header(HttpHeaders.ORIGIN, "https://evil.example"));
		assertThat(denied.getResponse().getStatus()).isEqualTo(403);
	}

}
