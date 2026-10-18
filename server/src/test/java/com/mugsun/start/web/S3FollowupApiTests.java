package com.mugsun.start.web;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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
 * #4 的后续：/error、406/415 各自的错误码、错误体 charset、推导包名的连字符、baseDir 缺省值、POST JSON 到 /starter.zip。
 */
@SpringBootTest
@AutoConfigureMockMvc
class S3FollowupApiTests {

	@Autowired
	private MockMvc mvc;

	private final ObjectMapper om = new ObjectMapper();

	private MvcResult perform(MockHttpServletRequestBuilder builder) throws Exception {
		return this.mvc.perform(builder).andReturn();
	}

	private JsonNode json(MvcResult r) throws Exception {
		return this.om.readTree(r.getResponse().getContentAsString());
	}

	private static List<String> entries(MvcResult zip) throws Exception {
		List<String> names = new ArrayList<>();
		try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip.getResponse().getContentAsByteArray()))) {
			for (ZipEntry e = in.getNextEntry(); e != null; e = in.getNextEntry()) {
				names.add(e.getName());
			}
		}
		return names;
	}

	private static void assertJsonUtf8(MvcResult r) {
		assertThat(MediaType.parseMediaType(r.getResponse().getContentType()))
			.isEqualTo(ErrorResponses.JSON_UTF8);
	}

	@Test
	@DisplayName("/error：直接访问也返回统一错误体（NOT_FOUND）、带 X-Request-Id 与 charset")
	void errorEndpoint() throws Exception {
		MvcResult r = perform(get("/error"));
		assertThat(r.getResponse().getStatus()).isEqualTo(404);
		assertJsonUtf8(r);
		JsonNode body = json(r);
		assertThat(body.path("code").asText()).isEqualTo("NOT_FOUND");
		assertThat(body.path("requestId").asText()).isNotBlank()
			.isEqualTo(r.getResponse().getHeader(RequestIds.HEADER));
	}

	@Test
	@DisplayName("/error 按 ERROR 分派的状态码返回：400 → INVALID_PARAMETER，500 → INTERNAL_ERROR 通用文案")
	void errorDispatchStatus() throws Exception {
		MvcResult bad = perform(get("/error").requestAttr(jakarta.servlet.RequestDispatcher.ERROR_STATUS_CODE, 400));
		assertThat(bad.getResponse().getStatus()).isEqualTo(400);
		assertThat(json(bad).path("code").asText()).isEqualTo("INVALID_PARAMETER");
		assertThat(json(bad).path("details").get(0).path("field").asText()).isEqualTo("request");
		MvcResult boom = perform(get("/error").requestAttr(jakarta.servlet.RequestDispatcher.ERROR_STATUS_CODE, 500)
			.requestAttr(jakarta.servlet.RequestDispatcher.ERROR_EXCEPTION, new IllegalStateException("secret")));
		assertThat(boom.getResponse().getStatus()).isEqualTo(500);
		assertThat(json(boom).path("code").asText()).isEqualTo("INTERNAL_ERROR");
		assertThat(boom.getResponse().getContentAsString()).doesNotContain("secret", "IllegalState");
	}

	@Test
	@DisplayName("406 与 415 各用自己的错误码")
	void notAcceptableAndUnsupportedMediaType() throws Exception {
		MvcResult notAcceptable = perform(get("/api/v1/metadata").accept(MediaType.TEXT_PLAIN));
		assertThat(notAcceptable.getResponse().getStatus()).isEqualTo(406);
		assertJsonUtf8(notAcceptable);
		assertThat(json(notAcceptable).path("code").asText()).isEqualTo("NOT_ACCEPTABLE");
		assertThat(json(notAcceptable).path("details")).isEmpty();

		MvcResult unsupported = perform(post("/api/v1/preview").contentType(MediaType.TEXT_PLAIN).content("x"));
		assertThat(unsupported.getResponse().getStatus()).isEqualTo(415);
		assertJsonUtf8(unsupported);
		assertThat(json(unsupported).path("code").asText()).isEqualTo("UNSUPPORTED_MEDIA_TYPE");
	}

	@Test
	@DisplayName("错误体 Content-Type 带 charset=UTF-8（字段错误、404、生成接口的参数错误）")
	void errorCharset() throws Exception {
		assertJsonUtf8(perform(get("/api/v1/preview").param("artifactId", "Bad Artifact")));
		assertJsonUtf8(perform(get("/no-such-path")));
		assertJsonUtf8(perform(get("/starter.zip").param("artifactId", "Bad Artifact")));
	}

	@Test
	@DisplayName("推导包名：连字符换成 _（shop-admin → shop_admin）；in-t 不再被误判为关键字 int")
	void derivedPackageName() throws Exception {
		MvcResult shopAdmin = perform(get("/starter.zip").param("artifactId", "shop-admin"));
		assertThat(shopAdmin.getResponse().getStatus()).isEqualTo(200);
		assertThat(entries(shopAdmin)).anyMatch((n) -> n.contains("/src/main/java/com/example/shop_admin/"));

		MvcResult inT = perform(get("/starter.zip").param("artifactId", "in-t"));
		assertThat(inT.getResponse().getStatus()).isEqualTo(200);
		assertThat(entries(inT)).anyMatch((n) -> n.contains("/src/main/java/com/example/in_t/"));

		MvcResult preview = perform(get("/api/v1/preview").param("artifactId", "in-t"));
		assertThat(preview.getResponse().getStatus()).isEqualTo(200);

		// 推导结果本身是关键字时仍然拒绝
		MvcResult keyword = perform(get("/starter.zip").param("artifactId", "int"));
		assertThat(keyword.getResponse().getStatus()).isEqualTo(400);
		assertThat(json(keyword).path("details").get(0).path("reason").asText()).isEqualTo("keyword");
	}

	@Test
	@DisplayName("baseDir 未传或空白：zip 根目录与预览 root 都是 artifactId")
	void baseDirFallsBackToArtifactId() throws Exception {
		for (String baseDir : new String[] { null, "", "   " }) {
			MockHttpServletRequestBuilder zipReq = get("/starter.zip").param("artifactId", "shop");
			MockHttpServletRequestBuilder previewReq = get("/api/v1/preview").param("artifactId", "shop");
			if (baseDir != null) {
				zipReq.param("baseDir", baseDir);
				previewReq.param("baseDir", baseDir);
			}
			MvcResult zip = perform(zipReq);
			assertThat(zip.getResponse().getStatus()).as("baseDir=[%s]", baseDir).isEqualTo(200);
			assertThat(entries(zip)).allMatch((n) -> n.startsWith("shop/"));
			JsonNode p = json(perform(previewReq));
			assertThat(p.path("root").isTextual()).isTrue();
			assertThat(p.path("root").asText()).isEqualTo("shop");
		}
		JsonNode post = json(perform(post("/api/v1/preview").contentType(MediaType.APPLICATION_JSON)
			.content("{\"artifactId\":\"shop\",\"baseDir\":\" \"}")));
		assertThat(post.path("root").asText()).isEqualTo("shop");
	}

	@Test
	@DisplayName("POST JSON 到 /starter.zip：415 UNSUPPORTED_MEDIA_TYPE，不再静默生成默认工程；表单与 query 照常")
	void postJsonToStarterZipRejected() throws Exception {
		MvcResult json = perform(post("/starter.zip").contentType(MediaType.APPLICATION_JSON)
			.content("{\"artifactId\":\"shop\"}"));
		assertThat(json.getResponse().getStatus()).isEqualTo(415);
		assertJsonUtf8(json);
		assertThat(json(json).path("code").asText()).isEqualTo("UNSUPPORTED_MEDIA_TYPE");
		assertThat(json.getResponse().getHeader(RequestIds.HEADER)).isNotBlank();

		MvcResult form = perform(post("/starter.zip").contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.content("artifactId=shop"));
		assertThat(form.getResponse().getStatus()).isEqualTo(200);
		assertThat(entries(form)).allMatch((n) -> n.startsWith("shop/"));

		MvcResult query = perform(post("/starter.zip").param("artifactId", "shop"));
		assertThat(query.getResponse().getStatus()).isEqualTo(200);
	}

}
