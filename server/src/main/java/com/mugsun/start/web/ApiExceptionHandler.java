package com.mugsun.start.web;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 生成接口以外（以及生成过程中的非参数异常）的统一错误处理。
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

	private final ErrorResponses errors;

	public ApiExceptionHandler(ErrorResponses errors) {
		this.errors = errors;
	}

	@ExceptionHandler(MugsunRequestException.class)
	public ResponseEntity<Object> mugsun(HttpServletRequest request, MugsunRequestException ex) {
		return this.errors.entity(request, ex);
	}

	/**
	 * JSON 请求体无法解析（格式错误、字段类型不对）：400 INVALID_PARAMETER。异常文本只进日志，不进 message。
	 */
	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<Object> unreadable(HttpServletRequest request, HttpMessageNotReadableException ex) {
		log.info("请求体无法解析 requestId={} {} {}：{}", ErrorResponses.requestId(request), request.getMethod(),
				request.getRequestURI(), ex.getMostSpecificCause().toString());
		return this.errors.entity(request, ErrorCode.INVALID_PARAMETER,
				List.of(new FieldProblem("body", "invalid")), null, null);
	}

	private ResponseEntity<Object> framework(HttpServletRequest request, ErrorResponse ex) {
		int status = ex.getStatusCode().value();
		if (status >= 500) {
			// 5xx 一律通用文案 + requestId；真实异常只写日志
			log.error("INTERNAL_ERROR requestId={} {} {}", ErrorResponses.requestId(request), request.getMethod(),
					request.getRequestURI(), (Throwable) ex);
		}
		ErrorCode code = switch (status) {
			case 404 -> ErrorCode.NOT_FOUND;
			case 405 -> ErrorCode.METHOD_NOT_ALLOWED;
			default -> (status >= 500) ? ErrorCode.INTERNAL_ERROR : ErrorCode.INVALID_PARAMETER;
		};
		if (code == ErrorCode.INVALID_PARAMETER) {
			return ResponseEntity.status(status)
				.contentType(MediaType.APPLICATION_JSON)
				.body(this.errors.body(code, List.of(new FieldProblem("request", "invalid")), null,
						ErrorResponses.requestId(request)));
		}
		return ResponseEntity.status(status)
			.contentType(MediaType.APPLICATION_JSON)
			.body(this.errors.body(code, List.of(), new Object[0], ErrorResponses.requestId(request)));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<Object> unexpected(HttpServletRequest request, Exception ex) {
		// Spring MVC 自身的 4xx/5xx（404、405、参数类型不匹配等）实现了 ErrorResponse
		if (ex instanceof ErrorResponse framework) {
			return framework(request, framework);
		}
		boolean generation = isGeneration(request.getRequestURI());
		ErrorCode code = generation ? ErrorCode.GENERATION_FAILED : ErrorCode.INTERNAL_ERROR;
		log.error("{} requestId={} {} {} params={}", code, ErrorResponses.requestId(request), request.getMethod(),
				request.getRequestURI(), params(request), ex);
		return this.errors.entity(request, code, List.of(), new Object[0], null);
	}

	static boolean isGeneration(String uri) {
		return uri != null && (uri.startsWith("/starter.") || uri.equals("/pom.xml") || uri.equals("/build.gradle")
				|| uri.startsWith("/api/v1/preview"));
	}

	private static Map<String, String> params(HttpServletRequest request) {
		Map<String, String> params = new TreeMap<>();
		request.getParameterMap().forEach((k, v) -> params.put(k, String.join(",", v)));
		return params;
	}

}
