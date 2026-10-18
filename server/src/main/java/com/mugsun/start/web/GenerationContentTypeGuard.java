package com.mugsun.start.web;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpMethod;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * {@code POST /starter.zip}（以及 {@code .tgz}）只接受表单参数，与 initializr 一致。
 * <p>initializr 的生成接口按 query/表单绑定参数，JSON 请求体会被静默忽略，结果是按默认值生成了一个「demo」工程。
 * 这里对带请求体、但不是表单的 POST 明确返回 415 {@code UNSUPPORTED_MEDIA_TYPE}；JSON 请走 {@code POST /api/v1/preview}，
 * 或把参数放进 query / 表单。
 */
public class GenerationContentTypeGuard implements HandlerInterceptor {

	static final List<MediaType> SUPPORTED = List.of(MediaType.APPLICATION_FORM_URLENCODED);

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
			throws HttpMediaTypeNotSupportedException {
		if (!HttpMethod.POST.matches(request.getMethod())) {
			return true;
		}
		String raw = request.getContentType();
		if (raw == null || raw.isBlank()) {
			// 没有请求体（参数都在 query 里）照常生成
			return true;
		}
		MediaType type;
		try {
			type = MediaType.parseMediaType(raw);
		}
		catch (InvalidMediaTypeException ex) {
			throw new HttpMediaTypeNotSupportedException(raw);
		}
		if (MediaType.APPLICATION_FORM_URLENCODED.includes(type) || MediaType.MULTIPART_FORM_DATA.includes(type)) {
			return true;
		}
		throw new HttpMediaTypeNotSupportedException(type, SUPPORTED, HttpMethod.POST);
	}

}
