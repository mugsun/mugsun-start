package com.mugsun.start.web;

import org.springframework.http.HttpStatus;

/**
 * 统一错误码（契约 §4.4）。
 */
public enum ErrorCode {

	INVALID_PARAMETER(HttpStatus.BAD_REQUEST),

	UNKNOWN_DEPENDENCY(HttpStatus.BAD_REQUEST),

	UNSUPPORTED_OPTION(HttpStatus.BAD_REQUEST),

	DEPENDENCY_NOT_APPLICABLE(HttpStatus.BAD_REQUEST),

	DEPENDENCY_CONFLICT(HttpStatus.CONFLICT),

	DEPENDENCY_REQUIRES(HttpStatus.CONFLICT),

	NOT_FOUND(HttpStatus.NOT_FOUND),

	METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED),

	RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS),

	GENERATION_FAILED(HttpStatus.INTERNAL_SERVER_ERROR),

	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR),

	TEMPLATE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE);

	private final HttpStatus status;

	ErrorCode(HttpStatus status) {
		this.status = status;
	}

	public HttpStatus status() {
		return this.status;
	}

}
