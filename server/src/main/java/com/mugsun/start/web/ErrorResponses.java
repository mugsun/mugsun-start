package com.mugsun.start.web;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

/**
 * 统一错误体 {@code {code, message, requestId, timestamp, details[{field, reason, message}]}}（契约 §4.4）。
 * message 按 {@code Accept-Language} 本地化（zh/en，缺省 zh）。顶层与 details[].message 都是面向用户的书面文案，
 * 不含错误码、类名、异常文本或堆栈；文案缺失时回落到通用文案，而不是错误码或 reason。
 */
@Component
public class ErrorResponses {

	static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

	private final MessageSource messages;

	private final ObjectMapper mapper;

	public ErrorResponses(MessageSource messages, ObjectMapper mapper) {
		this.messages = messages;
		this.mapper = mapper;
	}

	public Map<String, Object> body(ErrorCode code, List<FieldProblem> problems, Object[] args, String requestId) {
		Locale locale = LocaleContextHolder.getLocale();
		List<Map<String, Object>> details = problems.stream().map((p) -> detail(p, locale)).toList();
		String message;
		if (code == ErrorCode.INVALID_PARAMETER && details.size() == 1) {
			message = (String) details.get(0).get("message");
		}
		else {
			Object[] messageArgs = (args != null) ? args : new Object[] { joined(problems) };
			message = this.messages.getMessage("error." + code.name(), messageArgs, null, locale);
			if (message == null) {
				// 文案缺失时绝不回落成错误码：用通用文案（4xx 用「请求参数不正确」，5xx 用「服务暂时出现问题」）
				message = this.messages.getMessage(code.status().is5xxServerError() ? "error.INTERNAL_ERROR"
						: "detail.invalid", null, locale);
			}
		}
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("code", code.name());
		body.put("message", message);
		body.put("requestId", requestId);
		body.put("timestamp",
				OffsetDateTime.now(ZONE).truncatedTo(ChronoUnit.SECONDS).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
		body.put("details", details);
		return body;
	}

	public ResponseEntity<Object> entity(HttpServletRequest request, MugsunRequestException ex) {
		return entity(request, ex.code(), ex.problems(), retryArgs(ex), ex.retryAfterSeconds());
	}

	public ResponseEntity<Object> entity(HttpServletRequest request, ErrorCode code, List<FieldProblem> problems,
			Object[] args, Long retryAfterSeconds) {
		ResponseEntity.BodyBuilder builder = ResponseEntity.status(code.status())
			.contentType(MediaType.APPLICATION_JSON);
		if (retryAfterSeconds != null) {
			builder.header(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
		}
		return builder.body(body(code, problems, args, requestId(request)));
	}

	/** 生成接口里 initializr 的异常处理方法直接写 servlet 响应，用这个方法。 */
	public void write(HttpServletRequest request, HttpServletResponse response, MugsunRequestException ex)
			throws IOException {
		response.resetBuffer();
		response.setStatus(ex.code().status().value());
		response.setContentType("application/json;charset=UTF-8");
		if (ex.retryAfterSeconds() != null) {
			response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(ex.retryAfterSeconds()));
		}
		this.mapper.writeValue(response.getOutputStream(), body(ex.code(), ex.problems(), retryArgs(ex),
				requestId(request)));
	}

	public static String requestId(HttpServletRequest request) {
		Object id = (request != null) ? request.getAttribute(RequestIds.ATTRIBUTE) : null;
		return (id != null) ? id.toString() : null;
	}

	private static Object[] retryArgs(MugsunRequestException ex) {
		return (ex.retryAfterSeconds() != null) ? new Object[] { ex.retryAfterSeconds().toString() } : null;
	}

	private Map<String, Object> detail(FieldProblem p, Locale locale) {
		String specific = "detail." + p.field() + "." + p.reason();
		String generic = "detail." + p.reason();
		String message = this.messages.getMessage(specific, p.args(), null, locale);
		if (message == null) {
			message = this.messages.getMessage(generic, p.args(), null, locale);
		}
		if (message == null) {
			// 未知 reason 也不把机器码当文案下发
			message = this.messages.getMessage("detail.invalid", null, locale);
		}
		Map<String, Object> d = new LinkedHashMap<>();
		d.put("field", p.field());
		d.put("reason", p.reason());
		d.put("message", message);
		return d;
	}

	private static String joined(List<FieldProblem> problems) {
		return String.join(", ", problems.stream()
			.map((p) -> (p.args() != null && p.args().length > 0) ? String.valueOf(p.args()[0]) : p.field())
			.distinct()
			.toList());
	}

}
