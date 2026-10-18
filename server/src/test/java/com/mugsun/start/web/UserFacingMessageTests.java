package com.mugsun.start.web;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mugsun.testsupport.FailingContributorConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * 体验设计规则：服务端所有 message（顶层与 details[].message）都是面向用户的中文或英文书面文案，
 * 不含错误码、类名、异常文本或堆栈；5xx 一律通用文案 + requestId。
 */
@SpringBootTest
@AutoConfigureMockMvc
class UserFacingMessageTests {

	/** 错误码样式（INVALID_PARAMETER、GENERATION_FAILED……） */
	private static final Pattern CODE = Pattern.compile("\\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\\b");

	/** 类名、包名、异常与堆栈痕迹 */
	private static final Pattern TECHNICAL = Pattern.compile(
			"(Exception|Throwable|\\bError:|\\bat [\\w.$]+\\(|\\b(java|javax|jakarta|org|com|io)\\.[a-z]+\\.|"
					+ "\\$\\{|\\{\\d+\\}|\\bnull\\b|NullPointer|Caused by)");

	private static final Pattern CJK = Pattern.compile("\\p{IsHan}");

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ErrorResponses errors;

	private final ObjectMapper om = new ObjectMapper();

	/** 覆盖每一类错误出口：字段、选项、模块、请求体、404、405、415、500（生成与预览）。 */
	private List<MockHttpServletRequestBuilder> scenarios() {
		return List.of(
				get("/starter.zip").param("groupId", "1x").param("artifactId", "Bad_Name"),
				get("/starter.zip").param("packageName", "com.int.demo"),
				get("/starter.zip").param("bootVersion", "3.4.0"),
				get("/starter.zip").param("dependencies", "nope"),
				get("/starter.zip").param("artifactId", FailingContributorConfiguration.TRIGGER),
				get("/pom.xml"),
				post("/api/v1/preview").contentType(MediaType.APPLICATION_JSON).content("{\"groupId\":"),
				post("/api/v1/preview").contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"x\"}"),
				post("/api/v1/preview").contentType(MediaType.TEXT_PLAIN).content("hello"),
				post("/api/v1/preview").contentType(MediaType.APPLICATION_JSON)
					.content("{\"artifactId\":\"" + FailingContributorConfiguration.TRIGGER + "\"}"),
				get("/api/v1/no-such-endpoint"),
				delete("/api/v1/metadata"));
	}

	@ParameterizedTest(name = "{0}")
	@ValueSource(strings = { "zh", "en" })
	@DisplayName("所有错误出口的 message 与 details[].message 都是书面文案，不含错误码、类名、异常文本")
	void allMessagesUserFacing(String lang) throws Exception {
		List<String> checked = new ArrayList<>();
		for (MockHttpServletRequestBuilder s : scenarios()) {
			MvcResult r = this.mvc.perform(s.header("Accept-Language", lang)).andReturn();
			int status = r.getResponse().getStatus();
			String uri = r.getRequest().getMethod() + " " + r.getRequest().getRequestURI();
			assertThat(status).as(uri).isGreaterThanOrEqualTo(400);
			JsonNode body = this.om.readTree(r.getResponse().getContentAsString());
			assertThat(body.path("requestId").asText()).as(uri).isNotBlank();
			List<String> messages = new ArrayList<>();
			messages.add(body.path("message").asText(""));
			body.path("details").forEach((d) -> messages.add(d.path("message").asText("")));
			for (String m : messages) {
				assertUserFacing(uri + " [" + status + "]", m, lang);
				checked.add(m);
			}
			if (status >= 500) {
				String generic = this.errors.body(ErrorCode.valueOf(body.path("code").asText()), List.of(), new Object[0],
						null).get("message").toString();
				assertThat(body.path("details")).as(uri).isEmpty();
				assertThat(body.path("message").asText()).as(uri).isNotBlank();
				assertThat(generic).isNotBlank();
			}
		}
		assertThat(checked).hasSizeGreaterThan(scenarios().size());
	}

	private static void assertUserFacing(String where, String message, String lang) {
		assertThat(message).as(where).isNotBlank();
		assertThat(CODE.matcher(message).find()).as(where + " 含错误码：" + message).isFalse();
		assertThat(TECHNICAL.matcher(message).find()).as(where + " 含技术细节：" + message).isFalse();
		if ("zh".equals(lang)) {
			assertThat(CJK.matcher(message).find()).as(where + " 应为中文：" + message).isTrue();
		}
		else {
			assertThat(CJK.matcher(message).find()).as(where + " 应为英文：" + message).isFalse();
		}
	}

	@Test
	@DisplayName("文案缺失时回落到通用文案，不把错误码或 reason 机器码当 message")
	void fallbackNeverLeaksCodes() {
		for (Locale locale : new Locale[] { Locale.CHINESE, Locale.ENGLISH }) {
			LocaleContextHolder.setLocale(locale);
			try {
				var body = this.errors.body(ErrorCode.INVALID_PARAMETER,
						List.of(new FieldProblem("someField", "someNewReason")), null, "rid");
				@SuppressWarnings("unchecked")
				var details = (List<java.util.Map<String, Object>>) body.get("details");
				assertThat(details.get(0).get("message").toString()).doesNotContain("someNewReason").isNotBlank();
				assertThat(body.get("message").toString()).doesNotContain("someNewReason", "INVALID_PARAMETER");
			}
			finally {
				LocaleContextHolder.resetLocaleContext();
			}
		}
	}

}
