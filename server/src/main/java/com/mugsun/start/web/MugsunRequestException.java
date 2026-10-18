package com.mugsun.start.web;

import java.util.List;

import io.spring.initializr.web.project.InvalidProjectRequestException;

/**
 * 带错误码的请求异常。继承 initializr 的 {@link InvalidProjectRequestException}，
 * 因而在生成接口里由 {@code invalidProjectRequest} 处理，在其他接口里由 {@link ApiExceptionHandler} 处理。
 */
public class MugsunRequestException extends InvalidProjectRequestException {

	private final ErrorCode code;

	private final List<FieldProblem> problems;

	private final Long retryAfterSeconds;

	public MugsunRequestException(ErrorCode code, List<FieldProblem> problems) {
		this(code, problems, null);
	}

	private MugsunRequestException(ErrorCode code, List<FieldProblem> problems, Long retryAfterSeconds) {
		super(code.name() + " " + problems);
		this.code = code;
		this.problems = List.copyOf(problems);
		this.retryAfterSeconds = retryAfterSeconds;
	}

	/** 限流：{@code Retry-After} 只用整数秒。 */
	public static MugsunRequestException rateLimited(long retryAfterSeconds) {
		return new MugsunRequestException(ErrorCode.RATE_LIMITED, List.of(), Math.max(1, retryAfterSeconds));
	}

	public ErrorCode code() {
		return this.code;
	}

	public List<FieldProblem> problems() {
		return this.problems;
	}

	public Long retryAfterSeconds() {
		return this.retryAfterSeconds;
	}

}
