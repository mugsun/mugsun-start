package com.mugsun.start.web;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.catalina.Container;
import org.apache.catalina.Context;
import org.apache.catalina.Lifecycle;
import org.apache.catalina.Valve;
import org.apache.catalina.connector.Request;
import org.apache.catalina.connector.Response;
import org.apache.catalina.valves.ErrorReportValve;
import org.apache.coyote.ActionCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpHeaders;

/**
 * Tomcat 在进入应用之前就拒绝的请求（请求行或请求头解析失败，例如 URL 里有非法字符的 400）不会转到 {@code /error}，
 * 而是由 Host 上的 {@link ErrorReportValve} 直接写一页 HTML。这里把它换成写统一错误 JSON（契约 §4.4）的 valve，
 * 带 {@code X-Request-Id}，Content-Type 带 charset。应用内的错误仍由 {@link MugsunErrorController} 处理（那时响应已有内容，
 * 本 valve 不再改写）。
 */
@Configuration(proxyBeanMethods = false)
public class TomcatErrorJsonConfiguration {

	@Bean
	public WebServerFactoryCustomizer<TomcatServletWebServerFactory> jsonErrorReportValveCustomizer(
			ObjectProvider<ErrorResponses> errors, ObjectMapper mapper) {
		return (factory) -> factory.addContextCustomizers((context) -> context.addLifecycleListener((event) -> {
			if (Lifecycle.BEFORE_START_EVENT.equals(event.getType())) {
				replaceErrorReportValve(context, new JsonErrorReportValve(errors, mapper));
			}
		}));
	}

	/** Host 启动时先装好 ErrorReportValve 再启动子容器，所以在 Context 启动前替换。 */
	static void replaceErrorReportValve(Context context, JsonErrorReportValve replacement) {
		Container host = context.getParent();
		if (host == null) {
			return;
		}
		for (Valve valve : host.getPipeline().getValves()) {
			if (valve instanceof JsonErrorReportValve) {
				return;
			}
			if (valve instanceof ErrorReportValve) {
				host.getPipeline().removeValve(valve);
			}
		}
		host.getPipeline().addValve(replacement);
	}

	static class JsonErrorReportValve extends ErrorReportValve {

		private static final Logger log = LoggerFactory.getLogger(JsonErrorReportValve.class);

		private final ObjectProvider<ErrorResponses> errors;

		private final ObjectMapper mapper;

		JsonErrorReportValve(ObjectProvider<ErrorResponses> errors, ObjectMapper mapper) {
			this.errors = errors;
			this.mapper = mapper;
			setShowReport(false);
			setShowServerInfo(false);
		}

		@Override
		protected void report(Request request, Response response, Throwable throwable) {
			int status = response.getStatus();
			if (status < 400 || response.getContentWritten() > 0 || !response.setErrorReported()) {
				return;
			}
			AtomicBoolean ioAllowed = new AtomicBoolean(false);
			response.getCoyoteResponse().action(ActionCode.IS_IO_ALLOWED, ioAllowed);
			if (!ioAllowed.get()) {
				return;
			}
			ErrorResponses responses = this.errors.getIfAvailable();
			if (responses == null) {
				super.report(request, response, throwable);
				return;
			}
			Object existing = request.getAttribute(RequestIds.ATTRIBUTE);
			String id = (existing != null) ? existing.toString() : RequestIds.ulid();
			Locale previous = LocaleContextHolder.getLocale();
			try {
				LocaleContextHolder.setLocale(request.getLocale());
				request.setAttribute(RequestIds.ATTRIBUTE, id);
				ErrorCode code = ErrorResponses.codeFor(status);
				Long retry = ErrorResponses.retryAfter(code, null);
				Object[] args = (code == ErrorCode.INVALID_PARAMETER) ? null
						: (retry != null) ? new Object[] { retry.toString() } : new Object[0];
				Map<String, Object> body = responses.body(code,
						(code == ErrorCode.INVALID_PARAMETER) ? List.of(new FieldProblem("request", "invalid")) : List.of(),
						args, id);
				if (retry != null) {
					response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retry));
				}
				byte[] bytes = this.mapper.writeValueAsBytes(body);
				response.setContentType(ErrorResponses.JSON_UTF8.toString());
				response.setHeader(RequestIds.HEADER, id);
				response.setContentLength(bytes.length);
				OutputStream out = response.getOutputStream();
				out.write(bytes);
				response.finishResponse();
				log.info("Tomcat 层拒绝请求 requestId={} status={}", id, status);
			}
			catch (IOException | IllegalStateException ex) {
				log.debug("写错误 JSON 失败 requestId={}", id, ex);
			}
			finally {
				LocaleContextHolder.setLocale(previous);
			}
		}

	}

}
