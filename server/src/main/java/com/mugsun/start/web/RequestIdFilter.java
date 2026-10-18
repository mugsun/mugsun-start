package com.mugsun.start.web;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 为每个请求确定 requestId：写入 MDC（日志 pattern 中的 {@code %X{requestId}}）、request attribute 和
 * 响应头 {@code X-Request-Id}。成功、失败、预检请求都带这个响应头。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String id = (String) request.getAttribute(RequestIds.ATTRIBUTE);
		if (id == null) {
			String fromClient = request.getHeader(RequestIds.HEADER);
			id = RequestIds.isAcceptable(fromClient) ? fromClient : RequestIds.ulid();
			request.setAttribute(RequestIds.ATTRIBUTE, id);
		}
		if (!response.containsHeader(RequestIds.HEADER)) {
			response.setHeader(RequestIds.HEADER, id);
		}
		String previous = MDC.get(RequestIds.MDC_KEY);
		MDC.put(RequestIds.MDC_KEY, id);
		try {
			chain.doFilter(request, response);
		}
		finally {
			if (previous != null) {
				MDC.put(RequestIds.MDC_KEY, previous);
			}
			else {
				MDC.remove(RequestIds.MDC_KEY);
			}
		}
	}

	@Override
	protected boolean shouldNotFilterErrorDispatch() {
		return false;
	}

}
