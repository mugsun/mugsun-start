package com.mugsun.start.web;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 替换 Spring Boot 的 {@code BasicErrorController}：{@code /error} 以及 Tomcat 在进入 Spring MVC 之前就拒绝的请求
 * （例如请求行里有非法字符的 400）也返回统一错误体（契约 §4.4），带 {@code X-Request-Id}，Content-Type 带 charset。
 * <p>ERROR 分派时如果 {@link RequestIdFilter} 没跑过（Tomcat 直接转发到错误页），这里补一个 requestId。
 * 只处理状态码，不暴露异常信息；5xx 的真实异常写 ERROR 日志。
 */
@RestController
@RequestMapping("${server.error.path:${error.path:/error}}")
public class MugsunErrorController implements ErrorController {

	private static final Logger log = LoggerFactory.getLogger(MugsunErrorController.class);

	private final ErrorResponses errors;

	public MugsunErrorController(ErrorResponses errors) {
		this.errors = errors;
	}

	@RequestMapping
	public ResponseEntity<Object> error(HttpServletRequest request, HttpServletResponse response) {
		String id = ErrorResponses.requestId(request);
		if (id == null) {
			id = RequestIds.ulid();
			request.setAttribute(RequestIds.ATTRIBUTE, id);
		}
		if (!response.containsHeader(RequestIds.HEADER)) {
			response.setHeader(RequestIds.HEADER, id);
		}
		int status = status(request);
		if (status >= 500) {
			Object ex = request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);
			log.error("INTERNAL_ERROR requestId={} {}", id, request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI),
					(ex instanceof Throwable t) ? t : null);
		}
		else {
			log.info("错误页 requestId={} status={} uri={}", id, status,
					request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI));
		}
		return this.errors.forStatus(request, status);
	}

	/** 直接访问 /error（没有错误属性）按 404 处理：与访问任何不存在的地址一致。 */
	private static int status(HttpServletRequest request) {
		Object code = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
		if (code instanceof Integer i && i >= 400 && i <= 599) {
			return i;
		}
		return 404;
	}

}
